use crate::agent_supervisor::AgentSupervisor;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let title_item = MenuItem::with_id(
        app,
        "title",
        "Employee Tracking",
        false,
        None::<&str>,
    )?;
    let open_item = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let status_item = MenuItem::with_id(
        app,
        "status",
        "Refresh agent status",
        true,
        None::<&str>,
    )?;
    let stop_item = MenuItem::with_id(
        app,
        "stop_agent",
        "Stop monitoring agent",
        true,
        None::<&str>,
    )?;
    let exit_dash_item = MenuItem::with_id(
        app,
        "exit_dashboard",
        "Exit dashboard (keep monitoring)",
        true,
        None::<&str>,
    )?;
    let exit_all_item = MenuItem::with_id(
        app,
        "exit_all",
        "Exit & stop monitoring",
        true,
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &title_item,
            &sep,
            &open_item,
            &status_item,
            &stop_item,
            &sep,
            &exit_dash_item,
            &exit_all_item,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("Default window icon missing")?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Employee Tracking — dashboard & agent")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_dashboard(app),
            "status" => {
                if let Some(sup) = app.try_state::<AgentSupervisor>() {
                    let report = sup.refresh_status();
                    tracing::info!(
                        "Agent status: {:?} alive={} hb={:?}",
                        report.lifecycle,
                        report.process_alive,
                        report.last_heartbeat_at
                    );
                }
            }
            "stop_agent" => {
                if let Some(sup) = app.try_state::<AgentSupervisor>() {
                    match sup.stop_agent() {
                        Ok(r) => tracing::info!("Agent stopped: {:?}", r.lifecycle),
                        Err(e) => tracing::warn!("Stop agent failed: {e}"),
                    }
                }
            }
            "exit_dashboard" => {
                // Hide UI only — agent keeps running
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "exit_all" => {
                if let Some(sup) = app.try_state::<AgentSupervisor>() {
                    let _ = sup.stop_agent();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_dashboard(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_dashboard(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
