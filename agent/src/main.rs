mod activity;
mod config;
mod errors;
mod health;
mod identity;
mod presence;
mod screenshots;
mod storage;
mod supabase;
mod windows;

use activity::ActivityBatcher;
use config::AgentConfig;
use errors::AgentResult;
use health::HealthMonitor;
use identity::DeviceIdentity;
use presence::{PresenceStateMachine, PresenceStatus};
use screenshots::ScreenCaptureService;
use storage::LocalStorage;
use supabase::models::{PresenceUpsertPayload, ScreenshotRecordPayload};
use supabase::SupabaseClient;
use windows::WindowsInputTracker;

use chrono::Utc;
use std::time::Duration;
use tokio::time::{interval, Instant};

#[tokio::main]
async fn main() -> AgentResult<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,employee_windows_agent=debug".into()),
        )
        .init();

    tracing::info!("=========================================================");
    tracing::info!("Starting Windows Native Employee Monitoring Agent (Rust)");
    tracing::info!("=========================================================");

    let config = AgentConfig::load().map_err(|e| {
        tracing::error!("Configuration loading failed: {}", e);
        e
    })?;

    let identity = DeviceIdentity::get_or_create(Some(config.device_id.clone()));
    let storage = LocalStorage::new(&config.sqlite_db_path, config.max_local_queue_size)?;
    let health_monitor = HealthMonitor::new(identity.device_id.clone(), config.employee_id.clone());
    let screen_service = ScreenCaptureService::new(config.screenshot_quality);

    tracing::info!("Employee ID: {}", config.employee_id);
    tracing::info!("Device ID:   {} ({})", identity.device_id, identity.device_name);
    tracing::info!("OS Version:  {}", identity.os_version);
    tracing::info!("Agent Ver:   {}", identity.agent_version);
    tracing::info!("Supabase:    {}", config.supabase_url);
    tracing::info!("Idle Limit:  {}s", config.idle_threshold_seconds);
    tracing::info!("Screenshots: {} (interval: {}s, quality: {}%)", 
        if config.screenshots_enabled { "ENABLED" } else { "DISABLED" },
        config.screenshot_interval_seconds,
        config.screenshot_quality
    );
    tracing::info!("Local DB:    {:?}", config.sqlite_db_path);

    let supabase_client = SupabaseClient::new(&config.supabase_url, &config.supabase_anon_key)?;
    let input_tracker = WindowsInputTracker::new(config.idle_threshold_seconds);
    let mut state_machine = PresenceStateMachine::new();
    let mut batcher = ActivityBatcher::new(
        config.employee_id.clone(),
        identity.device_id.clone(),
        supabase_client.clone(),
        storage.clone(),
    );

    // Initial presence registration: notify Supabase that employee is ONLINE and ACTIVE
    let initial_presence = PresenceUpsertPayload {
        employee_id: config.employee_id.clone(),
        device_id: identity.device_id.clone(),
        status: PresenceStatus::Active.to_string(),
        last_activity_at: Utc::now(),
        idle_since: None,
        updated_at: Utc::now(),
    };

    if let Err(e) = supabase_client.upsert_presence(&initial_presence).await {
        tracing::warn!("Initial presence sync warning (will retry in background loop): {}", e);
        health_monitor.record_error(&format!("Initial presence sync failed: {}", e));
    } else {
        tracing::info!("Initial presence registered successfully as ACTIVE");
        health_monitor.record_sync_success();
    }

    let heartbeat_dur = Duration::from_secs(config.heartbeat_interval_seconds);
    let flush_dur = Duration::from_secs(config.batch_flush_interval_seconds);
    let screenshot_dur = Duration::from_secs(config.screenshot_interval_seconds);

    let mut poll_interval = interval(Duration::from_millis(config.poll_interval_millis));
    let mut last_heartbeat = Instant::now();
    let mut last_flush = Instant::now();
    // Trigger immediate screenshot upon agent startup so the dashboard immediately shows live view
    let mut last_screenshot = Instant::now() - screenshot_dur;

    tracing::info!("Agent background loop running. Monitoring input & idle state...");

    loop {
        tokio::select! {
            _ = poll_interval.tick() => {
                let snapshot = input_tracker.get_snapshot();
                batcher.record_sample(snapshot.is_user_idle);

                // Check for status transition
                let transition = state_machine.update(snapshot.is_user_idle, snapshot.idle_duration_seconds);

                if let Some(trans) = transition {
                    // 1. Record transition event in batcher & SQLite outbox
                    batcher.record_transition(&trans, &snapshot.active_window_title);

                    // 2. Immediately update presence in Supabase so dashboards reflect live changes
                    let presence_update = PresenceUpsertPayload {
                        employee_id: config.employee_id.clone(),
                        device_id: identity.device_id.clone(),
                        status: state_machine.current_status().to_string(),
                        last_activity_at: state_machine.last_activity_at(),
                        idle_since: state_machine.idle_since(),
                        updated_at: Utc::now(),
                    };

                    if let Err(e) = supabase_client.upsert_presence(&presence_update).await {
                        tracing::warn!("Failed to sync state transition to Supabase: {}", e);
                        health_monitor.record_error(&format!("State sync failed: {}", e));
                    } else {
                        tracing::info!(
                            "Synced presence transition [{}] to Supabase (idle: {}s)",
                            state_machine.current_status(),
                            snapshot.idle_duration_seconds
                        );
                        health_monitor.record_sync_success();
                    }
                }

                // 3. Periodic Heartbeat check
                if last_heartbeat.elapsed() >= heartbeat_dur {
                    last_heartbeat = Instant::now();
                    health_monitor.record_heartbeat();
                    batcher.record_heartbeat(&snapshot.active_window_title, snapshot.is_user_idle);

                    let heartbeat_presence = PresenceUpsertPayload {
                        employee_id: config.employee_id.clone(),
                        device_id: identity.device_id.clone(),
                        status: state_machine.current_status().to_string(),
                        last_activity_at: state_machine.last_activity_at(),
                        idle_since: state_machine.idle_since(),
                        updated_at: Utc::now(),
                    };

                    if let Err(e) = supabase_client.upsert_presence(&heartbeat_presence).await {
                        tracing::debug!("Heartbeat sync warning: {}", e);
                    } else {
                        tracing::debug!("Presence heartbeat sent to Supabase");
                    }
                }

                // 4. 60-Second Aggregate Telemetry Window
                if batcher.is_aggregate_window_ready() {
                    let aggregate = batcher.take_aggregate();
                    let supabase_clone = supabase_client.clone();
                    tokio::spawn(async move {
                        if let Err(e) = supabase_clone.insert_activity_aggregate(&aggregate).await {
                            tracing::warn!("Failed to send 60s activity aggregate: {}", e);
                        } else {
                            tracing::debug!("60s activity aggregate recorded");
                        }
                    });
                }

                // 5. Periodic Screenshot Capture & Upload (if enabled)
                if config.screenshots_enabled && last_screenshot.elapsed() >= screenshot_dur {
                    last_screenshot = Instant::now();
                    match screen_service.capture_screen() {
                        Ok(captured) => {
                            let timestamp_ms = captured.captured_at.timestamp_millis();
                            let storage_path = format!("{}/{}_{}.jpg", config.employee_id, timestamp_ms, identity.device_id);
                            let supabase_clone = supabase_client.clone();
                            let storage_clone = storage.clone();
                            let emp_id = config.employee_id.clone();
                            let dev_id = identity.device_id.clone();

                            tokio::spawn(async move {
                                match supabase_clone.upload_screenshot_storage(&storage_path, captured.image_bytes.clone()).await {
                                    Ok(_) => {
                                        let record = ScreenshotRecordPayload {
                                            employee_id: emp_id,
                                            device_id: dev_id,
                                            captured_at: captured.captured_at,
                                            storage_path,
                                            file_size_bytes: captured.image_bytes.len(),
                                        };
                                        if let Err(e) = supabase_clone.insert_screenshot_record(&record).await {
                                            tracing::warn!("Failed to log screenshot metadata to DB: {}", e);
                                        } else {
                                            tracing::info!("Screenshot uploaded & logged successfully ({} bytes)", captured.image_bytes.len());
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to upload screenshot to Supabase Storage: {}. Queuing locally.", e);
                                        let _ = storage_clone.enqueue_screenshot(&captured.image_bytes, &format!("{{\"width\":{},\"height\":{}}}", captured.width, captured.height));
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            tracing::warn!("Screenshot capture error: {}", e);
                        }
                    }
                }

                // 6. Batch flush check & offline outbox queue drain
                if last_flush.elapsed() >= flush_dur || batcher.should_flush() {
                    last_flush = Instant::now();
                    let _ = batcher.flush().await;

                    // Drain pending offline outbox events if any
                    if let Ok(pending) = storage.get_pending_events(10) {
                        for p in pending {
                            let _ = storage.mark_event_sent(&p.id);
                        }
                    }
                }
            }

            _ = tokio::signal::ctrl_c() => {
                tracing::info!("Received shutdown signal. Setting status to OFFLINE...");

                let offline_presence = PresenceUpsertPayload {
                    employee_id: config.employee_id.clone(),
                    device_id: identity.device_id.clone(),
                    status: PresenceStatus::Offline.to_string(),
                    last_activity_at: state_machine.last_activity_at(),
                    idle_since: None,
                    updated_at: Utc::now(),
                };

                let _ = supabase_client.upsert_presence(&offline_presence).await;
                let _ = batcher.flush().await;
                tracing::info!("Agent shutdown clean. Exiting.");
                break;
            }
        }
    }

    Ok(())
}
