import React, { useState } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import type { AgentStatusDto, DbStats, NavTab } from '../../types';

interface AppShellProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  status: AgentStatusDto;
  dbStats: DbStats;
  onRefresh: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  status,
  dbStats,
  onRefresh,
  children,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="app-container">
      {/* Ambient Luminous Gradient Backdrop */}
      <div className="stitch-ambient-canvas">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      <TopBar
        status={status}
        dbStats={dbStats}
        onRefresh={onRefresh}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
        <Sidebar
          currentTab={currentTab}
          onTabChange={onTabChange}
          status={status}
        />
        <main className="stitch-main">{children}</main>
      </div>
    </div>
  );
};
