use crate::agent_supervisor::AgentSupervisor;
use crate::core::db::{Database, DbStats};
use crate::platform::PlatformService;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct AgentStatusDto {
    pub is_running: bool,
    pub is_online: bool,
    pub is_active: bool,
    pub active_task_title: Option<String>,
    pub agent_version: String,
    pub last_sync_time: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemInfoDto {
    pub device_id: String,
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub agent_version: String,
}

#[tauri::command]
pub fn get_agent_status(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusDto, String> {
    let report = supervisor.refresh_status();
    Ok(AgentStatusDto {
        is_running: report.is_running,
        is_online: report.is_online,
        is_active: report.is_active,
        active_task_title: report.active_task_title,
        agent_version: report
            .agent_version
            .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
        last_sync_time: report.last_sync_time,
    })
}

#[tauri::command]
pub fn get_system_info(
    platform: State<'_, Box<dyn PlatformService>>,
) -> Result<SystemInfoDto, String> {
    let (os_name, os_version) = platform.get_os_info();
    Ok(SystemInfoDto {
        device_id: platform.get_device_id(),
        hostname: platform.get_hostname(),
        os_name,
        os_version,
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub fn get_database_stats(
    db: State<'_, Database>,
) -> Result<DbStats, String> {
    db.get_stats().map_err(|e| e.to_string())
}
