use crate::agent_supervisor::{AgentStatusReport, AgentSupervisor};
use tauri::State;

#[tauri::command]
pub fn get_agent_lifecycle_status(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    Ok(supervisor.refresh_status())
}

#[tauri::command]
pub fn install_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.install_from_candidates(&[])?;
    Ok(supervisor.refresh_status())
}

#[tauri::command]
pub fn configure_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
    employee_id: String,
    supabase_url: String,
    supabase_anon_key: String,
) -> Result<(), String> {
    supervisor.write_runtime_env(&employee_id, &supabase_url, &supabase_anon_key)
}

#[tauri::command]
pub fn start_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.set_deliberately_stopped(false);
    supervisor.ensure_running()
}

#[tauri::command]
pub fn stop_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.stop_agent()
}

#[tauri::command]
pub fn pause_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.pause_collection()?;
    Ok(supervisor.refresh_status())
}

#[tauri::command]
pub fn resume_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.resume_collection()?;
    supervisor.set_deliberately_stopped(false);
    if !AgentSupervisor::process_is_alive() {
        let _ = supervisor.ensure_running();
    }
    Ok(supervisor.refresh_status())
}

#[tauri::command]
pub fn uninstall_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    supervisor.uninstall()?;
    Ok(supervisor.refresh_status())
}

#[tauri::command]
pub fn recover_monitoring_agent(
    supervisor: State<'_, AgentSupervisor>,
) -> Result<AgentStatusReport, String> {
    match supervisor.maybe_recover()? {
        Some(s) => Ok(s),
        None => Ok(supervisor.refresh_status()),
    }
}

#[tauri::command]
pub fn set_monitoring_authorized(
    supervisor: State<'_, AgentSupervisor>,
    authorized: bool,
) -> Result<(), String> {
    supervisor.set_monitoring_authorized(authorized);
    if !authorized {
        let _ = supervisor.pause_collection();
    }
    Ok(())
}
