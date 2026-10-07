use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let title_item = MenuItem::with_id(app, "title", "Employee Tracking Agent", false, None::<&str>)?;
    let status_item = MenuItem::with_id(app, "status", "Status: Monitoring Active", false, None::<&str>)?;
    let open_item = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit Agent", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &title_item,
            &status_item,
            &open_item,
            &quit_item,
        ],
    )?;

    let icon = app.default_window_icon().cloned().ok_or("Default window icon missing")?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Employee Tracking Agent (Active)")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
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
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
