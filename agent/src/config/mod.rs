use crate::errors::{AgentError, AgentResult};
use rusqlite::Connection;
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub employee_id: String,
    pub device_id: String,
    pub idle_threshold_seconds: u64,
    pub poll_interval_millis: u64,
    pub heartbeat_interval_seconds: u64,
    pub batch_flush_interval_seconds: u64,
    pub screenshot_interval_seconds: u64,
    pub screenshot_quality: u8,
    pub screenshots_enabled: bool,
    pub max_local_queue_size: usize,
    pub sqlite_db_path: PathBuf,
}

impl AgentConfig {
    pub fn load() -> AgentResult<Self> {
        // Try loading .env from current directory, then parent directory
        if dotenvy::dotenv().is_err() {
            let _ = dotenvy::from_path("../.env");
        }

        let supabase_url = env::var("VITE_SUPABASE_URL")
            .or_else(|_| env::var("SUPABASE_URL"))
            .map_err(|_| AgentError::Config("Missing VITE_SUPABASE_URL or SUPABASE_URL in environment".into()))?;

        let supabase_anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .or_else(|_| env::var("SUPABASE_ANON_KEY"))
            .map_err(|_| AgentError::Config("Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in environment".into()))?;

        // Derive consistent device identifier without storing sensitive machine secrets
        let hostname = env::var("COMPUTERNAME").unwrap_or_else(|_| "WIN-AGENT-01".to_string());
        let username = env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
        let device_id = env::var("DEVICE_ID")
            .unwrap_or_else(|_| format!("WIN-{}-{}", hostname, username));

        // Resolve authenticated employee identity dynamically
        let employee_id = if let Ok(eid) = env::var("AGENT_EMPLOYEE_ID") {
            eid
        } else if let Some(eid) = Self::read_employee_from_sqlite() {
            eid
        } else {
            // Deterministic UUID namespace fallback for development
            let fallback_uuid = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_DNS, device_id.as_bytes()).to_string();
            fallback_uuid
        };

        let idle_threshold_seconds = env::var("IDLE_THRESHOLD_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let poll_interval_millis = env::var("POLL_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1000);

        let heartbeat_interval_seconds = env::var("HEARTBEAT_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let batch_flush_interval_seconds = env::var("BATCH_FLUSH_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let screenshot_interval_seconds = env::var("SCREENSHOT_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(300); // 5 minutes

        let screenshot_quality = env::var("SCREENSHOT_QUALITY")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(70);

        let screenshots_enabled = env::var("SCREENSHOTS_ENABLED")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);

        let max_local_queue_size = env::var("MAX_LOCAL_QUEUE_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5000);

        let sqlite_db_path = Self::resolve_db_path();

        Ok(Self {
            supabase_url,
            supabase_anon_key,
            employee_id,
            device_id,
            idle_threshold_seconds,
            poll_interval_millis,
            heartbeat_interval_seconds,
            batch_flush_interval_seconds,
            screenshot_interval_seconds,
            screenshot_quality,
            screenshots_enabled,
            max_local_queue_size,
            sqlite_db_path,
        })
    }

    fn resolve_db_path() -> PathBuf {
        let base = if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            PathBuf::from(local_app_data).join("EmployeeTracking")
        } else {
            PathBuf::from(".").join("data")
        };
        let _ = std::fs::create_dir_all(&base);
        base.join("agent_outbox.db")
    }

    fn read_employee_from_sqlite() -> Option<String> {
        let local_app_data = env::var("LOCALAPPDATA").ok()?;
        let db_path = PathBuf::from(local_app_data)
            .join("EmployeeTracking")
            .join("agent.db");

        if !db_path.exists() {
            return None;
        }

        let conn = Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ).ok()?;

        let mut stmt = conn.prepare("SELECT employee_id FROM auth_session ORDER BY created_at DESC LIMIT 1").ok()?;
        let mut rows = stmt.query([]).ok()?;

        if let Ok(Some(row)) = rows.next() {
            row.get::<_, String>(0).ok()
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_resolution() {
        let mut base_path = AgentConfig::resolve_db_path();
        assert!(base_path.to_string_lossy().contains("agent_outbox.db"));
    }
}
