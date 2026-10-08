import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  Camera,
  CalendarCheck,
  FolderKanban,
  CheckSquare,
  Award,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ManagerSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const ManagerSidebar: React.FC<ManagerSidebarProps> = ({ currentRoute, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const navSections = [
    {
      title: 'Operations',
      items: [
        { label: 'Team Dashboard', route: '/manager/dashboard', icon: <LayoutDashboard size={17} /> },
      ],
    },
    {
      title: 'My Team',
      items: [
        { label: 'Assigned Employees', route: '/manager/team', icon: <Users size={17} /> },
        { label: 'Live Activity', route: '/manager/activity', icon: <Activity size={17} /> },
        { label: 'Team Screenshots', route: '/manager/screenshots', icon: <Camera size={17} /> },
      ],
    },
    {
      title: 'Work & Delivery',
      items: [
        { label: 'Team Attendance', route: '/manager/attendance', icon: <CalendarCheck size={17} /> },
        { label: 'Assigned Projects', route: '/manager/projects', icon: <FolderKanban size={17} /> },
        { label: 'Team Tasks', route: '/manager/tasks', icon: <CheckSquare size={17} /> },
        { label: 'Team Performance', route: '/manager/performance', icon: <Award size={17} /> },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Project Documents', route: '/manager/documents', icon: <FileText size={17} /> },
      ],
    },
  ];

  return (
    <aside
      className="sidebar manager-sidebar"
      style={{
        width: collapsed ? '68px' : '240px',
        transition: 'width 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        {/* Manager Team Banner */}
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
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--success)' }}>
                Team Operations
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.team_name || 'Assigned Team'}</div>
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

      {/* Manager Scope Footprint Box */}
      <div className="agent-status-panel" style={{ marginTop: 'auto', padding: collapsed ? 8 : 12 }}>
        {!collapsed ? (
          <>
            <div className="status-header">
              <span className="status-title">Manager Scope</span>
              <div className="status-indicator-dot" title="Team Online" />
            </div>
            <div className="agent-meta-row">
              <span>Manager:</span>
              <span className="agent-meta-value">{user.name}</span>
            </div>
            <div className="agent-meta-row">
              <span>Permitted:</span>
              <span className="agent-meta-value" style={{ color: 'var(--success)' }}>Assigned Team Only</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Shield size={18} color="var(--success)" />
          </div>
        )}
      </div>
    </aside>
  );
};
