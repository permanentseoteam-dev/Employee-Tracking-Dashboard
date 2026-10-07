import { invoke } from '@tauri-apps/api/core';
import type { AgentStatusDto, AppConfig, DbStats, LogEntry, SystemInfoDto } from '../types';

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
    return {
      screenshot_interval_secs: 300,
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
};
