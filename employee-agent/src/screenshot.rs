use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct RawScreenshot {
    pub bgra_pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub captured_at: DateTime<Utc>,
}

pub struct ScreenCapture;

impl ScreenCapture {
    #[cfg(target_os = "windows")]
    pub fn capture() -> Result<RawScreenshot, String> {
        use windows_sys::Win32::Foundation::FALSE;
        use windows_sys::Win32::Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
            ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
        };
        use windows_sys::Win32::System::StationsAndDesktops::{
            CloseDesktop, OpenInputDesktop, SetThreadDesktop, DESKTOP_READOBJECTS,
            DESKTOP_SWITCHDESKTOP, DESKTOP_WRITEOBJECTS,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetDesktopWindow, GetSystemMetrics, SM_CXSCREEN, SM_CXVIRTUALSCREEN, SM_CYSCREEN,
            SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
        };

        unsafe {
            // Attach to the interactive user desktop when possible (avoids blank/session captures).
            let desk_access = DESKTOP_READOBJECTS | DESKTOP_WRITEOBJECTS | DESKTOP_SWITCHDESKTOP;
            let hdesk = OpenInputDesktop(0, FALSE, desk_access);
            let mut attached = false;
            if hdesk != 0 {
                attached = SetThreadDesktop(hdesk) != 0;
            }

            const CAPTUREBLT: u32 = 0x40000000;
            let hwnd_desktop = GetDesktopWindow();
            let mut hdc_screen = windows_sys::Win32::Graphics::Gdi::GetDC(0);
            if hdc_screen == 0 {
                hdc_screen = windows_sys::Win32::Graphics::Gdi::GetDC(hwnd_desktop);
            }

            let result = (|| -> Result<RawScreenshot, String> {
                if hdc_screen == 0 {
                    return Err("GetDC failed — no interactive display context".into());
                }

                let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
                let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
                let mut width = GetSystemMetrics(SM_CXVIRTUALSCREEN) as u32;
                let mut height = GetSystemMetrics(SM_CYVIRTUALSCREEN) as u32;
                if width == 0 {
                    width = GetSystemMetrics(SM_CXSCREEN) as u32;
                }
                if height == 0 {
                    height = GetSystemMetrics(SM_CYSCREEN) as u32;
                }
                if width == 0 || height == 0 {
                    return Err("Unable to resolve screen size".into());
                }

                let hdc_mem = CreateCompatibleDC(hdc_screen);
                if hdc_mem == 0 {
                    return Err("CreateCompatibleDC failed".into());
                }
                let hbitmap = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
                if hbitmap == 0 {
                    DeleteDC(hdc_mem);
                    return Err("CreateCompatibleBitmap failed".into());
                }

                let old_bitmap = SelectObject(hdc_mem, hbitmap);
                let mut blt_ok = BitBlt(
                    hdc_mem,
                    0,
                    0,
                    width as i32,
                    height as i32,
                    hdc_screen,
                    x,
                    y,
                    SRCCOPY | CAPTUREBLT,
                );
                if blt_ok == 0 {
                    blt_ok = BitBlt(
                        hdc_mem,
                        0,
                        0,
                        width as i32,
                        height as i32,
                        hdc_screen,
                        x,
                        y,
                        SRCCOPY,
                    );
                }

                if blt_ok == 0 {
                    SelectObject(hdc_mem, old_bitmap);
                    DeleteObject(hbitmap);
                    DeleteDC(hdc_mem);
                    return Err("BitBlt failed — cannot capture interactive desktop".into());
                }

                let mut bmi: BITMAPINFO = std::mem::zeroed();
                bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
                bmi.bmiHeader.biWidth = width as i32;
                bmi.bmiHeader.biHeight = -(height as i32); // top-down
                bmi.bmiHeader.biPlanes = 1;
                bmi.bmiHeader.biBitCount = 32;
                bmi.bmiHeader.biCompression = BI_RGB;

                let mut raw_pixels = vec![0u8; (width * height * 4) as usize];
                let lines = GetDIBits(
                    hdc_mem,
                    hbitmap,
                    0,
                    height,
                    raw_pixels.as_mut_ptr() as *mut _,
                    &mut bmi,
                    DIB_RGB_COLORS,
                );

                SelectObject(hdc_mem, old_bitmap);
                DeleteObject(hbitmap);
                DeleteDC(hdc_mem);

                if lines <= 0 {
                    return Err("GetDIBits failed".into());
                }

                if is_near_uniform_frame(&raw_pixels) {
                    return Err(
                        "Captured frame is blank/uniform — skipped upload (secure desktop or locked session?)"
                            .into(),
                    );
                }

                Ok(RawScreenshot {
                    bgra_pixels: raw_pixels,
                    width,
                    height,
                    captured_at: Utc::now(),
                })
            })();

            if hdc_screen != 0 {
                ReleaseDC(0, hdc_screen);
            }
            if hdesk != 0 {
                if attached {
                    // Leave thread on input desktop; CloseDesktop after SetThreadDesktop is fine for our handle.
                }
                CloseDesktop(hdesk);
            }

            result
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn capture() -> Result<RawScreenshot, String> {
        Err("Screen capture is only supported on Windows".into())
    }
}

/// Reject solid white / black / single-color frames that are not real desktops.
fn is_near_uniform_frame(bgra: &[u8]) -> bool {
    if bgra.len() < 16 {
        return true;
    }
    let step = ((bgra.len() / 4) / 400).max(1) * 4;
    let mut samples = 0u32;
    let mut sum_r = 0u64;
    let mut sum_g = 0u64;
    let mut sum_b = 0u64;
    let mut sum_r2 = 0u64;
    let mut sum_g2 = 0u64;
    let mut sum_b2 = 0u64;

    let mut i = 0;
    while i + 3 < bgra.len() {
        let b = bgra[i] as u64;
        let g = bgra[i + 1] as u64;
        let r = bgra[i + 2] as u64;
        sum_r += r;
        sum_g += g;
        sum_b += b;
        sum_r2 += r * r;
        sum_g2 += g * g;
        sum_b2 += b * b;
        samples += 1;
        i += step;
    }
    if samples < 8 {
        return true;
    }
    let n = samples as u64;
    let var = |sum: u64, sum2: u64| -> f64 {
        let mean = sum as f64 / n as f64;
        (sum2 as f64 / n as f64) - mean * mean
    };
    let vr = var(sum_r, sum_r2);
    let vg = var(sum_g, sum_g2);
    let vb = var(sum_b, sum_b2);
    // Real desktops usually have variance >> 50; solid blank/stripe-y fakes are low.
    vr < 40.0 && vg < 40.0 && vb < 40.0
}
