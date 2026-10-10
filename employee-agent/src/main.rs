mod auth;
mod compression;
mod config;
mod device;
mod heartbeat;
mod office_hours;
mod screenshot;
mod status_file;
mod uploader;

use compression::ScreenshotCompressor;
use config::AgentConfig;
use device::DeviceInfo;
use heartbeat::HeartbeatService;
use screenshot::ScreenCapture;
use status_file::{
    is_paused, now_rfc3339, stop_requested, write_status, AgentStatusSnapshot,
};
use uploader::SupabaseUploader;

use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    // Single-instance: do not launch duplicates
    if let Err(e) = acquire_single_instance_mutex() {
        eprintln!("❌ {e}");
        return Ok(());
    }

    println!("=========================================================");
    println!("🚀 [Agent started] Windows Native Employee Monitoring Agent");
    println!("=========================================================");

    let mut config = match AgentConfig::load() {
        Ok(cfg) => {
            println!("✅ Configuration loaded successfully");
            println!("   Supabase URL:        {}", cfg.supabase_url);
            println!("   Employee ID:         {}", cfg.employee_id);
            println!("   Screenshot Interval: {}s", cfg.screenshot_interval_secs);
            println!("   Heartbeat Interval:  {}s", cfg.heartbeat_interval_secs);
            println!("   Screenshot Quality:  {}%", cfg.screenshot_quality);
            println!("   Office hours:        {}", cfg.office_hours.summary());
            cfg
        }
        Err(e) => {
            eprintln!("❌ Configuration error: {}", e);
            return Err(e.into());
        }
    };

    let device_info = DeviceInfo::detect(config.device_id_override.clone());
    println!("✅ Device Workstation Identified:");
    println!("   Device Name: {}", device_info.device_name);
    println!("   Identifier:  {}", device_info.device_identifier);
    println!("   OS Version:  {}", device_info.os_version);
    println!("   Agent Ver:   {}", device_info.agent_version);

    let mut snap = AgentStatusSnapshot {
        agent_version: device_info.agent_version.clone(),
        employee_id: config.employee_id.clone(),
        device_id: device_info.device_identifier.clone(),
        last_heartbeat_at: None,
        last_collection_at: None,
        last_upload_at: None,
        last_error: None,
        paused: is_paused(),
        backend_ok: false,
        updated_at: now_rfc3339(),
    };
    write_status(&snap);

    let uploader = SupabaseUploader::new(&config.supabase_url, &config.supabase_anon_key)?;
    let heartbeat_service = HeartbeatService::new(
        &config.supabase_url,
        &config.supabase_anon_key,
        config.idle_threshold_secs,
    )?;

    println!("🔑 [Employee authenticated] Validated anon credentials with Supabase PostgREST");

    println!("📡 Registering device in Supabase devices table...");
    if let Err(e) = uploader
        .register_device(&config.employee_id, &device_info)
        .await
    {
        println!("⚠️  Device registration warning: {}", e);
        snap.last_error = Some(e.to_string());
        write_status(&snap);
    } else {
        println!("✅ Device registered in database");
    }

    match uploader.fetch_office_hours_config().await {
        Ok(Some(remote)) => {
            config.office_hours.apply_remote(&remote);
            println!(
                "✅ Remote office-hours policy applied: {}",
                config.office_hours.summary()
            );
        }
        Ok(None) => println!("ℹ️  No remote office-hours row yet (using .env / defaults)"),
        Err(e) => println!("⚠️  Remote office-hours fetch skipped: {}", e),
    }

    let config = Arc::new(RwLock::new(config));

    println!("\n📸 Executing initial screenshot capture cycle (if allowed)...");
    {
        let cfg = config.read().await;
        if is_paused() {
            println!("⏸️  PAUSE flag present — skipping initial screenshot");
            snap.paused = true;
            write_status(&snap);
        } else if cfg.office_hours.allows_capture_now() {
            match perform_screenshot_cycle(&cfg, &device_info, &uploader).await {
                Ok((path, bytes_len)) => {
                    println!("🎉 Initial capture cycle complete!");
                    println!("   Uploaded to Storage: screenshots/{}", path);
                    println!("   File Size:           {} bytes", bytes_len);
                    snap.last_collection_at = Some(now_rfc3339());
                    snap.last_upload_at = Some(now_rfc3339());
                    snap.backend_ok = true;
                    snap.last_error = None;
                    write_status(&snap);
                }
                Err(e) => {
                    eprintln!("⚠️ Initial screenshot cycle warning: {}", e);
                    snap.last_error = Some(e);
                    write_status(&snap);
                }
            }
        } else {
            println!("🌙 Outside office hours — skipping initial screenshot");
        }
    }

    let (is_idle, _idle_secs) = heartbeat_service.check_idle();
    if let Err(e) = heartbeat_service
        .send_heartbeat(
            &config.read().await.employee_id,
            &device_info.device_identifier,
            is_idle,
        )
        .await
    {
        eprintln!("⚠️ Initial heartbeat warning: {}", e);
        snap.last_error = Some(e.to_string());
        snap.backend_ok = false;
        write_status(&snap);
    } else {
        println!(
            "💓 [Heartbeat successful] Status registered as {}",
            if is_idle { "IDLE" } else { "ACTIVE" }
        );
        snap.last_heartbeat_at = Some(now_rfc3339());
        snap.backend_ok = true;
        write_status(&snap);
    }

    let screenshot_secs = config.read().await.screenshot_interval_secs;
    let heartbeat_secs = config.read().await.heartbeat_interval_secs;
    let refresh_secs = config.read().await.config_refresh_secs.max(60);

    println!(
        "\n🔄 Entering monitoring loop (Screenshots: {}s, Heartbeat: {}s, Config refresh: {}s)...",
        screenshot_secs, heartbeat_secs, refresh_secs
    );

    let mut screenshot_timer = interval(Duration::from_secs(screenshot_secs));
    let mut heartbeat_timer = interval(Duration::from_secs(heartbeat_secs));
    let mut config_timer = interval(Duration::from_secs(refresh_secs));
    let mut stop_poll = interval(Duration::from_secs(2));

    screenshot_timer.tick().await;
    heartbeat_timer.tick().await;
    config_timer.tick().await;
    stop_poll.tick().await;

    loop {
        tokio::select! {
            _ = stop_poll.tick() => {
                if stop_requested() {
                    println!("\n🛑 STOP flag detected — shutting down gracefully...");
                    break;
                }
                snap.paused = is_paused();
                snap.updated_at = now_rfc3339();
                write_status(&snap);
            }

            _ = heartbeat_timer.tick() => {
                if stop_requested() { break; }
                let (is_idle, idle_secs) = heartbeat_service.check_idle();
                let status_str = if is_idle { "IDLE" } else { "ACTIVE" };
                let employee_id = config.read().await.employee_id.clone();
                match heartbeat_service
                    .send_heartbeat(&employee_id, &device_info.device_identifier, is_idle)
                    .await
                {
                    Ok(_) => {
                        tracing::info!(
                            "💓 [Heartbeat successful] Telemetry synced (status: {}, idle: {}s)",
                            status_str,
                            idle_secs
                        );
                        snap.last_heartbeat_at = Some(now_rfc3339());
                        snap.backend_ok = true;
                        snap.last_error = None;
                        write_status(&snap);
                    }
                    Err(e) => {
                        tracing::warn!("⚠️ Heartbeat warning: {}", e);
                        snap.backend_ok = false;
                        snap.last_error = Some(e.to_string());
                        write_status(&snap);
                    }
                }
            }

            _ = screenshot_timer.tick() => {
                if stop_requested() { break; }
                if is_paused() {
                    tracing::info!("⏸️  Collection paused (PAUSE file) — screenshot skipped");
                    snap.paused = true;
                    write_status(&snap);
                    continue;
                }
                snap.paused = false;
                let cfg = config.read().await.clone();
                if !cfg.office_hours.allows_capture_now() {
                    tracing::info!("🌙 Outside office hours — screenshot skipped ({})", cfg.office_hours.summary());
                    continue;
                }
                match perform_screenshot_cycle(&cfg, &device_info, &uploader).await {
                    Ok((path, size)) => {
                        tracing::info!("📸 [Upload successful] Recorded screenshot: {} ({} bytes)", path, size);
                        snap.last_collection_at = Some(now_rfc3339());
                        snap.last_upload_at = Some(now_rfc3339());
                        snap.backend_ok = true;
                        snap.last_error = None;
                        write_status(&snap);
                    }
                    Err(e) => {
                        tracing::warn!("⚠️ Screenshot capture cycle warning: {}", e);
                        snap.last_error = Some(e);
                        write_status(&snap);
                    }
                }
            }

            _ = config_timer.tick() => {
                match uploader.fetch_office_hours_config().await {
                    Ok(Some(remote)) => {
                        let mut cfg = config.write().await;
                        cfg.office_hours.apply_remote(&remote);
                        tracing::info!("🔄 Office-hours policy refreshed: {}", cfg.office_hours.summary());
                    }
                    Ok(None) => {}
                    Err(e) => tracing::debug!("Config refresh skipped: {}", e),
                }
            }

            _ = tokio::signal::ctrl_c() => {
                println!("\n🛑 Received shutdown signal. Marking agent as OFFLINE in Supabase...");
                break;
            }
        }
    }

    let employee_id = config.read().await.employee_id.clone();
    let _ = heartbeat_service
        .send_heartbeat(&employee_id, &device_info.device_identifier, true)
        .await;
    let _ = std::fs::remove_file(status_file::stop_path());
    let _ = std::fs::remove_file(status_file::agent_dir().join("agent.lock"));
    println!("👋 [Agent stopped] Employee Agent terminated gracefully.");
    Ok(())
}

