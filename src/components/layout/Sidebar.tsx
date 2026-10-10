import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Award,
  Timer,
} from 'lucide-react';
import type { AgentStatusDto, NavTab } from '../../types';
import { SidebarProjectsNav } from '../projects/SidebarProjectsNav';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  status: AgentStatusDto;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  status,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={17} /> },
    { id: 'performance', label: 'Performance', icon: <Award size={17} /> },
    { id: 'timer', label: 'Timer & Activity', icon: <Timer size={17} /> },
  ];

  return (
    <aside
      style={{
        width: 240,
        background: 'var(--surface-frosted)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem 1rem',
        userSelect: 'none',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 10px 6px', borderBottom: '1px solid var(--surface-border-subtle)', marginBottom: 4 }}>
          <div
            className="stitch-brand-icon"
            style={{ width: 28, height: 28, borderRadius: 8 }}
          >
            <img src="/app-icon-192.png" alt="Workstation" width={28} height={28} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
              Workstation
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Employee Navigation</div>
          </div>
        </div>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <React.Fragment key={item.id}>
              <button
                type="button"
                className={`nav-pill-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '9px 14px',
                  fontSize: 13,
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
              {item.id === 'attendance' && (
                <SidebarProjectsNav
                  role="employee"
                  projectsRoute="projects"
                  isActive={currentTab === 'projects'}
                  onNavigate={() => onTabChange('projects')}
                />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Live Workstation Agent Telemetry Panel */}
      <div className="frosted-card frosted-card-sm" style={{ padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Native Agent
          </span>
          <span className={`pulse-beacon ${status.is_online ? '' : 'offline'}`} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>State:</span>
          <span className="status-pill active" style={{ padding: '1px 8px', fontSize: 10 }}>
            {status.is_active ? 'Active' : 'Idle'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
          <span>Telemetry:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{status.is_online ? 'Supabase Live' : 'Outbox Queue'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Engine:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>v{status.agent_version}</span>
        </div>
      </div>
    </aside>
  );
};
