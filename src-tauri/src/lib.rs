pub mod agent_supervisor;
pub mod commands;
pub mod core;
pub mod platform;
pub mod tray;

use agent_supervisor::AgentSupervisor;
use core::db::Database;
use core::logging::{get_log_buffer, init_logging};
use platform::create_platform_service;
use std::path::PathBuf;
use tauri::{Manager, RunEvent, WindowEvent};

pub fn run() {
    init_logging();
    let log_buf = get_log_buffer();
    log_buf.push("INFO", "core::init", "Starting Employee Tracking App core");

    let platform = create_platform_service();
    let supervisor = AgentSupervisor::new();

    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let db_path = PathBuf::from(local_app_data)
        .join("EmployeeTracking")
        .join("agent.db");

    let db = Database::open_file(&db_path).unwrap_or_else(|e| {
        log_buf.push(
            "WARN",
            "core::db",
            &format!(
                "Failed to open disk database at {:?}: {}. Falling back to in-memory.",
                db_path, e
            ),
        );
        Database::in_memory().expect("In-memory database initialization failed")
    });

    log_buf.push(
        "INFO",
        "core::db",
        "SQLite database and migrations verified successfully",
    );

    // Discover install state early (do not auto-start — wait for authorized employee session)
    if AgentSupervisor::is_installed() {
        log_buf.push(
            "INFO",
            "agent_supervisor",
            &format!(
                "Existing agent install at {}",
                AgentSupervisor::install_exe_path().display()
            ),
        );
    }

    tauri::Builder::default()
        .manage(db)
        .manage(platform)
        .manage(supervisor)
        .setup(|app| {
            if let Err(e) = tray::setup_tray(app.handle()) {
                tracing::warn!("Failed to initialize system tray: {}", e);
            }

            // Prefer bundled agent from installer resources → LocalAppData
            let mut bundled: Vec<std::path::PathBuf> = Vec::new();
            if let Ok(resource_dir) = app.path().resource_dir() {
                bundled.push(resource_dir.join("agent").join("employee-agent.exe"));
                bundled.push(resource_dir.join("employee-agent.exe"));
            }
            if let Some(sup) = app.try_state::<AgentSupervisor>() {
                match sup.install_from_candidates(&bundled) {
                    Ok(path) => tracing::info!("Agent ready at {}", path.display()),
                    Err(e) => tracing::warn!("Agent bundle install deferred: {e}"),
                }
            }

            // Close window → hide (agent keeps running if already started)
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                        tracing::info!("Dashboard hidden to tray; monitoring agent not terminated");
                    }
                });
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
            commands::agent::get_agent_lifecycle_status,
            commands::agent::install_monitoring_agent,
            commands::agent::configure_monitoring_agent,
            commands::agent::start_monitoring_agent,
            commands::agent::stop_monitoring_agent,
            commands::agent::pause_monitoring_agent,
            commands::agent::resume_monitoring_agent,
            commands::agent::uninstall_monitoring_agent,
            commands::agent::recover_monitoring_agent,
            commands::agent::set_monitoring_authorized,
        ])
        .build(tauri::generate_context!())
        .expect("Error while building Tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                // Default Exit from OS may still fire; tray "Exit dashboard only" uses hide.
                // Full quit is explicit via tray "Exit & stop monitoring".
                let _ = app_handle;
                let _ = api;
            }
        });
}
