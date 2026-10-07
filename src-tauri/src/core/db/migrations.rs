use crate::core::error::{AppError, AppResult};
use rusqlite::Connection;

pub struct Migration {
    pub version: i32,
    pub description: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "Initial schema with outbox, activities, attendance, tasks, and screenshots",
        sql: r#"
        -- Local key-value store for app configuration
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        -- Hardware & OS Device Identity
        CREATE TABLE IF NOT EXISTS device_info (
            device_id TEXT PRIMARY KEY,
            hostname TEXT NOT NULL,
            os_name TEXT NOT NULL,
            os_version TEXT NOT NULL,
            agent_version TEXT NOT NULL,
            registered_at TEXT,
            last_heartbeat TEXT
        );

        -- Active User Session State
        CREATE TABLE IF NOT EXISTS auth_session (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            employee_name TEXT NOT NULL,
            employee_email TEXT NOT NULL,
            access_token_vault_key TEXT NOT NULL,
            refresh_token_vault_key TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        -- Reliable Outbox Queue (Write-locally-first pattern)
        CREATE TABLE IF NOT EXISTS outbox_queue (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_queue(status, next_retry_at);

        -- 60-second Aggregated Activity Windows (Never individual characters)
        CREATE TABLE IF NOT EXISTS activity_aggregates (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            window_start TEXT NOT NULL,
            window_end TEXT NOT NULL,
            key_press_count INTEGER NOT NULL DEFAULT 0,
            mouse_move_count INTEGER NOT NULL DEFAULT 0,
            mouse_click_count INTEGER NOT NULL DEFAULT 0,
            active_seconds INTEGER NOT NULL DEFAULT 0,
            idle_seconds INTEGER NOT NULL DEFAULT 0,
            is_idle INTEGER NOT NULL DEFAULT 0,
            synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_activity_window ON activity_aggregates(window_start);

        -- Attendance Detection Records
        CREATE TABLE IF NOT EXISTS attendance_records (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            date TEXT NOT NULL,
            first_activity_at TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            synced_at TEXT
        );

        -- Task Sessions and Breaks
        CREATE TABLE IF NOT EXISTS task_sessions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            task_title TEXT NOT NULL,
            project_id TEXT,
            project_name TEXT,
            employee_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            total_seconds INTEGER NOT NULL DEFAULT 0,
            break_seconds INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'running',
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS break_records (
            id TEXT PRIMARY KEY,
            task_session_id TEXT NOT NULL,
            break_type TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            synced_at TEXT,
            FOREIGN KEY(task_session_id) REFERENCES task_sessions(id) ON DELETE CASCADE
        );

        -- Screenshot Records
        CREATE TABLE IF NOT EXISTS screenshot_records (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            file_path TEXT NOT NULL,
            thumbnail_path TEXT,
            file_size_bytes INTEGER NOT NULL,
            upload_status TEXT NOT NULL DEFAULT 'pending',
            synced_at TEXT
        );
        "#,
    },
];

pub fn run_migrations(conn: &mut Connection) -> AppResult<i32> {
    // Ensure migrations tracker table exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        )",
        [],
    )?;

    let mut applied_count = 0;

    for migration in MIGRATIONS {
        let is_applied: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                [migration.version],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !is_applied {
            let tx = conn.transaction()?;
            tx.execute_batch(migration.sql).map_err(|e| {
                AppError::Migration(format!("Migration {} failed: {}", migration.version, e))
            })?;
            tx.execute(
                "INSERT INTO schema_migrations (version, description) VALUES (?1, ?2)",
                rusqlite::params![migration.version, migration.description],
            )?;
            tx.commit()?;
            applied_count += 1;
        }
    }

    Ok(applied_count)
}

pub fn get_current_version(conn: &Connection) -> AppResult<i32> {
    let result = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    );
    match result {
        Ok(v) => Ok(v),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(e) => Err(AppError::Database(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_execute_and_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        let applied_first = run_migrations(&mut conn).unwrap();
        assert_eq!(applied_first, 1);

        let current_version = get_current_version(&conn).unwrap();
        assert_eq!(current_version, 1);

        // Second run should apply 0 migrations
        let applied_second = run_migrations(&mut conn).unwrap();
        assert_eq!(applied_second, 0);

        // Verify key tables exist
        let has_outbox: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='outbox_queue')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_outbox);

        let has_activity: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='activity_aggregates')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_activity);
    }
}
