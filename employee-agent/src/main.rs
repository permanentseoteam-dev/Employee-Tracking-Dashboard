mod auth;
mod compression;
mod config;
mod device;
mod heartbeat;
mod office_hours;
mod screenshot;
mod uploader;

use compression::ScreenshotCompressor;
use config::AgentConfig;
use device::DeviceInfo;
use heartbeat::HeartbeatService;
use screenshot::ScreenCapture;
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

    let uploader = SupabaseUploader::new(&config.supabase_url, &config.supabase_anon_key)?;
    let heartbeat_service = HeartbeatService::new(
        &config.supabase_url,
        &config.supabase_anon_key,
        config.idle_threshold_secs,
    )?;

    println!("🔑 [Employee authenticated] Validated anon credentials with Supabase PostgREST");

    println!("📡 Registering device in Supabase devices table...");
    if let Err(e) = uploader.register_device(&config.employee_id, &device_info).await {
        println!("⚠️  Device registration warning: {}", e);
    } else {
        println!("✅ Device registered in database");
    }

    // Merge remote office-hours policy if table exists
    match uploader.fetch_office_hours_config().await {
        Ok(Some(remote)) => {
            config.office_hours.apply_remote(&remote);
            println!("✅ Remote office-hours policy applied: {}", config.office_hours.summary());
        }
        Ok(None) => println!("ℹ️  No remote office-hours row yet (using .env / defaults)"),
        Err(e) => println!("⚠️  Remote office-hours fetch skipped: {}", e),
    }

    let config = Arc::new(RwLock::new(config));

    println!("\n📸 Executing initial screenshot capture cycle (if inside office hours)...");
    {
        let cfg = config.read().await;
        if cfg.office_hours.allows_capture_now() {
            match perform_screenshot_cycle(&cfg, &device_info, &uploader).await {
                Ok((path, bytes_len)) => {
                    println!("🎉 Initial capture cycle complete!");
                    println!("   Uploaded to Storage: screenshots/{}", path);
                    println!("   File Size:           {} bytes", bytes_len);
                }
                Err(e) => eprintln!("⚠️ Initial screenshot cycle warning: {}", e),
            }
        } else {
            println!("🌙 Outside office hours — skipping initial screenshot");
        }
    }

    let heartbeat_service_for_init = &heartbeat_service;
    let (is_idle, _idle_secs) = heartbeat_service_for_init.check_idle();
    if let Err(e) = heartbeat_service
        .send_heartbeat(
            &config.read().await.employee_id,
            &device_info.device_identifier,
            is_idle,
        )
        .await
    {
        eprintln!("⚠️ Initial heartbeat warning: {}", e);
    } else {
        println!(
            "💓 [Heartbeat successful] Status registered as {}",
            if is_idle { "IDLE" } else { "ACTIVE" }
        );
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

    screenshot_timer.tick().await;
    heartbeat_timer.tick().await;
    config_timer.tick().await;

    loop {
        tokio::select! {
            _ = heartbeat_timer.tick() => {
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
                    }
                    Err(e) => tracing::warn!("⚠️ Heartbeat warning: {}", e),
                }
            }

            _ = screenshot_timer.tick() => {
                let cfg = config.read().await.clone();
                if !cfg.office_hours.allows_capture_now() {
                    tracing::info!("🌙 Outside office hours — screenshot skipped ({})", cfg.office_hours.summary());
                    continue;
                }
                match perform_screenshot_cycle(&cfg, &device_info, &uploader).await {
                    Ok((path, size)) => {
                        tracing::info!("📸 [Upload successful] Recorded screenshot: {} ({} bytes)", path, size);
                    }
                    Err(e) => tracing::warn!("⚠️ Screenshot capture cycle warning: {}", e),
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
                let employee_id = config.read().await.employee_id.clone();
                let _ = heartbeat_service
                    .send_heartbeat(&employee_id, &device_info.device_identifier, true)
                    .await;
                println!("👋 [Agent stopped] Employee Agent terminated gracefully.");
                break;
            }
        }
    }

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
