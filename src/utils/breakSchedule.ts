import type { BreakScheduleConfig, BreakWindowConfig } from '../types/roles';
import { DEFAULT_BREAK_SCHEDULE } from '../types/roles';

/** Normalize to HH:mm */
export function normalizeBreakTime(raw?: string | null): string {
  if (!raw) return '';
  const parts = String(raw).trim().split(':');
  if (parts.length < 2) return '';
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/** Format HH:mm as "11:00 AM" */
export function formatBreakClock(hhmm: string): string {
  const n = normalizeBreakTime(hhmm);
  if (!n) return '—';
  const [hStr, mStr] = n.split(':');
  let h = Number(hStr);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

/** "11:00 AM – 11:30 AM" */
export function formatBreakRange(window: BreakWindowConfig): string {
  return `${formatBreakClock(window.start_time)} – ${formatBreakClock(window.end_time)}`;
}

export function formatBreakChip(window: BreakWindowConfig): string {
  return `${window.label}: ${formatBreakRange(window)}`;
}

/** Hourly telemetry slot key from start time (e.g. 11:30 → 11:00). */
export function breakTimeSlot(window: BreakWindowConfig): string {
  const n = normalizeBreakTime(window.start_time) || '09:00';
  const hour = n.split(':')[0];
  return `${hour}:00`;
}

export function minutesBetween(start: string, end: string): number {
  const s = normalizeBreakTime(start);
  const e = normalizeBreakTime(end);
  if (!s || !e) return 0;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function formatDurationTotal(schedule: BreakScheduleConfig): string {
  const total = (['coffee', 'zuhr', 'asr'] as const)
    .filter((k) => schedule[k].enabled)
    .reduce((acc, k) => acc + minutesBetween(schedule[k].start_time, schedule[k].end_time), 0);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs <= 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function mergeBreakSchedule(partial?: Partial<BreakScheduleConfig> | null): BreakScheduleConfig {
  const base = DEFAULT_BREAK_SCHEDULE;
  if (!partial) return { ...base, coffee: { ...base.coffee }, zuhr: { ...base.zuhr }, asr: { ...base.asr } };
  const mergeWin = (def: BreakWindowConfig, next?: Partial<BreakWindowConfig>): BreakWindowConfig => ({
    enabled: next?.enabled ?? def.enabled,
    label: (next?.label || def.label).trim() || def.label,
    start_time: normalizeBreakTime(next?.start_time) || def.start_time,
    end_time: normalizeBreakTime(next?.end_time) || def.end_time,
  });
  return {
    coffee: mergeWin(base.coffee, partial.coffee),
    zuhr: mergeWin(base.zuhr, partial.zuhr),
    asr: mergeWin(base.asr, partial.asr),
    updated_at: partial.updated_at,
  };
}
