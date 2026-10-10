use crate::errors::AgentResult;
use rusqlite::Connection;
use std::env;
use std::path::PathBuf;

pub const DEFAULT_SUPABASE_URL: &str = "https://isywkcymfzpgjerfuors.supabase.co";
pub const DEFAULT_SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs";
pub const DEFAULT_EMPLOYEE_ID: &str = "304c14cc-995b-424e-a30f-a8e8418591cc"; // Real employee UUID in Supabase (Arsal)

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
        // 1. Try loading .env from directory containing current executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let _ = dotenvy::from_path(exe_dir.join(".env"));
                let _ = dotenvy::from_path(exe_dir.join("agent_config.env"));
            }
        }

        // 2. Try loading .env from current directory, then parent directory
        if dotenvy::dotenv().is_err() {
            let _ = dotenvy::from_path("../.env");
        }

        // 3. Fallback to %LOCALAPPDATA%\EmployeeTracking\.env
        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            let _ = dotenvy::from_path(PathBuf::from(local_app_data).join("EmployeeTracking").join(".env"));
        }

        // Credentials with embedded production fallbacks for zero-command double-click execution
        let supabase_url = env::var("VITE_SUPABASE_URL")
            .or_else(|_| env::var("SUPABASE_URL"))
            .unwrap_or_else(|_| DEFAULT_SUPABASE_URL.to_string())
            .trim_end_matches('/')
            .to_string();

        let supabase_anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .or_else(|_| env::var("SUPABASE_ANON_KEY"))
            .unwrap_or_else(|_| DEFAULT_SUPABASE_ANON_KEY.to_string());

        // Derive consistent device identifier without storing sensitive machine secrets
        let hostname = env::var("COMPUTERNAME")
            .or_else(|_| env::var("HOSTNAME"))
            .unwrap_or_else(|_| "DESKTOP-AGENT".to_string());

        let username = env::var("USERNAME")
            .or_else(|_| env::var("USER"))
            .unwrap_or_else(|_| "User".to_string());

        let device_id = env::var("DEVICE_ID")
            .unwrap_or_else(|_| format!("WIN-{}-{}", hostname, username));

        // Resolve authenticated employee identity dynamically
        let employee_id = env::var("AGENT_EMPLOYEE_ID")
            .or_else(|_| env::var("EMPLOYEE_ID"))
            .unwrap_or_else(|_| {
                Self::read_employee_from_local_config().unwrap_or_else(|| {
                    Self::read_employee_from_sqlite().unwrap_or_else(|| {
                        let u_lower = username.to_lowercase();
                        if u_lower.contains("michael") || u_lower.contains("chen") {
                            // Seeded employee ID for Michael Chen in Supabase
                            "dddddddd-dddd-dddd-dddd-dddddddddddd".to_string()
                        } else {
                            // Seeded employee ID for Arsal in Supabase
                            DEFAULT_EMPLOYEE_ID.to_string()
                        }
                    })
                })
            });

        let idle_threshold_seconds = env::var("IDLE_THRESHOLD_SECS")
            .or_else(|_| env::var("IDLE_THRESHOLD_SECONDS"))
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let poll_interval_millis = env::var("POLL_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1000);

        let heartbeat_interval_seconds = env::var("HEARTBEAT_INTERVAL_SECS")
            .or_else(|_| env::var("HEARTBEAT_SECS"))
            .or_else(|_| env::var("HEARTBEAT_INTERVAL_SECONDS"))
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);

        let batch_flush_interval_seconds = env::var("BATCH_FLUSH_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let screenshot_interval_seconds = env::var("SCREENSHOT_INTERVAL_SECS")
            .or_else(|_| env::var("SCREENSHOT_INTERVAL_SECONDS"))
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

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

    fn read_employee_from_local_config() -> Option<String> {
        let local_app_data = env::var("LOCALAPPDATA").ok()?;
        let config_file = PathBuf::from(local_app_data)
            .join("EmployeeTracking")
            .join("config.json");

        if !config_file.exists() {
            return None;
        }

        let content = std::fs::read_to_string(config_file).ok()?;
        let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;
        parsed.get("employee_id").and_then(|v| v.as_str()).map(|s| s.to_string())
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
        let cfg = AgentConfig::load().expect("AgentConfig should load with built-in fallbacks");
        assert!(cfg.supabase_url.starts_with("https://"));
        assert!(!cfg.employee_id.is_empty());
    }
}
