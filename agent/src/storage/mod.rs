use crate::errors::{AgentError, AgentResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOutboxEvent {
    pub id: String,
    pub event_type: String,
    pub payload_json: String,
    pub retry_count: i32,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOutboxScreenshot {
    pub id: String,
    pub captured_at: String,
    pub image_bytes: Vec<u8>,
    pub metadata_json: String,
    pub retry_count: i32,
}

#[derive(Clone)]
pub struct LocalStorage {
    conn: Arc<Mutex<Connection>>,
    max_queue_size: usize,
}

impl LocalStorage {
    pub fn new<P: AsRef<Path>>(path: P, max_queue_size: usize) -> AgentResult<Self> {
        let conn = Connection::open(path)
            .map_err(|e| AgentError::Storage(format!("Failed to open SQLite database: {}", e)))?;

        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
            max_queue_size,
        };

        storage.init_schema()?;
        Ok(storage)
    }

    #[cfg(test)]
    pub fn new_in_memory(max_queue_size: usize) -> AgentResult<Self> {
        let conn = Connection::open_in_memory()
            .map_err(|e| AgentError::Storage(format!("Failed to open in-memory SQLite: {}", e)))?;

        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
            max_queue_size,
        };

        storage.init_schema()?;
        Ok(storage)
    }

    fn init_schema(&self) -> AgentResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS outbox_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status, created_at);

            CREATE TABLE IF NOT EXISTS outbox_screenshots (
                id TEXT PRIMARY KEY,
                captured_at TEXT NOT NULL,
                image_blob BLOB NOT NULL,
                metadata_json TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending'
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_screenshots_status ON outbox_screenshots(status, captured_at);
            ",
        )
        .map_err(|e| AgentError::Storage(format!("Failed to initialize outbox tables: {}", e)))?;

        Ok(())
    }

    pub fn enqueue_event(&self, event_type: &str, payload_json: &str) -> AgentResult<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let conn = self.conn.lock().unwrap();

        // Enforce max capacity by dropping oldest pending events if needed
        let count: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if count >= self.max_queue_size {
            let _ = conn.execute(
                "DELETE FROM outbox_events WHERE id IN (
                    SELECT id FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10
                )",
                [],
            );
        }

        conn.execute(
            "INSERT INTO outbox_events (id, event_type, payload_json, retry_count, created_at, status)
             VALUES (?1, ?2, ?3, 0, ?4, 'pending')",
            params![id, event_type, payload_json, now],
        )
        .map_err(|e| AgentError::Storage(format!("Failed to enqueue event: {}", e)))?;

        Ok(id)
    }

    pub fn get_pending_events(&self, limit: usize) -> AgentResult<Vec<PendingOutboxEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, event_type, payload_json, retry_count, created_at
                 FROM outbox_events
                 WHERE status = 'pending'
                 ORDER BY created_at ASC
                 LIMIT ?1",
            )
            .map_err(|e| AgentError::Storage(format!("Failed to prepare query: {}", e)))?;

        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok(PendingOutboxEvent {
                    id: row.get(0)?,
                    event_type: row.get(1)?,
                    payload_json: row.get(2)?,
                    retry_count: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| AgentError::Storage(format!("Failed to execute query: {}", e)))?;

        let mut events = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                events.push(item);
            }
        }
        Ok(events)
    }

    pub fn mark_event_sent(&self, id: &str) -> AgentResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM outbox_events WHERE id = ?1",
            params![id],
        )
        .map_err(|e| AgentError::Storage(format!("Failed to delete sent event: {}", e)))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn increment_event_retry(&self, id: &str) -> AgentResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE outbox_events SET retry_count = retry_count + 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| AgentError::Storage(format!("Failed to increment retry: {}", e)))?;
        Ok(())
    }

    pub fn enqueue_screenshot(&self, image_bytes: &[u8], metadata_json: &str) -> AgentResult<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let conn = self.conn.lock().unwrap();

        // Enforce max capacity
        let count: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_screenshots WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if count >= 100 {
            let _ = conn.execute(
                "DELETE FROM outbox_screenshots WHERE id IN (
                    SELECT id FROM outbox_screenshots WHERE status = 'pending' ORDER BY captured_at ASC LIMIT 5
                )",
                [],
            );
        }

        conn.execute(
            "INSERT INTO outbox_screenshots (id, captured_at, image_blob, metadata_json, retry_count, status)
             VALUES (?1, ?2, ?3, ?4, 0, 'pending')",
            params![id, now, image_bytes, metadata_json],
        )
        .map_err(|e| AgentError::Storage(format!("Failed to enqueue screenshot: {}", e)))?;

        Ok(id)
    }

    #[allow(dead_code)]
    pub fn get_pending_screenshots(&self, limit: usize) -> AgentResult<Vec<PendingOutboxScreenshot>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, captured_at, image_blob, metadata_json, retry_count
                 FROM outbox_screenshots
                 WHERE status = 'pending'
                 ORDER BY captured_at ASC
                 LIMIT ?1",
            )
            .map_err(|e| AgentError::Storage(format!("Failed to query screenshots: {}", e)))?;

        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok(PendingOutboxScreenshot {
                    id: row.get(0)?,
                    captured_at: row.get(1)?,
                    image_bytes: row.get(2)?,
                    metadata_json: row.get(3)?,
                    retry_count: row.get(4)?,
                })
            })
            .map_err(|e| AgentError::Storage(format!("Failed to execute query: {}", e)))?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }

    #[allow(dead_code)]
    pub fn mark_screenshot_sent(&self, id: &str) -> AgentResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM outbox_screenshots WHERE id = ?1",
            params![id],
        )
        .map_err(|e| AgentError::Storage(format!("Failed to delete screenshot: {}", e)))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_queue_stats(&self) -> (usize, usize) {
        let conn = self.conn.lock().unwrap();
        let events_count: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let screenshots_count: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_screenshots WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        (events_count, screenshots_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_event_enqueue_and_mark_sent() {
        let storage = LocalStorage::new_in_memory(100).expect("storage init");

        let id = storage
            .enqueue_event("presence_heartbeat", r#"{"status":"active"}"#)
            .expect("enqueue");

        let pending = storage.get_pending_events(10).expect("get pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, id);
        assert_eq!(pending[0].event_type, "presence_heartbeat");

        storage.mark_event_sent(&id).expect("mark sent");
        let remaining = storage.get_pending_events(10).expect("get pending");
        assert_eq!(remaining.len(), 0);
    }

    #[test]
    fn test_storage_screenshot_enqueue_and_dequeue() {
        let storage = LocalStorage::new_in_memory(100).expect("storage init");

        let fake_bytes = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let id = storage
            .enqueue_screenshot(&fake_bytes, r#"{"width":1920,"height":1080}"#)
            .expect("enqueue screenshot");

        let pending = storage.get_pending_screenshots(10).expect("get pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, id);
        assert_eq!(pending[0].image_bytes, fake_bytes);

        storage.mark_screenshot_sent(&id).expect("mark sent");
        let remaining = storage.get_pending_screenshots(10).expect("get pending");
        assert_eq!(remaining.len(), 0);
    }
}
