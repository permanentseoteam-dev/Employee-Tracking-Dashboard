import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, ShieldAlert, Save, RefreshCw, Terminal, Lock } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { api } from '../../services/tauriBridge';
import type { AuditLogItem } from '../../types/roles';
import type { AppConfig } from '../../types';

export const AdminSettingsAuditPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [cfg, logs] = await Promise.all([
        api.getAppConfig(),
        dataService.getAuditLogs('admin'),
      ]);
      setConfig(cfg);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await api.updateAppConfig(config);
      dataService.logAction(
        'Super Admin',
        'admin',
        'UPDATE_MONITORING_CONFIG',
        `Interval: ${config.screenshot_interval_secs}s, Idle: ${config.idle_threshold_secs}s`,
        'Modified organization-wide telemetry thresholds'
      );
      setSaveMessage('Organization monitoring settings saved.');
      setTimeout(() => setSaveMessage(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message);
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
            <ShieldAlert size={14} color="var(--color-secondary)" />
            <span>Enterprise Governance</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Organization Settings & Audit Logs
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Enterprise monitoring thresholds and tamper-evident administrative audit ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Monitoring Configuration */}
        {config && (
          <form className="frosted-card" onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Global Telemetry & Screenshot Rules</span>
              </div>
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
                onChange={(e) =>
                  setConfig({ ...config, screenshot_interval_secs: parseInt(e.target.value) || 30 })
                }
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
                onChange={(e) =>
                  setConfig({ ...config, screenshot_quality: parseInt(e.target.value) || 80 })
                }
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Idle Inactivity Detection (Seconds)</label>
              <input
                type="number"
                min="10"
                className="stitch-input"
                value={config.idle_threshold_secs}
                onChange={(e) =>
                  setConfig({ ...config, idle_threshold_secs: parseInt(e.target.value) || 180 })
                }
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

        {/* Security & Access Overview */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Security, Scopes & Cryptography</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', border: '1px solid var(--surface-border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                Windows DPAPI Credential Vault
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Active desktop agent telemetry tokens and keys are encrypted via native Windows DPAPI.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', border: '1px solid var(--surface-border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                Role Boundary Enforcement
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Manager roles are strictly scoped to their assigned direct reports and teams with row-level security.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', border: '1px solid var(--surface-border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                Tamper-Evident Audit Guarantee
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                All configuration changes, screenshots views, and role actions are logged to the SQLite audit database.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="frosted-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={18} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Administrative Audit Ledger</span>
            <span className="live-telemetry-badge">{auditLogs.length} events</span>
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
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.timestamp}</td>
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
    </motion.div>
  );
};
