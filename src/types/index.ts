export interface AgentStatusDto {
  is_running: boolean;
  is_online: boolean;
  is_active: boolean;
  active_task_title: string | null;
  agent_version: string;
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
  | 'timer'
  | 'settings';
