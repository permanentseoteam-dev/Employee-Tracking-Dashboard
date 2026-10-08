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
    // 1. Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    println!("=========================================================");
    println!("🚀 STARTING EMPLOYEE MONITORING AGENT (MVP)");
    println!("=========================================================");

    // 2. Load Configuration
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

    // 3. Identify Employee / Device
    let device_info = DeviceInfo::detect(config.device_id_override.clone());
    println!("✅ Device Workstation Identified:");
    println!("   Device Name: {}", device_info.device_name);
    println!("   Identifier:  {}", device_info.device_identifier);
    println!("   OS Version:  {}", device_info.os_version);
    println!("   Agent Ver:   {}", device_info.agent_version);

    // Initialize Services
    let uploader = SupabaseUploader::new(&config.supabase_url, &config.supabase_anon_key)?;
    let heartbeat_service = HeartbeatService::new(
        &config.supabase_url,
        &config.supabase_anon_key,
        config.idle_threshold_secs,
    )?;

    // Register Device in DB
    println!("📡 Registering device in Supabase devices table...");
    if let Err(e) = uploader.register_device(&config.employee_id, &device_info).await {
        println!("⚠️  Device registration warning: {}", e);
    } else {
        println!("✅ Device registered in database");
    }

    // =========================================================================
    // 🎯 MILESTONE 1: Capture screenshot → Compress → Upload → Save DB Record
    // =========================================================================
    println!("\n📸 [MILESTONE 1] Capturing initial screenshot...");
    match perform_screenshot_cycle(&config, &device_info, &uploader).await {
        Ok((path, bytes_len)) => {
            println!("🎉 MILESTONE 1 SUCCESS!");
            println!("   Uploaded to Storage: screenshots/{}", path);
            println!("   File Size:           {} bytes", bytes_len);
            println!("   Database Record:     Created in public.screenshots");
        }
        Err(e) => {
            eprintln!("⚠️ Initial screenshot cycle error: {}", e);
        }
    }

    // Initial Heartbeat
    println!("\n💓 Sending initial presence heartbeat...");
    let (is_idle, _idle_secs) = heartbeat_service.check_idle();
    if let Err(e) = heartbeat_service
        .send_heartbeat(&config.employee_id, &device_info.device_identifier, is_idle)
        .await
    {
        eprintln!("⚠️ Initial heartbeat warning: {}", e);
    } else {
        println!("✅ Initial presence heartbeat registered (Status: {})", if is_idle { "IDLE" } else { "ACTIVE" });
    }

    // =========================================================================
    // 🔄 CONTINUOUS INTERVAL & HEARTBEAT LOOP
    // =========================================================================
    println!("\n🔄 Entering automatic background monitoring loop...");
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
                tracing::info!("💓 Heartbeat tick (idle: {}s, state: {})", idle_secs, if is_idle { "IDLE" } else { "ACTIVE" });
                let _ = heartbeat_service
                    .send_heartbeat(&config.employee_id, &device_info.device_identifier, is_idle)
                    .await;
            }

            // Screenshot tick
            _ = screenshot_timer.tick() => {
                tracing::info!("📸 Periodic screenshot timer triggered");
                match perform_screenshot_cycle(&config, &device_info, &uploader).await {
                    Ok((path, size)) => {
                        tracing::info!("✅ Screenshot uploaded & recorded: {} ({} bytes)", path, size);
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
                println!("👋 Employee Agent terminated gracefully.");
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

    // 2. Compress to JPEG
    let compressed = ScreenshotCompressor::compress(&raw, config.screenshot_quality)?;

    // 3. Construct storage path
    let timestamp_ms = Utc::now().timestamp_millis();
    let storage_path = format!("{}/{}_{}.jpg", config.employee_id, timestamp_ms, device.device_identifier);

    // 4. Upload binary to Supabase Storage
    uploader
        .upload_screenshot_storage(&storage_path, compressed.jpeg_bytes.clone())
        .await?;

    // 5. Save metadata to DB
    uploader
        .save_screenshot_metadata(&config.employee_id, &device.device_identifier, &storage_path, &compressed)
        .await?;

    Ok((storage_path, compressed.file_size_bytes))
}
