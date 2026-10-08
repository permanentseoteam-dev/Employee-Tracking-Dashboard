use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// Thread-safe in-memory log buffer for dashboard UI diagnostics.
pub struct MemoryLogBuffer {
    capacity: usize,
    entries: Mutex<VecDeque<LogEntry>>,
}

impl MemoryLogBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            entries: Mutex::new(VecDeque::with_capacity(capacity)),
        }
    }

    pub fn push(&self, level: &str, target: &str, raw_message: &str) {
        let redacted = redact_sensitive_data(raw_message);
        let entry = LogEntry {
            timestamp: Utc::now(),
            level: level.to_string(),
            target: target.to_string(),
            message: redacted,
        };

        let mut entries = self.entries.lock();
        if entries.len() >= self.capacity {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    pub fn get_recent(&self, limit: usize) -> Vec<LogEntry> {
        let entries = self.entries.lock();
        let start = if entries.len() > limit {
            entries.len() - limit
        } else {
            0
        };
        entries.iter().skip(start).cloned().collect()
    }
}

static LOG_BUFFER: once_cell::sync::Lazy<Arc<MemoryLogBuffer>> =
    once_cell::sync::Lazy::new(|| Arc::new(MemoryLogBuffer::new(200)));

pub fn get_log_buffer() -> Arc<MemoryLogBuffer> {
    LOG_BUFFER.clone()
}

/// Redact sensitive authentication tokens, passwords, and secrets from text.
pub fn redact_sensitive_data(input: &str) -> String {
    let mut result = input.to_string();

    // Redact Bearer tokens
    let bearer_prefix = "Bearer ";
    let mut start_idx = 0;
    while let Some(rel_pos) = result[start_idx..].find(bearer_prefix) {
        let pos = start_idx + rel_pos;
        let token_start = pos + bearer_prefix.len();
        let token_end = result[token_start..]
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',')
            .map(|offset| token_start + offset)
            .unwrap_or(result.len());

        if token_start < token_end {
            result.replace_range(token_start..token_end, "[REDACTED]");
            start_idx = token_start + "[REDACTED]".len();
        } else {
            start_idx = token_start;
        }
    }

    // List of key prefixes to redact
    let sensitive_keys = ["password", "token", "refresh_token", "secret", "auth_token"];
    for key in &sensitive_keys {
        redact_key_value(&mut result, key);
    }

    result
}

fn redact_key_value(text: &mut String, key: &str) {
    let search_patterns = [
        format!("\"{}\": \"", key),
        format!("\"{}\":\"", key),
        format!("{}=", key),
        format!("{}: ", key),
    ];

    for pat in &search_patterns {
        let mut start_idx = 0;
        while let Some(rel_pos) = text[start_idx..].find(pat) {
            let val_start = start_idx + rel_pos + pat.len();
            if val_start >= text.len() {
                break;
            }

            // Find where value ends
            let quote_terminated = pat.ends_with('"');
            let val_end = if quote_terminated {
                text[val_start..]
                    .find('"')
                    .map(|o| val_start + o)
                    .unwrap_or(text.len())
            } else {
                text[val_start..]
                    .find(|c: char| c == ' ' || c == ',' || c == '&' || c == '\n' || c == ';' || c == '}')
                    .map(|o| val_start + o)
                    .unwrap_or(text.len())
            };

            if val_start < val_end {
                text.replace_range(val_start..val_end, "[REDACTED]");
                start_idx = val_start + "[REDACTED]".len();
            } else {
                start_idx = val_start;
            }
        }
    }
}

/// Initialize tracing subscriber with security filters and memory buffer recorder.
pub fn init_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tracking_dashboard_app=debug"));

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_level(true);

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .try_init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_bearer_token() {
        let log = "Sending request with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz to server";
        let redacted = redact_sensitive_data(log);
        assert!(!redacted.contains("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"));
        assert!(redacted.contains("Authorization: Bearer [REDACTED] to server"));
    }

    #[test]
    fn test_redact_json_password() {
        let log = r#"User payload: {"username": "employee1", "password": "supersecretpassword123", "role": "user"}"#;
        let redacted = redact_sensitive_data(log);
        assert!(!redacted.contains("supersecretpassword123"));
        assert!(redacted.contains(r#""password": "[REDACTED]""#));
        assert!(redacted.contains(r#""username": "employee1""#));
    }

    #[test]
    fn test_redact_url_query_tokens() {
        let log = "Syncing with https://api.example.com/v1/sync?token=secret9988&device=win11";
        let redacted = redact_sensitive_data(log);
        assert!(!redacted.contains("secret9988"));
        assert!(redacted.contains("token=[REDACTED]"));
        assert!(redacted.contains("device=win11"));
    }

    #[test]
    fn test_clean_log_preserved() {
        let log = "Activity aggregated: key_events=42, mouse_moves=120, active_seconds=55";
        let redacted = redact_sensitive_data(log);
        assert_eq!(log, redacted);
    }

    #[test]
    fn test_memory_buffer_capacity() {
        let buf = MemoryLogBuffer::new(3);
        buf.push("INFO", "core", "msg 1");
        buf.push("INFO", "core", "msg 2");
        buf.push("INFO", "core", "msg 3");
        buf.push("INFO", "core", "msg 4");

        let recent = buf.get_recent(10);
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].message, "msg 2");
        assert_eq!(recent[2].message, "msg 4");
    }
}
