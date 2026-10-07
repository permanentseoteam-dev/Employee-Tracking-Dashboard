use super::PlatformService;
use std::env;

pub struct WindowsPlatformService {
    cached_device_id: String,
}

impl WindowsPlatformService {
    pub fn new() -> Self {
        let hostname = env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN-PC".to_string());
        let user = env::var("USERNAME").unwrap_or_else(|_| "UNKNOWN-USER".to_string());

        // Derive consistent device identifier without storing sensitive data
        let device_id = format!("WIN-{}-{}", hostname, user);

        Self {
            cached_device_id: device_id,
        }
    }
}

impl Default for WindowsPlatformService {
    fn default() -> Self {
        Self::new()
    }
}

impl PlatformService for WindowsPlatformService {
    fn get_hostname(&self) -> String {
        env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN-PC".to_string())
    }

    fn get_os_info(&self) -> (String, String) {
        ("Windows".to_string(), env::consts::OS.to_string())
    }

    fn get_device_id(&self) -> String {
        self.cached_device_id.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_platform_service() {
        let service = WindowsPlatformService::new();
        assert!(!service.get_hostname().is_empty());
        assert!(!service.get_device_id().is_empty());
        let (os_name, _) = service.get_os_info();
        assert_eq!(os_name, "Windows");
    }
}
