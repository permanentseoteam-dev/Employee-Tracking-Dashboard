#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, POINT};
#[cfg(windows)]
use windows_sys::Win32::System::SystemInformation::GetTickCount64;
#[cfg(windows)]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, GetLastInputInfo, LASTINPUTINFO};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetForegroundWindow, GetWindowTextW};

#[derive(Debug, Clone)]
pub struct InputActivitySnapshot {
    pub idle_duration_seconds: u64,
    pub is_user_idle: bool,
    pub active_window_title: String,
    pub key_presses: u32,
    pub mouse_moves: u32,
    pub mouse_clicks: u32,
}

pub struct WindowsInputTracker {
    idle_threshold_seconds: u64,
    #[cfg(windows)]
    prev_key_down: [bool; 256],
    #[cfg(windows)]
    prev_mouse_buttons: [bool; 3],
    #[cfg(windows)]
    prev_cursor: Option<(i32, i32)>,
    #[cfg(windows)]
    primed: bool,
}

impl WindowsInputTracker {
    pub fn new(idle_threshold_seconds: u64) -> Self {
        Self {
            idle_threshold_seconds,
            #[cfg(windows)]
            prev_key_down: [false; 256],
            #[cfg(windows)]
            prev_mouse_buttons: [false; 3],
            #[cfg(windows)]
            prev_cursor: None,
            #[cfg(windows)]
            primed: false,
        }
    }

    #[cfg(windows)]
    pub fn get_snapshot(&mut self) -> InputActivitySnapshot {
        let idle_duration_seconds = Self::get_idle_seconds_native();
        let is_user_idle = idle_duration_seconds >= self.idle_threshold_seconds;
        let active_window_title = Self::get_foreground_window_title();
        let (key_presses, mouse_moves, mouse_clicks) = self.sample_input_deltas();

        InputActivitySnapshot {
            idle_duration_seconds,
            is_user_idle,
            active_window_title,
            key_presses,
            mouse_moves,
            mouse_clicks,
        }
    }

    #[cfg(not(windows))]
    pub fn get_snapshot(&mut self) -> InputActivitySnapshot {
        InputActivitySnapshot {
            idle_duration_seconds: 0,
            is_user_idle: false,
            active_window_title: "Non-Windows".into(),
            key_presses: 0,
            mouse_moves: 0,
            mouse_clicks: 0,
        }
    }

    #[cfg(windows)]
    fn sample_input_deltas(&mut self) -> (u32, u32, u32) {
        let mut key_presses = 0u32;
        let mut mouse_clicks = 0u32;
        let mut mouse_moves = 0u32;

        for vk in 0x08u32..=0xFEu32 {
            let down = unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000 != 0;
            let was_down = self.prev_key_down[vk as usize];
            if self.primed && down && !was_down {
                key_presses = key_presses.saturating_add(1);
            }
            self.prev_key_down[vk as usize] = down;
        }

        const MOUSE_VKS: [i32; 3] = [0x01, 0x02, 0x04];
        for (i, vk) in MOUSE_VKS.iter().enumerate() {
            let down = unsafe { GetAsyncKeyState(*vk) } as u16 & 0x8000 != 0;
            let was_down = self.prev_mouse_buttons[i];
            if self.primed && down && !was_down {
                mouse_clicks = mouse_clicks.saturating_add(1);
            }
            self.prev_mouse_buttons[i] = down;
        }

        let mut point = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point) } != 0 {
            if let Some((px, py)) = self.prev_cursor {
                if self.primed && (point.x != px || point.y != py) {
                    mouse_moves = 1;
                }
            }
            self.prev_cursor = Some((point.x, point.y));
        }

        self.primed = true;
        (key_presses, mouse_moves, mouse_clicks)
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
                let tick_32 = (current_tick & 0xFFFF_FFFF) as u32;
                tick_32.wrapping_sub(lii.dwTime) as u64 / 1000
            } else {
                0
            }
        }
    }

    #[cfg(windows)]
    fn get_foreground_window_title() -> String {
        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd == 0 {
                return "Desktop".into();
            }
            let mut buffer = [0u16; 256];
            let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
            if len > 0 {
                String::from_utf16_lossy(&buffer[..len as usize])
            } else {
                "Unknown Window".into()
            }
        }
    }
}
