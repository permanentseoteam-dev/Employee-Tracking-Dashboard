import { Search, Bell, Activity, RefreshCw, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { AgentStatusDto, DbStats } from '../../types';
import type { UserRole } from '../../types/roles';

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
  const { theme, toggleTheme } = useTheme();
  const { user, role, switchRole } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand-badge">
          <div className="brand-icon">
            <Activity size={14} />
          </div>
          <span>Tracking Agent</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              backgroundColor:
                role === 'admin'
                  ? 'rgba(59, 130, 246, 0.2)'
                  : role === 'manager'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(148, 163, 184, 0.2)',
              color:
                role === 'admin'
                  ? 'var(--primary)'
                  : role === 'manager'
                  ? 'var(--success)'
                  : 'var(--text-secondary)',
            }}
          >
            {role}
          </span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="search-box">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder={
              role === 'admin'
                ? 'Search entire organization (employees, managers, teams, logs)...'
                : role === 'manager'
                ? 'Search team members, assigned tasks, projects...'
                : 'Search tasks, attendance, projects...'
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* Role Switcher Pill Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: 2,
            border: '1px solid var(--border-medium)',
            gap: 2,
          }}
          title="Switch Active Role Session"
        >
          {(['admin', 'manager', 'employee'] as UserRole[]).map((r) => {
            const isSelected = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => switchRole(r)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: isSelected ? 600 : 500,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  backgroundColor: isSelected
                    ? r === 'admin'
                      ? 'var(--primary)'
                      : r === 'manager'
                      ? 'var(--success)'
                      : 'var(--border-medium)'
                    : 'transparent',
                  color: isSelected
                    ? '#fff'
                    : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

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

        {/* Light & Dark Mode Switcher */}
        <button
          className="icon-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun size={16} className="theme-toggle-icon sun" />
          ) : (
            <Moon size={16} className="theme-toggle-icon moon" />
          )}
        </button>

        {/* Notifications button */}
        <button
          className="icon-btn"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>

        {/* User profile chip */}
        <div
          className="user-profile-chip"
          title={`Active Session: ${user.name} (${user.role.toUpperCase()})`}
        >
          <div
            className="user-avatar"
            style={{
              backgroundColor:
                role === 'admin' ? '#3b82f6' : role === 'manager' ? '#10b981' : '#64748b',
            }}
          >
            {user.avatar}
          </div>
          <div className="user-info-text">
            <span className="user-name">{user.name}</span>
            <span className="user-role" style={{ textTransform: 'capitalize' }}>
              {user.role} &bull; {user.department}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
