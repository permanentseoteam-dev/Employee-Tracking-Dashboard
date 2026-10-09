import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Activity,
  Camera,
  Flame,
  CalendarCheck,
  Coffee,
  DollarSign,
  Award,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Keyboard,
  Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SidebarProjectsNav } from '../projects/SidebarProjectsNav';

interface AdminSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentRoute, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const navSections = [
    {
      title: 'Overview',
      items: [
        { label: 'Admin Dashboard', route: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
      ],
    },
    {
      title: 'Organization',
      items: [
        { label: 'Employees', route: '/admin/employees', icon: <Users size={16} /> },
        { label: 'Managers', route: '/admin/managers', icon: <UserCheck size={16} /> },
        { label: 'Teams', route: '/admin/teams', icon: <Building2 size={16} /> },
      ],
    },
    {
      title: 'Live Telemetry',
      items: [
        { label: 'Live Monitoring', route: '/admin/monitoring/live', icon: <Activity size={16} /> },
        { label: 'Screenshots', route: '/admin/monitoring/screenshots', icon: <Camera size={16} /> },
        { label: 'Mouse Heatmaps', route: '/admin/monitoring/heatmaps', icon: <Flame size={16} /> },
        { label: 'Keyboard Activity', route: '/admin/monitoring/keyboard', icon: <Keyboard size={16} /> },
        { label: 'Screen Recordings', route: '/admin/monitoring/recordings', icon: <Video size={16} /> },
      ],
    },
    {
      title: 'Workforce',
      items: [
        { label: 'Attendance & Rules', route: '/admin/attendance', icon: <CalendarCheck size={16} /> },
        { label: 'Break Schedule', route: '/admin/breaks', icon: <Coffee size={16} /> },
        { label: 'Payroll & Salaries', route: '/admin/finance', icon: <DollarSign size={16} /> },
        { label: 'Performance & Stars', route: '/admin/performance', icon: <Award size={16} /> },
      ],
    },
    {
      title: 'Governance',
      items: [
        { label: 'Audit Logs', route: '/admin/audit-logs', icon: <ShieldAlert size={16} /> },
        { label: 'Settings & Config', route: '/admin/settings', icon: <Settings size={16} /> },
      ],
    },
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        {/* Collapse toggle row */}
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
                Admin Operations
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Enterprise Control</div>
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

        {/* Navigation Sections */}
        {navSections.map((section) => (
          <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!collapsed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '4px 8px',
                  letterSpacing: '0.05em',
                }}
              >
                {section.title}
              </span>
            )}
            {section.items.map((item) => {
              const isActive =
                currentRoute === item.route ||
                (item.route === '/admin/monitoring/live' &&
                  (currentRoute === '/admin/monitoring' ||
                    currentRoute === '/admin/monitoring/live' ||
                    currentRoute === '/admin/monitoring/recordings'));
              return (
                <React.Fragment key={item.route}>
                  <button
                    type="button"
                    className={`nav-pill-item ${isActive ? 'active' : ''}`}
                    onClick={() => onNavigate(item.route)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '8px 0' : '7px 12px',
                      fontSize: 12,
                    }}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                  {section.title === 'Workforce' && item.route === '/admin/breaks' && (
                    <SidebarProjectsNav
                      role="admin"
                      projectsRoute="/admin/projects"
                      isActive={currentRoute.includes('/admin/projects')}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {/* Admin Scope Panel */}
      <div className="frosted-card frosted-card-sm" style={{ marginTop: 'auto', padding: collapsed ? 8 : 12 }}>
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Global Scope
              </span>
              <span className="pulse-beacon" />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              All Departments
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
