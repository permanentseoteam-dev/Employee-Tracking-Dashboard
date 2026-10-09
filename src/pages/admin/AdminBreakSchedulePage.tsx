import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee, Moon, Save, Clock, CheckCircle2 } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import type { BreakScheduleConfig, BreakWindowConfig } from '../../types/roles';
import { DEFAULT_BREAK_SCHEDULE } from '../../types/roles';
import {
  formatBreakRange,
  formatDurationTotal,
  mergeBreakSchedule,
} from '../../utils/breakSchedule';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
type BreakKey = 'coffee' | 'zuhr' | 'asr';

const BREAK_META: Record<
  BreakKey,
  { icon: React.ReactNode; accent: string; accentBg: string; accentBorder: string; description: string }
> = {
  coffee: {
    icon: <Coffee size={18} />,
    accent: '#d97706',
    accentBg: 'rgba(245, 158, 11, 0.12)',
    accentBorder: 'rgba(245, 158, 11, 0.28)',
    description: 'Mid-morning recess. Telemetry pause is excused for all roles.',
  },
  zuhr: {
    icon: <Moon size={18} />,
    accent: '#059669',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    accentBorder: 'rgba(16, 185, 129, 0.28)',
    description: 'Primary prayer & lunch window. Snapshot state resumes after break.',
  },
  asr: {
    icon: <Moon size={18} />,
    accent: '#7c3aed',
    accentBg: 'rgba(139, 92, 246, 0.12)',
    accentBorder: 'rgba(139, 92, 246, 0.28)',
    description: 'Afternoon prayer recess shown on heatmaps and keyboard banners.',
  },
};

export const AdminBreakSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<BreakScheduleConfig>(() => mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const cfg = await dataService.getBreakScheduleConfig();
      setSchedule(mergeBreakSchedule(cfg));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load break schedule');
      setSchedule(mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE));
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  const patchWindow = (key: BreakKey, patch: Partial<BreakWindowConfig>) => {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const saved = await dataService.updateBreakScheduleConfig('admin', schedule);
      setSchedule(mergeBreakSchedule(saved));
      dataService.logAction(
        user.name || 'Admin',
        'admin',
        'UPDATE_BREAK_SCHEDULE',
        `Coffee ${saved.coffee.start_time}-${saved.coffee.end_time}; Zuhr ${saved.zuhr.start_time}-${saved.zuhr.end_time}; Asr ${saved.asr.start_time}-${saved.asr.end_time}`,
        'Updated organization coffee & prayer break windows'
      );
      setSaveMessage('Break schedule deployed organization-wide.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save break schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSchedule(mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      <div className="grid-operations-header">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            <Coffee size={14} color="var(--color-secondary)" />
            <span>Workforce Policy</span>
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginTop: 2,
            }}
          >
            Coffee & Prayer Break Schedule
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Set official recess windows shown on employee timers, heatmaps, and keyboard activity
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshButton onRefresh={loadData} />
          <button type="button" className="btn-pill btn-pill-secondary" onClick={handleResetDefaults}>
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* KPI-style summary ribbon (dashboard theme) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Authorized Total</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Clock size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {formatDurationTotal(schedule)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
            Combined enabled recess duration
          </span>
        </div>

        {(['coffee', 'zuhr', 'asr'] as BreakKey[]).map((key) => {
          const win = schedule[key];
          const meta = BREAK_META[key];
          return (
            <div key={key} className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{win.label}</span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: meta.accentBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: meta.accent,
                  }}
                >
                  {meta.icon}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {win.enabled ? formatBreakRange(win) : 'Disabled'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                {win.enabled ? 'Visible to all roles' : 'Hidden from banners & timer'}
              </span>
            </div>
          );
        })}
      </div>

      {loadError && (
        <div
          className="frosted-card"
          style={{
            padding: '10px 16px',
            color: 'var(--status-warning)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {loadError}
        </div>
      )}

      <form
        className="frosted-card"
        onSubmit={handleSave}
        style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '1.35rem 1.5rem' }}
      >
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Edit Break Windows</span>
          </div>
          <span className="live-telemetry-badge">Org policy</span>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
          Changes apply to Timer & Activity labels, heatmap / keyboard recess banners, and break telemetry titles.
          Run <code>supabase/migrations/008_break_schedule_config.sql</code> once if the table is missing.
        </p>

        {saveMessage && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--status-success-bg)',
              color: 'var(--status-success)',
              borderRadius: 'var(--radius-card-sm)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={15} />
            <span>{saveMessage}</span>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {(['coffee', 'zuhr', 'asr'] as BreakKey[]).map((key) => {
            const win = schedule[key];
            const meta = BREAK_META[key];
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 14,
                  borderRadius: 'var(--radius-card-sm)',
                  background: 'var(--surface-frosted-subdued)',
                  border: `1px solid ${meta.accentBorder}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: meta.accent, fontWeight: 700 }}>
                    {meta.icon}
                    <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{key === 'coffee' ? 'Coffee' : key === 'zuhr' ? 'Zuhr / Prayer' : 'Asr Prayer'}</span>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={win.enabled}
                      onChange={(e) => patchWindow(key, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {meta.description}
                </p>

                <div className="stitch-form-group">
                  <label className="stitch-label">Display label</label>
                  <input
                    type="text"
                    className="stitch-input"
                    value={win.label}
                    onChange={(e) => patchWindow(key, { label: e.target.value })}
                    disabled={!win.enabled}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Start</label>
                    <input
                      type="time"
                      className="stitch-input"
                      value={win.start_time}
                      onChange={(e) => patchWindow(key, { start_time: e.target.value })}
                      disabled={!win.enabled}
                    />
                  </div>
                  <div className="stitch-form-group">
                    <label className="stitch-label">End</label>
                    <input
                      type="time"
                      className="stitch-input"
                      value={win.end_time}
                      onChange={(e) => patchWindow(key, { end_time: e.target.value })}
                      disabled={!win.enabled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="submit" className="btn-pill btn-pill-primary" disabled={isSaving}>
            <Save size={15} />
            <span>{isSaving ? 'Saving Break Schedule...' : 'Deploy Break Schedule'}</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AdminBreakSchedulePage;
