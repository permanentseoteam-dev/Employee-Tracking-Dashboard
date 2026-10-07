import React from 'react';
import { Play, CheckCircle2, Clock, HardDrive, Shield } from 'lucide-react';
import type { AgentStatusDto, DbStats, SystemInfoDto } from '../types';

interface DashboardPageProps {
  status: AgentStatusDto;
  dbStats: DbStats;
  systemInfo: SystemInfoDto;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  status,
  dbStats,
  systemInfo,
  onNavigateToTab,
}) => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Dashboard</h1>
          <p className="page-subtitle">
            Local Workstation &bull; {systemInfo.hostname} &bull; Device ID: {systemInfo.device_id}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => onNavigateToTab('timer')}
          >
            <Play size={15} />
            <span>Open Task Timer</span>
          </button>
        </div>
      </div>

      {/* Metrics Row - All Real Local Agent Metrics */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Agent Status</span>
            <span
              className={`status-indicator-dot ${status.is_online ? '' : 'offline'}`}
            />
          </div>
          <div className="stat-value">{status.is_online ? 'Online' : 'Offline'}</div>
          <div className="stat-footer">
            <CheckCircle2 size={13} color="var(--success)" />
            <span>{status.is_active ? 'Active & Tracking' : 'Idle Mode'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Outbox Queue</span>
            <Clock size={14} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{dbStats.pending_outbox_count}</div>
          <div className="stat-footer">
            <span>
              {dbStats.pending_outbox_count === 0
                ? 'All records synced to server'
                : 'Pending sync upon network available'}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Activity Windows</span>
            <HardDrive size={14} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{dbStats.activity_records_count}</div>
          <div className="stat-footer">
            <span>60s aggregated telemetry logs</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Active Task</span>
            <Play size={14} color="var(--primary)" />
          </div>
          <div className="stat-value" style={{ fontSize: 18, paddingTop: 4 }}>
            {status.active_task_title || 'None'}
          </div>
          <div className="stat-footer">
            <span>{status.active_task_title ? 'Timer Running' : 'No task in progress'}</span>
          </div>
        </div>
      </div>

      {/* Local System Architecture Info Card */}
      <div className="content-card">
        <div className="content-card-title">
          <span>Agent Compliance & Transparency</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Schema v{dbStats.schema_version}
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
          This desktop agent runs with privacy-first and transparent monitoring principles:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <div
            style={{
              padding: 12,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 4 }}>
              <Shield size={16} color="var(--success)" />
              <span>Zero Keystroke Logging</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Actual typed characters and passwords are never recorded. Only aggregate activity counts are computed.
            </p>
          </div>

          <div
            style={{
              padding: 12,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 4 }}>
              <HardDrive size={16} color="var(--primary)" />
              <span>Offline Outbox SQLite</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              All telemetry, tasks, and attendance are written locally first with UUID v4 idempotency keys before sync.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
