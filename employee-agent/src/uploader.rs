use crate::auth::AuthManager;
use crate::compression::CompressedScreenshot;
use crate::device::DeviceInfo;
use crate::office_hours::RemoteOfficeHoursRow;
use chrono::{DateTime, Utc};
use reqwest::header::CONTENT_TYPE;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenshotDbRecord {
    pub employee_id: String,
    pub device_id: Option<String>,
    pub storage_path: String,
    pub file_size_bytes: usize,
    pub width: u32,
    pub height: u32,
    pub captured_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyScreenshotRecord {
    pub employee_id: String,
    pub device_id: String,
    pub storage_path: String,
    pub file_size_bytes: usize,
    pub captured_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceRegisterRecord {
    pub employee_id: String,
    pub device_name: String,
    pub device_identifier: String,
    pub os_version: String,
    pub agent_version: String,
    pub last_seen_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct SupabaseUploader {
    client: Client,
    base_url: String,
    auth: AuthManager,
}

impl SupabaseUploader {
    pub fn new(supabase_url: &str, anon_key: &str) -> Result<Self, String> {
        let auth = AuthManager::new(anon_key);
        let headers = auth.build_headers()?;

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let base_url = supabase_url.trim_end_matches('/').to_string();

        Ok(Self {
            client,
            base_url,
            auth,
        })
    }

    /// Register/Upsert device in public.devices table
    pub async fn register_device(&self, employee_id: &str, device: &DeviceInfo) -> Result<(), String> {
        let record = DeviceRegisterRecord {
            employee_id: employee_id.to_string(),
            device_name: device.device_name.clone(),
            device_identifier: device.device_identifier.clone(),
            os_version: device.os_version.clone(),
            agent_version: device.agent_version.clone(),
            last_seen_at: Utc::now(),
        };

        let url = format!("{}/rest/v1/devices", self.base_url);
        let resp = self
            .client
            .post(&url)
            .header("Prefer", "resolution=merge-duplicates")
            .json(&[record])
            .send()
            .await
            .map_err(|e| format!("Device registration request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!("Device registration response (status {}): {}", status, body);
        }

        Ok(())
    }

    /// Upload compressed screenshot binary directly to Supabase Storage bucket 'screenshots' with retry
    pub async fn upload_screenshot_storage(&self, path: &str, jpeg_bytes: Vec<u8>) -> Result<(), String> {
        let upload_url = format!("{}/storage/v1/object/screenshots/{}", self.base_url, path);
        let max_attempts = 3;

        for attempt in 1..=max_attempts {
            let resp = self
                .client
                .post(&upload_url)
                .header(CONTENT_TYPE, "image/jpeg")
                .header("x-upsert", "true")
                .body(jpeg_bytes.clone())
                .send()
                .await;

            match resp {
                Ok(response) if response.status().is_success() => {
                    tracing::info!("✅ [Upload successful] Storage object written: screenshots/{}", path);
                    return Ok(());
                }
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    if attempt < max_attempts {
                        let delay = Duration::from_millis(500 * (1 << (attempt - 1)));
                        tracing::warn!(
                            "⚠️ [Upload failed -> Retrying] Attempt {}/{} failed (HTTP {}): {}. Waiting {:?}...",
                            attempt, max_attempts, status, body, delay
                        );
                        tokio::time::sleep(delay).await;
                    } else {
                        return Err(format!("Storage upload failed after {} attempts (HTTP {}): {}", max_attempts, status, body));
                    }
                }
                Err(err) => {
                    if attempt < max_attempts {
                        let delay = Duration::from_millis(500 * (1 << (attempt - 1)));
                        tracing::warn!(
                            "⚠️ [Upload failed -> Retrying] Attempt {}/{} network error: {}. Waiting {:?}...",
                            attempt, max_attempts, err, delay
                        );
                        tokio::time::sleep(delay).await;
                    } else {
                        return Err(format!("Storage upload network error after {} attempts: {}", max_attempts, err));
                    }
                }
            }
        }

        Err("Storage upload retry attempts exhausted".to_string())
    }

    /// Save screenshot metadata record in public.screenshots table
    pub async fn save_screenshot_metadata(
        &self,
        employee_id: &str,
        device_id: &str,
        storage_path: &str,
        screenshot: &CompressedScreenshot,
    ) -> Result<(), String> {
        let record = ScreenshotDbRecord {
            employee_id: employee_id.to_string(),
            device_id: None, // Or device UUID if matched
            storage_path: storage_path.to_string(),
            file_size_bytes: screenshot.file_size_bytes,
            width: screenshot.width,
            height: screenshot.height,
            captured_at: screenshot.captured_at,
        };

        let url = format!("{}/rest/v1/screenshots", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&[record])
            .send()
            .await
            .map_err(|e| format!("Screenshot DB metadata insert failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!("public.screenshots insert returned ({}): {}", status, body);
        }

        // Also insert into legacy screenshot_records for backward compatibility
        let legacy_record = LegacyScreenshotRecord {
            employee_id: employee_id.to_string(),
            device_id: device_id.to_string(),
            storage_path: storage_path.to_string(),
            file_size_bytes: screenshot.file_size_bytes,
            captured_at: screenshot.captured_at,
        };

        let legacy_url = format!("{}/rest/v1/screenshot_records", self.base_url);
        let _ = self.client.post(&legacy_url).json(&[legacy_record]).send().await;

        Ok(())
    }

    /// Pull single-row office-hours policy from public.agent_runtime_config (if present).
    pub async fn fetch_office_hours_config(&self) -> Result<Option<RemoteOfficeHoursRow>, String> {
        let url = format!(
            "{}/rest/v1/agent_runtime_config?id=eq.1&select=enabled,work_start,work_end,work_days,capture_outside_hours",
            self.base_url
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Office-hours config request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Office-hours config HTTP {}: {}", status, body));
        }

        let rows: Vec<RemoteOfficeHoursRow> = resp
            .json()
            .await
            .map_err(|e| format!("Office-hours config parse failed: {}", e))?;
        Ok(rows.into_iter().next())
    }

    pub async fn fetch_pending_commands(
        &self,
        employee_id: &str,
    ) -> Result<Vec<crate::commands::AgentCommandRow>, String> {
        let url = format!(
            "{}/rest/v1/agent_commands?employee_id=eq.{}&status=eq.pending&order=created_at.asc&limit=10",
            self.base_url, employee_id
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Command poll failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Command poll HTTP {}: {}", status, body));
        }
        resp.json()
            .await
            .map_err(|e| format!("Command poll parse failed: {}", e))
    }

    pub async fn update_command_status(
        &self,
        command_id: &str,
        status: &str,
        result: serde_json::Value,
    ) -> Result<(), String> {
        let url = format!(
            "{}/rest/v1/agent_commands?id=eq.{}",
            self.base_url, command_id
        );
        let body = serde_json::json!({
            "status": status,
            "result": result,
            "updated_at": Utc::now().to_rfc3339(),
        });
        let resp = self
            .client
            .patch(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Command status update failed: {}", e))?;
        if !resp.status().is_success() {
            let status_code = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!(
                "Command status update HTTP {}: {}",
                status_code, text
            ));
        }
        Ok(())
    }

    pub async fn upsert_live_session(
        &self,
        employee_id: &str,
        active: bool,
        storage_path: Option<&str>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<(), String> {
        let url = format!("{}/rest/v1/employee_live_sessions", self.base_url);
        let row = serde_json::json!({
            "employee_id": employee_id,
            "active": active,
            "storage_path": storage_path,
            "width": width,
            "height": height,
            "updated_at": Utc::now().to_rfc3339(),
        });
        let resp = self
            .client
            .post(&url)
            .header("Prefer", "resolution=merge-duplicates")
            .json(&row)
            .send()
            .await
            .map_err(|e| format!("Live session upsert failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Live session upsert HTTP {}: {}", status, body));
        }
        Ok(())
    }

    pub async fn insert_activity_aggregate(
        &self,
        payload: &crate::activity::ActivityAggregatePayload,
    ) -> Result<(), String> {
        let url = format!("{}/rest/v1/activity_aggregates", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&[payload])
            .send()
            .await
            .map_err(|e| format!("activity_aggregates insert failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("activity_aggregates HTTP {}: {}", status, body));
        }
        Ok(())
    }

    pub async fn insert_activity_event(
        &self,
        employee_id: &str,
        device_id: &str,
        event_type: &str,
        window_title: &str,
        is_idle: bool,
    ) -> Result<(), String> {
        let url = format!("{}/rest/v1/activity_events", self.base_url);
        let row = serde_json::json!({
            "employee_id": employee_id,
            "device_id": device_id,
            "event_type": event_type,
            "occurred_at": Utc::now().to_rfc3339(),
            "metadata": {
                "window": window_title,
                "window_title": window_title,
                "is_idle": is_idle,
            }
        });
        let resp = self
            .client
            .post(&url)
            .json(&[row])
            .send()
            .await
            .map_err(|e| format!("activity_events insert failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("activity_events HTTP {}: {}", status, body));
        }
        Ok(())
    }

    pub async fn insert_screen_recording(
        &self,
        row: serde_json::Value,
    ) -> Result<(), String> {
        let url = format!("{}/rest/v1/screen_recordings", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&row)
            .send()
            .await
            .map_err(|e| format!("screen_recordings insert failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("screen_recordings insert HTTP {}: {}", status, body));
        }
        Ok(())
    }
}
