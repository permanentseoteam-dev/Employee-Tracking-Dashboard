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
  FolderKanban,
  CheckSquare,
  Award,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
        { label: 'Admin Dashboard', route: '/admin/dashboard', icon: <LayoutDashboard size={17} /> },
      ],
    },
    {
      title: 'Organization',
      items: [
        { label: 'Employees', route: '/admin/employees', icon: <Users size={17} /> },
        { label: 'Managers', route: '/admin/managers', icon: <UserCheck size={17} /> },
        { label: 'Teams', route: '/admin/teams', icon: <Building2 size={17} /> },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        { label: 'Live Activity', route: '/admin/monitoring/live', icon: <Activity size={17} /> },
        { label: 'Screenshots', route: '/admin/monitoring/screenshots', icon: <Camera size={17} /> },
        { label: 'Mouse Heatmaps', route: '/admin/monitoring/heatmaps', icon: <Flame size={17} /> },
      ],
    },
    {
      title: 'Workforce',
      items: [
        { label: 'Attendance & Rules', route: '/admin/attendance', icon: <CalendarCheck size={17} /> },
        { label: 'Projects', route: '/admin/projects', icon: <FolderKanban size={17} /> },
        { label: 'Tasks', route: '/admin/tasks', icon: <CheckSquare size={17} /> },
        { label: 'Performance & Stars', route: '/admin/performance', icon: <Award size={17} /> },
      ],
    },
    {
      title: 'System & Governance',
      items: [
        { label: 'Audit Logs', route: '/admin/audit-logs', icon: <ShieldAlert size={17} /> },
        { label: 'Organization Settings', route: '/admin/settings', icon: <Settings size={17} /> },
      ],
    },
  ];

  return (
    <aside
      className="sidebar admin-sidebar"
      style={{
        width: collapsed ? '68px' : '250px',
        transition: 'width 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        {/* Organization Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px 8px 6px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {!collapsed && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--primary)' }}>
                Organization Center
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enterprise Admin</div>
            </div>
          )}
          <button
            className="icon-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
            style={{ margin: collapsed ? '0 auto' : undefined }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Sections */}
        {navSections.map((section) => (
          <div key={section.title} className="nav-group">
            {!collapsed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '4px 10px',
                  letterSpacing: '0.5px',
                }}
              >
                {section.title}
              </span>
            )}
            {section.items.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate(item.route)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '8px 12px',
                  }}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Admin Footprint Box */}
      <div className="agent-status-panel" style={{ marginTop: 'auto', padding: collapsed ? 8 : 12 }}>
        {!collapsed ? (
          <>
            <div className="status-header">
              <span className="status-title">Control Center</span>
              <div className="status-indicator-dot" title="Enterprise Core Connected" />
            </div>
            <div className="agent-meta-row">
              <span>Admin:</span>
              <span className="agent-meta-value">{user.name}</span>
            </div>
            <div className="agent-meta-row">
              <span>Scope:</span>
              <span className="agent-meta-value" style={{ color: 'var(--primary)' }}>All Teams (Global)</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="var(--primary)" />
          </div>
        )}
      </div>
    </aside>
  );
};
