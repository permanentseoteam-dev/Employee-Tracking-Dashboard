import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { AdminSidebar } from './components/layout/AdminSidebar';
import { ManagerSidebar } from './components/layout/ManagerSidebar';

// Employee Pages (Untouched and preserved)
import { DashboardPage } from './pages/DashboardPage';
import { AttendancePage } from './pages/AttendancePage';
import { TasksPage } from './pages/TasksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PerformancePage } from './pages/PerformancePage';
import { TimerPage } from './pages/TimerPage';
import { SettingsPage } from './pages/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage';
import { AdminManagersPage } from './pages/admin/AdminManagersPage';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';
import { AdminMonitoringPage } from './pages/admin/AdminMonitoringPage';
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage';
import { AdminProjectsTasksPage } from './pages/admin/AdminProjectsTasksPage';
import { AdminPerformancePage } from './pages/admin/AdminPerformancePage';
import { AdminSettingsAuditPage } from './pages/admin/AdminSettingsAuditPage';

// Manager Pages
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ManagerTeamPage } from './pages/manager/ManagerTeamPage';
import { ManagerMonitoringPage } from './pages/manager/ManagerMonitoringPage';
import { ManagerAttendancePage } from './pages/manager/ManagerAttendancePage';
import { ManagerTasksPage } from './pages/manager/ManagerTasksPage';
import { ManagerPerformancePage } from './pages/manager/ManagerPerformancePage';

import { api } from './services/tauriBridge';
import { useAuth } from './context/AuthContext';
import type { AgentStatusDto, DbStats, NavTab, SystemInfoDto } from './types';

export const App: React.FC = () => {
  const { role, currentRoute, navigate } = useAuth();

  // Employee State (Preserved for zero regression)
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

  const [searchQuery, setSearchQuery] = useState('');

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
    const timer = setInterval(fetchState, 10000);
    return () => clearInterval(timer);
  }, [fetchState]);

  const handleStartTask = (title: string) => {
    setActiveTaskTitle(title);
    setCurrentTab('timer');
  };

  // =========================================================================
  // Role: ADMIN ROUTING & EXPERIENCE (Organization Control Center)
  // =========================================================================
  if (role === 'admin') {
    const renderAdminContent = () => {
      switch (currentRoute) {
        case '/admin/dashboard':
          return <AdminDashboardPage onNavigate={navigate} />;
        case '/admin/employees':
          return <AdminEmployeesPage />;
        case '/admin/managers':
          return <AdminManagersPage />;
        case '/admin/teams':
          return <AdminTeamsPage />;
        case '/admin/monitoring/live':
        case '/admin/monitoring/screenshots':
        case '/admin/monitoring/heatmaps':
          return <AdminMonitoringPage />;
        case '/admin/attendance':
          return <AdminAttendancePage />;
        case '/admin/projects':
          return <AdminProjectsTasksPage initialView="projects" />;
        case '/admin/tasks':
          return <AdminProjectsTasksPage initialView="tasks" />;
        case '/admin/performance':
          return <AdminPerformancePage />;
        case '/admin/audit-logs':
        case '/admin/settings':
          return <AdminSettingsAuditPage />;
        default:
          return <AdminDashboardPage onNavigate={navigate} />;
      }
    };

    return (
      <div className="app-container">
        <TopBar
          status={status}
          dbStats={dbStats}
          onRefresh={fetchState}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="app-body">
          <AdminSidebar currentRoute={currentRoute} onNavigate={navigate} />
          <main className="main-content">{renderAdminContent()}</main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Role: MANAGER ROUTING & EXPERIENCE (Team Operations Center)
  // =========================================================================
  if (role === 'manager') {
    const renderManagerContent = () => {
      switch (currentRoute) {
        case '/manager/dashboard':
          return <ManagerDashboardPage onNavigate={navigate} />;
        case '/manager/team':
          return <ManagerTeamPage />;
        case '/manager/activity':
        case '/manager/screenshots':
          return <ManagerMonitoringPage />;
        case '/manager/attendance':
          return <ManagerAttendancePage />;
        case '/manager/projects':
        case '/manager/tasks':
        case '/manager/documents':
          return <ManagerTasksPage />;
        case '/manager/performance':
          return <ManagerPerformancePage />;
        default:
          return <ManagerDashboardPage onNavigate={navigate} />;
      }
    };

    return (
      <div className="app-container">
        <TopBar
          status={status}
          dbStats={dbStats}
          onRefresh={fetchState}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="app-body">
          <ManagerSidebar currentRoute={currentRoute} onNavigate={navigate} />
          <main className="main-content">{renderManagerContent()}</main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Role: EMPLOYEE EXPERIENCE (Preserved exactly as existing)
  // =========================================================================
  const renderEmployeeContent = () => {
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
      {renderEmployeeContent()}
    </AppShell>
  );
};

export default App;
