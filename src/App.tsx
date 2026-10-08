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

import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const { role, currentRoute, navigate } = useAuth();

  // Employee State (Synchronized with URL route and browser history)
  const getEmployeeTab = (route: string): NavTab => {
    if (route.includes('/attendance')) return 'attendance';
    if (route.includes('/tasks')) return 'tasks';
    if (route.includes('/projects')) return 'projects';
    if (route.includes('/performance')) return 'performance';
    if (route.includes('/timer')) return 'timer';
    return 'dashboard';
  };

  const currentTab = getEmployeeTab(currentRoute);
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

  const handleTabChange = (tab: NavTab) => {
    navigate(`/employee/${tab}`);
  };

  const handleStartTask = (title: string) => {
    setActiveTaskTitle(title);
    navigate('/employee/timer');
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
        case '/admin/monitoring':
        case '/admin/monitoring/live':
          return <AdminMonitoringPage initialSubTab="live" />;
        case '/admin/monitoring/screenshots':
          return <AdminMonitoringPage initialSubTab="screenshots" />;
        case '/admin/monitoring/heatmaps':
          return <AdminMonitoringPage initialSubTab="heatmaps" />;
        case '/admin/attendance':
          return <AdminAttendancePage />;
        case '/admin/projects':
          return <AdminProjectsTasksPage initialView="projects" />;
        case '/admin/tasks':
          return <AdminProjectsTasksPage initialView="tasks" />;
        case '/admin/performance':
          return <AdminPerformancePage />;
        case '/admin/audit-logs':
          return <AdminSettingsAuditPage initialView="audit-logs" />;
        case '/admin/settings':
          return <AdminSettingsAuditPage initialView="settings" />;
        default:
          return <AdminDashboardPage onNavigate={navigate} />;
      }
    };

    return (
      <div className="app-container">
        {/* Ambient Luminous Gradient Canvas */}
        <div className="stitch-ambient-canvas">
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>

        <TopBar
          status={status}
          dbStats={dbStats}
          onRefresh={fetchState}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
          <AdminSidebar currentRoute={currentRoute} onNavigate={navigate} />
          <main className="stitch-main">
            <ErrorBoundary fallbackTitle="Admin Section Error">
              {renderAdminContent()}
            </ErrorBoundary>
          </main>
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
        case '/manager/monitoring':
        case '/manager/monitoring/live':
        case '/manager/activity':
          return <ManagerMonitoringPage initialSubTab="live" />;
        case '/manager/monitoring/screenshots':
        case '/manager/screenshots':
          return <ManagerMonitoringPage initialSubTab="screenshots" />;
        case '/manager/monitoring/heatmaps':
        case '/manager/heatmaps':
          return <ManagerMonitoringPage initialSubTab="heatmaps" />;
        case '/manager/attendance':
          return <ManagerAttendancePage />;
        case '/manager/projects':
          return <ManagerTasksPage initialView="projects" />;
        case '/manager/tasks':
          return <ManagerTasksPage initialView="tasks" />;
        case '/manager/documents':
          return <ManagerTasksPage initialView="projects" />;
        case '/manager/performance':
          return <ManagerPerformancePage />;
        default:
          return <ManagerDashboardPage onNavigate={navigate} />;
      }
    };

    return (
      <div className="app-container">
        {/* Ambient Luminous Gradient Canvas */}
        <div className="stitch-ambient-canvas">
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>

        <TopBar
          status={status}
          dbStats={dbStats}
          onRefresh={fetchState}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
          <ManagerSidebar currentRoute={currentRoute} onNavigate={navigate} />
          <main className="stitch-main">
            <ErrorBoundary fallbackTitle="Manager Section Error">
              {renderManagerContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Role: EMPLOYEE EXPERIENCE (Preserved exactly with history support)
  // =========================================================================
  const renderEmployeeContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            status={status}
            dbStats={dbStats}
            systemInfo={systemInfo}
            onNavigateToTab={handleTabChange}
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
      default:
        return (
          <DashboardPage
            status={status}
            dbStats={dbStats}
            systemInfo={systemInfo}
            onNavigateToTab={handleTabChange}
          />
        );
    }
  };

  return (
    <AppShell
      currentTab={currentTab}
      onTabChange={handleTabChange}
      status={status}
      dbStats={dbStats}
      onRefresh={fetchState}
    >
      <ErrorBoundary fallbackTitle="Employee Section Error">
        {renderEmployeeContent()}
      </ErrorBoundary>
    </AppShell>
  );
};

export default App;
