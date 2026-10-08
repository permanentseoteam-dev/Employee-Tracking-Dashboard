use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_name: String,
    pub device_identifier: String,
    pub os_version: String,
    pub agent_version: String,
}

impl DeviceInfo {
    pub fn detect(override_id: Option<String>) -> Self {
        let hostname = env::var("COMPUTERNAME")
            .or_else(|_| env::var("HOSTNAME"))
            .unwrap_or_else(|_| "DESKTOP-WORKSTATION".to_string());

        let username = env::var("USERNAME")
            .or_else(|_| env::var("USER"))
            .unwrap_or_else(|_| "user".to_string());

        let device_identifier = match override_id {
            Some(id) if !id.trim().is_empty() => id.trim().to_string(),
            _ => format!("WIN-{}-{}", hostname, username),
        };

        let os_version = if cfg!(target_os = "windows") {
            "Windows 10/11 x86_64".to_string()
        } else if cfg!(target_os = "macos") {
            "macOS aarch64/x86_64".to_string()
        } else {
            "Linux x86_64".to_string()
        };

        Self {
            device_name: hostname,
            device_identifier,
            os_version,
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_detection() {
        let dev = DeviceInfo::detect(Some("CUSTOM-ID".into()));
        assert_eq!(dev.device_identifier, "CUSTOM-ID");
        assert_eq!(dev.agent_version, "0.1.0");
    }
}
