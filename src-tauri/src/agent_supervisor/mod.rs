//! Supervises the existing `employee-agent.exe` lifecycle.
//! Does not embed monitoring logic — only install, spawn, health, stop/pause.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const AGENT_EXE_NAME: &str = "employee-agent.exe";
const STALE_HEARTBEAT_SECS: u64 = 120;
const MAX_RESTART_ATTEMPTS: u32 = 5;
const BASE_BACKOFF_MS: u64 = 2_000;

#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
#[cfg(windows)]
const DETACHED_PROCESS: u32 = 0x0000_0008;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentLifecycleState {
    NotInstalled,
    Installed,
    Stopped,
    Starting,
    Running,
    Paused,
    Reconnecting,
    Error,
    Stopping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatusReport {
    pub lifecycle: AgentLifecycleState,
    pub process_alive: bool,
    pub backend_connected: bool,
    pub collection_ok: bool,
    pub upload_ok: bool,
    pub policy_allows_collection: bool,
    pub deliberately_stopped: bool,
    pub agent_version: Option<String>,
    pub install_path: Option<String>,
    pub last_heartbeat_at: Option<String>,
    pub last_collection_at: Option<String>,
    pub last_upload_at: Option<String>,
    pub last_error: Option<String>,
    pub diagnostic: String,
    /// Backward-compatible flags for existing UI
    pub is_running: bool,
    pub is_online: bool,
    pub is_active: bool,
    pub active_task_title: Option<String>,
    pub last_sync_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AgentStatusFile {
    agent_version: Option<String>,
    employee_id: Option<String>,
    device_id: Option<String>,
    last_heartbeat_at: Option<String>,
    last_collection_at: Option<String>,
    last_upload_at: Option<String>,
    last_error: Option<String>,
    paused: Option<bool>,
    backend_ok: Option<bool>,
}

struct SupervisorInner {
    state: AgentLifecycleState,
    deliberately_stopped: bool,
    last_error: Option<String>,
    restart_attempts: u32,
    last_restart_at: Option<Instant>,
    employee_id: Option<String>,
    monitoring_authorized: bool,
}

pub struct AgentSupervisor {
    inner: Mutex<SupervisorInner>,
}

impl Default for AgentSupervisor {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentSupervisor {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(SupervisorInner {
                state: AgentLifecycleState::NotInstalled,
                deliberately_stopped: false,
                last_error: None,
                restart_attempts: 0,
                last_restart_at: None,
                employee_id: None,
                monitoring_authorized: true,
            }),
        }
    }

    pub fn agent_dir() -> PathBuf {
        let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
        PathBuf::from(base).join("EmployeeTracking").join("agent")
    }

    pub fn install_exe_path() -> PathBuf {
        Self::agent_dir().join(AGENT_EXE_NAME)
    }

    pub fn status_file_path() -> PathBuf {
        Self::agent_dir().join("status.json")
    }

    pub fn pause_file_path() -> PathBuf {
        Self::agent_dir().join("PAUSE")
    }

    pub fn env_file_path() -> PathBuf {
        Self::agent_dir().join(".env")
    }

    pub fn is_installed() -> bool {
        Self::install_exe_path().is_file()
    }

    /// Copy bundled or sibling `employee-agent.exe` into LocalAppData install dir.
    pub fn install_from_candidates(&self, extra_candidates: &[PathBuf]) -> Result<PathBuf, String> {
        let dest_dir = Self::agent_dir();
        fs::create_dir_all(&dest_dir).map_err(|e| format!("Cannot create agent dir: {e}"))?;
        let dest = Self::install_exe_path();

        let mut candidates = extra_candidates.to_vec();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                candidates.push(dir.join(AGENT_EXE_NAME));
                candidates.push(dir.join("agent").join(AGENT_EXE_NAME));
                candidates.push(dir.join("resources").join("agent").join(AGENT_EXE_NAME));
                candidates.push(dir.join("resources").join(AGENT_EXE_NAME));
                // NSIS may already have copied during install
                candidates.push(dest.clone());
            }
        }
        // Dev / repo layout
        candidates.push(PathBuf::from("src-tauri/resources/agent").join(AGENT_EXE_NAME));
        candidates.push(PathBuf::from("resources/agent").join(AGENT_EXE_NAME));
        candidates.push(PathBuf::from("release/employee-agent-windows").join(AGENT_EXE_NAME));
        candidates.push(PathBuf::from("../release/employee-agent-windows").join(AGENT_EXE_NAME));

        let src = candidates
            .into_iter()
            .find(|p| p.is_file())
            .ok_or_else(|| {
                format!(
                    "Could not find {AGENT_EXE_NAME}. Reinstall the desktop app (agent must be bundled)."
                )
            })?;

        // Always refresh from bundle when source differs (repair)
        if src.canonicalize().ok() != dest.canonicalize().ok() {
            fs::copy(&src, &dest).map_err(|e| format!("Failed to install agent binary: {e}"))?;
        }

        // Verify integrity
        let meta = fs::metadata(&dest).map_err(|e| format!("Agent install verify failed: {e}"))?;
        if meta.len() < 1_000_000 {
            return Err(format!(
                "Installed agent looks corrupt ({} bytes). Repair the installation.",
                meta.len()
            ));
        }

        let _ = Self::register_logon_task(&dest);

        let mut inner = self.inner.lock();
        if matches!(
            inner.state,
            AgentLifecycleState::NotInstalled | AgentLifecycleState::Error
        ) {
            inner.state = AgentLifecycleState::Installed;
        }
        Ok(dest)
    }

    /// User-visible Task Scheduler registration (ONLOGON, limited rights).
    pub fn register_logon_task(agent_exe: &Path) -> Result<(), String> {
        #[cfg(windows)]
        {
            let tr = format!("\"{}\"", agent_exe.display());
            let out = Command::new("schtasks")
                .args([
                    "/Create",
                    "/TN",
                    "EmployeeTrackingAgent",
                    "/TR",
                    &tr,
                    "/SC",
                    "ONLOGON",
                    "/RL",
                    "LIMITED",
                    "/F",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("schtasks failed: {e}"))?;
            if !out.status.success() {
                let msg = String::from_utf8_lossy(&out.stderr);
                return Err(format!("Could not register logon task: {msg}"));
            }
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let _ = agent_exe;
            Ok(())
        }
    }

    pub fn unregister_logon_task() {
        #[cfg(windows)]
        {
            let _ = Command::new("schtasks")
                .args(["/Delete", "/TN", "EmployeeTrackingAgent", "/F"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }

    pub fn write_runtime_env(
        &self,
        employee_id: &str,
        supabase_url: &str,
        supabase_anon_key: &str,
    ) -> Result<(), String> {
        let dir = Self::agent_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let body = format!(
            "SUPABASE_URL={}\nSUPABASE_ANON_KEY={}\nEMPLOYEE_ID={}\n",
            supabase_url.trim(),
            supabase_anon_key.trim(),
            employee_id.trim()
        );
        fs::write(Self::env_file_path(), body).map_err(|e| format!("Failed to write agent .env: {e}"))?;
        let mut inner = self.inner.lock();
        inner.employee_id = Some(employee_id.to_string());
        Ok(())
    }

    pub fn set_monitoring_authorized(&self, authorized: bool) {
        self.inner.lock().monitoring_authorized = authorized;
    }

    pub fn set_deliberately_stopped(&self, stopped: bool) {
        self.inner.lock().deliberately_stopped = stopped;
    }

    pub fn pause_collection(&self) -> Result<(), String> {
        let dir = Self::agent_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(Self::pause_file_path(), b"paused_by_dashboard\n")
            .map_err(|e| format!("Failed to write PAUSE file: {e}"))?;
        let mut inner = self.inner.lock();
        inner.state = AgentLifecycleState::Paused;
        Ok(())
    }

    pub fn resume_collection(&self) -> Result<(), String> {
        let path = Self::pause_file_path();
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Failed to clear PAUSE file: {e}"))?;
        }
        Ok(())
    }

    pub fn process_is_alive() -> bool {
        find_process_running(AGENT_EXE_NAME)
    }

    fn read_status_file() -> AgentStatusFile {
        let path = Self::status_file_path();
        match fs::read_to_string(&path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => AgentStatusFile::default(),
        }
    }

    fn heartbeat_fresh(iso: &Option<String>) -> bool {
        let Some(s) = iso else { return false };
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(s) {
            let age = chrono::Utc::now().signed_duration_since(parsed.with_timezone(&chrono::Utc));
            return age.num_seconds() >= 0 && age.num_seconds() < STALE_HEARTBEAT_SECS as i64;
        }
        false
    }

    pub fn refresh_status(&self) -> AgentStatusReport {
        let installed = Self::is_installed();
        let alive = Self::process_is_alive();
        let file = Self::read_status_file();
        let paused_file = Self::pause_file_path().exists() || file.paused == Some(true);
        let hb_fresh = Self::heartbeat_fresh(&file.last_heartbeat_at);
        let upload_recent = Self::heartbeat_fresh(&file.last_upload_at)
            || Self::heartbeat_fresh(&file.last_collection_at);

        let mut inner = self.inner.lock();

        if !installed {
            inner.state = AgentLifecycleState::NotInstalled;
        } else if inner.deliberately_stopped && !alive {
            inner.state = AgentLifecycleState::Stopped;
        } else if paused_file && alive {
            inner.state = AgentLifecycleState::Paused;
        } else if alive && hb_fresh {
            inner.state = AgentLifecycleState::Running;
            inner.restart_attempts = 0;
            inner.last_error = None;
        } else if alive && !hb_fresh {
            inner.state = AgentLifecycleState::Reconnecting;
        } else if matches!(
            inner.state,
            AgentLifecycleState::Starting | AgentLifecycleState::Stopping
        ) {
            // keep transient state briefly
        } else if !alive && !inner.deliberately_stopped && installed {
            if inner.last_error.is_some() {
                inner.state = AgentLifecycleState::Error;
            } else {
                inner.state = AgentLifecycleState::Stopped;
            }
        } else if installed {
            inner.state = AgentLifecycleState::Installed;
        }

        let lifecycle = inner.state;
        let deliberately_stopped = inner.deliberately_stopped;
        let last_error = inner.last_error.clone();
        let policy_ok = inner.monitoring_authorized && !paused_file;
        drop(inner);

        let is_running = matches!(
            lifecycle,
            AgentLifecycleState::Running | AgentLifecycleState::Paused | AgentLifecycleState::Reconnecting
        );
        let diagnostic = match lifecycle {
            AgentLifecycleState::NotInstalled => {
                "Agent not installed. Use Install / Enable Monitoring to set up employee-agent.exe."
                    .into()
            }
            AgentLifecycleState::Installed => "Agent installed but not running.".into(),
            AgentLifecycleState::Stopped => "Agent stopped.".into(),
            AgentLifecycleState::Starting => "Starting agent…".into(),
            AgentLifecycleState::Running => "Agent process healthy; recent heartbeat confirmed.".into(),
            AgentLifecycleState::Paused => "Collection paused by policy or user.".into(),
            AgentLifecycleState::Reconnecting => {
                "Agent process is up but heartbeat is stale (network or backend issue).".into()
            }
            AgentLifecycleState::Error => last_error
                .clone()
                .unwrap_or_else(|| "Agent failed to stay running.".into()),
            AgentLifecycleState::Stopping => "Stopping agent…".into(),
        };

        AgentStatusReport {
            lifecycle,
            process_alive: alive,
            backend_connected: hb_fresh || file.backend_ok == Some(true),
            collection_ok: matches!(lifecycle, AgentLifecycleState::Running) && policy_ok,
            upload_ok: upload_recent,
            policy_allows_collection: policy_ok,
            deliberately_stopped,
            agent_version: file.agent_version.or_else(|| Some(env!("CARGO_PKG_VERSION").into())),
            install_path: if installed {
                Some(Self::install_exe_path().display().to_string())
            } else {
                None
            },
            last_heartbeat_at: file.last_heartbeat_at.clone(),
            last_collection_at: file.last_collection_at.clone(),
            last_upload_at: file.last_upload_at.clone(),
            last_error,
            diagnostic,
            is_running,
            is_online: hb_fresh,
            is_active: matches!(lifecycle, AgentLifecycleState::Running) && !paused_file,
            active_task_title: None,
            last_sync_time: file
                .last_upload_at
                .or(file.last_heartbeat_at)
                .or(file.last_collection_at),
        }
    }

    /// Start agent if authorized and not already healthy. Avoids duplicates.
    pub fn ensure_running(&self) -> Result<AgentStatusReport, String> {
        {
            let inner = self.inner.lock();
            if !inner.monitoring_authorized {
                return Err("Monitoring is not authorized for this session.".into());
            }
            if inner.deliberately_stopped {
                return Err("Agent was deliberately stopped. Resume monitoring to start again.".into());
            }
        }

        if !Self::is_installed() {
            self.install_from_candidates(&[])?;
        }

        let current = self.refresh_status();
        if current.process_alive {
            return Ok(self.refresh_status());
        }

        self.spawn_agent()?;
        // Brief wait for status file / process
        std::thread::sleep(Duration::from_millis(800));
        let after = self.refresh_status();
        if after.process_alive {
            Ok(after)
        } else {
            let mut inner = self.inner.lock();
            inner.state = AgentLifecycleState::Error;
            inner.last_error = Some(
                "Agent process did not stay running after start. Check agent .env and logs.".into(),
            );
            Err(inner.last_error.clone().unwrap())
        }
    }

    pub fn spawn_agent(&self) -> Result<(), String> {
        let exe = Self::install_exe_path();
        if !exe.is_file() {
            return Err(format!("Agent binary missing at {}", exe.display()));
        }
        if Self::process_is_alive() {
            return Ok(());
        }

        {
            let mut inner = self.inner.lock();
            // backoff
            if inner.restart_attempts >= MAX_RESTART_ATTEMPTS {
                if let Some(last) = inner.last_restart_at {
                    if last.elapsed() < Duration::from_secs(60) {
                        inner.state = AgentLifecycleState::Error;
                        return Err(format!(
                            "Restart limit reached ({MAX_RESTART_ATTEMPTS}). Wait before retrying."
                        ));
                    }
                    inner.restart_attempts = 0;
                }
            }
            inner.state = AgentLifecycleState::Starting;
            inner.restart_attempts += 1;
            inner.last_restart_at = Some(Instant::now());
            inner.deliberately_stopped = false;
        }

        let dir = Self::agent_dir();
        let mut cmd = Command::new(&exe);
        cmd.current_dir(&dir);
        // Ensure dotenv picks up LocalAppData .env
        if let Ok(env_path) = Self::env_file_path().canonicalize() {
            cmd.env("DOTENV_PATH", env_path);
        }

        #[cfg(windows)]
        {
            cmd.creation_flags(CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS | CREATE_NO_WINDOW);
        }

        match cmd.spawn() {
            Ok(child) => {
                // Detach: do not keep child in a kill-on-drop job; forget handle
                std::mem::forget(child);
                let delay = BASE_BACKOFF_MS.saturating_mul(
                    1u64 << self.inner.lock().restart_attempts.min(4).saturating_sub(1),
                );
                let _ = delay; // used conceptually; spawn already done
                Ok(())
            }
            Err(e) => {
                let mut inner = self.inner.lock();
                inner.state = AgentLifecycleState::Error;
                inner.last_error = Some(format!("Failed to spawn agent: {e}"));
                Err(inner.last_error.clone().unwrap())
            }
        }
    }

    /// Graceful stop: write STOP flag and taskkill only if still alive after brief wait.
    pub fn stop_agent(&self) -> Result<AgentStatusReport, String> {
        {
            let mut inner = self.inner.lock();
            inner.deliberately_stopped = true;
            inner.state = AgentLifecycleState::Stopping;
        }
        let stop_flag = Self::agent_dir().join("STOP");
        let _ = fs::create_dir_all(Self::agent_dir());
        let _ = fs::write(&stop_flag, b"stop\n");

        std::thread::sleep(Duration::from_millis(500));
        if Self::process_is_alive() {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/IM", AGENT_EXE_NAME, "/F"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
            }
            #[cfg(not(windows))]
            {
                let _ = Command::new("pkill").arg("-f").arg(AGENT_EXE_NAME).output();
            }
        }
        let _ = fs::remove_file(stop_flag);
        {
            let mut inner = self.inner.lock();
            inner.state = AgentLifecycleState::Stopped;
        }
        Ok(self.refresh_status())
    }

    /// Attempt recovery if crashed (not deliberately stopped).
    pub fn maybe_recover(&self) -> Result<Option<AgentStatusReport>, String> {
        let inner = self.inner.lock();
        if inner.deliberately_stopped || !inner.monitoring_authorized {
            return Ok(None);
        }
        drop(inner);
        if !Self::is_installed() {
            return Ok(None);
        }
        if Self::process_is_alive() {
            return Ok(Some(self.refresh_status()));
        }
        // exponential cooldown
        {
            let inner = self.inner.lock();
            if let Some(last) = inner.last_restart_at {
                let backoff = Duration::from_millis(
                    BASE_BACKOFF_MS * (1u64 << inner.restart_attempts.min(4)),
                );
                if last.elapsed() < backoff {
                    return Ok(None);
                }
            }
            if inner.restart_attempts >= MAX_RESTART_ATTEMPTS {
                return Err("Automatic recovery exhausted. Manual restart required.".into());
            }
        }
        self.spawn_agent()?;
        std::thread::sleep(Duration::from_millis(600));
        Ok(Some(self.refresh_status()))
    }

    pub fn uninstall(&self) -> Result<(), String> {
        let _ = self.stop_agent();
        Self::unregister_logon_task();
        let exe = Self::install_exe_path();
        if exe.exists() {
            fs::remove_file(&exe).map_err(|e| format!("Failed to remove agent: {e}"))?;
        }
        let _ = fs::remove_file(Self::pause_file_path());
        let _ = fs::remove_file(Self::status_file_path());
        let _ = fs::remove_file(Self::agent_dir().join("agent.lock"));
        self.inner.lock().state = AgentLifecycleState::NotInstalled;
        Ok(())
    }
}

fn find_process_running(exe_name: &str) -> bool {
    #[cfg(windows)]
    {
        find_process_running_windows(exe_name)
    }
    #[cfg(not(windows))]
    {
        let _ = exe_name;
        false
    }
}

#[cfg(windows)]
fn find_process_running_windows(exe_name: &str) -> bool {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {exe_name}"), "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            text.contains(&exe_name.to_lowercase())
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_serde_roundtrip() {
        let s = AgentLifecycleState::Running;
        let j = serde_json::to_string(&s).unwrap();
        assert_eq!(j, "\"RUNNING\"");
        let back: AgentLifecycleState = serde_json::from_str(&j).unwrap();
        assert_eq!(back, AgentLifecycleState::Running);
    }

    #[test]
    fn fresh_supervisor_starts_not_installed_or_stopped() {
        let s = AgentSupervisor::new();
        let report = s.refresh_status();
        assert!(matches!(
            report.lifecycle,
            AgentLifecycleState::NotInstalled
                | AgentLifecycleState::Installed
                | AgentLifecycleState::Stopped
                | AgentLifecycleState::Running
                | AgentLifecycleState::Reconnecting
                | AgentLifecycleState::Paused
        ));
        // Must not claim RUNNING without process+heartbeat
        if !report.process_alive {
            assert_ne!(report.lifecycle, AgentLifecycleState::Running);
            assert!(!report.collection_ok);
        }
    }

    #[test]
    fn merge_paths_under_localappdata() {
        let dir = AgentSupervisor::agent_dir();
        assert!(dir.to_string_lossy().contains("EmployeeTracking"));
    }
}
