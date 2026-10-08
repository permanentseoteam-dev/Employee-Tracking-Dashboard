import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  FolderKanban,
  Award,
  Timer,
  ShieldCheck,
} from 'lucide-react';
import type { AgentStatusDto, NavTab } from '../../types';

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
    { id: 'tasks', label: 'My Tasks', icon: <CheckSquare size={17} /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban size={17} /> },
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
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            padding: '4px 10px',
          }}
        >
          Workstation Navigation
        </span>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--surface-border-subtle)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          <ShieldCheck size={13} color="var(--status-success)" />
          <span>Zero Keylogging Verified</span>
        </div>
      </div>
    </aside>
  );
};
