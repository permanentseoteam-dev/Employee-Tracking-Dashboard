use crate::errors::{AgentError, AgentResult};
use crate::supabase::models::{
    ActivityAggregatePayload, ActivityEventPayload, DeviceQueryItem, DeviceRegisterPayload,
    EmployeeLookupItem, PresenceUpsertPayload, ScreenshotDbPayload, ScreenshotRecordPayload,
};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use std::time::Duration;

#[derive(Clone)]
#[allow(dead_code)]
pub struct SupabaseClient {
    client: Client,
    base_url: String,
    presence_url: String,
    events_url: String,
    aggregates_url: String,
    screenshots_db_url: String,
    screenshots_main_url: String,
    devices_url: String,
    employees_url: String,
}

impl SupabaseClient {
    pub fn new(supabase_url: &str, anon_key: &str) -> AgentResult<Self> {
        let mut headers = HeaderMap::new();

        let mut key_val = HeaderValue::from_str(anon_key)
            .map_err(|e| AgentError::Config(format!("Invalid anon key header: {}", e)))?;
        key_val.set_sensitive(true);

        headers.insert("apikey", key_val.clone());

        let mut auth_val = HeaderValue::from_str(&format!("Bearer {}", anon_key))
            .map_err(|e| AgentError::Config(format!("Invalid auth token: {}", e)))?;
        auth_val.set_sensitive(true);

        headers.insert(AUTHORIZATION, auth_val);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(AgentError::Network)?;

        let base = supabase_url.trim_end_matches('/').to_string();
        let presence_url = format!("{}/rest/v1/employee_presence", base);
        let events_url = format!("{}/rest/v1/activity_events", base);
        let aggregates_url = format!("{}/rest/v1/activity_aggregates", base);
        let screenshots_db_url = format!("{}/rest/v1/screenshot_records", base);
        let screenshots_main_url = format!("{}/rest/v1/screenshots", base);
        let devices_url = format!("{}/rest/v1/devices", base);
        let employees_url = format!("{}/rest/v1/employees", base);

        Ok(Self {
            client,
            base_url: base,
            presence_url,
            events_url,
            aggregates_url,
            screenshots_db_url,
            screenshots_main_url,
            devices_url,
            employees_url,
        })
    }

    /// Check if this device is already registered and mapped to an employee
    pub async fn lookup_assigned_employee(&self, device_identifier: &str) -> Option<String> {
        let url = format!(
            "{}?device_identifier=eq.{}&select=id,employee_id,device_identifier&limit=1",
            self.devices_url, device_identifier
        );
        if let Ok(resp) = self.client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(items) = resp.json::<Vec<DeviceQueryItem>>().await {
                    if let Some(first) = items.first() {
                        if !first.employee_id.trim().is_empty() {
                            return Some(first.employee_id.clone());
                        }
                    }
                }
            }
        }
        None
    }

    /// Retrieve all employees for automatic matching by Windows username
    pub async fn lookup_employees(&self) -> AgentResult<Vec<EmployeeLookupItem>> {
        let url = format!("{}?select=id,full_name,email", self.employees_url);
        let resp = self.client.get(&url).send().await?;
        if resp.status().is_success() {
            let employees = resp.json::<Vec<EmployeeLookupItem>>().await.unwrap_or_default();
            Ok(employees)
        } else {
            Ok(vec![])
        }
    }

    /// Register or update device metadata in public.devices
    pub async fn register_device(&self, payload: &DeviceRegisterPayload) -> AgentResult<()> {
        let query_url = format!(
            "{}?device_identifier=eq.{}&select=id&limit=1",
            self.devices_url, payload.device_identifier
        );

        if let Ok(resp) = self.client.get(&query_url).send().await {
            if resp.status().is_success() {
                if let Ok(existing) = resp.json::<Vec<serde_json::Value>>().await {
                    if let Some(first) = existing.first() {
                        if let Some(id) = first.get("id").and_then(|v| v.as_str()) {
                            let patch_url = format!("{}?id=eq.{}", self.devices_url, id);
                            let update_body = serde_json::json!({
                                "last_seen_at": payload.last_seen_at,
                                "agent_version": payload.agent_version,
                                "os_version": payload.os_version,
                                "device_name": payload.device_name
                            });
                            let _ = self.client.patch(&patch_url).json(&update_body).send().await;
                            return Ok(());
                        }
                    }
                }
            }
        }

        // If not existing, insert new row
        let resp = self
            .client
            .post(&self.devices_url)
            .json(&[payload])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!("Device registration response (status {}): {}", status, body);
        }

        Ok(())
    }

    /// Upsert employee presence record (merges on primary key employee_id, device_id)
    pub async fn upsert_presence(&self, payload: &PresenceUpsertPayload) -> AgentResult<()> {
        let resp = self
            .client
            .post(&self.presence_url)
            .header("Prefer", "resolution=merge-duplicates")
            .json(&[payload])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AgentError::Supabase(format!(
                "Failed to upsert presence (status {}): {}",
                status, body
            )));
        }

        Ok(())
    }

    /// Insert a batch of activity events
    pub async fn insert_activity_events(&self, events: &[ActivityEventPayload]) -> AgentResult<()> {
        if events.is_empty() {
            return Ok(());
        }

        let resp = self
            .client
            .post(&self.events_url)
            .json(events)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AgentError::Supabase(format!(
                "Failed to insert activity events (status {}): {}",
                status, body
            )));
        }

        Ok(())
    }

    /// Insert an activity aggregate window (60s summary telemetry)
    #[allow(dead_code)]
    pub async fn insert_activity_aggregate(&self, payload: &ActivityAggregatePayload) -> AgentResult<()> {
        let resp = self
            .client
            .post(&self.aggregates_url)
            .json(&[payload])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AgentError::Supabase(format!(
                "Failed to insert activity aggregate (status {}): {}",
                status, body
            )));
        }

        Ok(())
    }

    /// Upload compressed screenshot binary to Supabase Storage bucket 'screenshots'
    #[allow(dead_code)]
    pub async fn upload_screenshot_storage(&self, path: &str, jpeg_bytes: Vec<u8>) -> AgentResult<()> {
        let upload_url = format!("{}/storage/v1/object/screenshots/{}", self.base_url, path);

        let resp = self
            .client
            .post(&upload_url)
            .header(CONTENT_TYPE, "image/jpeg")
            .header("x-upsert", "true")
            .body(jpeg_bytes)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AgentError::Supabase(format!(
                "Failed to upload screenshot to storage (status {}): {}",
                status, body
            )));
        }

        Ok(())
    }

    /// Insert screenshot metadata record in Supabase DB (both screenshot_records and public.screenshots)
    #[allow(dead_code)]
    pub async fn insert_screenshot_record(
        &self,
        payload: &ScreenshotRecordPayload,
        width: u32,
        height: u32,
    ) -> AgentResult<()> {
        // 1. Insert into public.screenshot_records
        let resp = self
            .client
            .post(&self.screenshots_db_url)
            .json(&[payload])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(
                "Failed to insert screenshot_records (status {}): {}",
                status, body
            );
        }

        // 2. Insert into public.screenshots (for live telemetry and card thumbnail real-time events)
        let main_record = ScreenshotDbPayload {
            employee_id: payload.employee_id.clone(),
            device_id: None,
            storage_path: payload.storage_path.clone(),
            file_size_bytes: payload.file_size_bytes,
            width,
            height,
            captured_at: payload.captured_at,
        };

        let _ = self
            .client
            .post(&self.screenshots_main_url)
            .json(&[main_record])
            .send()
            .await;

        Ok(())
    }
}
