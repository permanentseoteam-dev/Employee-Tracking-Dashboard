use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceIdentity {
    pub device_id: String,
    pub device_name: String,
    pub os_version: String,
    pub agent_version: String,
}

impl DeviceIdentity {
    pub fn get_or_create(configured_device_id: Option<String>) -> Self {
        let device_name = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "WIN-DEVICE-01".to_string());

        let device_id = if let Some(id) = configured_device_id {
            if !id.trim().is_empty() {
                id
            } else {
                Self::generate_stable_id(&device_name)
            }
        } else {
            Self::generate_stable_id(&device_name)
        };

        let os_version = if cfg!(target_os = "windows") {
            "Windows 10/11 x86_64".to_string()
        } else {
            std::env::consts::OS.to_string()
        };

        Self {
            device_id,
            device_name,
            os_version,
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    fn generate_stable_id(name: &str) -> String {
        let username = std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
        let seed = format!("{}-{}", name, username);
        let namespace = uuid::Uuid::NAMESPACE_DNS;
        let uuid = uuid::Uuid::new_v5(&namespace, seed.as_bytes());
        format!("WIN-{}", &uuid.to_string()[..8].to_uppercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_identity_deterministic() {
        let id1 = DeviceIdentity::generate_stable_id("TEST-HOST");
        let id2 = DeviceIdentity::generate_stable_id("TEST-HOST");
        assert_eq!(id1, id2);
        assert!(id1.starts_with("WIN-"));
    }

    #[test]
    fn test_custom_device_id_override() {
        let identity = DeviceIdentity::get_or_create(Some("CUSTOM-ID-99".to_string()));
        assert_eq!(identity.device_id, "CUSTOM-ID-99");
    }
}
