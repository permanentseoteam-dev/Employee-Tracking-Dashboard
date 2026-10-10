import { invoke } from '@tauri-apps/api/core';
import type {
  AgentLifecycleStatusDto,
  AgentStatusDto,
  AppConfig,
  DbStats,
  LogEntry,
  SystemInfoDto,
} from '../types';

// Check if running inside Tauri webview
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const api = {
  getAgentStatus: async (): Promise<AgentStatusDto> => {
    if (isTauriEnvironment()) {
      return await invoke<AgentStatusDto>('get_agent_status');
    }
    return {
      is_running: true,
      is_online: true,
      is_active: true,
      active_task_title: null,
      agent_version: '0.1.0 (Web Preview)',
      last_sync_time: new Date().toISOString(),
    };
  },

  getSystemInfo: async (): Promise<SystemInfoDto> => {
    if (isTauriEnvironment()) {
      return await invoke<SystemInfoDto>('get_system_info');
    }
    return {
      device_id: 'WIN-DESKTOP-DEV',
      hostname: 'DESKTOP-WORKSTATION',
      os_name: 'Windows',
      os_version: '11.0 (Browser Preview)',
      agent_version: '0.1.0',
    };
  },

  getDatabaseStats: async (): Promise<DbStats> => {
    if (isTauriEnvironment()) {
      return await invoke<DbStats>('get_database_stats');
    }
    return {
      schema_version: 1,
      pending_outbox_count: 0,
      activity_records_count: 0,
      screenshot_records_count: 0,
      task_sessions_count: 0,
    };
  },

  getAppConfig: async (): Promise<AppConfig> => {
    if (isTauriEnvironment()) {
      return await invoke<AppConfig>('get_app_config');
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('stitch_app_config') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          screenshot_interval_secs: parsed.screenshot_interval_secs || 60,
          screenshot_quality: parsed.screenshot_quality || 80,
          screenshot_width: parsed.screenshot_width || 1920,
          screenshot_height: parsed.screenshot_height || 1080,
          idle_threshold_secs: parsed.idle_threshold_secs || 180,
          track_keyboard: parsed.track_keyboard ?? true,
          track_mouse: parsed.track_mouse ?? true,
          track_screenshots: parsed.track_screenshots ?? true,
          server_url: parsed.server_url || 'http://localhost:8080',
          version: parsed.version || 1,
        };
      } catch {}
    }
    return {
      screenshot_interval_secs: 60,
      screenshot_quality: 80,
      screenshot_width: 1920,
      screenshot_height: 1080,
      idle_threshold_secs: 180,
      track_keyboard: true,
      track_mouse: true,
      track_screenshots: true,
      server_url: 'http://localhost:8080',
      version: 1,
    };
  },

  updateAppConfig: async (config: AppConfig): Promise<AppConfig> => {
    if (isTauriEnvironment()) {
      return await invoke<AppConfig>('update_app_config', { newConfig: config });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('stitch_app_config', JSON.stringify(config));
    }
    return config;
  },

  getRecentLogs: async (limit = 50): Promise<LogEntry[]> => {
    if (isTauriEnvironment()) {
      return await invoke<LogEntry[]>('get_recent_logs', { limit });
    }
    return [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        target: 'core::init',
        message: 'Employee Tracking Agent initialized (Browser Preview Mode)',
      },
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        target: 'core::db',
        message: 'SQLite schema migrations verified [v1: outbox, telemetry, attendance, tasks]',
      },
    ];
  },

  getAgentLifecycleStatus: async (): Promise<AgentLifecycleStatusDto> => {
    if (isTauriEnvironment()) {
      return await invoke<AgentLifecycleStatusDto>('get_agent_lifecycle_status');
    }
    return {
      lifecycle: 'NOT_INSTALLED',
      process_alive: false,
      backend_connected: false,
      collection_ok: false,
      upload_ok: false,
      policy_allows_collection: true,
      deliberately_stopped: false,
      agent_version: null,
      install_path: null,
      last_heartbeat_at: null,
      last_collection_at: null,
      last_upload_at: null,
      last_error: null,
      diagnostic: 'Desktop app required to manage the monitoring agent.',
      is_running: false,
      is_online: false,
      is_active: false,
      active_task_title: null,
      last_sync_time: null,
    };
  },

  installMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('install_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  configureMonitoringAgent: async (
    employeeId: string,
    supabaseUrl: string,
    supabaseAnonKey: string
  ) => {
    if (!isTauriEnvironment()) return;
    await invoke('configure_monitoring_agent', {
      employeeId,
      supabaseUrl,
      supabaseAnonKey,
    });
  },

  startMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('start_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  stopMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('stop_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  pauseMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('pause_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  resumeMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('resume_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  uninstallMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('uninstall_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  recoverMonitoringAgent: async () =>
    isTauriEnvironment()
      ? invoke<AgentLifecycleStatusDto>('recover_monitoring_agent')
      : api.getAgentLifecycleStatus(),

  setMonitoringAuthorized: async (authorized: boolean) => {
    if (!isTauriEnvironment()) return;
    await invoke('set_monitoring_authorized', { authorized });
  },
};
