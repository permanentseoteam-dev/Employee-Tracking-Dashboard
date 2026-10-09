// Hide the console window on Windows (GUI app only).
#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    tracking_dashboard_lib::run();
}
