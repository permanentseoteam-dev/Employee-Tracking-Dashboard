pub mod migrations;

use crate::core::error::{AppError, AppResult};
use parking_lot::Mutex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStats {
    pub schema_version: i32,
    pub pending_outbox_count: i64,
    pub activity_records_count: i64,
    pub screenshot_records_count: i64,
    pub task_sessions_count: i64,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(mut connection: Connection) -> AppResult<Self> {
        // Optimize SQLite for robust desktop usage:
        // WAL mode enables concurrent reads without blocking writes
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "NORMAL")?;
        connection.pragma_update(None, "busy_timeout", 5000)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;

        // Run schema migrations
        migrations::run_migrations(&mut connection)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(connection)),
        })
    }

    /// Open or create database file on disk.
    pub fn open_file<P: AsRef<Path>>(path: P) -> AppResult<Self> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        Self::new(conn)
    }

    /// In-memory database for testing and ephemeral execution.
    pub fn in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        Self::new(conn)
    }

    pub fn lock(&self) -> parking_lot::MutexGuard<'_, Connection> {
        self.conn.lock()
    }

    /// Collect table counts and current migration version.
    pub fn get_stats(&self) -> AppResult<DbStats> {
        let conn = self.conn.lock();
        let schema_version = migrations::get_current_version(&conn)?;

        let pending_outbox_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM outbox_queue WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let activity_records_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM activity_aggregates",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let screenshot_records_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM screenshot_records",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let task_sessions_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM task_sessions", [], |row| row.get(0))
            .unwrap_or(0);

        Ok(DbStats {
            schema_version,
            pending_outbox_count,
            activity_records_count,
            screenshot_records_count,
            task_sessions_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_init_and_stats() {
        let db = Database::in_memory().unwrap();
        let stats = db.get_stats().unwrap();
        assert_eq!(stats.schema_version, 1);
        assert_eq!(stats.pending_outbox_count, 0);
        assert_eq!(stats.activity_records_count, 0);
    }
}
