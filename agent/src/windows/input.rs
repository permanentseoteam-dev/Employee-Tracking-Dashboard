#[cfg(windows)]
use windows_sys::Win32::Foundation::HWND;
#[cfg(windows)]
use windows_sys::Win32::System::SystemInformation::GetTickCount64;
#[cfg(windows)]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

#[derive(Debug, Clone)]
pub struct InputActivitySnapshot {
    pub idle_duration_seconds: u64,
    pub is_user_idle: bool,
    pub active_window_title: String,
}

pub struct WindowsInputTracker {
    idle_threshold_seconds: u64,
}

impl WindowsInputTracker {
    pub fn new(idle_threshold_seconds: u64) -> Self {
        Self {
            idle_threshold_seconds,
        }
    }

    #[cfg(windows)]
    pub fn get_snapshot(&self) -> InputActivitySnapshot {
        let idle_duration_seconds = Self::get_idle_seconds_native();
        let is_user_idle = idle_duration_seconds >= self.idle_threshold_seconds;
        let active_window_title = Self::get_foreground_window_title();

        InputActivitySnapshot {
            idle_duration_seconds,
            is_user_idle,
            active_window_title,
        }
    }

    #[cfg(not(windows))]
    pub fn get_snapshot(&self) -> InputActivitySnapshot {
        InputActivitySnapshot {
            idle_duration_seconds: 0,
            is_user_idle: false,
            active_window_title: "Non-Windows Platform".to_string(),
        }
    }

    #[cfg(windows)]
    fn get_idle_seconds_native() -> u64 {
        unsafe {
            let mut lii = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };

            if GetLastInputInfo(&mut lii) != 0 {
                let current_tick = GetTickCount64();
                // Handle 32-bit tick count wrapping safely
                let tick_32 = (current_tick & 0xFFFF_FFFF) as u32;
                let idle_millis = tick_32.wrapping_sub(lii.dwTime) as u64;

                idle_millis / 1000
            } else {
                0
            }
        }
    }

    #[cfg(windows)]
    fn get_foreground_window_title() -> String {
        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.is_null() {
                return "Desktop / Background".to_string();
            }

            let mut buffer = [0u16; 256];
            let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
            if len > 0 {
                String::from_utf16_lossy(&buffer[..len as usize])
            } else {
                "Unknown Window".to_string()
            }
        }
    }
}
