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
use supabase::models::{DeviceRegisterPayload, PresenceUpsertPayload, ScreenshotRecordPayload};
use supabase::SupabaseClient;
use windows::WindowsInputTracker;

use chrono::Utc;
use std::time::Duration;
use tokio::time::{interval, Instant};

fn main() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build();

    let result = match rt {
        Ok(runtime) => runtime.block_on(run_agent()),
        Err(e) => Err(errors::AgentError::General(format!("Failed to build Tokio async runtime: {}", e))),
    };

    if let Err(e) = result {
        eprintln!("\n=======================================================================");
        eprintln!("❌ [FATAL AGENT ERROR] Failed to start or maintain agent:");
        eprintln!("   {}", e);
        eprintln!("=======================================================================");
        eprintln!("Press Enter to close this window...");
        let mut input = String::new();
        let _ = std::io::stdin().read_line(&mut input);
        std::process::exit(1);
    }
}

async fn run_agent() -> AgentResult<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,employee_windows_agent=info".into()),
        )
        .init();

    // 1. Load configuration with zero-command defaults
    let mut config = AgentConfig::load().map_err(|e| {
        tracing::error!("Configuration loading failed: {}", e);
        e
    })?;

    let identity = DeviceIdentity::get_or_create(Some(config.device_id.clone()));
    let storage = LocalStorage::new(&config.sqlite_db_path, config.max_local_queue_size)?;
    let screen_service = ScreenCaptureService::new(config.screenshot_quality);

    let supabase_client = SupabaseClient::new(&config.supabase_url, &config.supabase_anon_key)?;

    // 2. Dynamic Employee & Device Identity Resolution (for user's PC and other PCs)
    if let Some(assigned_emp) = supabase_client.lookup_assigned_employee(&identity.device_id).await {
        tracing::info!("Found existing device assignment: employee_id={}", assigned_emp);
        config.employee_id = assigned_emp;
    } else {
        let username = std::env::var("USERNAME").unwrap_or_default().to_lowercase();
        if let Ok(employees) = supabase_client.lookup_employees().await {
            for emp in &employees {
                let email_lower = emp.email.to_lowercase();
                let name_lower = emp.full_name.to_lowercase();
                if (!username.is_empty()) && (email_lower.contains(&username) || name_lower.contains(&username)) {
                    tracing::info!("Auto-detected employee from username '{}': {} ({})", username, emp.full_name, emp.id);
                    config.employee_id = emp.id.clone();
                    break;
                }
            }
        }
    }

    let health_monitor = HealthMonitor::new(identity.device_id.clone(), config.employee_id.clone());

    // 3. Register device in public.devices table
    let device_reg = DeviceRegisterPayload {
        employee_id: config.employee_id.clone(),
        device_name: identity.device_name.clone(),
        device_identifier: identity.device_id.clone(),
        os_version: identity.os_version.clone(),
        agent_version: identity.agent_version.clone(),
        last_seen_at: Utc::now(),
    };
    if let Err(e) = supabase_client.register_device(&device_reg).await {
        tracing::warn!("Device registration warning (non-fatal): {}", e);
    } else {
        tracing::info!("Workstation registered in Supabase devices table");
    }

    // 4. Print clean, reassuring ASCII banner for double-click execution
    println!("\n=======================================================================");
    println!("  🚀 EMPLOYEE TRACKING BACKGROUND AGENT (v{})", identity.agent_version);
    println!("=======================================================================");
    println!("  Central Vault:    {}", config.supabase_url);
    println!("  Workstation:      {} ({})", identity.device_name, identity.device_id);
    println!("  OS Environment:   {}", identity.os_version);
    println!("  Assigned Profile: {}", config.employee_id);
    println!("  Input Polling:    Every {}ms | Idle Limit: {}s", config.poll_interval_millis, config.idle_threshold_seconds);
    println!("  Screenshots:      {} (Interval: {}s, Quality: {}%)", 
        if config.screenshots_enabled { "ENABLED" } else { "DISABLED" },
        config.screenshot_interval_seconds,
        config.screenshot_quality
    );
    println!("  Local Outbox:     {:?}", config.sqlite_db_path);
    println!("=======================================================================");
    println!("  ✅ Status: ONLINE & MONITORING");
    println!("  💡 You can safely minimize this console window while you work.");
    println!("  🛑 To cleanly stop the agent, press Ctrl+C in this window.");
    println!("=======================================================================\n");

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
        println!("[+] Workstation status synced: ONLINE (Active)");
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
                            let width = captured.width;
                            let height = captured.height;

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
                                        if let Err(e) = supabase_clone.insert_screenshot_record(&record, width, height).await {
                                            tracing::warn!("Failed to log screenshot metadata to DB: {}", e);
                                        } else {
                                            println!("[+] Screen capture synchronized with Supabase ({} bytes)", captured.image_bytes.len());
                                            tracing::info!("Screenshot uploaded & logged successfully ({} bytes)", captured.image_bytes.len());
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to upload screenshot to Supabase Storage: {}. Queuing locally.", e);
                                        let _ = storage_clone.enqueue_screenshot(&captured.image_bytes, &format!("{{\"width\":{},\"height\":{}}}", width, height));
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
                println!("\n[!] Received shutdown signal (Ctrl+C). Setting status to OFFLINE...");

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
                println!("[+] Agent shutdown clean. Exiting.");
                break;
            }
        }
    }

    Ok(())
}
