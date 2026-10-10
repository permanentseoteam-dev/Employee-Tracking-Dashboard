import { useEffect, useState, useCallback } from 'react';
import { dataService } from '../services/dataService';
import type { AgentRuntimeConfig } from '../types';
import { normalizeWorkDay, DEFAULT_AGENT_RUNTIME_CONFIG } from '../types';

export const DEFAULT_OFFICE_HOURS: AgentRuntimeConfig = {
  ...DEFAULT_AGENT_RUNTIME_CONFIG,
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
  // If office hours enforcement is disabled, capture is active 24/7
  if (!cfg.enabled) {
    return {
      isWithin: true,
      isWorkDay: true,
      statusLabel: 'Active (24/7 Policy)',
      statusColor: 'success',
    };
  }

  const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDayCode = dayCodes[now.getDay()];
  const normalizedWorkDays = (cfg.work_days || []).map(normalizeWorkDay);
  const isWorkDay = normalizedWorkDays.includes(currentDayCode);

  const [startH, startM] = (cfg.work_start || '09:00').split(':').map(Number);
  const [endH, endM] = (cfg.work_end || '17:00').split(':').map(Number);

  const startMin = (startH || 0) * 60 + (startM || 0);
  const endMin = (endH || 0) * 60 + (endM || 0);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const isShiftTime = startMin <= endMin
    ? currentMin >= startMin && currentMin < endMin
    : currentMin >= startMin || currentMin < endMin; // overnight window support

  // When capture_outside_hours override is enabled:
  // Capture is NEVER paused, even outside office hours or on weekends!
  if (cfg.capture_outside_hours) {
    return {
      isWithin: true,
      isWorkDay,
      statusLabel: isWorkDay && isShiftTime
        ? 'Within Office Hours (On Shift)'
        : isWorkDay
        ? 'Active (Outside Hours Override)'
        : 'Active (Weekend Override)',
      statusColor: 'success',
    };
  }

  if (!isWorkDay) {
    return {
      isWithin: false,
      isWorkDay: false,
      statusLabel: 'Weekend / Off Duty',
      statusColor: 'muted',
    };
  }

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

  const normDays = (config.work_days || []).map(normalizeWorkDay);
  const hasMonToFri = ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => normDays.includes(d));
  let workDaysSummary: string;
  if (normDays.length === 5 && hasMonToFri && !normDays.includes('sat') && !normDays.includes('sun')) {
    workDaysSummary = 'Mon – Fri';
  } else if (normDays.length === 6 && hasMonToFri && normDays.includes('sat') && !normDays.includes('sun')) {
    workDaysSummary = 'Mon – Sat';
  } else if (normDays.length === 7) {
    workDaysSummary = 'Everyday (Mon – Sun)';
  } else {
    workDaysSummary = normDays.map((d) => d.slice(0, 3).toUpperCase()).join(', ');
  }

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
