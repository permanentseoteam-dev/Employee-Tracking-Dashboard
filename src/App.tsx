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
import { AdminBreakSchedulePage } from './pages/admin/AdminBreakSchedulePage';
import { AdminFinancePage } from './pages/admin/AdminFinancePage';
import { AdminPerformancePage } from './pages/admin/AdminPerformancePage';
import { AdminSettingsAuditPage } from './pages/admin/AdminSettingsAuditPage';

// Manager Pages
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ManagerTeamPage } from './pages/manager/ManagerTeamPage';
import { ManagerMonitoringPage } from './pages/manager/ManagerMonitoringPage';
import { ManagerAttendancePage } from './pages/manager/ManagerAttendancePage';
import { ManagerPerformancePage } from './pages/manager/ManagerPerformancePage';

// Project Workspace (Folders & File Embedding)
import { ProjectWorkspace } from './components/projects/ProjectWorkspace';

import { api } from './services/tauriBridge';
import { useAuth } from './context/AuthContext';
import type { AgentStatusDto, DbStats, NavTab, SystemInfoDto } from './types';

import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const { user, role, currentRoute, navigate } = useAuth();

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
        case '/admin/live':
          return <AdminMonitoringPage initialSubTab="live" />;
        case '/admin/monitoring/screenshots':
        case '/admin/screenshots':
          return <AdminMonitoringPage initialSubTab="screenshots" />;
        case '/admin/monitoring/heatmaps':
        case '/admin/heatmaps':
          return <AdminMonitoringPage initialSubTab="heatmaps" />;
        case '/admin/monitoring/keyboard':
        case '/admin/keyboard':
          return <AdminMonitoringPage initialSubTab="keyboard" />;
        case '/admin/monitoring/recordings':
        case '/admin/recordings':
          return <AdminMonitoringPage initialSubTab="recordings" />;
        case '/admin/attendance':
          return <AdminAttendancePage />;
        case '/admin/breaks':
        case '/admin/break-schedule':
          return <AdminBreakSchedulePage />;
        case '/admin/projects':
        case '/admin/tasks':
          return <ProjectWorkspace role="admin" />;
        case '/admin/finance':
          return <AdminFinancePage />;
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
            <ErrorBoundary key={currentRoute} fallbackTitle="Admin Section Error">
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
        case '/manager/live':
          return <ManagerMonitoringPage initialSubTab="live" />;
        case '/manager/monitoring/screenshots':
        case '/manager/screenshots':
          return <ManagerMonitoringPage initialSubTab="screenshots" />;
        case '/manager/monitoring/heatmaps':
        case '/manager/heatmaps':
        case '/manager/activity':
          return <ManagerMonitoringPage initialSubTab="heatmaps" />;
        case '/manager/monitoring/keyboard':
        case '/manager/keyboard':
          return <ManagerMonitoringPage initialSubTab="keyboard" />;
        case '/manager/monitoring/recordings':
        case '/manager/recordings':
          return <ManagerMonitoringPage initialSubTab="recordings" />;
        case '/manager/attendance':
          return <ManagerAttendancePage />;
        case '/manager/projects':
        case '/manager/tasks':
        case '/manager/documents':
          return <ProjectWorkspace role="manager" managerId={user?.id} />;
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
            <ErrorBoundary key={currentRoute} fallbackTitle="Manager Section Error">
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
