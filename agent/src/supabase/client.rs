use crate::errors::{AgentError, AgentResult};
use crate::supabase::models::{
    ActivityAggregatePayload, ActivityEventPayload, PresenceUpsertPayload, ScreenshotRecordPayload,
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

        Ok(Self {
            client,
            base_url: base,
            presence_url,
            events_url,
            aggregates_url,
            screenshots_db_url,
        })
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

    /// Insert screenshot metadata record in Supabase DB
    #[allow(dead_code)]
    pub async fn insert_screenshot_record(&self, payload: &ScreenshotRecordPayload) -> AgentResult<()> {
        let resp = self
            .client
            .post(&self.screenshots_db_url)
            .json(&[payload])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AgentError::Supabase(format!(
                "Failed to insert screenshot record (status {}): {}",
                status, body
            )));
        }

        Ok(())
    }
}
