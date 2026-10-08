import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  CalendarCheck,
  CheckSquare,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ManagerSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const ManagerSidebar: React.FC<ManagerSidebarProps> = ({ currentRoute, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const navItems = [
    { label: 'Team Dashboard', route: '/manager/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'My Team Roster', route: '/manager/team', icon: <Users size={16} /> },
    { label: 'Live Telemetry', route: '/manager/monitoring', icon: <Activity size={16} /> },
    { label: 'Team Attendance', route: '/manager/attendance', icon: <CalendarCheck size={16} /> },
    { label: 'Tasks & Projects', route: '/manager/tasks', icon: <CheckSquare size={16} /> },
    { label: 'Performance & Stars', route: '/manager/performance', icon: <Award size={16} /> },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 72 : 240,
        background: 'var(--surface-frosted)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem 0.75rem',
        userSelect: 'none',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: '0 6px 8px 6px',
            borderBottom: '1px solid var(--surface-border-subtle)',
          }}
        >
          {!collapsed && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
                Team Management
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Operations Lead</div>
            </div>
          )}
          <button
            type="button"
            className="btn-icon-circle"
            style={{ width: 28, height: 28 }}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                className={`nav-pill-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.route)}
                title={collapsed ? item.label : undefined}
                style={{
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '8px 0' : '8px 12px',
                  fontSize: 13,
                }}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Manager Scope Panel */}
      <div className="frosted-card frosted-card-sm" style={{ marginTop: 'auto', padding: collapsed ? 8 : 12 }}>
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Assigned Team
              </span>
              <span className="pulse-beacon" />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-secondary)' }}>
              Engineering & Operations
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ShieldCheck size={16} color="var(--color-secondary)" />
          </div>
        )}
      </div>
    </aside>
  );
};
