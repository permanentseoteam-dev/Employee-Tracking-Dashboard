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
      <TopBar
        status={status}
        dbStats={dbStats}
        onRefresh={onRefresh}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="app-body">
        <Sidebar
          currentTab={currentTab}
          onTabChange={onTabChange}
          status={status}
        />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};
