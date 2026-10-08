import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Terminal, Database, Sun, Moon } from 'lucide-react';
import { api } from '../services/tauriBridge';
import { useTheme } from '../context/ThemeContext';
import type { AppConfig, DbStats, LogEntry } from '../types';

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateAppConfig(config);
      setConfig(updated);
      setSaveMessage('Configuration updated successfully in SQLite database.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Settings & Diagnostics</h1>
          <p className="page-subtitle">
            Local SQLite configuration &bull; Secret-free redacted audit logs
          </p>
        </div>
      </div>

      {saveMessage && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {saveMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Configuration Form */}
        {config && (
          <form className="content-card" onSubmit={handleSave}>
            <div className="content-card-title">
              <span>Telemetry & Screenshot Thresholds</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Config v{config.version}</span>
            </div>

            <div className="form-group">
              <label className="form-label">Screenshot Interval (Seconds, min 30)</label>
              <input
                type="number"
                min="30"
                className="form-input"
                value={config.screenshot_interval_secs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    screenshot_interval_secs: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Screenshot Compression Quality (10 - 100)</label>
              <input
                type="number"
                min="10"
                max="100"
                className="form-input"
                value={config.screenshot_quality}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    screenshot_quality: parseInt(e.target.value) || 80,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Idle Inactivity Threshold (Seconds)</label>
              <input
                type="number"
                min="10"
                className="form-input"
                value={config.idle_threshold_secs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    idle_threshold_secs: parseInt(e.target.value) || 180,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Backend API Server Endpoint</label>
              <input
                type="text"
                className="form-input"
                value={config.server_url}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    server_url: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.track_keyboard}
                  onChange={(e) => setConfig({ ...config, track_keyboard: e.target.checked })}
                />
                <span>Track Aggregate Keyboard Counts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.track_mouse}
                  onChange={(e) => setConfig({ ...config, track_mouse: e.target.checked })}
                />
                <span>Track Mouse Moves & Clicks</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.track_screenshots}
                  onChange={(e) => setConfig({ ...config, track_screenshots: e.target.checked })}
                />
                <span>Enable Periodic Screenshots</span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Appearance & Theme Selector */}
          <div className="content-card">
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {theme === 'dark' ? (
                  <Moon size={16} color="var(--primary)" />
                ) : (
                  <Sun size={16} color="var(--warning)" />
                )}
                <span>Appearance & Theme</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Toggle between Light and Dark interface modes.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('dark')}
                style={{ flex: 1 }}
              >
                <Moon size={15} />
                <span>Dark Mode</span>
              </button>
              <button
                type="button"
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('light')}
                style={{ flex: 1 }}
              >
                <Sun size={15} />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Database Diagnostics */}
          <div className="content-card">
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={16} color="var(--primary)" />
                <span>SQLite Database Health</span>
              </div>
            </div>

            <table className="data-table">
              <tbody>
                <tr>
                  <td>Schema Migration Version</td>
                  <td style={{ fontWeight: 600 }}>v{dbStats.schema_version}</td>
                </tr>
                <tr>
                  <td>Pending Outbox Items</td>
                  <td>{dbStats.pending_outbox_count}</td>
                </tr>
                <tr>
                  <td>Activity Telemetry Rows</td>
                  <td>{dbStats.activity_records_count}</td>
                </tr>
                <tr>
                  <td>Screenshot Records</td>
                  <td>{dbStats.screenshot_records_count}</td>
                </tr>
                <tr>
                  <td>Task Sessions Recorded</td>
                  <td>{dbStats.task_sessions_count}</td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              WAL journaling and ACID guarantees are active. Credentials are sequestered in Windows Credential Vault.
            </div>
          </div>
        </div>
      </div>

      {/* Redacted Audit Logs */}
      <div className="content-card" style={{ marginTop: 20 }}>
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} color="var(--primary)" />
            <span>Redacted Agent Diagnostics Logs</span>
          </div>
          <button className="icon-btn" onClick={loadData} title="Refresh Logs">
            <RefreshCw size={14} />
          </button>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-terminal, #070a0f)',
            padding: 12,
            borderRadius: 'var(--radius-md)',
            fontFamily: 'monospace',
            fontSize: 12,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No logs available.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span
                  style={{
                    color:
                      log.level === 'ERROR'
                        ? 'var(--danger)'
                        : log.level === 'WARN'
                        ? 'var(--warning)'
                        : 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  [{log.level}]
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>[{log.target}]</span>
                <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
