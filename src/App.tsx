import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { TasksPage } from './pages/TasksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PerformancePage } from './pages/PerformancePage';
import { TimerPage } from './pages/TimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './services/tauriBridge';
import type { AgentStatusDto, DbStats, NavTab, SystemInfoDto } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);

  const [status, setStatus] = useState<AgentStatusDto>({
    is_running: true,
    is_online: true,
    is_active: true,
    active_task_title: null,
    agent_version: '0.1.0',
    last_sync_time: new Date().toISOString(),
  });

  const [dbStats, setDbStats] = useState<DbStats>({
    schema_version: 1,
    pending_outbox_count: 0,
    activity_records_count: 0,
    screenshot_records_count: 0,
    task_sessions_count: 0,
  });

  const [systemInfo, setSystemInfo] = useState<SystemInfoDto>({
    device_id: 'WIN-DESKTOP-INIT',
    hostname: 'DESKTOP-WORKSTATION',
    os_name: 'Windows',
    os_version: '11',
    agent_version: '0.1.0',
  });

  const fetchState = useCallback(async () => {
    try {
      const [agentStatus, databaseStats, sysInfo] = await Promise.all([
        api.getAgentStatus(),
        api.getDatabaseStats(),
        api.getSystemInfo(),
      ]);
      setStatus(agentStatus);
      setDbStats(databaseStats);
      setSystemInfo(sysInfo);
    } catch (err) {
      console.error('Failed to sync agent state:', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Low resource usage: refresh state every 10 seconds, no tight polling loops
    const timer = setInterval(fetchState, 10000);
    return () => clearInterval(timer);
  }, [fetchState]);

  const handleStartTask = (title: string) => {
    setActiveTaskTitle(title);
    setCurrentTab('timer');
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            status={status}
            dbStats={dbStats}
            systemInfo={systemInfo}
            onNavigateToTab={setCurrentTab}
          />
        );
      case 'attendance':
        return <AttendancePage status={status} />;
      case 'tasks':
        return <TasksPage onStartTask={handleStartTask} />;
      case 'projects':
        return <ProjectsPage />;
      case 'performance':
        return <PerformancePage dbStats={dbStats} />;
      case 'timer':
        return (
          <TimerPage
            activeTaskTitle={activeTaskTitle}
            onActiveTaskChange={setActiveTaskTitle}
          />
        );
      case 'settings':
        return <SettingsPage dbStats={dbStats} />;
      default:
        return (
          <DashboardPage
            status={status}
            dbStats={dbStats}
            systemInfo={systemInfo}
            onNavigateToTab={setCurrentTab}
          />
        );
    }
  };

  return (
    <AppShell
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      status={status}
      dbStats={dbStats}
      onRefresh={fetchState}
    >
      {renderContent()}
    </AppShell>
  );
};

export default App;
