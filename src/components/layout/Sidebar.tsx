import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  FolderKanban,
  BarChart3,
  Timer,
  Settings,
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
    { id: 'performance', label: 'Performance', icon: <BarChart3 size={17} /> },
    { id: 'timer', label: 'Timer', icon: <Timer size={17} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  ];

  return (
    <aside className="sidebar">
      <nav className="nav-group">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Agent Status Panel per design.md and hard rules */}
      <div className="agent-status-panel">
        <div className="status-header">
          <span className="status-title">Agent Status</span>
          <div
            className={`status-indicator-dot ${status.is_online ? '' : 'offline'}`}
            title={status.is_online ? 'Agent Online' : 'Agent Offline'}
          />
        </div>
        <div className="agent-meta-row">
          <span>Mode:</span>
          <span className="agent-meta-value">
            {status.is_active ? 'Active' : 'Idle'}
          </span>
        </div>
        <div className="agent-meta-row">
          <span>Connection:</span>
          <span className="agent-meta-value">
            {status.is_online ? 'Online' : 'Offline Queue'}
          </span>
        </div>
        <div className="agent-meta-row">
          <span>Version:</span>
          <span className="agent-meta-value">{status.agent_version}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          <ShieldCheck size={12} color="var(--success)" />
          <span>Transparent Monitoring</span>
        </div>
      </div>
    </aside>
  );
};
