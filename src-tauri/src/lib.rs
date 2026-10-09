pub mod commands;
pub mod core;
pub mod platform;
pub mod tray;

use core::db::Database;
use core::logging::{get_log_buffer, init_logging};
use platform::create_platform_service;
use std::path::PathBuf;

pub fn run() {
    init_logging();
    let log_buf = get_log_buffer();
    log_buf.push("INFO", "core::init", "Starting Employee Tracking App core");

    let platform = create_platform_service();

    // Determine database path in Windows LocalAppData
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let db_path = PathBuf::from(local_app_data)
        .join("EmployeeTracking")
        .join("agent.db");

    let db = Database::open_file(&db_path).unwrap_or_else(|e| {
        log_buf.push(
            "WARN",
            "core::db",
            &format!("Failed to open disk database at {:?}: {}. Falling back to in-memory.", db_path, e),
        );
        Database::in_memory().expect("In-memory database initialization failed")
    });

    log_buf.push("INFO", "core::db", "SQLite database and migrations verified successfully");

    tauri::Builder::default()
        .manage(db)
        .manage(platform)
        .setup(|app| {
            if let Err(e) = tray::setup_tray(app.handle()) {
                tracing::warn!("Failed to initialize system tray: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_agent_status,
            commands::system::get_system_info,
            commands::system::get_database_stats,
            commands::config::get_app_config,
            commands::config::update_app_config,
            commands::logs::get_recent_logs,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
