use crate::core::error::{AppError, AppResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    pub screenshot_interval_secs: u64,
    pub screenshot_quality: u8,
    pub screenshot_width: u32,
    pub screenshot_height: u32,
    pub idle_threshold_secs: u64,
    pub track_keyboard: bool,
    pub track_mouse: bool,
    pub track_screenshots: bool,
    pub server_url: String,
    pub version: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            screenshot_interval_secs: 300,
            screenshot_quality: 80,
            screenshot_width: 1920,
            screenshot_height: 1080,
            idle_threshold_secs: 180,
            track_keyboard: true,
            track_mouse: true,
            track_screenshots: true,
            server_url: "http://localhost:8080".to_string(),
            version: 1,
        }
    }
}

impl AppConfig {
    pub fn validate(&self) -> AppResult<()> {
        if self.screenshot_interval_secs < 30 {
            return Err(AppError::Validation(
                "Screenshot interval must be at least 30 seconds to prevent resource exhaustion"
                    .to_string(),
            ));
        }
        if self.screenshot_quality < 10 || self.screenshot_quality > 100 {
            return Err(AppError::Validation(
                "Screenshot quality must be between 10 and 100".to_string(),
            ));
        }
        if self.idle_threshold_secs < 10 {
            return Err(AppError::Validation(
                "Idle threshold must be at least 10 seconds".to_string(),
            ));
        }
        if self.server_url.trim().is_empty() {
            return Err(AppError::Validation(
                "Server URL cannot be empty".to_string(),
            ));
        }
        Ok(())
    }

    /// Load configuration from the local SQLite database.
    /// If not present, inserts defaults and returns them.
    pub fn load_or_init(conn: &Connection) -> AppResult<Self> {
        let mut stmt = conn.prepare("SELECT value FROM app_config WHERE key = 'active_config'")?;
        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            let json_str: String = row.get(0)?;
            let config: AppConfig = serde_json::from_str(&json_str)?;
            config.validate()?;
            Ok(config)
        } else {
            let default_config = AppConfig::default();
            default_config.save(conn)?;
            Ok(default_config)
        }
    }

    /// Persist current configuration into SQLite.
    pub fn save(&self, conn: &Connection) -> AppResult<()> {
        self.validate()?;
        let json_str = serde_json::to_string_pretty(self)?;
        conn.execute(
            "INSERT INTO app_config (key, value, updated_at) 
             VALUES ('active_config', ?1, datetime('now', 'utc'))
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = datetime('now', 'utc')",
            params![json_str],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_is_valid() {
        let config = AppConfig::default();
        assert!(config.validate().is_ok());
        assert_eq!(config.screenshot_interval_secs, 300);
        assert_eq!(config.idle_threshold_secs, 180);
    }

    #[test]
    fn test_invalid_screenshot_interval() {
        let mut config = AppConfig::default();
        config.screenshot_interval_secs = 10;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_invalid_quality() {
        let mut config = AppConfig::default();
        config.screenshot_quality = 105;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_sqlite_persistence() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .unwrap();

        let initial = AppConfig::load_or_init(&conn).unwrap();
        assert_eq!(initial, AppConfig::default());

        let mut updated = initial.clone();
        updated.idle_threshold_secs = 120;
        updated.screenshot_interval_secs = 180;
        updated.save(&conn).unwrap();

        let loaded = AppConfig::load_or_init(&conn).unwrap();
        assert_eq!(loaded.idle_threshold_secs, 120);
        assert_eq!(loaded.screenshot_interval_secs, 180);
    }
}
