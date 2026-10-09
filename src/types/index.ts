export type AgentLifecycleState =
  | 'NOT_INSTALLED'
  | 'INSTALLED'
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'STOPPING';

export interface AgentStatusDto {
  is_running: boolean;
  is_online: boolean;
  is_active: boolean;
  active_task_title: string | null;
  agent_version: string;
  last_sync_time: string | null;
}

/** Full supervisor report from Tauri (process + heartbeat + policy). */
export interface AgentLifecycleStatusDto {
  lifecycle: AgentLifecycleState;
  process_alive: boolean;
  backend_connected: boolean;
  collection_ok: boolean;
  upload_ok: boolean;
  policy_allows_collection: boolean;
  deliberately_stopped: boolean;
  agent_version: string | null;
  install_path: string | null;
  last_heartbeat_at: string | null;
  last_collection_at: string | null;
  last_upload_at: string | null;
  last_error: string | null;
  diagnostic: string;
  is_running: boolean;
  is_online: boolean;
  is_active: boolean;
  active_task_title: string | null;
  last_sync_time: string | null;
}

export interface SystemInfoDto {
  device_id: string;
  hostname: string;
  os_name: string;
  os_version: string;
  agent_version: string;
}

export interface AppConfig {
  screenshot_interval_secs: number;
  screenshot_quality: number;
  screenshot_width: number;
  screenshot_height: number;
  idle_threshold_secs: number;
  track_keyboard: boolean;
  track_mouse: boolean;
  track_screenshots: boolean;
  server_url: string;
  version: number;
}

/** Remote policy polled by EmployeeAgent (public.agent_runtime_config). */
export interface AgentRuntimeConfig {
  id: number;
  enabled: boolean;
  work_start: string;
  work_end: string;
  work_days: string[];
  capture_outside_hours: boolean;
  timezone_note: string;
  updated_at?: string;
}

export const DEFAULT_AGENT_RUNTIME_CONFIG: AgentRuntimeConfig = {
  id: 1,
  enabled: true,
  work_start: '09:00',
  work_end: '17:00',
  work_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  capture_outside_hours: false,
  timezone_note: 'Uses each workstation local clock',
};

export interface DbStats {
  schema_version: number;
  pending_outbox_count: number;
  activity_records_count: number;
  screenshot_records_count: number;
  task_sessions_count: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

export type NavTab =
  | 'dashboard'
  | 'attendance'
  | 'tasks'
  | 'projects'
  | 'performance'
  | 'timer';
