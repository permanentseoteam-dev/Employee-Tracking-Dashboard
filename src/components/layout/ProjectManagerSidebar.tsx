import React, { useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SidebarProjectsNav } from '../projects/SidebarProjectsNav';

interface ProjectManagerSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const ProjectManagerSidebar: React.FC<ProjectManagerSidebarProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const navItems = [
    { label: 'PM Dashboard', route: '/project-manager/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'User Allocation', route: '/project-manager/allocations', icon: <UserPlus size={16} /> },
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
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-primary)',
                }}
              >
                Project Delivery
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Access & Allocation</div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
              Workspace
            </span>
          )}
          {navItems.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <React.Fragment key={item.route}>
                {item.route === '/project-manager/dashboard' && (
                  <>
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
                    <SidebarProjectsNav
                      role="project_manager"
                      projectsRoute="/project-manager/projects"
                      isActive={currentRoute.includes('/project-manager/projects')}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </>
                )}
                {item.route !== '/project-manager/dashboard' && (
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
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="frosted-card frosted-card-sm" style={{ marginTop: 'auto', padding: collapsed ? 8 : 12 }}>
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                }}
              >
                Project Scope
              </span>
              <span className="pulse-beacon" />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Owned projects & members</div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Briefcase size={16} color="var(--color-secondary)" />
          </div>
        )}
      </div>
    </aside>
  );
};
