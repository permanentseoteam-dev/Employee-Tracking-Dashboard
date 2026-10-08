import React, { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon, Radio, Clock, Shield, Users, User, Activity } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
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
  status: _status,
  dbStats: _dbStats,
  onRefresh,
  searchQuery,
  onSearchChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, role, switchRole } = useAuth();
  const [realtimeStatus, setRealtimeStatus] = useState<'Live' | 'Reconnecting...' | 'Offline'>('Live');
  const [sessionSeconds, setSessionSeconds] = useState(16338); // 04:32:18 starting reference

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = dataService.subscribeToRealtime(
      () => {},
      (channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setRealtimeStatus('Live');
        } else if (channelStatus === 'TIMED_OUT' || channelStatus === 'CHANNEL_ERROR') {
          setRealtimeStatus('Reconnecting...');
        } else {
          setRealtimeStatus('Offline');
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const formatElapsedTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <header className="stitch-header">
      {/* Brand & Live Activity Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div className="stitch-brand" onClick={onRefresh} title="Click to refresh telemetry">
          <div className="stitch-brand-icon">
            <Activity size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="stitch-brand-title">Tracking Agent</span>
            <span className="stitch-brand-sub">Core Track Desktop</span>
          </div>
        </div>

        {/* Live Stopwatch Badge */}
        <div className="live-telemetry-badge" title="Live background activity telemetry counter">
          <span className="pulse-beacon" />
          <Clock size={13} />
          <span>Live Track: {formatElapsedTime(sessionSeconds)}</span>
        </div>
      </div>

      {/* Global Search Pill Bar */}
      <div className="stitch-search-pill" style={{ flex: 1, maxWidth: 460, margin: '0 1.5rem' }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder={
            role === 'admin'
              ? 'Search employees, managers, teams, audits...'
              : role === 'manager'
              ? 'Search team members, assigned tasks...'
              : 'Search my tasks, attendance, projects...'
          }
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Controls: Role Switcher, Realtime Telemetry, Theme, Notification, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Role Switcher Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface-frosted-subdued)',
            padding: 3,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--surface-border-subtle)',
            gap: 3,
          }}
          title="Switch Active Console View"
        >
          {(['admin', 'manager', 'employee'] as UserRole[]).map((r) => {
            const isSelected = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => switchRole(r)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'var(--color-on-primary)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? 'var(--shadow-pill)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {r === 'admin' && <Shield size={12} />}
                {r === 'manager' && <Users size={12} />}
                {r === 'employee' && <User size={12} />}
                {r}
              </button>
            );
          })}
        </div>

        {/* Supabase Realtime Stream Beacon */}
        <div
          className="live-telemetry-badge"
          style={{
            background:
              realtimeStatus === 'Live'
                ? 'var(--status-success-bg)'
                : realtimeStatus === 'Reconnecting...'
                ? 'var(--status-warning-bg)'
                : 'var(--status-neutral-bg)',
            color:
              realtimeStatus === 'Live'
                ? 'var(--status-success)'
                : realtimeStatus === 'Reconnecting...'
                ? 'var(--status-warning)'
                : 'var(--status-neutral-text)',
          }}
          title={`Supabase Realtime Telemetry: ${realtimeStatus}`}
        >
          <Radio size={12} className={realtimeStatus === 'Live' ? 'pulse-beacon' : ''} />
          <span>{realtimeStatus}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-icon-circle"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#4c6bff" />}
        </button>

        {/* Notifications Icon Button with Pill Badge */}
        <button
          type="button"
          className="btn-icon-circle"
          style={{ position: 'relative' }}
          title="Notifications & System Alerts"
        >
          <Bell size={17} />
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--status-error)',
              boxShadow: '0 0 4px var(--status-error)',
            }}
          />
        </button>

        {/* Profile Avatar Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 12px 3px 4px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-frosted-subdued)',
            border: '1px solid var(--surface-border-subtle)',
            cursor: 'pointer',
          }}
          title={`Active Session: ${user.name} (${user.email})`}
        >
          <div className="avatar-chip">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {user.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {role} console
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
