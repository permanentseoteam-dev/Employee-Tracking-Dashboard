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
    #[allow(dead_code)]
    pub idle_duration_seconds: u64,
    pub is_user_idle: bool,
    pub active_window_title: String,
    pub key_presses: u32,
    pub mouse_moves: u32,
    pub mouse_clicks: u32,
}

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

pub struct WindowsInputTracker {
    idle_threshold_seconds: u64,
    accumulated_keys: Arc<AtomicU32>,
    accumulated_clicks: Arc<AtomicU32>,
    accumulated_moves: Arc<AtomicU32>,
}

impl WindowsInputTracker {
    pub fn new(idle_threshold_seconds: u64) -> Self {
        let accumulated_keys = Arc::new(AtomicU32::new(0));
        let accumulated_clicks = Arc::new(AtomicU32::new(0));
        let accumulated_moves = Arc::new(AtomicU32::new(0));

        #[cfg(windows)]
        {
            let keys_clone = accumulated_keys.clone();
            let clicks_clone = accumulated_clicks.clone();
            let moves_clone = accumulated_moves.clone();

            let _ = std::thread::Builder::new()
                .name("input-sampler".into())
                .spawn(move || {
                    let mut prev_keys = [false; 256];
                    let mut prev_mouse = [false; 3];
                    let mut prev_pos: Option<(i32, i32)> = None;
                    let mut primed = false;

                    loop {
                        // Sample virtual keys 0x08..=0xFE at 20ms intervals (50Hz)
                        for vk in 0x08u32..=0xFEu32 {
                            let down = unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000 != 0;
                            let was_down = prev_keys[vk as usize];
                            if primed && down && !was_down {
                                keys_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            prev_keys[vk as usize] = down;
                        }

                        // Sample mouse buttons: LBUTTON, RBUTTON, MBUTTON
                        const MOUSE_VKS: [i32; 3] = [0x01, 0x02, 0x04];
                        for (i, vk) in MOUSE_VKS.iter().enumerate() {
                            let down = unsafe { GetAsyncKeyState(*vk) } as u16 & 0x8000 != 0;
                            let was_down = prev_mouse[i];
                            if primed && down && !was_down {
                                clicks_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            prev_mouse[i] = down;
                        }

                        // Sample cursor position deltas
                        let mut pt = POINT { x: 0, y: 0 };
                        if unsafe { GetCursorPos(&mut pt) } != 0 {
                            if let Some((px, py)) = prev_pos {
                                if primed && (pt.x != px || pt.y != py) {
                                    moves_clone.fetch_add(1, Ordering::Relaxed);
                                }
                            }
                            prev_pos = Some((pt.x, pt.y));
                        }

                        primed = true;
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                });
        }

        Self {
            idle_threshold_seconds,
            accumulated_keys,
            accumulated_clicks,
            accumulated_moves,
        }
    }

    #[cfg(windows)]
    pub fn get_snapshot(&mut self) -> InputActivitySnapshot {
        let idle_duration_seconds = Self::get_idle_seconds_native();
        let is_user_idle = idle_duration_seconds >= self.idle_threshold_seconds;
        let active_window_title = Self::get_foreground_window_title();
        let key_presses = self.accumulated_keys.swap(0, Ordering::Relaxed);
        let mouse_moves = self.accumulated_moves.swap(0, Ordering::Relaxed);
        let mouse_clicks = self.accumulated_clicks.swap(0, Ordering::Relaxed);

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