async fn perform_screenshot_cycle(
    config: &AgentConfig,
    device: &DeviceInfo,
    uploader: &SupabaseUploader,
) -> Result<(String, usize), String> {
    let raw = ScreenCapture::capture()?;
    tracing::info!(
        "📸 [Screenshot captured] Screen buffer: {}x{}",
        raw.width,
        raw.height
    );

    let compressed = ScreenshotCompressor::compress(&raw, config.screenshot_quality)?;
    let orig_raw_size = (raw.width * raw.height * 4) as usize;
    let ratio = 100.0 - ((compressed.file_size_bytes as f64 / orig_raw_size as f64) * 100.0);
    tracing::info!(
        "🗜️ [Screenshot compressed] Compressed to {} bytes ({:.1}% size reduction)",
        compressed.file_size_bytes,
        ratio
    );

    let timestamp_ms = Utc::now().timestamp_millis();
    let storage_path = format!(
        "{}/{}_{}.jpg",
        config.employee_id, timestamp_ms, device.device_identifier
    );

    uploader
        .upload_screenshot_storage(&storage_path, compressed.jpeg_bytes.clone())
        .await?;

    uploader
        .save_screenshot_metadata(
            &config.employee_id,
            &device.device_identifier,
            &storage_path,
            &compressed,
        )
        .await?;

    Ok((storage_path, compressed.file_size_bytes))
}

fn acquire_single_instance_mutex() -> Result<(), String> {
    let lock_path = status_file::agent_dir().join("agent.lock");
    let _ = std::fs::create_dir_all(status_file::agent_dir());
    let current_pid = std::process::id();

    if lock_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&lock_path) {
            if let Ok(prev_pid) = content.trim().parse::<u32>() {
                if prev_pid != current_pid {
                    #[cfg(windows)]
                    {
                        let is_alive = std::process::Command::new("tasklist")
                            .args(["/FI", &format!("PID eq {}", prev_pid), "/NH"])
                            .output()
                            .ok()
                            .map(|o| {
                                let out = String::from_utf8_lossy(&o.stdout).to_lowercase();
                                out.contains("employee-agent.exe")
                            })
                            .unwrap_or(false);
                        if is_alive {
                            return Err(format!(
                                "Another employee-agent instance (PID {}) is already running.",
                                prev_pid
                            ));
                        }
                    }
                }
            }
        }
    }
    std::fs::write(&lock_path, current_pid.to_string().as_bytes())
        .map_err(|e| format!("Failed to write agent lock: {e}"))?;
    Ok(())
}
