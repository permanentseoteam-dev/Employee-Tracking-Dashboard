use crate::core::config::AppConfig;
use crate::core::db::Database;
use tauri::State;

#[tauri::command]
pub fn get_app_config(db: State<'_, Database>) -> Result<AppConfig, String> {
    let conn = db.lock();
    AppConfig::load_or_init(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_app_config(
    new_config: AppConfig,
    db: State<'_, Database>,
) -> Result<AppConfig, String> {
    new_config.validate().map_err(|e| e.to_string())?;
    let conn = db.lock();
    new_config.save(&conn).map_err(|e| e.to_string())?;
    Ok(new_config)
}
