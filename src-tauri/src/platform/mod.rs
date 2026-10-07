pub mod windows;

pub trait PlatformService: Send + Sync {
    fn get_hostname(&self) -> String;
    fn get_os_info(&self) -> (String, String);
    fn get_device_id(&self) -> String;
}

/// Factory function to create platform-specific service implementation.
pub fn create_platform_service() -> Box<dyn PlatformService> {
    #[cfg(target_os = "windows")]
    {
        Box::new(windows::WindowsPlatformService::new())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Box::new(windows::WindowsPlatformService::new())
    }
}
