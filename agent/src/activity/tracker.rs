use crate::errors::AgentResult;
use crate::presence::StatusTransition;
use crate::storage::LocalStorage;
use crate::supabase::models::{ActivityAggregatePayload, ActivityEventPayload};
use crate::supabase::SupabaseClient;
use chrono::{DateTime, Utc};
use serde_json::json;

pub struct ActivityBatcher {
    employee_id: String,
    device_id: String,
    supabase_client: SupabaseClient,
    storage: LocalStorage,
    buffered_events: Vec<ActivityEventPayload>,
    max_batch_size: usize,

    // 60-second summary telemetry accumulator
    window_start: DateTime<Utc>,
    active_seconds: u32,
    idle_seconds: u32,
    key_count: u32,
    mouse_moves: u32,
    mouse_clicks: u32,
}

impl ActivityBatcher {
    pub fn new(
        employee_id: String,
        device_id: String,
        supabase_client: SupabaseClient,
        storage: LocalStorage,
    ) -> Self {
        Self {
            employee_id,
            device_id,
            supabase_client,
            storage,
            buffered_events: Vec::new(),
            max_batch_size: 20,
            window_start: Utc::now(),
            active_seconds: 0,
            idle_seconds: 0,
            key_count: 0,
            mouse_moves: 0,
            mouse_clicks: 0,
        }
    }

    /// Record one poll of activity using real input deltas (no invented key/mouse counts).
    pub fn record_sample(
        &mut self,
        is_idle: bool,
        key_presses: u32,
        mouse_moves: u32,
        mouse_clicks: u32,
    ) {
        if is_idle {
            self.idle_seconds = self.idle_seconds.saturating_add(1);
        } else {
            self.active_seconds = self.active_seconds.saturating_add(1);
        }
        self.key_count = self.key_count.saturating_add(key_presses);
        self.mouse_moves = self.mouse_moves.saturating_add(mouse_moves);
        self.mouse_clicks = self.mouse_clicks.saturating_add(mouse_clicks);
    }

    /// Check if 60-second aggregate window is complete
    pub fn is_aggregate_window_ready(&self) -> bool {
        (Utc::now() - self.window_start).num_seconds() >= 60
    }

    /// Extract and reset 60-second aggregate
    pub fn take_aggregate(&mut self) -> ActivityAggregatePayload {
        let now = Utc::now();
        let is_idle = self.idle_seconds > self.active_seconds;

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
            is_idle,
        };

        self.window_start = now;
        self.active_seconds = 0;
        self.idle_seconds = 0;
        self.key_count = 0;
        self.mouse_moves = 0;
        self.mouse_clicks = 0;

        payload
    }

    /// Record a status transition event
    pub fn record_transition(
        &mut self,
        transition: &StatusTransition,
        active_window: &str,
    ) {
        let (event_type, metadata) = match transition {
            StatusTransition::BecameIdle { idle_since } => (
                "idle_start".to_string(),
                json!({
                    "idle_since": idle_since,
                    "last_active_window": active_window,
                }),
            ),
            StatusTransition::ResumedActive { last_activity_at } => (
                "active_resume".to_string(),
                json!({
                    "resumed_at": last_activity_at,
                    "active_window": active_window,
                }),
            ),
        };

        let event = ActivityEventPayload {
            employee_id: self.employee_id.clone(),
            device_id: self.device_id.clone(),
            event_type: event_type.clone(),
            occurred_at: Utc::now(),
            metadata: metadata.clone(),
        };

        // Also persist to local outbox for durability
        let _ = self.storage.enqueue_event(&event_type, &metadata.to_string());
        self.buffered_events.push(event);
    }

    /// Record periodic heartbeat event
    pub fn record_heartbeat(&mut self, active_window: &str, is_idle: bool) {
        let metadata = json!({
            "is_idle": is_idle,
            "window": active_window,
        });

        let event = ActivityEventPayload {
            employee_id: self.employee_id.clone(),
            device_id: self.device_id.clone(),
            event_type: "heartbeat".to_string(),
            occurred_at: Utc::now(),
            metadata,
        };

        self.buffered_events.push(event);
    }

    /// Flushes buffered events to Supabase.
    pub async fn flush(&mut self) -> AgentResult<()> {
        if self.buffered_events.is_empty() {
            return Ok(());
        }

        tracing::debug!("Flushing {} activity events to Supabase...", self.buffered_events.len());

        match self.supabase_client.insert_activity_events(&self.buffered_events).await {
            Ok(_) => {
                tracing::info!("Successfully flushed {} activity events", self.buffered_events.len());
                self.buffered_events.clear();
                Ok(())
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to flush events to Supabase: {}. Buffered locally in SQLite for retry.",
                    e
                );
                if self.buffered_events.len() > 100 {
                    let drain_count = self.buffered_events.len() - 100;
                    self.buffered_events.drain(0..drain_count);
                }
                Err(e)
            }
        }
    }

    pub fn should_flush(&self) -> bool {
        self.buffered_events.len() >= self.max_batch_size
    }

    #[allow(dead_code)]
    pub fn pending_count(&self) -> usize {
        self.buffered_events.len()
    }
}
