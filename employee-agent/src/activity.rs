use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityAggregatePayload {
    pub employee_id: String,
    pub device_id: String,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub key_press_count: u32,
    pub mouse_move_count: u32,
    pub mouse_click_count: u32,
    pub active_seconds: u32,
    pub idle_seconds: u32,
    pub is_idle: bool,
}

/// Accumulates 1 Hz input samples into ~60s windows for activity_aggregates.
pub struct ActivityWindow {
    employee_id: String,
    device_id: String,
    window_start: DateTime<Utc>,
    active_seconds: u32,
    idle_seconds: u32,
    key_count: u32,
    mouse_moves: u32,
    mouse_clicks: u32,
    pub last_window_title: String,
}

impl ActivityWindow {
    pub fn new(employee_id: String, device_id: String) -> Self {
        Self {
            employee_id,
            device_id,
            window_start: Utc::now(),
            active_seconds: 0,
            idle_seconds: 0,
            key_count: 0,
            mouse_moves: 0,
            mouse_clicks: 0,
            last_window_title: String::new(),
        }
    }

    pub fn record_sample(
        &mut self,
        is_idle: bool,
        key_presses: u32,
        mouse_moves: u32,
        mouse_clicks: u32,
        window_title: &str,
    ) {
        if is_idle {
            self.idle_seconds = self.idle_seconds.saturating_add(1);
        } else {
            self.active_seconds = self.active_seconds.saturating_add(1);
        }
        self.key_count = self.key_count.saturating_add(key_presses);
        self.mouse_moves = self.mouse_moves.saturating_add(mouse_moves);
        self.mouse_clicks = self.mouse_clicks.saturating_add(mouse_clicks);
        if !window_title.is_empty() {
            self.last_window_title = window_title.to_string();
        }
    }

    pub fn is_ready(&self) -> bool {
        (Utc::now() - self.window_start).num_seconds() >= 60
    }

    pub fn take_aggregate(&mut self) -> ActivityAggregatePayload {
        let now = Utc::now();
        let payload = ActivityAggregatePayload {
            employee_id: self.employee_id.clone(),
            device_id: self.device_id.clone(),
            window_start: self.window_start,
            window_end: now,
            key_press_count: self.key_count,
            mouse_move_count: self.mouse_moves,
            mouse_click_count: self.mouse_clicks,
            active_seconds: self.active_seconds,
            idle_seconds: self.idle_seconds,
            is_idle: self.idle_seconds > self.active_seconds,
        };
        self.window_start = now;
        self.active_seconds = 0;
        self.idle_seconds = 0;
        self.key_count = 0;
        self.mouse_moves = 0;
        self.mouse_clicks = 0;
        payload
    }
}
