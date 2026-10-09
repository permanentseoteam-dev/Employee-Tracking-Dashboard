import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Radio,
  Shield,
  Users,
  User,
  Briefcase,
  Activity,
  CheckCheck,
  LogOut,
  ChevronDown,
  DollarSign,
  Award,
  Pencil,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { EditProfileModal } from '../profile/EditProfileModal';
import type { AgentStatusDto, DbStats } from '../../types';
import type { UserRole } from '../../types/roles';

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
  type: 'telemetry' | 'security' | 'merit' | 'system' | 'payment';
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
  const { user, role, switchRole, signOut, isAuthenticated } = useAuth();
  const [imgError, setImgError] = useState(false);

  // Popover States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

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
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (notificationFilter === 'unread') return n.unread;
    return true;
  });

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    );
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  // Fetch Payment Notification for Employee Only
  const fetchPaymentNotifications = async () => {
    if (role === 'employee') {
      try {
        const msgs = await dataService.getConfidentialMessages('employee', user.id, user.email, user.name);
        if (msgs.length > 0) {
          const payNotifs: NotificationItem[] = msgs.map((m) => ({
            id: `pay-${m.id}`,
            title: m.subject || 'Payment Disbursed',
            description: m.salary_slip_reference
              ? `Salary disbursed: $${m.salary_slip_reference.amount.toLocaleString()} ${m.salary_slip_reference.currency} (${m.salary_slip_reference.month})`
              : m.message_body,
            time: 'Payment Confirmed',
            type: 'payment',
            unread: !m.is_read,
          }));

          setNotifications((prev) => {
            const payIds = new Set(payNotifs.map((p) => p.id));
            return [...payNotifs, ...prev.filter((n) => !payIds.has(n.id))];
          });
        } else {
          // Default payment notification for employee
          const defaultPaymentNotif: NotificationItem = {
            id: 'pay-default',
            title: 'Payment Processed',
            description: 'October 2026 salary compensation of $6,650 USD has been credited to your account (•••• 4821).',
            time: 'October 2026',
            type: 'payment',
            unread: true,
          };
          setNotifications((prev) => {
            if (prev.some((n) => n.id === 'pay-default')) return prev;
            return [defaultPaymentNotif, ...prev];
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchPaymentNotifications();
    const interval = setInterval(fetchPaymentNotifications, 10000);
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

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const openEditProfile = () => {
    setIsProfileOpen(false);
    setIsEditProfileOpen(true);
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
      : (user?.name || 'Arsal')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

  return (
    <header className="stitch-header" style={{ position: 'relative', zIndex: 100 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div className="stitch-brand" onClick={onRefresh} title="Click to refresh agent status and current page data" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRefresh(); } }}>
          <div className="stitch-brand-icon">
            <img src="/app-icon-192.png" alt="Employee Tracking App" width={36} height={36} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="stitch-brand-title">Employee Tracking App</span>
            <span className="stitch-brand-sub">Workforce Activity Desktop</span>
          </div>
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
              : role === 'project_manager'
              ? 'Search projects, members, allocations...'
              : 'Search my tasks, attendance, projects...'
          }
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Controls: Role Switcher, Realtime Telemetry, Theme, Notification, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Role switcher — demo only when not signed in. Authenticated users stay on profile role. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface-frosted-subdued)',
            padding: 3,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--surface-border-subtle)',
            gap: 3,
            opacity: isAuthenticated ? 0.85 : 1,
          }}
          title={
            isAuthenticated
              ? `Signed in as ${role} — role switch locked`
              : 'Demo: switch console view (not available when signed in)'
          }
        >
          {(['admin', 'manager', 'project_manager', 'employee'] as UserRole[]).map((r) => {
            const isSelected = role === r;
            const lockedOut = isAuthenticated && r !== role;
            const label =
              r === 'project_manager' ? 'PM' : r === 'admin' ? 'Admin' : r === 'manager' ? 'Manager' : 'Employee';
            return (
              <button
                key={r}
                type="button"
                disabled={lockedOut}
                onClick={() => switchRole(r)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  cursor: lockedOut ? 'not-allowed' : 'pointer',
                  textTransform: 'capitalize',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'var(--color-on-primary)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? 'var(--shadow-pill)' : 'none',
                  transition: 'all 0.2s ease',
                  opacity: lockedOut ? 0.4 : 1,
                }}
                title={r === 'project_manager' ? 'Project Manager' : label}
              >
                {r === 'admin' && <Shield size={12} />}
                {r === 'manager' && <Users size={12} />}
                {r === 'project_manager' && <Briefcase size={12} />}
                {r === 'employee' && <User size={12} />}
                {label}
              </button>
            );
          })}
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
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 390,
                  maxWidth: 'calc(100vw - 32px)',
                  background: theme === 'dark' ? '#0f172a' : '#ffffff',
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  borderRadius: '16px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #cbd5e1',
                  boxShadow:
                    theme === 'dark'
                      ? '0 24px 60px -10px rgba(0, 0, 0, 0.85), 0 10px 24px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      : '0 20px 48px -8px rgba(15, 23, 42, 0.18), 0 8px 16px -4px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  zIndex: 9999,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '14px 18px',
                    background: theme === 'dark' ? '#1e293b' : '#f8fafc',
                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(76, 107, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4c6bff',
                      }}
                    >
                      <Bell size={16} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              background: '#4c6bff',
                              color: '#ffffff',
                              padding: '2px 7px',
                              borderRadius: 10,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {unreadCount} NEW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: theme === 'dark' ? '#94a3b8' : '#64748b', marginTop: 1 }}>
                        System alerts, telemetry & messages
                      </div>
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4c6bff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        transition: 'all 0.15s ease',
                      }}
                      title="Mark all as read"
                    >
                      <CheckCheck size={14} />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {/* Sub-header Filter Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    background: theme === 'dark' ? '#151f33' : '#f1f5f9',
                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setNotificationFilter('all')}
                      style={{
                        border: 'none',
                        background:
                          notificationFilter === 'all'
                            ? theme === 'dark'
                              ? '#334155'
                              : '#ffffff'
                            : 'transparent',
                        color:
                          notificationFilter === 'all'
                            ? theme === 'dark'
                              ? '#ffffff'
                              : '#0f172a'
                            : theme === 'dark'
                            ? '#94a3b8'
                            : '#64748b',
                        fontSize: 11,
                        fontWeight: notificationFilter === 'all' ? 700 : 500,
                        padding: '3px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        boxShadow: notificationFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotificationFilter('unread')}
                      style={{
                        border: 'none',
                        background:
                          notificationFilter === 'unread'
                            ? theme === 'dark'
                              ? '#334155'
                              : '#ffffff'
                            : 'transparent',
                        color:
                          notificationFilter === 'unread'
                            ? theme === 'dark'
                              ? '#ffffff'
                              : '#0f172a'
                            : theme === 'dark'
                            ? '#94a3b8'
                            : '#64748b',
                        fontSize: 11,
                        fontWeight: notificationFilter === 'unread' ? 700 : 500,
                        padding: '3px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        boxShadow: notificationFilter === 'unread' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {filteredNotifications.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '36px 20px',
                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#10b981',
                        }}
                      >
                        <CheckCheck size={22} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                        All caught up!
                      </div>
                      <div style={{ fontSize: 11, maxWidth: 220 }}>
                        {notificationFilter === 'unread'
                          ? 'No unread notifications at the moment.'
                          : 'No system notifications currently stored.'}
                      </div>
                    </div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const getIconAndColors = () => {
                        switch (n.type) {
                          case 'payment':
                            return {
                              icon: <DollarSign size={13} />,
                              bg: 'rgba(16, 185, 129, 0.16)',
                              color: '#10b981',
                              badgeText: 'Payroll',
                            };
                          case 'telemetry':
                            return {
                              icon: <Activity size={13} />,
                              bg: 'rgba(76, 107, 255, 0.16)',
                              color: '#4c6bff',
                              badgeText: 'Telemetry',
                            };
                          case 'merit':
                            return {
                              icon: <Award size={13} />,
                              bg: 'rgba(245, 158, 11, 0.16)',
                              color: '#f59e0b',
                              badgeText: 'Performance',
                            };
                          case 'security':
                            return {
                              icon: <Shield size={13} />,
                              bg: 'rgba(139, 92, 246, 0.16)',
                              color: '#8b5cf6',
                              badgeText: 'Security',
                            };
                          case 'system':
                          default:
                            return {
                              icon: <Radio size={13} />,
                              bg: 'rgba(100, 116, 139, 0.16)',
                              color: '#64748b',
                              badgeText: 'System',
                            };
                        }
                      };

                      const meta = getIconAndColors();

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleToggleRead(n.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom:
                              theme === 'dark'
                                ? '1px solid rgba(255, 255, 255, 0.07)'
                                : '1px solid #f1f5f9',
                            background: n.unread
                              ? theme === 'dark'
                                ? 'rgba(76, 107, 255, 0.08)'
                                : 'rgba(76, 107, 255, 0.04)'
                              : 'transparent',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                            position: 'relative',
                          }}
                          title="Click to toggle read status"
                        >
                          {/* Type Icon Badge */}
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: meta.bg,
                              color: meta.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            {meta.icon}
                          </div>

                          {/* Text Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 2,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {n.title}
                                </span>
                                {n.unread && (
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: '#4c6bff',
                                      boxShadow: '0 0 6px #4c6bff',
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                  flexShrink: 0,
                                }}
                              >
                                {n.time}
                              </span>
                            </div>

                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                fontWeight: 400,
                                color: theme === 'dark' ? '#cbd5e1' : '#334155',
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                              }}
                            >
                              {n.description}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
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
                    : role === 'project_manager'
                    ? 'linear-gradient(135deg, #7c3aed, #1e293b)'
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
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 280,
                  background: theme === 'dark' ? '#0f172a' : '#ffffff',
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  borderRadius: '16px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #cbd5e1',
                  boxShadow:
                    theme === 'dark'
                      ? '0 24px 60px -10px rgba(0, 0, 0, 0.85), 0 10px 24px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      : '0 20px 48px -8px rgba(15, 23, 42, 0.18), 0 8px 16px -4px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  zIndex: 9999,
                  overflow: 'hidden',
                  padding: '14px 16px',
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                      {user.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: theme === 'dark' ? '#1e293b' : '#f8fafc',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Authority Role:</span>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                      {role}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Department:</span>
                    <span style={{ fontWeight: 600, color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                      {user.department || 'Management'}
                    </span>
                  </div>
                  {user.team_name ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Team:</span>
                      <span style={{ fontWeight: 600, color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                        {user.team_name}
                      </span>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Security Level:</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                      DPAPI Verified
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openEditProfile}
                  className="btn-pill btn-pill-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '7px 0' }}
                >
                  <Pencil size={13} />
                  <span>Edit Profile</span>
                </button>

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

      <EditProfileModal open={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
    </header>
  );
};
