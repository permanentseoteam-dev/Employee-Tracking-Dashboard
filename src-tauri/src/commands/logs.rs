use crate::core::logging::{get_log_buffer, LogEntry};

#[tauri::command]
pub fn get_recent_logs(limit: Option<usize>) -> Result<Vec<LogEntry>, String> {
    let buffer = get_log_buffer();
    let count = limit.unwrap_or(50).min(200);
    Ok(buffer.get_recent(count))
}
