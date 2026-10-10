use crate::compression::ScreenshotCompressor;
use crate::config::AgentConfig;
use crate::device::DeviceInfo;
use crate::screenshot::ScreenCapture;
use crate::uploader::SupabaseUploader;
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct AgentCommandRow {
    pub id: String,
    pub employee_id: String,
    pub command: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Default)]
pub struct LiveRuntime {
    pub active: bool,
    pub last_keepalive: Option<Instant>,
}

impl LiveRuntime {
    pub fn keep_alive(&mut self) {
        self.active = true;
        self.last_keepalive = Some(Instant::now());
    }

    pub fn stop(&mut self) {
        self.active = false;
        self.last_keepalive = None;
    }

    pub fn expired(&self, max_idle: Duration) -> bool {
        match self.last_keepalive {
            Some(t) => t.elapsed() > max_idle,
            None => true,
        }
    }
}

pub async fn poll_and_handle(
    uploader: &SupabaseUploader,
    config: &AgentConfig,
    device: &DeviceInfo,
    live: &mut LiveRuntime,
) {
    match uploader.fetch_pending_commands(&config.employee_id).await {
        Ok(cmds) => {
            for cmd in cmds {
                if let Err(e) = handle_command(uploader, config, device, live, &cmd).await {
                    tracing::warn!("Command {} failed: {}", cmd.id, e);
                    let _ = uploader
                        .update_command_status(
                            &cmd.id,
                            "failed",
                            json!({ "error": e }),
                        )
                        .await;
                }
            }
        }
        Err(e) => tracing::debug!("Command poll skipped: {}", e),
    }

    // Auto-expire live if admin closed without stop_live
    if live.active && live.expired(Duration::from_secs(60)) {
        tracing::info!("Live session idle timeout — stopping");
        live.stop();
        let _ = uploader
            .upsert_live_session(&config.employee_id, false, None, None, None)
            .await;
    }
}

async fn handle_command(
    uploader: &SupabaseUploader,
    config: &AgentConfig,
    device: &DeviceInfo,
    live: &mut LiveRuntime,
    cmd: &AgentCommandRow,
) -> Result<(), String> {
    uploader
        .update_command_status(&cmd.id, "running", json!({}))
        .await?;

    match cmd.command.as_str() {
        "start_live" => {
            live.keep_alive();
            // Push one frame immediately so UI has something before the 1s timer
            push_live_frame(uploader, config).await?;
            uploader
                .update_command_status(&cmd.id, "done", json!({ "live": true }))
                .await?;
        }
        "stop_live" => {
            live.stop();
            uploader
                .upsert_live_session(&config.employee_id, false, None, None, None)
                .await?;
            uploader
                .update_command_status(&cmd.id, "done", json!({ "live": false }))
                .await?;
        }
        "record" => {
            let duration = cmd
                .payload
                .get("duration_secs")
                .and_then(|v| v.as_u64())
                .unwrap_or(10)
                .clamp(3, 30);
            let requested_by = cmd
                .payload
                .get("requested_by")
                .and_then(|v| v.as_str())
                .unwrap_or("admin")
                .to_string();
            let recording_id = Uuid::new_v4().to_string();
            let result = run_recording(
                uploader,
                config,
                device,
                &recording_id,
                duration,
                &requested_by,
            )
            .await?;
            uploader
                .update_command_status(&cmd.id, "done", result)
                .await?;
        }
        other => {
            return Err(format!("Unknown command: {other}"));
        }
    }
    Ok(())
}

pub async fn push_live_frame(
    uploader: &SupabaseUploader,
    config: &AgentConfig,
) -> Result<(), String> {
    let raw = ScreenCapture::capture()?;
    let compressed = ScreenshotCompressor::compress(&raw, config.screenshot_quality.min(75))?;
    let path = format!("live/{}/latest.jpg", config.employee_id);
    uploader
        .upload_screenshot_storage(&path, compressed.jpeg_bytes)
        .await?;
    uploader
        .upsert_live_session(
            &config.employee_id,
            true,
            Some(&path),
            Some(compressed.width),
            Some(compressed.height),
        )
        .await?;
    Ok(())
}

async fn run_recording(
    uploader: &SupabaseUploader,
    config: &AgentConfig,
    device: &DeviceInfo,
    recording_id: &str,
    duration_secs: u64,
    requested_by: &str,
) -> Result<serde_json::Value, String> {
    let fps = 2u64;
    let frame_interval = Duration::from_millis(1000 / fps);
    let total_frames = (duration_secs * fps).max(1);
    let started_at = Utc::now();
    let mut frames: Vec<String> = Vec::with_capacity(total_frames as usize);
    let mut total_bytes: u64 = 0;
    let mut thumb_path: Option<String> = None;
    let mut width = 0u32;
    let mut height = 0u32;

    tracing::info!(
        "🎥 Starting real screen recording {} ({}s @ {}fps)",
        recording_id,
        duration_secs,
        fps
    );

    for i in 0..total_frames {
        let tick = Instant::now();
        match ScreenCapture::capture() {
            Ok(raw) => {
                width = raw.width;
                height = raw.height;
                match ScreenshotCompressor::compress(&raw, config.screenshot_quality.min(70)) {
                    Ok(compressed) => {
                        let path = format!(
                            "recordings/{}/frame_{:04}.jpg",
                            recording_id,
                            i + 1
                        );
                        if let Err(e) = uploader
                            .upload_screenshot_storage(&path, compressed.jpeg_bytes.clone())
                            .await
                        {
                            tracing::warn!("Frame upload failed: {}", e);
                        } else {
                            total_bytes += compressed.file_size_bytes as u64;
                            if thumb_path.is_none() {
                                thumb_path = Some(path.clone());
                            }
                            frames.push(path);
                        }
                    }
                    Err(e) => tracing::warn!("Frame compress failed: {}", e),
                }
            }
            Err(e) => tracing::warn!("Frame capture failed: {}", e),
        }

        let elapsed = tick.elapsed();
        if elapsed < frame_interval {
            sleep(frame_interval - elapsed).await;
        }
    }

    if frames.is_empty() {
        return Err("Recording produced no frames (capture failed)".into());
    }

    let manifest = json!({
        "fps": fps,
        "width": width,
        "height": height,
        "frames": frames,
    });

    uploader
        .insert_screen_recording(json!({
            "id": recording_id,
            "employee_id": config.employee_id,
            "device_id": device.device_identifier,
            "started_at": started_at.to_rfc3339(),
            "duration_seconds": duration_secs as i64,
            "storage_path": format!("recordings/{}/", recording_id),
            "video_url": null,
            "thumbnail_url": thumb_path,
            "recorded_by": requested_by,
            "active_window": "Desktop",
            "file_size_bytes": total_bytes,
            "status": "completed",
            "trigger_type": "on_demand",
            "frame_manifest": manifest,
            "metadata": {
                "bucket": "screenshots",
                "employee_name": null,
                "device_name": device.device_name,
                "fps": fps,
                "frame_count": frames.len(),
            }
        }))
        .await?;

    Ok(json!({
        "recording_id": recording_id,
        "frame_count": frames.len(),
        "duration_secs": duration_secs,
    }))
}
