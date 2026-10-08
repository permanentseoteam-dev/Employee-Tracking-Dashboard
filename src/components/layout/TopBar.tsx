import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Radio,
  Clock,
  Shield,
  Users,
  User,
  Activity,
  CheckCheck,
  LogOut,
  ChevronDown,
  Lock,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { AgentStatusDto, DbStats } from '../../types';
import type { UserRole, ConfidentialMessageItem } from '../../types/roles';

interface TopBarProps {
  status: AgentStatusDto;
  dbStats: DbStats;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'telemetry' | 'security' | 'merit' | 'system';
  unread: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  status: _status,
  dbStats: _dbStats,
  onRefresh,
  searchQuery,
  onSearchChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, role, switchRole, signOut } = useAuth();
  const [realtimeStatus, setRealtimeStatus] = useState<'Live' | 'Reconnecting...' | 'Offline'>('Live');
  const [sessionSeconds, setSessionSeconds] = useState(16338); // 04:32:18 starting reference
  const [imgError, setImgError] = useState(false);

  // Popover States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Confidential Direct Messages State (Employee Role Only)
  const [confidentialMessages, setConfidentialMessages] = useState<ConfidentialMessageItem[]>([]);
  const [isConfidentialModalOpen, setIsConfidentialModalOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      title: 'Agent Telemetry Stream Online',
      description: 'Real-time WebSocket connection to Supabase active.',
      time: 'Just now',
      type: 'telemetry',
      unread: true,
    },
    {
      id: 'n-2',
      title: 'Shift Check-in Punctuality',
      description: 'Morning shift check-in recorded within grace period.',
      time: '12m ago',
      type: 'merit',
      unread: true,
    },
    {
      id: 'n-3',
      title: 'Windows DPAPI Vault Secure',
      description: 'Desktop credentials encrypted via native Windows vault.',
      time: '1h ago',
      type: 'security',
      unread: false,
    },
    {
      id: 'n-4',
      title: 'Audit Log Checkpoint',
      description: 'Automated SQLite outbox flush completed.',
      time: '2h ago',
      type: 'system',
      unread: false,
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

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

  // Fetch Confidential Direct Messages for Employee
  const fetchConfidentialMessages = async () => {
    if (role === 'employee') {
      try {
        const msgs = await dataService.getConfidentialMessages('employee', user.id, user.email, user.name);
        setConfidentialMessages(msgs);
      } catch (err) {
        console.error(err);
      }
    } else {
      setConfidentialMessages([]);
    }
  };

  useEffect(() => {
    fetchConfidentialMessages();
    const interval = setInterval(fetchConfidentialMessages, 8000);
    return () => clearInterval(interval);
  }, [role, user.id, user.email, user.name]);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatElapsedTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const isAvatarUrl = (avatarStr?: string) => {
    if (!avatarStr) return false;
    return (
      avatarStr.startsWith('http://') ||
      avatarStr.startsWith('https://') ||
      avatarStr.startsWith('/') ||
      avatarStr.startsWith('data:')
    );
  };

  const userInitials =
    user?.avatar && !isAvatarUrl(user.avatar)
      ? user.avatar
      : (user?.name || 'Admin User')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

  return (
    <header className="stitch-header" style={{ position: 'relative', zIndex: 100 }}>
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

        {/* Confidential Admin Direct Messages (Employee Role Only) */}
        {role === 'employee' && (
          <button
            type="button"
            className="btn-icon-circle"
            style={{
              position: 'relative',
              background: confidentialMessages.some((m) => !m.is_read)
                ? 'rgba(59, 130, 246, 0.18)'
                : 'var(--surface-frosted-subdued)',
              borderColor: confidentialMessages.some((m) => !m.is_read)
                ? '#3b82f6'
                : 'var(--surface-border-subtle)',
            }}
            onClick={() => setIsConfidentialModalOpen(true)}
            title={`Confidential Admin Direct Messages (${confidentialMessages.filter((m) => !m.is_read).length} unread)`}
          >
            <Lock size={15} color={confidentialMessages.some((m) => !m.is_read) ? '#3b82f6' : 'var(--text-secondary)'} />
            {confidentialMessages.some((m) => !m.is_read) && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
                }}
              >
                {confidentialMessages.filter((m) => !m.is_read).length}
              </span>
            )}
          </button>
        )}

        {/* Notifications Icon Button with Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="btn-icon-circle"
            style={{ position: 'relative' }}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            title="Notifications & System Alerts"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-error)',
                  boxShadow: '0 0 5px var(--status-error)',
                }}
              />
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 320,
                  background: 'var(--surface-card)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 'var(--radius-card-sm)',
                  border: '1px solid var(--surface-border)',
                  boxShadow: 'var(--shadow-dropdown)',
                  zIndex: 200,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--surface-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={15} color="var(--color-secondary)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      System Notifications
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-secondary)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCheck size={13} />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--surface-border-subtle)',
                        background: n.unread ? 'var(--surface-frosted-subdued)' : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{n.time}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {n.description}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Avatar Pill with Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 10px 3px 4px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            title={`Active Session: ${user.name} (${user.email})`}
          >
            <div
              className="avatar-chip"
              style={{
                background:
                  role === 'admin'
                    ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                    : role === 'manager'
                    ? 'linear-gradient(135deg, #4c6bff, #1e293b)'
                    : 'linear-gradient(135deg, #10b981, #0f172a)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isAvatarUrl(user.avatar) && !imgError ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  onError={() => setImgError(true)}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                userInitials
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {user.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {role} console
              </span>
            </div>

            <ChevronDown size={13} color="var(--text-muted)" style={{ marginLeft: 2 }} />
          </div>

          {/* Profile Dropdown Popover */}
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 260,
                  background: 'var(--surface-card)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 'var(--radius-card-sm)',
                  border: '1px solid var(--surface-border)',
                  boxShadow: 'var(--shadow-dropdown)',
                  zIndex: 200,
                  overflow: 'hidden',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* User Info Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    className="avatar-chip"
                    style={{
                      width: 38,
                      height: 38,
                      fontSize: 13,
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #4c6bff, #1e293b)',
                      color: '#fff',
                    }}
                  >
                    {userInitials}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                    border: '1px solid var(--surface-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Authority Role:</span>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {role}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {user.department || 'Management'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Security Level:</span>
                    <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>
                      DPAPI Verified
                    </span>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    signOut();
                  }}
                  className="btn-pill btn-pill-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '7px 0' }}
                >
                  <LogOut size={13} />
                  <span>Reset Session / Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIDENTIAL MESSAGES MODAL (EMPLOYEE ROLE ONLY) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isConfidentialModalOpen && (
          <div className="stitch-modal-backdrop" onClick={() => setIsConfidentialModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 560, width: '92vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-card-sm)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                      Confidential Executive Transmissions
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Private direct communications addressed exclusively to {user.name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsConfidentialModalOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Security Badge Banner */}
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-card-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <ShieldCheck size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <strong>Single-Recipient Isolation:</strong> These transmissions are delivered directly to you from Executive Administration. Neither team managers nor peers have access to these records.
                </div>
              </div>

              {/* Message List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14, maxHeight: 420, overflowY: 'auto' }}>
                {confidentialMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    No confidential messages from administration.
                  </div>
                ) : (
                  confidentialMessages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-card-sm)',
                        background: msg.is_read ? 'var(--surface-frosted-subdued)' : 'rgba(59, 130, 246, 0.08)',
                        border: msg.is_read ? '1px solid var(--surface-border-subtle)' : '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {msg.subject}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            From: <strong style={{ color: 'var(--color-secondary)' }}>{msg.sender_name}</strong> &bull; {new Date(msg.sent_at).toLocaleDateString()} {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {!msg.is_read && (
                          <span className="live-telemetry-badge" style={{ background: '#3b82f6', color: '#ffffff' }}>
                            New Message
                          </span>
                        )}
                      </div>

                      {/* Salary Slip Reference if present */}
                      {msg.salary_slip_reference && (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-card-sm)',
                            background: 'var(--surface-card)',
                            border: '1px solid var(--surface-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                              Salary Slip Reference ({msg.salary_slip_reference.month})
                            </span>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                              ${msg.salary_slip_reference.amount.toLocaleString()} {msg.salary_slip_reference.currency}
                            </div>
                          </div>
                          <span className="status-pill active" style={{ fontSize: 10 }}>
                            {msg.salary_slip_reference.pay_status}
                          </span>
                        </div>
                      )}

                      {/* Message Body */}
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.message_body}
                      </div>

                      {/* Action buttons */}
                      {!msg.is_read && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            type="button"
                            className="btn-pill btn-pill-secondary"
                            style={{ padding: '4px 12px', fontSize: 11 }}
                            onClick={async () => {
                              await dataService.markConfidentialMessageRead(msg.id);
                              setConfidentialMessages((prev) =>
                                prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
                              );
                            }}
                          >
                            <CheckCheck size={13} />
                            <span>Mark as Read</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};
