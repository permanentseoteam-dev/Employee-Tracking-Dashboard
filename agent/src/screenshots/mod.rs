use crate::errors::{AgentError, AgentResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::io::Cursor;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotMetadata {
    pub employee_id: String,
    pub device_id: String,
    pub captured_at: DateTime<Utc>,
    pub width: u32,
    pub height: u32,
    pub file_size_bytes: usize,
    pub storage_path: String,
}

#[derive(Debug, Clone)]
pub struct CapturedScreenshot {
    pub image_bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub captured_at: DateTime<Utc>,
}

pub struct ScreenCaptureService {
    quality: u8,
}

impl ScreenCaptureService {
    pub fn new(quality: u8) -> Self {
        let quality = if quality == 0 || quality > 100 { 70 } else { quality };
        Self { quality }
    }

    #[cfg(target_os = "windows")]
    pub fn capture_screen(&self) -> AgentResult<CapturedScreenshot> {
        use windows_sys::Win32::Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
            GetDIBits, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetDesktopWindow, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN,
        };

        unsafe {
            const CAPTUREBLT: u32 = 0x40000000;
            let hwnd_desktop = GetDesktopWindow();
            let mut hdc_screen = windows_sys::Win32::Graphics::Gdi::GetDC(std::ptr::null_mut());
            if hdc_screen.is_null() {
                hdc_screen = windows_sys::Win32::Graphics::Gdi::GetDC(hwnd_desktop);
            }
            if hdc_screen.is_null() {
                return Err(AgentError::Windows("Failed to get desktop DC".into()));
            }

            let mut width = GetSystemMetrics(SM_CXSCREEN) as u32;
            let mut height = GetSystemMetrics(SM_CYSCREEN) as u32;

            if width == 0 { width = 1920; }
            if height == 0 { height = 1080; }

            let hdc_mem = CreateCompatibleDC(hdc_screen);
            if hdc_mem.is_null() {
                ReleaseDC(std::ptr::null_mut(), hdc_screen);
                return Err(AgentError::Windows("Failed to create compatible memory DC".into()));
            }

            let hbitmap = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
            if hbitmap.is_null() {
                DeleteDC(hdc_mem);
                ReleaseDC(std::ptr::null_mut(), hdc_screen);
                return Err(AgentError::Windows("Failed to create compatible bitmap".into()));
            }

            let old_bitmap = windows_sys::Win32::Graphics::Gdi::SelectObject(hdc_mem, hbitmap);

            // Try with CAPTUREBLT first (captures layered windows/cursor), fall back to standard SRCCOPY
            let mut blt_res = BitBlt(
                hdc_mem,
                0,
                0,
                width as i32,
                height as i32,
                hdc_screen,
                0,
                0,
                SRCCOPY | CAPTUREBLT,
            );

            if blt_res == 0 {
                blt_res = BitBlt(
                    hdc_mem,
                    0,
                    0,
                    width as i32,
                    height as i32,
                    hdc_screen,
                    0,
                    0,
                    SRCCOPY,
                );
            }

            if blt_res == 0 {
                windows_sys::Win32::Graphics::Gdi::SelectObject(hdc_mem, old_bitmap);
                DeleteObject(hbitmap);
                DeleteDC(hdc_mem);
                ReleaseDC(std::ptr::null_mut(), hdc_screen);
                return Err(AgentError::Windows("BitBlt screen copy failed".into()));
            }

            // Extract pixel buffer
            let mut bmi: BITMAPINFO = std::mem::zeroed();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = width as i32;
            bmi.bmiHeader.biHeight = -(height as i32); // Top-down
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

            // Cleanup GDI objects immediately
            windows_sys::Win32::Graphics::Gdi::SelectObject(hdc_mem, old_bitmap);
            DeleteObject(hbitmap);
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd_desktop, hdc_screen);

            if lines == 0 {
                return Err(AgentError::Windows("GetDIBits failed to extract pixels".into()));
            }

            // Convert BGRA (Windows standard) to RGB
            let mut rgb_pixels = Vec::with_capacity((width * height * 3) as usize);
            for chunk in raw_pixels.chunks_exact(4) {
                let b = chunk[0];
                let g = chunk[1];
                let r = chunk[2];
                rgb_pixels.push(r);
                rgb_pixels.push(g);
                rgb_pixels.push(b);
            }

            // Compress to JPEG using image crate
            let img = image::RgbImage::from_raw(width, height, rgb_pixels)
                .ok_or_else(|| AgentError::General("Failed to construct RGB image buffer".into()))?;

            let mut jpeg_bytes = Vec::new();
            let mut cursor = Cursor::new(&mut jpeg_bytes);

            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, self.quality);
            encoder
                .encode(img.as_raw(), width, height, image::ExtendedColorType::Rgb8)
                .map_err(|e| AgentError::General(format!("JPEG compression failed: {}", e)))?;

            Ok(CapturedScreenshot {
                image_bytes: jpeg_bytes,
                width,
                height,
                captured_at: Utc::now(),
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn capture_screen(&self) -> AgentResult<CapturedScreenshot> {
        let width = 1280;
        let height = 720;
        let mock_pixels = vec![128u8; (width * height * 3) as usize];
        let img = image::RgbImage::from_raw(width, height, mock_pixels)
            .ok_or_else(|| AgentError::General("Failed to create mock image".into()))?;

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, self.quality);
        encoder
            .encode(img.as_raw(), width, height, image::ExtendedColorType::Rgb8)
            .map_err(|e| AgentError::General(format!("Mock JPEG encode failed: {}", e)))?;

        Ok(CapturedScreenshot {
            image_bytes: jpeg_bytes,
            width,
            height,
            captured_at: Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_capture_service_init() {
        let service = ScreenCaptureService::new(75);
        assert_eq!(service.quality, 75);
    }
}
