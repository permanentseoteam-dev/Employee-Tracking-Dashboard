import React from 'react';
import { Search, Bell, Activity, RefreshCw } from 'lucide-react';
import type { AgentStatusDto, DbStats } from '../../types';

interface TopBarProps {
  status: AgentStatusDto;
  dbStats: DbStats;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  status,
  dbStats,
  onRefresh,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand-badge">
          <div className="brand-icon">
            <Activity size={14} />
          </div>
          <span>Tracking Agent</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="search-box">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search tasks, attendance, projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* Outbox synchronization indicator */}
        <div
          className="sync-status-badge"
          title={`Outbox Queue: ${dbStats.pending_outbox_count} items pending sync`}
        >
          <span
            className={`status-indicator-dot ${status.is_online ? '' : 'offline'}`}
          />
          <span>
            {status.is_online
              ? dbStats.pending_outbox_count === 0
                ? 'Synced'
                : `${dbStats.pending_outbox_count} pending`
              : 'Offline Queue'}
          </span>
        </div>

        {/* Refresh manual sync button */}
        <button
          className="icon-btn"
          onClick={onRefresh}
          title="Refresh metrics and sync status"
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Notifications button */}
        <button
          className="icon-btn"
          title="Notifications"
          aria-label="Notifications"
          onClick={() => {
            alert('Notifications: No critical alerts. All local systems operational.');
          }}
        >
          <Bell size={16} />
        </button>

        {/* User profile button */}
        <div
          className="user-profile-chip"
          title="Logged In User"
          onClick={() => {
            alert('User profile: Active session linked with Windows Credential Vault.');
          }}
        >
          <div className="user-avatar">EM</div>
          <div className="user-info-text">
            <span className="user-name">Employee User</span>
            <span className="user-role">Desktop Agent</span>
          </div>
        </div>
      </div>
    </header>
  );
};
