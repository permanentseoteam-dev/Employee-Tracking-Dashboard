use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpsertPayload {
    pub employee_id: String,
    pub device_id: String,
    pub status: String,
    pub last_activity_at: DateTime<Utc>,
    pub idle_since: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEventPayload {
    pub employee_id: String,
    pub device_id: String,
    pub event_type: String,
    pub occurred_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ActivityAggregatePayload {
    pub employee_id: String,
    pub device_id: String,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub key_press_count: u32,
    pub mouse_move_count: u32,
    pub mouse_click_count: u32,
    pub active_seconds: u32,
    pub idle_seconds: u32,
    pub is_idle: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ScreenshotRecordPayload {
    pub employee_id: String,
    pub device_id: String,
    pub captured_at: DateTime<Utc>,
    pub storage_path: String,
    pub file_size_bytes: usize,
}
