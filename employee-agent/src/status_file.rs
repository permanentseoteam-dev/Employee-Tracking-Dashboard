use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct AgentStatusSnapshot {
    pub agent_version: String,
    pub employee_id: String,
    pub device_id: String,
    pub last_heartbeat_at: Option<String>,
    pub last_collection_at: Option<String>,
    pub last_upload_at: Option<String>,
    pub last_error: Option<String>,
    pub paused: bool,
    pub backend_ok: bool,
    /// Agent can poll agent_commands for live/record.
    pub supports_live_commands: bool,
    pub updated_at: String,
}

pub fn agent_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    PathBuf::from(base).join("EmployeeTracking").join("agent")
}

pub fn status_path() -> PathBuf {
    agent_dir().join("status.json")
}

pub fn pause_path() -> PathBuf {
    agent_dir().join("PAUSE")
}

pub fn stop_path() -> PathBuf {
    agent_dir().join("STOP")
}

pub fn is_paused() -> bool {
    pause_path().exists()
}

pub fn stop_requested() -> bool {
    stop_path().exists()
}

pub fn write_status(snap: &AgentStatusSnapshot) {
    let _ = fs::create_dir_all(agent_dir());
    if let Ok(raw) = serde_json::to_string_pretty(snap) {
        let _ = fs::write(status_path(), raw);
    }
}

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub fn parse_optional_rfc3339(s: &Option<String>) -> Option<DateTime<Utc>> {
    s.as_ref()
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|d| d.with_timezone(&Utc))
}
