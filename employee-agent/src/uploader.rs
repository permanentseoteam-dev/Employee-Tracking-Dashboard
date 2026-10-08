use crate::auth::AuthManager;
use crate::compression::CompressedScreenshot;
use crate::device::DeviceInfo;
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
}
