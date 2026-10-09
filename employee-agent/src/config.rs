use crate::office_hours::OfficeHoursConfig;
use std::env;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub employee_id: String,
    pub device_id_override: Option<String>,
    pub screenshot_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub idle_threshold_secs: u64,
    pub screenshot_quality: u8,
    pub config_refresh_secs: u64,
    pub office_hours: OfficeHoursConfig,
}

impl AgentConfig {
    pub fn load() -> Result<Self, String> {
        // Attempt to load .env from current directory or parent
        let _ = dotenvy::dotenv();

        let supabase_url = env::var("SUPABASE_URL")
            .or_else(|_| env::var("VITE_SUPABASE_URL"))
            .map_err(|_| "Missing SUPABASE_URL environment variable".to_string())?
            .trim_end_matches('/')
            .to_string();

        let supabase_anon_key = env::var("SUPABASE_ANON_KEY")
            .or_else(|_| env::var("VITE_SUPABASE_ANON_KEY"))
            .map_err(|_| "Missing SUPABASE_ANON_KEY environment variable".to_string())?;

        let employee_id = env::var("EMPLOYEE_ID")
            .or_else(|_| env::var("AGENT_EMPLOYEE_ID"))
            .unwrap_or_else(|_| "cccccccc-cccc-cccc-cccc-cccccccccccc".to_string());

        let device_id_override = env::var("DEVICE_ID").ok();

        let screenshot_interval_secs = env::var("SCREENSHOT_INTERVAL_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);

        let heartbeat_interval_secs = env::var("HEARTBEAT_INTERVAL_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(30);

        let idle_threshold_secs = env::var("IDLE_THRESHOLD_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);

        let screenshot_quality = env::var("SCREENSHOT_QUALITY")
            .ok()
            .and_then(|s| s.parse::<u8>().ok())
            .unwrap_or(70);

        let config_refresh_secs = env::var("CONFIG_REFRESH_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(300);

        let office_hours = OfficeHoursConfig::from_env_defaults();

        Ok(Self {
            supabase_url,
            supabase_anon_key,
            employee_id,
            device_id_override,
            screenshot_interval_secs,
            heartbeat_interval_secs,
            idle_threshold_secs,
            screenshot_quality,
            config_refresh_secs,
            office_hours,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_fallback() {
        env::set_var("SUPABASE_URL", "https://example.supabase.co");
        env::set_var("SUPABASE_ANON_KEY", "dummy-key");
        let cfg = AgentConfig::load().expect("Config should load");
        assert_eq!(cfg.supabase_url, "https://example.supabase.co");
        assert_eq!(cfg.screenshot_interval_secs, 60);
    }
}
