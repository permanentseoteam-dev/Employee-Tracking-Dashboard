import { useEffect, useState, useCallback } from 'react';
import { dataService } from '../services/dataService';
import type { AgentRuntimeConfig } from '../types';

export const DEFAULT_OFFICE_HOURS: AgentRuntimeConfig = {
  id: 1,
  enabled: true,
  work_start: '09:00',
  work_end: '17:00',
  work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  capture_outside_hours: false,
  timezone_note: 'Local device time',
};

export interface OfficeHoursState {
  config: AgentRuntimeConfig;
  loading: boolean;
  isWithinOfficeHours: boolean;
  isWorkDay: boolean;
  statusLabel: string;
  statusColor: 'success' | 'warning' | 'muted';
  workStartFormatted: string;
  workEndFormatted: string;
  workDaysSummary: string;
  reload: () => Promise<void>;
}

function formatHHMMTo12Hr(timeStr?: string): string {
  if (!timeStr) return '09:00 AM';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${h < 10 ? '0' + h : h}:${mm} ${ampm}`;
}

function evaluateShiftStatus(cfg: AgentRuntimeConfig, now = new Date()): {
  isWithin: boolean;
  isWorkDay: boolean;
  statusLabel: string;
  statusColor: 'success' | 'warning' | 'muted';
} {
  if (!cfg.enabled) {
    return {
      isWithin: true,
      isWorkDay: true,
      statusLabel: 'Active (24/7 Policy)',
      statusColor: 'success',
    };
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[now.getDay()];
  const isWorkDay = cfg.work_days.map((d) => d.toLowerCase()).includes(currentDayName);

  if (!isWorkDay) {
    return {
      isWithin: false,
      isWorkDay: false,
      statusLabel: 'Weekend / Off Duty',
      statusColor: 'muted',
    };
  }

  const [startH, startM] = (cfg.work_start || '09:00').split(':').map(Number);
  const [endH, endM] = (cfg.work_end || '17:00').split(':').map(Number);

  const startMin = (startH || 0) * 60 + (startM || 0);
  const endMin = (endH || 0) * 60 + (endM || 0);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (currentMin < startMin) {
    return {
      isWithin: false,
      isWorkDay: true,
      statusLabel: 'Pre-Shift (Before Office Hours)',
      statusColor: 'warning',
    };
  }

  if (currentMin > endMin) {
    return {
      isWithin: false,
      isWorkDay: true,
      statusLabel: 'Shift Ended (Outside Office Hours)',
      statusColor: 'muted',
    };
  }

  return {
    isWithin: true,
    isWorkDay: true,
    statusLabel: 'Within Office Hours (On Shift)',
    statusColor: 'success',
  };
}

export function useOfficeHours(): OfficeHoursState {
  const [config, setConfig] = useState<AgentRuntimeConfig>(DEFAULT_OFFICE_HOURS);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(() => new Date());

  const reload = useCallback(async () => {
    try {
      const remote = await dataService.getAgentRuntimeConfig();
      setConfig(remote);
    } catch {
      setConfig(DEFAULT_OFFICE_HOURS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();

    // Re-evaluate every 30 seconds
    const interval = setInterval(() => setNow(new Date()), 30000);

    const onUpdated = () => {
      reload();
    };
    window.addEventListener('stitch:office_hours_updated', onUpdated);

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'agent_runtime_config') {
        reload();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('stitch:office_hours_updated', onUpdated);
      unsubscribe();
    };
  }, [reload]);

  const { isWithin, isWorkDay, statusLabel, statusColor } = evaluateShiftStatus(config, now);

  const workStartFormatted = formatHHMMTo12Hr(config.work_start);
  const workEndFormatted = formatHHMMTo12Hr(config.work_end);

  const workDaysSummary = config.work_days.length === 5 && !config.work_days.includes('saturday') && !config.work_days.includes('sunday')
    ? 'Mon – Fri'
    : config.work_days.map((d) => d.slice(0, 3).toUpperCase()).join(', ');

  return {
    config,
    loading,
    isWithinOfficeHours: isWithin,
    isWorkDay,
    statusLabel,
    statusColor,
    workStartFormatted,
    workEndFormatted,
    workDaysSummary,
    reload,
  };
}
