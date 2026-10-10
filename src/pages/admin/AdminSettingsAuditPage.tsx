import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  ShieldAlert,
  Save,
  Terminal,
  Activity,
  Laptop,
  Clock,
  Radio,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/tauriBridge';
import { supabase } from '../../services/supabaseClient';
import type { AuditLogItem } from '../../types/roles';
import type { AgentRuntimeConfig, AppConfig } from '../../types';
import { DEFAULT_AGENT_RUNTIME_CONFIG, normalizeWorkDay } from '../../types';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface AdminSettingsAuditPageProps {
  initialView?: 'all' | 'settings' | 'audit-logs';
}

interface AgentTelemetryInfo {
  deviceId: string;
  deviceName: string;
  lastHeartbeatTime: string;
  rawHeartbeat: string;
  activeWindow: string;
  isOnline: boolean;
  status: string;
}

export interface ConnectedWorkstationTelemetry {
  deviceId: string;
  deviceName: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  lastHeartbeatTime: string;
  rawHeartbeat: string;
  activeWindow: string;
  isOnline: boolean;
  status: string;
  isCurrentDevice: boolean;
}

const WORK_DAY_OPTIONS: { id: string; label: string }[] = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

export const AdminSettingsAuditPage: React.FC<AdminSettingsAuditPageProps> = ({ initialView = 'all' }) => {
  const { navigate } = useAuth();
  const [activeView, setActiveView] = useState<'all' | 'settings' | 'audit-logs'>(initialView);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [officeHours, setOfficeHours] = useState<AgentRuntimeConfig>({ ...DEFAULT_AGENT_RUNTIME_CONFIG });
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hoursMessage, setHoursMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const isHoursDirtyRef = React.useRef(false);
  const isConfigDirtyRef = React.useRef(false);

  const [workstations, setWorkstations] = useState<ConnectedWorkstationTelemetry[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  void workstations;
  void selectedDeviceId;
  void setSelectedDeviceId;

  const [agentTelemetry, setAgentTelemetry] = useState<AgentTelemetryInfo>({
    deviceId: '—',
    deviceName: 'Awaiting agent…',
    lastHeartbeatTime: 'Checking agent...',
    rawHeartbeat: '',
    activeWindow: '—',
    isOnline: false,
    status: 'offline',
  });

  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  const formatLocalTime = (isoOrDate?: string): string => {
    if (!isoOrDate) return 'Just now';
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const loadData = async (forceSettings = false) => {
    try {
      const [cfg, hours, logs, presenceRes, eventsRes, profilesRes, localSysInfo] = await Promise.all([
        !isConfigDirtyRef.current || forceSettings ? api.getAppConfig() : Promise.resolve(null),
        !isHoursDirtyRef.current || forceSettings ? dataService.getAgentRuntimeConfig() : Promise.resolve(null),
        dataService.getAuditLogs('admin'),
        supabase
          .from('employee_presence')
          .select('*')
          .order('last_activity_at', { ascending: false })
          .limit(20),
        supabase
          .from('activity_events')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(40),
        supabase
          .from('profiles')
          .select('id, full_name, email, role'),
        api.getSystemInfo().catch(() => null),
      ]);

      if (cfg && (!isConfigDirtyRef.current || forceSettings)) {
        setConfig(cfg);
        if (forceSettings) isConfigDirtyRef.current = false;
      }
      if (hours && (!isHoursDirtyRef.current || forceSettings)) {
        setOfficeHours({
          ...hours,
          work_days: Array.from(new Set((hours.work_days || []).map(normalizeWorkDay))),
        });
        if (forceSettings) isHoursDirtyRef.current = false;
      }
      setAuditLogs(logs);

      const now = new Date();
      setLastSyncTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );

      const presenceList = presenceRes.data || [];
      const eventsList = eventsRes.data || [];
      const profilesList = profilesRes.data || [];
      const localDeviceId = localSysInfo?.device_id || '';

      // Group presence records by distinct device_id
      const deviceMap = new Map<string, any>();
      for (const p of presenceList) {
        if (!p.device_id) continue;
        if (!deviceMap.has(p.device_id)) {
          deviceMap.set(p.device_id, p);
        }
      }

      const mappedWorkstations: ConnectedWorkstationTelemetry[] = Array.from(deviceMap.values()).map((p) => {
        const matchingProfile = profilesList.find((prof: any) => prof.id === p.employee_id);
        const latestDevEvent = eventsList.find(
          (ev: any) =>
            ev.device_id === p.device_id ||
            (ev.metadata?.device_name && ev.metadata.device_name === p.device_id)
        );
        const hbTime = p.last_activity_at || latestDevEvent?.occurred_at;
        const diffSecs = hbTime ? (Date.now() - new Date(hbTime).getTime()) / 1000 : 999999;
        const isOnline = diffSecs < 180; // active within last 3 minutes

        return {
          deviceId: p.device_id,
          deviceName: p.device_id.replace(/^WIN-/, '').replace(/-[^-]+$/, ''),
          employeeId: p.employee_id,
          employeeName: matchingProfile?.full_name || 'System User',
          employeeEmail: matchingProfile?.email || '',
          lastHeartbeatTime: hbTime ? formatLocalTime(hbTime) : 'No heartbeat yet',
          rawHeartbeat: hbTime || '',
          activeWindow:
            latestDevEvent?.metadata?.window ||
            latestDevEvent?.metadata?.window_title ||
            '—',
          isOnline,
          status: p.status || (isOnline ? 'active' : 'offline'),
          isCurrentDevice: p.device_id === localDeviceId,
        };
      });

      setWorkstations(mappedWorkstations);

      if (mappedWorkstations.length > 0) {
        const primary =
          (selectedDeviceId !== 'all' ? mappedWorkstations.find((w) => w.deviceId === selectedDeviceId) : null) ||
          mappedWorkstations[0];
        setAgentTelemetry({
          deviceId: primary.deviceId,
          deviceName: primary.deviceName,
          lastHeartbeatTime: primary.lastHeartbeatTime,
          rawHeartbeat: primary.rawHeartbeat,
          activeWindow: primary.activeWindow,
          isOnline: primary.isOnline,
          status: primary.status,
        });
      }
    } catch (err) {
      console.error('Error loading settings and audit data:', err);
    }
  };

  useAppRefresh(() => loadData(true));

  // Real-time synchronization: subscribe to Postgres changes & interval poll
  useEffect(() => {
    loadData(true);

    // 1. Subscribe to realtime events
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (
        payload.table === 'activity_events' ||
        payload.table === 'employee_presence' ||
        payload.table === 'screenshots'
      ) {
        loadData(false);
      }
    });

    // 2. Poll every 4 seconds to guarantee timestamp synchronization with running agent
    const interval = setInterval(() => loadData(false), 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await api.updateAppConfig(config);
      isConfigDirtyRef.current = false;
      dataService.logAction(
        'Super Admin',
        'admin',
        'UPDATE_MONITORING_CONFIG',
        `Interval: ${config.screenshot_interval_secs}s, Idle: ${config.idle_threshold_secs}s`,
        'Modified organization-wide telemetry thresholds'
      );
      setSaveMessage('Organization monitoring settings saved & synced to agents.');
      setTimeout(() => setSaveMessage(null), 3000);
      loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWorkDay = (dayId: string) => {
    const norm = normalizeWorkDay(dayId);
    isHoursDirtyRef.current = true;
    setOfficeHours((prev) => {
      const current = Array.from(new Set((prev.work_days || []).map(normalizeWorkDay)));
      const has = current.includes(norm);
      const next = has ? current.filter((d) => d !== norm) : [...current, norm];
      const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return { ...prev, work_days: next };
    });
  };

  const handleSaveOfficeHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeHours.work_days.length) {
      alert('Select at least one work day.');
      return;
    }
    setIsSavingHours(true);
    try {
      const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const normalizedDays = Array.from(
        new Set((officeHours.work_days || []).map(normalizeWorkDay))
      ).sort((a, b) => order.indexOf(a) - order.indexOf(b));

      const toSave: AgentRuntimeConfig = {
        ...officeHours,
        work_days: normalizedDays,
      };

      const saved = await dataService.updateAgentRuntimeConfig('admin', toSave);
      isHoursDirtyRef.current = false;
      setOfficeHours(saved);
      window.dispatchEvent(new CustomEvent('stitch:office_hours_updated'));
      dataService.logAction(
        'Super Admin',
        'admin',
        'UPDATE_OFFICE_HOURS',
        `${saved.work_start}–${saved.work_end} [${saved.work_days.join(',')}] enabled=${saved.enabled} override=${saved.capture_outside_hours}`,
        'Updated agent office-hours capture policy'
      );
      setHoursMessage('Office hours saved. Agents refresh this policy within ~5 minutes.');
      setTimeout(() => setHoursMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setIsSavingHours(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* Header */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <ShieldAlert size={14} color="var(--color-secondary)" />
            <span>Enterprise Governance</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Settings & Audit Logs
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Enterprise monitoring thresholds and tamper-evident administrative audit ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* View Toggle Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeView === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('all');
                navigate('/admin/settings');
              }}
            >
              <span>All Overview</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('settings');
                navigate('/admin/settings');
              }}
            >
              <Settings size={14} />
              <span>Settings & Rules</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeView === 'audit-logs' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('audit-logs');
                navigate('/admin/audit-logs');
              }}
            >
              <Terminal size={14} />
              <span>Audit Ledger ({auditLogs.length})</span>
            </button>
          </div>

          <RefreshButton onRefresh={loadData} label="Sync Telemetry" title="Refresh telemetry sync" />
        </div>
      </div>

      {(activeView === 'all' || activeView === 'settings') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          {/* Monitoring Configuration */}
          {config && (
            <form className="frosted-card" onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Global Telemetry & Screenshot Rules</span>
                </div>
                <span className="live-telemetry-badge">Agent v{config.version}</span>
              </div>

              {saveMessage && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--status-success-bg)',
                    color: 'var(--status-success)',
                    borderRadius: 'var(--radius-card-sm)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {saveMessage}
                </div>
              )}

              <div className="stitch-form-group">
                <label className="stitch-label">Screenshot Capture Frequency (Seconds, min 30)</label>
                <input
                  type="number"
                  min="30"
                  className="stitch-input"
                  value={config.screenshot_interval_secs}
                  onChange={(e) => {
                    isConfigDirtyRef.current = true;
                    setConfig({ ...config, screenshot_interval_secs: parseInt(e.target.value) || 60 });
                  }}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Compression Quality (WebP 10 - 100)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  className="stitch-input"
                  value={config.screenshot_quality}
                  onChange={(e) => {
                    isConfigDirtyRef.current = true;
                    setConfig({ ...config, screenshot_quality: parseInt(e.target.value) || 80 });
                  }}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Idle Inactivity Detection (Seconds)</label>
                <input
                  type="number"
                  min="10"
                  className="stitch-input"
                  value={config.idle_threshold_secs}
                  onChange={(e) => {
                    isConfigDirtyRef.current = true;
                    setConfig({ ...config, idle_threshold_secs: parseInt(e.target.value) || 180 });
                  }}
                />
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <button type="submit" className="btn-pill btn-pill-primary" disabled={isSaving} style={{ width: '100%' }}>
                  <Save size={15} />
                  <span>{isSaving ? 'Saving Settings...' : 'Deploy Settings To Agents'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Office hours — remote policy for EmployeeAgent */}
          <form className="frosted-card" onSubmit={handleSaveOfficeHours} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Office Hours Capture Window</span>
              </div>
              <span className="live-telemetry-badge">Agent policy</span>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
              Screenshots pause outside this window on each workstation&apos;s local clock. Agents poll Supabase about every 5 minutes.
            </p>

            {hoursMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  borderRadius: 'var(--radius-card-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {hoursMessage}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={officeHours.enabled}
                onChange={(e) => {
                  isHoursDirtyRef.current = true;
                  setOfficeHours({ ...officeHours, enabled: e.target.checked });
                }}
              />
              <span>Enforce office hours (disable to capture 24/7)</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Work start</label>
                <input
                  type="time"
                  className="stitch-input"
                  value={officeHours.work_start}
                  onChange={(e) => {
                    isHoursDirtyRef.current = true;
                    setOfficeHours({ ...officeHours, work_start: e.target.value });
                  }}
                  disabled={!officeHours.enabled}
                />
              </div>
              <div className="stitch-form-group">
                <label className="stitch-label">Work end</label>
                <input
                  type="time"
                  className="stitch-input"
                  value={officeHours.work_end}
                  onChange={(e) => {
                    isHoursDirtyRef.current = true;
                    setOfficeHours({ ...officeHours, work_end: e.target.value });
                  }}
                  disabled={!officeHours.enabled}
                />
              </div>
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Work days</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WORK_DAY_OPTIONS.map((d) => {
                  const active = (officeHours.work_days || []).map(normalizeWorkDay).includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={`nav-pill-item ${active ? 'active' : ''}`}
                      onClick={() => toggleWorkDay(d.id)}
                      disabled={!officeHours.enabled}
                      style={{
                        opacity: officeHours.enabled ? 1 : 0.45,
                        cursor: officeHours.enabled ? 'pointer' : 'not-allowed',
                        background: active ? 'var(--color-primary)' : 'transparent',
                        color: active ? 'var(--color-on-primary)' : 'var(--text-secondary)',
                        border: active ? '1px solid var(--color-primary)' : '1px solid var(--surface-border-subtle)',
                        fontWeight: active ? 700 : 500,
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-pill)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: officeHours.enabled ? 'pointer' : 'not-allowed', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={officeHours.capture_outside_hours}
                  onChange={(e) => {
                    isHoursDirtyRef.current = true;
                    setOfficeHours({ ...officeHours, capture_outside_hours: e.target.checked });
                  }}
                  disabled={!officeHours.enabled}
                />
                <span style={{ fontWeight: 600 }}>Still capture outside hours (override)</span>
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 24, lineHeight: 1.45 }}>
                {officeHours.capture_outside_hours
                  ? '⚡ Active Override: Workstations will continuously capture screenshots 24/7 without pausing, while maintaining the scheduled office hours for attendance records & shift statistics.'
                  : '🔒 Standard Policy: Workstations will automatically pause screenshot capture outside defined work hours and on unselected days.'}
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <button type="submit" className="btn-pill btn-pill-primary" disabled={isSavingHours} style={{ width: '100%' }}>
                <Save size={15} />
                <span>{isSavingHours ? 'Saving Office Hours...' : 'Save Office Hours Policy'}</span>
              </button>
            </div>
          </form>

          {/* Live Agent Synchronization & Realtime Telemetry Status */}
          <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Agent Synchronization & Heartbeat</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: workstations.some((w) => w.isOnline)
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: workstations.some((w) => w.isOnline) ? '#10b981' : '#ef4444',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'currentColor',
                    boxShadow: workstations.some((w) => w.isOnline) ? '0 0 6px #10b981' : 'none',
                  }}
                />
                <span>
                  {workstations.filter((w) => w.isOnline).length > 1
                    ? `${workstations.filter((w) => w.isOnline).length} WORKSTATIONS ACTIVE & SYNCED`
                    : workstations.some((w) => w.isOnline)
                      ? 'ACTIVE & SYNCED'
                      : 'AWAITING AGENT'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Live telemetry heartbeat receiver constantly synced with running background desktop agent workstations.
            </p>

            {/* Workstation Selector Tabs if multiple connected workstations */}
            {workstations.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: 4,
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-card-sm)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDeviceId('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-card-sm)',
                    border: 'none',
                    background: selectedDeviceId === 'all' ? 'var(--color-primary)' : 'transparent',
                    color: selectedDeviceId === 'all' ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  All Connected Workstations ({workstations.length})
                </button>
                {workstations.map((w) => (
                  <button
                    key={w.deviceId}
                    type="button"
                    onClick={() => setSelectedDeviceId(w.deviceId)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-card-sm)',
                      border: 'none',
                      background: selectedDeviceId === w.deviceId ? 'var(--color-primary)' : 'transparent',
                      color: selectedDeviceId === w.deviceId ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: w.isOnline ? '#10b981' : '#ef4444',
                      }}
                    />
                    <span>{w.deviceId}</span>
                    {w.isCurrentDevice && (
                      <span style={{ opacity: 0.75, fontSize: 10 }}>(This PC)</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Render Workstations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(selectedDeviceId === 'all'
                ? workstations
                : workstations.filter((w) => w.deviceId === selectedDeviceId)
              ).map((ws) => (
                <div
                  key={ws.deviceId}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--surface-frosted-subdued)',
                    borderRadius: 'var(--radius-card-sm)',
                    border: '1px solid var(--surface-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Workstation Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(76, 107, 255, 0.12)',
                          color: 'var(--color-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Laptop size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            Connected Workstation
                          </span>
                          {ws.isCurrentDevice && (
                            <span className="live-telemetry-badge" style={{ fontSize: 9 }}>
                              This Machine
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {ws.deviceId}
                          {ws.employeeName && ws.employeeName !== 'System User' ? ` · ${ws.employeeName}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className={`status-pill ${ws.isOnline ? 'active' : 'offline'}`}
                        style={{ fontSize: 11 }}
                      >
                        {ws.isOnline ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid (Timestamp & Active Window) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div
                      style={{
                        padding: '8px 10px',
                        background: 'var(--surface-subtle)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} color="#10b981" />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last Sync:</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                        {ws.lastHeartbeatTime}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '8px 10px',
                        background: 'var(--surface-subtle)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        <Cpu size={13} color="#f59e0b" />
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={ws.activeWindow}
                        >
                          {ws.activeWindow}
                        </span>
                      </div>
                      <span
                        style={{
                          color: '#10b981',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          marginLeft: 4,
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Tracking
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {workstations.length === 0 && (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                  }}
                >
                  No desktop agents or active workstations currently reporting presence.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              <span>Dashboard Poll Cycle: 4s</span>
              <span>Last refreshed: {lastSyncTime || 'Active'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      {(activeView === 'all' || activeView === 'audit-logs') && (
        <div className="frosted-card">
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Administrative Audit Ledger</span>
              <span className="live-telemetry-badge">{auditLogs.length} events</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <Radio size={12} className="pulse-beacon" color="#10b981" />
              <span>Realtime Synced: {lastSyncTime}</span>
            </div>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Device</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.timestamp}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.actor_name}</td>
                    <td>
                      <span className={`status-pill ${log.actor_role === 'admin' ? 'active' : 'neutral'}`}>
                        {log.actor_role}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {log.action}
                    </td>
                    <td>{log.target}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.ip_device}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{log.details}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No audit records logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};
