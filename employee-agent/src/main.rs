mod auth;
mod compression;
mod config;
mod device;
mod heartbeat;
mod screenshot;
mod uploader;

use compression::ScreenshotCompressor;
use config::AgentConfig;
use device::DeviceInfo;
use heartbeat::HeartbeatService;
use screenshot::ScreenCapture;
use uploader::SupabaseUploader;

use chrono::Utc;
use std::time::Duration;
use tokio::time::interval;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize standard logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    println!("=========================================================");
    println!("🚀 [Agent started] Windows Native Employee Monitoring Agent");
    println!("=========================================================");

    // Load Configuration
    let config = match AgentConfig::load() {
        Ok(cfg) => {
            println!("✅ Configuration loaded successfully");
            println!("   Supabase URL:        {}", cfg.supabase_url);
            println!("   Employee ID:         {}", cfg.employee_id);
            println!("   Screenshot Interval: {}s", cfg.screenshot_interval_secs);
            println!("   Heartbeat Interval:  {}s", cfg.heartbeat_interval_secs);
            println!("   Screenshot Quality:  {}%", cfg.screenshot_quality);
            cfg
        }
        Err(e) => {
            eprintln!("❌ Configuration error: {}", e);
            return Err(e.into());
        }
    };

    // Identify Employee & Workstation
    let device_info = DeviceInfo::detect(config.device_id_override.clone());
    println!("✅ Device Workstation Identified:");
    println!("   Device Name: {}", device_info.device_name);
    println!("   Identifier:  {}", device_info.device_identifier);
    println!("   OS Version:  {}", device_info.os_version);
    println!("   Agent Ver:   {}", device_info.agent_version);

    // Initialize Services & Authenticate
    let uploader = SupabaseUploader::new(&config.supabase_url, &config.supabase_anon_key)?;
    let heartbeat_service = HeartbeatService::new(
        &config.supabase_url,
        &config.supabase_anon_key,
        config.idle_threshold_secs,
    )?;

    println!("🔑 [Employee authenticated] Validated anon credentials with Supabase PostgREST");

    // Register Device in DB
    println!("📡 Registering device in Supabase devices table...");
    if let Err(e) = uploader.register_device(&config.employee_id, &device_info).await {
        println!("⚠️  Device registration warning: {}", e);
    } else {
        println!("✅ Device registered in database");
    }

    // =========================================================================
    // 🎯 INITIAL SCREENSHOT CYCLE
    // =========================================================================
    println!("\n📸 Executing initial screenshot capture cycle...");
    match perform_screenshot_cycle(&config, &device_info, &uploader).await {
        Ok((path, bytes_len)) => {
            println!("🎉 Initial capture cycle complete!");
            println!("   Uploaded to Storage: screenshots/{}", path);
            println!("   File Size:           {} bytes", bytes_len);
            println!("   Database Record:     Created in public.screenshots");
        }
        Err(e) => {
            eprintln!("⚠️ Initial screenshot cycle warning: {}", e);
        }
    }

    // Initial Heartbeat
    let (is_idle, _idle_secs) = heartbeat_service.check_idle();
    if let Err(e) = heartbeat_service
        .send_heartbeat(&config.employee_id, &device_info.device_identifier, is_idle)
        .await
    {
        eprintln!("⚠️ Initial heartbeat warning: {}", e);
    } else {
        println!("💓 [Heartbeat successful] Status registered as {}", if is_idle { "IDLE" } else { "ACTIVE" });
    }

    // =========================================================================
    // 🔄 AUTOMATIC BACKGROUND MONITORING INTERVALS
    // =========================================================================
    println!("\n🔄 Entering automatic background monitoring loop (Screenshots: {}s, Heartbeat: {}s)...", config.screenshot_interval_secs, config.heartbeat_interval_secs);
    let mut screenshot_timer = interval(Duration::from_secs(config.screenshot_interval_secs));
    let mut heartbeat_timer = interval(Duration::from_secs(config.heartbeat_interval_secs));

    // Consume the initial immediate tick
    screenshot_timer.tick().await;
    heartbeat_timer.tick().await;

    loop {
        tokio::select! {
            // Heartbeat tick
            _ = heartbeat_timer.tick() => {
                let (is_idle, idle_secs) = heartbeat_service.check_idle();
                let status_str = if is_idle { "IDLE" } else { "ACTIVE" };
                match heartbeat_service
                    .send_heartbeat(&config.employee_id, &device_info.device_identifier, is_idle)
                    .await
                {
                    Ok(_) => {
                        tracing::info!("💓 [Heartbeat successful] Telemetry synced (status: {}, idle: {}s)", status_str, idle_secs);
                    }
                    Err(e) => {
                        tracing::warn!("⚠️ Heartbeat warning: {}", e);
                    }
                }
            }

            // Screenshot tick
            _ = screenshot_timer.tick() => {
                match perform_screenshot_cycle(&config, &device_info, &uploader).await {
                    Ok((path, size)) => {
                        tracing::info!("📸 [Upload successful] Recorded screenshot: {} ({} bytes)", path, size);
                    }
                    Err(e) => {
                        tracing::warn!("⚠️ Screenshot capture cycle warning: {}", e);
                    }
                }
            }

            // Graceful shutdown on Ctrl+C
            _ = tokio::signal::ctrl_c() => {
                println!("\n🛑 Received shutdown signal. Marking agent as OFFLINE in Supabase...");
                let _ = heartbeat_service
                    .send_heartbeat(&config.employee_id, &device_info.device_identifier, true)
                    .await;
                println!("👋 [Agent stopped] Employee Agent terminated gracefully.");
                break;
            }
        }
    }

    Ok(())
}

/// Helper function to execute the full screenshot pipeline
async fn perform_screenshot_cycle(
    config: &AgentConfig,
    device: &DeviceInfo,
    uploader: &SupabaseUploader,
) -> Result<(String, usize), String> {
    // 1. Capture raw screen
    let raw = ScreenCapture::capture()?;
    tracing::info!("📸 [Screenshot captured] Screen buffer: {}x{}", raw.width, raw.height);

    // 2. Compress to JPEG
    let compressed = ScreenshotCompressor::compress(&raw, config.screenshot_quality)?;
    let orig_raw_size = (raw.width * raw.height * 4) as usize;
    let ratio = 100.0 - ((compressed.file_size_bytes as f64 / orig_raw_size as f64) * 100.0);
    tracing::info!("🗜️ [Screenshot compressed] Compressed to {} bytes ({:.1}% size reduction)", compressed.file_size_bytes, ratio);

    // 3. Construct storage path
    let timestamp_ms = Utc::now().timestamp_millis();
    let storage_path = format!("{}/{}_{}.jpg", config.employee_id, timestamp_ms, device.device_identifier);

    // 4. Upload binary to Supabase Storage (with automatic retry)
    uploader
        .upload_screenshot_storage(&storage_path, compressed.jpeg_bytes.clone())
        .await?;

    // 5. Save metadata to DB
    uploader
        .save_screenshot_metadata(&config.employee_id, &device.device_identifier, &storage_path, &compressed)
        .await?;

    Ok((storage_path, compressed.file_size_bytes))
}
