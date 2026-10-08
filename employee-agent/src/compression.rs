use crate::screenshot::RawScreenshot;
use chrono::{DateTime, Utc};
use image::ExtendedColorType;
use std::io::Cursor;

#[derive(Debug, Clone)]
pub struct CompressedScreenshot {
    pub jpeg_bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub file_size_bytes: usize,
    pub captured_at: DateTime<Utc>,
}

pub struct ScreenshotCompressor;

impl ScreenshotCompressor {
    /// Compresses raw BGRA screen buffer into efficient JPEG binary
    pub fn compress(raw: &RawScreenshot, quality: u8) -> Result<CompressedScreenshot, String> {
        let quality = if quality == 0 || quality > 100 { 70 } else { quality };

        // Convert BGRA (32-bit Windows memory representation) to standard RGB (24-bit)
        let total_pixels = (raw.width * raw.height) as usize;
        let mut rgb_pixels = Vec::with_capacity(total_pixels * 3);

        for chunk in raw.bgra_pixels.chunks_exact(4) {
            let b = chunk[0];
            let g = chunk[1];
            let r = chunk[2];
            rgb_pixels.push(r);
            rgb_pixels.push(g);
            rgb_pixels.push(b);
        }

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);

        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
        encoder
            .encode(&rgb_pixels, raw.width, raw.height, ExtendedColorType::Rgb8)
            .map_err(|e| format!("JPEG encoder compression error: {}", e))?;

        let file_size_bytes = jpeg_bytes.len();

        Ok(CompressedScreenshot {
            jpeg_bytes,
            width: raw.width,
            height: raw.height,
            file_size_bytes,
            captured_at: raw.captured_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compression_cycle() {
        let width = 100;
        let height = 100;
        let bgra_pixels = vec![200u8; (width * height * 4) as usize];
        let raw = RawScreenshot {
            bgra_pixels,
            width,
            height,
            captured_at: Utc::now(),
        };

        let compressed = ScreenshotCompressor::compress(&raw, 70).unwrap();
        assert!(compressed.file_size_bytes > 0);
        assert!(compressed.file_size_bytes < (width * height * 3) as usize);
    }
}
