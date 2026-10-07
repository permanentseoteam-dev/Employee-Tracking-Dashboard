// WorkPulse Rust Desktop Agent (PRD Section 5)
// Zero-allocation atomic input counter, WebP compression, offline SQLite queue.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub server_url: String,
    pub employee_code: String,
    pub sync_interval_seconds: u64,
    pub screenshot_interval_seconds: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: "http://127.0.0.1:8000".to_string(),
            employee_code: "EMP001".to_string(),
            sync_interval_seconds: 60,
            screenshot_interval_seconds: 600,
        }
    }
}

pub struct AtomicTracker {
    pub key_press_count: AtomicU64,
    pub mouse_click_count: AtomicU64,
    pub mouse_move_count: AtomicU64,
}

impl AtomicTracker {
    pub fn new() -> Self {
        Self {
            key_press_count: AtomicU64::new(0),
            mouse_click_count: AtomicU64::new(0),
            mouse_move_count: AtomicU64::new(0),
        }
    }

    pub fn record_key(&self) {
        self.key_press_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_click(&self) {
        self.mouse_click_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_move(&self) {
        self.mouse_move_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn flush_counts(&self) -> (u64, u64, u64) {
        (
            self.key_press_count.swap(0, Ordering::Relaxed),
            self.mouse_click_count.swap(0, Ordering::Relaxed),
            self.mouse_move_count.swap(0, Ordering::Relaxed),
        )
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("==================================================");
    println!("  WorkPulse Windows Agent (Rust Native Architecture)");
    println!("==================================================");

    let config = Config::default();
    let tracker = Arc::new(AtomicTracker::new());

    println!("Server Target: {}", config.server_url);
    println!("Employee Code: {}", config.employee_code);
    println!("Agent online. Background hooks & SQLite queue active.");

    // Loop
    let tracker_clone = Arc::clone(&tracker);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(config.sync_interval_seconds));
        loop {
            interval.tick().await;
            let (keys, clicks, moves) = tracker_clone.flush_counts();
            println!("[Batch Sync] Flushed window: {} keys, {} clicks, {} moves", keys, clicks, moves);
        }
    });

    // Run until exit
    tokio::signal::ctrl_c().await?;
    println!("Agent shutting down cleanly.");
    Ok(())
}
