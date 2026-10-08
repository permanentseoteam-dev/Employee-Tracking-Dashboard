use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Offline,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealthReport {
    pub status: HealthStatus,
    pub agent_version: String,
    pub device_id: String,
    pub employee_id: String,
    pub uptime_seconds: u64,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub pending_events_count: usize,
    pub pending_screenshots_count: usize,
    pub error_count: u64,
    pub last_error: Option<String>,
}

#[derive(Clone)]
pub struct HealthMonitor {
    #[allow(dead_code)]
    start_time: Instant,
    #[allow(dead_code)]
    device_id: String,
    #[allow(dead_code)]
    employee_id: String,
    state: Arc<Mutex<HealthMonitorState>>,
}

struct HealthMonitorState {
    last_heartbeat_at: Option<DateTime<Utc>>,
    last_sync_at: Option<DateTime<Utc>>,
    error_count: u64,
    last_error: Option<String>,
}

impl HealthMonitor {
    pub fn new(device_id: String, employee_id: String) -> Self {
        Self {
            start_time: Instant::now(),
            device_id,
            employee_id,
            state: Arc::new(Mutex::new(HealthMonitorState {
                last_heartbeat_at: None,
                last_sync_at: None,
                error_count: 0,
                last_error: None,
            })),
        }
    }

    pub fn record_heartbeat(&self) {
        let mut state = self.state.lock().unwrap();
        state.last_heartbeat_at = Some(Utc::now());
    }

    pub fn record_sync_success(&self) {
        let mut state = self.state.lock().unwrap();
        state.last_sync_at = Some(Utc::now());
    }

    pub fn record_error(&self, error: &str) {
        let mut state = self.state.lock().unwrap();
        state.error_count += 1;
        state.last_error = Some(error.to_string());
    }

    #[allow(dead_code)]
    pub fn get_report(&self, pending_events: usize, pending_screenshots: usize) -> AgentHealthReport {
        let state = self.state.lock().unwrap();
        let uptime_seconds = self.start_time.elapsed().as_secs();

        let status = if state.error_count > 10 {
            HealthStatus::Error
        } else if pending_events > 500 || pending_screenshots > 20 {
            HealthStatus::Warning
        } else {
            HealthStatus::Healthy
        };

        AgentHealthReport {
            status,
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            device_id: self.device_id.clone(),
            employee_id: self.employee_id.clone(),
            uptime_seconds,
            last_heartbeat_at: state.last_heartbeat_at,
            last_sync_at: state.last_sync_at,
            pending_events_count: pending_events,
            pending_screenshots_count: pending_screenshots,
            error_count: state.error_count,
            last_error: state.last_error.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_monitor_transitions() {
        let monitor = HealthMonitor::new("DEV-01".into(), "EMP-01".into());
        let r1 = monitor.get_report(0, 0);
        assert_eq!(r1.status, HealthStatus::Healthy);

        monitor.record_error("Network timeout");
        let r2 = monitor.get_report(0, 0);
        assert_eq!(r2.error_count, 1);
        assert_eq!(r2.last_error.as_deref(), Some("Network timeout"));
    }
}
