import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Save, RefreshCw, Terminal } from 'lucide-react';
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Settings & Audit Logs</h1>
          <p className="page-subtitle">
            Enterprise monitoring thresholds &bull; Tamper-evident administrative audit ledger
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Monitoring Configuration */}
        {config && (
          <form className="content-card" onSubmit={handleSaveConfig}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} color="var(--primary)" />
                <span>Global Telemetry & Screenshot Rules</span>
              </div>
            </div>

            {saveMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                {saveMessage}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Screenshot Capture Frequency (Seconds)</label>
              <input
                type="number"
                min="30"
                className="form-input"
                value={config.screenshot_interval_secs}
                onChange={(e) =>
                  setConfig({ ...config, screenshot_interval_secs: parseInt(e.target.value) || 30 })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Compression Quality (WebP 10 - 100)</label>
              <input
                type="number"
                min="10"
                max="100"
                className="form-input"
                value={config.screenshot_quality}
                onChange={(e) =>
                  setConfig({ ...config, screenshot_quality: parseInt(e.target.value) || 80 })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Idle Inactivity Detection (Seconds)</label>
              <input
                type="number"
                min="10"
                className="form-input"
                value={config.idle_threshold_secs}
                onChange={(e) =>
                  setConfig({ ...config, idle_threshold_secs: parseInt(e.target.value) || 180 })
                }
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : 'Deploy Settings To Agents'}</span>
            </button>
          </form>
        )}

        {/* Security & Access Overview */}
        <div className="content-card">
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="var(--primary)" />
              <span>Role Permissions & Cryptographic Vault</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>
              <strong>Windows Credential Vault:</strong> Active tokens encrypted with DPAPI hardware keys.
            </div>
            <div>
              <strong>Role Scoping Enforcement:</strong> Manager accounts strictly restricted to assigned team records.
            </div>
            <div>
              <strong>Audit Guarantee:</strong> Administrative setting changes and screenshot views are committed to SQLite audit logs.
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="content-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} color="var(--primary)" />
            <span>Administrative Audit Log ({auditLogs.length} events)</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Target</th>
                <th>Device</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.timestamp}</td>
                  <td style={{ fontWeight: 600 }}>{log.actor_name}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor:
                          log.actor_role === 'admin'
                            ? 'var(--primary-light)'
                            : 'var(--success-bg)',
                        color: log.actor_role === 'admin' ? 'var(--primary)' : 'var(--success)',
                      }}
                    >
                      {log.actor_role}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                    {log.action}
                  </td>
                  <td>{log.target}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.ip_device}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
