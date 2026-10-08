use crate::auth::AuthManager;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct PresenceHeartbeatPayload {
    pub employee_id: String,
    pub device_id: String,
    pub status: String,
    pub last_activity_at: DateTime<Utc>,
    pub idle_since: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmployeeStatusUpdate {
    pub status: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct HeartbeatService {
    client: Client,
    base_url: String,
    idle_threshold_secs: u64,
}

impl HeartbeatService {
    pub fn new(supabase_url: &str, anon_key: &str, idle_threshold_secs: u64) -> Result<Self, String> {
        let auth = AuthManager::new(anon_key);
        let headers = auth.build_headers()?;

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(10))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| format!("Failed to build Heartbeat HTTP client: {}", e))?;

        let base_url = supabase_url.trim_end_matches('/').to_string();

        Ok(Self {
            client,
            base_url,
            idle_threshold_secs,
        })
    }

    /// Check if the local Windows workstation is currently idle using GetLastInputInfo
    #[cfg(target_os = "windows")]
    pub fn check_idle(&self) -> (bool, u64) {
        use windows_sys::Win32::System::SystemInformation::GetTickCount;
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

        unsafe {
            let mut lii: LASTINPUTINFO = std::mem::zeroed();
            lii.cbSize = std::mem::size_of::<LASTINPUTINFO>() as u32;

            if GetLastInputInfo(&mut lii) != 0 {
                let current_tick = GetTickCount();
                let idle_millis = current_tick.saturating_sub(lii.dwTime);
                let idle_secs = (idle_millis / 1000) as u64;
                let is_idle = idle_secs >= self.idle_threshold_secs;
                (is_idle, idle_secs)
            } else {
                (false, 0)
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn check_idle(&self) -> (bool, u64) {
        (false, 0)
    }

    /// Send heartbeat to Supabase
    pub async fn send_heartbeat(&self, employee_id: &str, device_id: &str, is_idle: bool) -> Result<(), String> {
        let status = if is_idle { "idle" } else { "active" };
        let now = Utc::now();

        let payload = PresenceHeartbeatPayload {
            employee_id: employee_id.to_string(),
            device_id: device_id.to_string(),
            status: status.to_string(),
            last_activity_at: now,
            idle_since: if is_idle { Some(now) } else { None },
            updated_at: now,
        };

        // 1. Upsert employee_presence
        let presence_url = format!("{}/rest/v1/employee_presence", self.base_url);
        let resp = self
            .client
            .post(&presence_url)
            .header("Prefer", "resolution=merge-duplicates")
            .json(&[payload])
            .send()
            .await
            .map_err(|e| format!("Presence heartbeat request error: {}", e))?;

        if !resp.status().is_success() {
            let s = resp.status();
            let b = resp.text().await.unwrap_or_default();
            tracing::warn!("Presence heartbeat warning ({}): {}", s, b);
        }

        // 2. Update employee status in public.employees
        let emp_url = format!("{}/rest/v1/employees?id=eq.{}", self.base_url, employee_id);
        let emp_update = EmployeeStatusUpdate {
            status: status.to_string(),
            updated_at: now,
        };
        let _ = self.client.patch(&emp_url).json(&emp_update).send().await;

        Ok(())
    }
}
