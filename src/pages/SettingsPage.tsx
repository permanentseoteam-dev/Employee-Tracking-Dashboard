import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Terminal, Database, Sun, Moon, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { api } from '../services/tauriBridge';
import { useTheme } from '../context/ThemeContext';
import type { AppConfig, DbStats, LogEntry } from '../types';

import { useAppRefresh } from '../hooks/useAppRefresh';
import { RefreshButton } from '../components/common/RefreshButton';
interface SettingsPageProps {
  dbStats: DbStats;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ dbStats }) => {
  const { theme, setTheme } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cfg = await api.getAppConfig();
      setConfig(cfg);
      const recentLogs = await api.getRecentLogs(30);
      setLogs(recentLogs);
    } catch (e: any) {
      console.error('Failed to load settings:', e);
    }
  };

  useAppRefresh(loadData);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateAppConfig(config);
      setConfig(updated);
      setSaveMessage('Configuration updated successfully in local SQLite store.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err}`);
    } finally {
      setIsSaving(false);
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
            <SettingsIcon size={14} color="var(--color-secondary)" />
            <span>Local Workstation Engine</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Agent Settings & Diagnostics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Local SQLite telemetry configuration and secret-free redacted audit diagnostics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshButton onRefresh={loadData}   />
        </div>
      </div>

      {saveMessage && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            borderRadius: 'var(--radius-card-sm)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {saveMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Configuration Form */}
        {config && (
          <form className="frosted-card" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <span style={{ fontSize: 16, fontWeight: 700 }}>Telemetry & Screenshot Thresholds</span>
              <span className="live-telemetry-badge">Config v{config.version}</span>
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Screenshot Interval (Seconds, min 30)</label>
              <input
                type="number"
                min="30"
                className="stitch-input"
                value={config.screenshot_interval_secs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    screenshot_interval_secs: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Screenshot Compression Quality (10 - 100)</label>
              <input
                type="number"
                min="10"
                max="100"
                className="stitch-input"
                value={config.screenshot_quality}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    screenshot_quality: parseInt(e.target.value) || 80,
                  })
                }
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Idle Inactivity Threshold (Seconds)</label>
              <input
                type="number"
                min="10"
                className="stitch-input"
                value={config.idle_threshold_secs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    idle_threshold_secs: parseInt(e.target.value) || 180,
                  })
                }
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Backend API Server Endpoint</label>
              <input
                type="text"
                className="stitch-input"
                value={config.server_url}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    server_url: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={config.track_keyboard}
                  onChange={(e) => setConfig({ ...config, track_keyboard: e.target.checked })}
                />
                <span>Track Aggregate Keyboard Counts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={config.track_mouse}
                  onChange={(e) => setConfig({ ...config, track_mouse: e.target.checked })}
                />
                <span>Track Mouse Moves & Clicks</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={config.track_screenshots}
                  onChange={(e) => setConfig({ ...config, track_screenshots: e.target.checked })}
                />
                <span>Enable Periodic Screenshots</span>
              </label>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <button type="submit" className="btn-pill btn-pill-primary" disabled={isSaving} style={{ width: '100%' }}>
                <Save size={15} />
                <span>{isSaving ? 'Saving Configuration...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Appearance & Theme Selector */}
          <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {theme === 'dark' ? (
                  <Moon size={18} color="var(--color-secondary)" />
                ) : (
                  <Sun size={18} color="var(--color-secondary)" />
                )}
                <span style={{ fontSize: 16, fontWeight: 700 }}>Appearance & Theme</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Toggle between Luminous Frosted Light and Obsidian Frosted Dark modes.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className={`btn-pill ${theme === 'dark' ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                onClick={() => setTheme('dark')}
                style={{ flex: 1 }}
              >
                <Moon size={15} />
                <span>Dark Mode</span>
              </button>
              <button
                type="button"
                className={`btn-pill ${theme === 'light' ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                onClick={() => setTheme('light')}
                style={{ flex: 1 }}
              >
                <Sun size={15} />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Database Diagnostics */}
          <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Local SQLite Telemetry Health</span>
              </div>
            </div>

            <div className="stitch-table-wrapper">
              <table className="stitch-table">
                <tbody>
                  <tr>
                    <td>Schema Migration Version</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>v{dbStats.schema_version}</td>
                  </tr>
                  <tr>
                    <td>Pending Outbox Items</td>
                    <td style={{ fontWeight: 600 }}>{dbStats.pending_outbox_count}</td>
                  </tr>
                  <tr>
                    <td>Activity Telemetry Rows</td>
                    <td style={{ fontWeight: 600 }}>{dbStats.activity_records_count}</td>
                  </tr>
                  <tr>
                    <td>Screenshot Records</td>
                    <td style={{ fontWeight: 600 }}>{dbStats.screenshot_records_count}</td>
                  </tr>
                  <tr>
                    <td>Task Sessions Recorded</td>
                    <td style={{ fontWeight: 600 }}>{dbStats.task_sessions_count}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                background: 'var(--surface-frosted-subdued)',
                borderRadius: 'var(--radius-card-sm)',
                fontSize: 11,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldCheck size={14} color="var(--status-success)" />
              <span>WAL journaling and DPAPI hardware secrets are active.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Redacted Audit Logs */}
      <div className="frosted-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={18} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Redacted Agent Diagnostics Logs</span>
          </div>
          <RefreshButton onRefresh={loadData} iconOnly size={14} title="Refresh Logs" />
        </div>

        <div
          style={{
            background: 'var(--surface-frosted-subdued)',
            border: '1px solid var(--surface-border-subtle)',
            padding: 14,
            borderRadius: 'var(--radius-card-sm)',
            fontFamily: 'monospace',
            fontSize: 12,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No logs available in the local telemetry queue.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span
                  style={{
                    color:
                      log.level === 'ERROR'
                        ? 'var(--status-error)'
                        : log.level === 'WARN'
                        ? 'var(--status-warning)'
                        : 'var(--color-secondary)',
                    fontWeight: 700,
                  }}
                >
                  [{log.level}]
                </span>
                <span style={{ color: 'var(--text-muted)' }}>[{log.target}]</span>
                <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};
