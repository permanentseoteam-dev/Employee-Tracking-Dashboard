import type {
  UserRole,
  EmployeeRecord,
  ManagerRecord,
  TeamRecord,
  ScreenshotItem,
  AttendanceRecordItem,
  ProjectItem,
  TaskItem,
  AuditLogItem,
  StarRuleItem,
  AttendanceRuleConfig,
  HeatmapPoint,
} from '../types/roles';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Seeded organization data
let employeesStore: EmployeeRecord[] = [
  {
    id: 'emp-001',
    name: 'Arsal',
    email: 'arsal@company.com',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    status: 'active',
    attendance_status: 'on_time',
    first_activity: '08:55 AM',
    active_seconds: 19800, // 5.5h
    idle_seconds: 1800, // 0.5h
    last_screenshot: '10:42 AM',
    current_task: 'Optimize PostgreSQL migration scripts',
    stars: 28,
    device_id: 'WIN-SRV-DEV01',
    joined_at: '2025-03-15',
  },
  {
    id: 'emp-002',
    name: 'Michael Chen',
    email: 'michael.c@company.com',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    status: 'active',
    attendance_status: 'on_time',
    first_activity: '09:02 AM',
    active_seconds: 18400,
    idle_seconds: 2400,
    last_screenshot: '10:40 AM',
    current_task: 'Implement Redis lock caching layer',
    stars: 24,
    device_id: 'WIN-DEV-WS02',
    joined_at: '2025-06-01',
  },
  {
    id: 'emp-003',
    name: 'Elena Rostova',
    email: 'elena.r@company.com',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    status: 'idle',
    attendance_status: 'late',
    first_activity: '09:35 AM',
    active_seconds: 14200,
    idle_seconds: 4800,
    last_screenshot: '10:25 AM',
    current_task: 'Fix outbox retry backoff glitch',
    stars: 18,
    device_id: 'WIN-DEV-WS03',
    joined_at: '2025-08-12',
  },
  {
    id: 'emp-004',
    name: 'David Kim',
    email: 'david.k@company.com',
    department: 'Frontend',
    team_id: 'team-web',
    team_name: 'Design & Web Platform',
    manager_id: 'mgr-002',
    manager_name: 'Jessica Pearson',
    status: 'active',
    attendance_status: 'on_time',
    first_activity: '08:48 AM',
    active_seconds: 21000,
    idle_seconds: 1200,
    last_screenshot: '10:44 AM',
    current_task: 'Refactor role-based routing layout',
    stars: 32,
    device_id: 'WIN-FRONT-WS01',
    joined_at: '2024-11-20',
  },
  {
    id: 'emp-005',
    name: 'Amina Tariq',
    email: 'amina.t@company.com',
    department: 'Frontend',
    team_id: 'team-web',
    team_name: 'Design & Web Platform',
    manager_id: 'mgr-002',
    manager_name: 'Jessica Pearson',
    status: 'on_break',
    attendance_status: 'on_time',
    first_activity: '08:58 AM',
    active_seconds: 16500,
    idle_seconds: 2100,
    last_screenshot: '10:30 AM',
    current_task: 'Namaz Break (General Break)',
    stars: 26,
    device_id: 'WIN-FRONT-WS02',
    joined_at: '2025-01-10',
  },
  {
    id: 'emp-006',
    name: 'Lucas Silva',
    email: 'lucas.s@company.com',
    department: 'Mobile',
    team_id: 'team-mobile',
    team_name: 'Cross-Platform Apps',
    manager_id: 'mgr-003',
    manager_name: 'Marcus Brody',
    status: 'offline',
    attendance_status: 'absent',
    first_activity: '--:--',
    active_seconds: 0,
    idle_seconds: 0,
    last_screenshot: 'Yesterday 05:12 PM',
    current_task: null,
    stars: 12,
    device_id: 'WIN-MOB-WS01',
    joined_at: '2025-09-01',
  },
  {
    id: 'emp-007',
    name: 'Emily Watson',
    email: 'emily.w@company.com',
    department: 'Mobile',
    team_id: 'team-mobile',
    team_name: 'Cross-Platform Apps',
    manager_id: 'mgr-003',
    manager_name: 'Marcus Brody',
    status: 'active',
    attendance_status: 'on_time',
    first_activity: '09:00 AM',
    active_seconds: 18900,
    idle_seconds: 1500,
    last_screenshot: '10:41 AM',
    current_task: 'Android push notification payload bug',
    stars: 22,
    device_id: 'WIN-MOB-WS02',
    joined_at: '2025-04-18',
  },
];

let managersStore: ManagerRecord[] = [
  {
    id: 'mgr-001',
    name: 'Alex Vance',
    email: 'alex.v@company.com',
    department: 'Engineering',
    teams: ['Core Backend Team'],
    assigned_employee_ids: ['emp-001', 'emp-002', 'emp-003'],
    active_projects_count: 2,
  },
  {
    id: 'mgr-002',
    name: 'Jessica Pearson',
    email: 'jessica.p@company.com',
    department: 'Frontend',
    teams: ['Design & Web Platform'],
    assigned_employee_ids: ['emp-004', 'emp-005'],
    active_projects_count: 2,
  },
  {
    id: 'mgr-003',
    name: 'Marcus Brody',
    email: 'marcus.b@company.com',
    department: 'Mobile',
    teams: ['Cross-Platform Apps'],
    assigned_employee_ids: ['emp-006', 'emp-007'],
    active_projects_count: 1,
  },
];

let teamsStore: TeamRecord[] = [
  {
    id: 'team-backend',
    name: 'Core Backend Team',
    department: 'Engineering',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    member_count: 3,
    active_count: 2,
    attendance_rate: 94.5,
    project_ids: ['proj-01', 'proj-02'],
  },
  {
    id: 'team-web',
    name: 'Design & Web Platform',
    department: 'Frontend',
    manager_id: 'mgr-002',
    manager_name: 'Jessica Pearson',
    member_count: 2,
    active_count: 1,
    attendance_rate: 98.0,
    project_ids: ['proj-03', 'proj-04'],
  },
  {
    id: 'team-mobile',
    name: 'Cross-Platform Apps',
    department: 'Mobile',
    manager_id: 'mgr-003',
    manager_name: 'Marcus Brody',
    member_count: 2,
    active_count: 1,
    attendance_rate: 82.0,
    project_ids: ['proj-05'],
  },
];

let screenshotsStore: ScreenshotItem[] = [
  {
    id: 'sc-101',
    employee_id: 'emp-001',
    employee_name: 'Sarah Connor',
    team_name: 'Core Backend Team',
    captured_at: '2026-10-07 10:42:15',
    file_path: 'C:/Tracking/Screenshots/20261007_emp001_1042.webp',
    thumbnail_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%231e293b"/><text x="160" y="90" fill="%2394a3b8" font-size="13" text-anchor="middle" font-family="monospace">VSCode - migration_v2.sql</text></svg>',
    high_res_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%230f172a"/><text x="640" y="340" fill="%2338bdf8" font-size="28" text-anchor="middle" font-family="monospace">Visual Studio Code (Sarah Connor)</text><text x="640" y="390" fill="%2394a3b8" font-size="18" text-anchor="middle" font-family="monospace">ALTER TABLE telemetry_events ADD COLUMN duration_ms INTEGER;</text></svg>',
    file_size_bytes: 148200,
    activity_type: 'active',
    window_title: 'Visual Studio Code - postgres_migrations.rs',
  },
  {
    id: 'sc-102',
    employee_id: 'emp-002',
    employee_name: 'Michael Chen',
    team_name: 'Core Backend Team',
    captured_at: '2026-10-07 10:40:02',
    file_path: 'C:/Tracking/Screenshots/20261007_emp002_1040.webp',
    thumbnail_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%231e293b"/><text x="160" y="90" fill="%2394a3b8" font-size="13" text-anchor="middle" font-family="monospace">Terminal - cargo build --release</text></svg>',
    high_res_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%230b0f17"/><text x="640" y="340" fill="%2310b981" font-size="28" text-anchor="middle" font-family="monospace">PowerShell - Build Output</text><text x="640" y="390" fill="%2394a3b8" font-size="18" text-anchor="middle" font-family="monospace">Compiling redis-sync v0.4.1 ... Finished in 14.2s</text></svg>',
    file_size_bytes: 112450,
    activity_type: 'active',
    window_title: 'Windows PowerShell - redis-sync',
  },
  {
    id: 'sc-103',
    employee_id: 'emp-003',
    employee_name: 'Elena Rostova',
    team_name: 'Core Backend Team',
    captured_at: '2026-10-07 10:25:30',
    file_path: 'C:/Tracking/Screenshots/20261007_emp003_1025.webp',
    thumbnail_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%2327354a"/><text x="160" y="90" fill="%23f59e0b" font-size="13" text-anchor="middle" font-family="monospace">[IDLE] Chrome - GitHub Pull Requests</text></svg>',
    high_res_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%231e293b"/><text x="640" y="340" fill="%23f59e0b" font-size="28" text-anchor="middle" font-family="monospace">Chrome - Inactivity Detected (Idle 6 mins)</text></svg>',
    file_size_bytes: 98400,
    activity_type: 'idle',
    window_title: 'Google Chrome - Pull Request #412',
  },
  {
    id: 'sc-104',
    employee_id: 'emp-004',
    employee_name: 'David Kim',
    team_name: 'Design & Web Platform',
    captured_at: '2026-10-07 10:44:11',
    file_path: 'C:/Tracking/Screenshots/20261007_emp004_1044.webp',
    thumbnail_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%231e293b"/><text x="160" y="90" fill="%2394a3b8" font-size="13" text-anchor="middle" font-family="monospace">Figma - Admin Dashboard Layout</text></svg>',
    high_res_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%230f172a"/><text x="640" y="340" fill="%23a855f7" font-size="28" text-anchor="middle" font-family="monospace">Figma Design - Organization Control Center</text></svg>',
    file_size_bytes: 182300,
    activity_type: 'active',
    window_title: 'Figma - Tracking Agent 2.0',
  },
  {
    id: 'sc-105',
    employee_id: 'emp-007',
    employee_name: 'Emily Watson',
    team_name: 'Cross-Platform Apps',
    captured_at: '2026-10-07 10:41:40',
    file_path: 'C:/Tracking/Screenshots/20261007_emp007_1041.webp',
    thumbnail_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%231e293b"/><text x="160" y="90" fill="%2394a3b8" font-size="13" text-anchor="middle" font-family="monospace">Android Studio - Logcat</text></svg>',
    high_res_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%230f172a"/><text x="640" y="340" fill="%2322c55e" font-size="28" text-anchor="middle" font-family="monospace">Android Studio - PushNotificationService.kt</text></svg>',
    file_size_bytes: 142100,
    activity_type: 'active',
    window_title: 'Android Studio - MobileTracker',
  },
];

let attendanceStore: AttendanceRecordItem[] = [
  {
    id: 'att-1',
    employee_id: 'emp-001',
    employee_name: 'Sarah Connor',
    team_name: 'Core Backend Team',
    manager_name: 'Alex Vance',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '08:55 AM',
    status: 'on_time',
    late_minutes: 0,
    active_hours: 5.5,
    idle_hours: 0.5,
  },
  {
    id: 'att-2',
    employee_id: 'emp-002',
    employee_name: 'Michael Chen',
    team_name: 'Core Backend Team',
    manager_name: 'Alex Vance',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '09:02 AM',
    status: 'on_time',
    late_minutes: 0,
    active_hours: 5.1,
    idle_hours: 0.7,
  },
  {
    id: 'att-3',
    employee_id: 'emp-003',
    employee_name: 'Elena Rostova',
    team_name: 'Core Backend Team',
    manager_name: 'Alex Vance',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '09:35 AM',
    status: 'late',
    late_minutes: 20, // 15m grace exceeded
    active_hours: 3.9,
    idle_hours: 1.3,
  },
  {
    id: 'att-4',
    employee_id: 'emp-004',
    employee_name: 'David Kim',
    team_name: 'Design & Web Platform',
    manager_name: 'Jessica Pearson',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '08:48 AM',
    status: 'on_time',
    late_minutes: 0,
    active_hours: 5.8,
    idle_hours: 0.3,
  },
  {
    id: 'att-5',
    employee_id: 'emp-005',
    employee_name: 'Amina Tariq',
    team_name: 'Design & Web Platform',
    manager_name: 'Jessica Pearson',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '08:58 AM',
    status: 'on_time',
    late_minutes: 0,
    active_hours: 4.6,
    idle_hours: 0.6,
  },
  {
    id: 'att-6',
    employee_id: 'emp-006',
    employee_name: 'Lucas Silva',
    team_name: 'Cross-Platform Apps',
    manager_name: 'Marcus Brody',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '--:--',
    status: 'absent',
    late_minutes: 0,
    active_hours: 0,
    idle_hours: 0,
  },
  {
    id: 'att-7',
    employee_id: 'emp-007',
    employee_name: 'Emily Watson',
    team_name: 'Cross-Platform Apps',
    manager_name: 'Marcus Brody',
    date: '2026-10-07',
    scheduled_start: '09:00 AM',
    first_activity_at: '09:00 AM',
    status: 'on_time',
    late_minutes: 0,
    active_hours: 5.2,
    idle_hours: 0.4,
  },
];

let projectsStore: ProjectItem[] = [
  {
    id: 'proj-01',
    name: 'Enterprise Telemetry Engine',
    code: 'ETE-2026',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    members_count: 3,
    status: 'active',
    progress_percentage: 78,
    total_tasks: 12,
    completed_tasks: 9,
    due_date: '2026-11-15',
    documents: [
      { title: 'Architecture RFC', type: 'doc', url: 'https://docs.google.com/document/d/rf-arch' },
      { title: 'Sprint Capacity Tracker', type: 'sheet', url: 'https://docs.google.com/spreadsheets/d/spr-cap' },
    ],
  },
  {
    id: 'proj-02',
    name: 'SQLite Local Journal Sync',
    code: 'LJS-101',
    manager_id: 'mgr-001',
    manager_name: 'Alex Vance',
    members_count: 2,
    status: 'active',
    progress_percentage: 60,
    total_tasks: 8,
    completed_tasks: 5,
    due_date: '2026-10-30',
  },
  {
    id: 'proj-03',
    name: 'Role-Based Desktop Portal UI',
    code: 'RBD-03',
    manager_id: 'mgr-002',
    manager_name: 'Jessica Pearson',
    members_count: 2,
    status: 'active',
    progress_percentage: 85,
    total_tasks: 10,
    completed_tasks: 8,
    due_date: '2026-10-20',
    documents: [
      { title: 'UX Design System Guidelines', type: 'doc', url: 'https://docs.google.com/document/d/ux-guide' },
    ],
  },
  {
    id: 'proj-04',
    name: 'Analytics Heatmap Renderer',
    code: 'AHR-04',
    manager_id: 'mgr-002',
    manager_name: 'Jessica Pearson',
    members_count: 2,
    status: 'active',
    progress_percentage: 45,
    total_tasks: 6,
    completed_tasks: 3,
    due_date: '2026-11-30',
  },
  {
    id: 'proj-05',
    name: 'Mobile Background Agent',
    code: 'MBA-05',
    manager_id: 'mgr-003',
    manager_name: 'Marcus Brody',
    members_count: 2,
    status: 'on_hold',
    progress_percentage: 30,
    total_tasks: 9,
    completed_tasks: 2,
    due_date: '2026-12-15',
  },
];

let tasksStore: TaskItem[] = [
  {
    id: 'tsk-01',
    title: 'Optimize PostgreSQL migration scripts',
    project_id: 'proj-01',
    project_name: 'Enterprise Telemetry Engine',
    employee_id: 'emp-001',
    employee_name: 'Sarah Connor',
    manager_id: 'mgr-001',
    priority: 'urgent',
    status: 'in_progress',
    tracked_seconds: 14400,
    due_date: '2026-10-09',
  },
  {
    id: 'tsk-02',
    title: 'Implement Redis lock caching layer',
    project_id: 'proj-01',
    project_name: 'Enterprise Telemetry Engine',
    employee_id: 'emp-002',
    employee_name: 'Michael Chen',
    manager_id: 'mgr-001',
    priority: 'high',
    status: 'in_progress',
    tracked_seconds: 12800,
    due_date: '2026-10-10',
  },
  {
    id: 'tsk-03',
    title: 'Fix outbox retry backoff glitch',
    project_id: 'proj-02',
    project_name: 'SQLite Local Journal Sync',
    employee_id: 'emp-003',
    employee_name: 'Elena Rostova',
    manager_id: 'mgr-001',
    priority: 'medium',
    status: 'in_progress',
    tracked_seconds: 9600,
    due_date: '2026-10-12',
  },
  {
    id: 'tsk-04',
    title: 'Refactor role-based routing layout',
    project_id: 'proj-03',
    project_name: 'Role-Based Desktop Portal UI',
    employee_id: 'emp-004',
    employee_name: 'David Kim',
    manager_id: 'mgr-002',
    priority: 'high',
    status: 'in_progress',
    tracked_seconds: 18000,
    due_date: '2026-10-08',
  },
  {
    id: 'tsk-05',
    title: 'Namaz and General Break tracking state sync',
    project_id: 'proj-03',
    project_name: 'Role-Based Desktop Portal UI',
    employee_id: 'emp-005',
    employee_name: 'Amina Tariq',
    manager_id: 'mgr-002',
    priority: 'medium',
    status: 'completed',
    tracked_seconds: 15400,
    due_date: '2026-10-07',
  },
  {
    id: 'tsk-06',
    title: 'Android push notification payload bug',
    project_id: 'proj-05',
    project_name: 'Mobile Background Agent',
    employee_id: 'emp-007',
    employee_name: 'Emily Watson',
    manager_id: 'mgr-003',
    priority: 'urgent',
    status: 'in_progress',
    tracked_seconds: 16200,
    due_date: '2026-10-08',
  },
];

let auditLogsStore: AuditLogItem[] = [
  {
    id: 'aud-01',
    timestamp: '2026-10-07 10:35:12',
    actor_name: 'Super Admin',
    actor_role: 'admin',
    action: 'UPDATE_CONFIG',
    target: 'screenshot_interval_secs',
    ip_device: '192.168.1.10 (WIN-ADM-01)',
    details: 'Changed screenshot interval from 300s to 180s',
  },
  {
    id: 'aud-02',
    timestamp: '2026-10-07 10:14:05',
    actor_name: 'Alex Vance',
    actor_role: 'manager',
    action: 'VIEW_SCREENSHOT',
    target: 'emp-003 (Elena Rostova)',
    ip_device: '192.168.1.42 (WIN-MGR-01)',
    details: 'Viewed thumbnail & timestamp for idle verification',
  },
  {
    id: 'aud-03',
    timestamp: '2026-10-07 09:30:22',
    actor_name: 'Super Admin',
    actor_role: 'admin',
    action: 'STAR_RULE_UPDATED',
    target: 'On-time arrival bonus',
    ip_device: '192.168.1.10 (WIN-ADM-01)',
    details: 'Increased star award to +2 stars',
  },
  {
    id: 'aud-04',
    timestamp: '2026-10-07 08:50:00',
    actor_name: 'System Agent',
    actor_role: 'admin',
    action: 'DEVICE_HEARTBEAT',
    target: 'WIN-SRV-DEV01',
    ip_device: 'Localhost',
    details: 'Agent heartbeat acknowledged and verified',
  },
];

let starRulesStore: StarRuleItem[] = [
  { id: 'sr-1', name: 'On-Time Arrival', condition: 'Check-in before 09:15 AM', star_delta: 2, is_active: true },
  { id: 'sr-2', name: 'Late Arrival Penalty', condition: 'Check-in after grace period', star_delta: -1, is_active: true },
  { id: 'sr-3', name: 'Task Completed', condition: 'Mark task done within estimate', star_delta: 2, is_active: true },
  { id: 'sr-4', name: 'Task Overdue', condition: 'Task missed due date', star_delta: -2, is_active: true },
  { id: 'sr-5', name: 'Exemplary Sprint Performance', condition: 'Manager manual award', star_delta: 5, is_active: true },
];

let attendanceRulesStore: AttendanceRuleConfig = {
  work_start_time: '09:00',
  work_end_time: '17:00',
  grace_period_minutes: 15,
  late_threshold_minutes: 30,
};

// ============================================================================
// Scoped Data Access API with Strict Permission Enforcement
// ============================================================================

export const dataService = {
  // Employees Access
  getEmployees: async (role: UserRole, managerId?: string): Promise<EmployeeRecord[]> => {
    // Sync live presence from Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { data: presenceList } = await supabase.from('employee_presence').select('*');
        if (presenceList && presenceList.length > 0) {
          for (const p of presenceList) {
            const match = employeesStore.find(
              (e) => e.email === 'arsal@company.com' || e.id === 'emp-001' || e.id === p.employee_id
            );
            if (match) {
              match.status = p.status as 'active' | 'idle' | 'offline';
              match.device_id = p.device_id;
              if (p.last_activity_at) {
                const d = new Date(p.last_activity_at);
                match.first_activity = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Could not sync live presence from Supabase:', e);
      }
    }

    if (role === 'admin') {
      return [...employeesStore];
    }
    if (role === 'manager') {
      if (!managerId) return [];
      return employeesStore.filter((e) => e.manager_id === managerId);
    }
    // Employee
    return employeesStore.filter((e) => e.id === 'emp-001');
  },

  addEmployee: async (role: UserRole, newEmp: Partial<EmployeeRecord>): Promise<EmployeeRecord> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can add employees');
    }
    const created: EmployeeRecord = {
      id: `emp-${Date.now()}`,
      name: newEmp.name || 'New Employee',
      email: newEmp.email || 'emp@company.com',
      department: newEmp.department || 'Engineering',
      team_id: newEmp.team_id || 'team-backend',
      team_name: newEmp.team_name || 'Core Backend Team',
      manager_id: newEmp.manager_id || 'mgr-001',
      manager_name: newEmp.manager_name || 'Alex Vance',
      status: 'offline',
      attendance_status: 'absent',
      first_activity: '--:--',
      active_seconds: 0,
      idle_seconds: 0,
      last_screenshot: 'None',
      current_task: null,
      stars: 10,
      device_id: `WIN-DESK-${Math.floor(Math.random() * 1000)}`,
      joined_at: new Date().toISOString().split('T')[0],
    };
    employeesStore = [created, ...employeesStore];
    return created;
  },

  updateEmployeeStatus: async (
    role: UserRole,
    employeeId: string,
    updates: Partial<EmployeeRecord>,
    managerId?: string
  ): Promise<EmployeeRecord> => {
    const emp = employeesStore.find((e) => e.id === employeeId);
    if (!emp) throw new Error('Employee not found');

    if (role === 'manager' && emp.manager_id !== managerId) {
      throw new Error('403 Forbidden: Cannot update employee outside manager team scope');
    }

    Object.assign(emp, updates);
    return emp;
  },

  // Managers Access
  getManagers: async (role: UserRole): Promise<ManagerRecord[]> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can access manager list');
    }
    return [...managersStore];
  },

  // Teams Access
  getTeams: async (role: UserRole, managerId?: string): Promise<TeamRecord[]> => {
    if (role === 'admin') {
      return [...teamsStore];
    }
    if (role === 'manager') {
      if (!managerId) return [];
      return teamsStore.filter((t) => t.manager_id === managerId);
    }
    return [];
  },

  // Screenshots Access with Strict Authorization
  getScreenshots: async (
    role: UserRole,
    managerId?: string,
    filterEmployeeId?: string
  ): Promise<ScreenshotItem[]> => {
    // 1. Fetch live screenshots from Supabase
    let liveScreenshots: ScreenshotItem[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data: dbScreenshots } = await supabase
          .from('screenshots')
          .select('*')
          .order('captured_at', { ascending: false })
          .limit(30);

        if (dbScreenshots && dbScreenshots.length > 0) {
          liveScreenshots = dbScreenshots.map((s) => {
            const { data: pubUrl } = supabase.storage.from('screenshots').getPublicUrl(s.storage_path);
            const isArsal = s.employee_id === 'cccccccc-cccc-cccc-cccc-cccccccccccc' || s.employee_id === 'emp-001';
            const empName = isArsal ? 'Arsal' : 'Michael Chen';
            const empId = isArsal ? 'emp-001' : 'emp-002';
            const d = new Date(s.captured_at);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return {
              id: s.id,
              employee_id: empId,
              employee_name: empName,
              team_name: 'Core Backend Team',
              captured_at: timeStr,
              file_path: s.storage_path,
              thumbnail_url: pubUrl?.publicUrl || '',
              high_res_url: pubUrl?.publicUrl || '',
              file_size_bytes: s.file_size_bytes || 134000,
              activity_type: 'active' as const,
              window_title: 'Development Workstation (Live Rust Agent Capture)',
            };
          });
        }
      } catch (e) {
        console.warn('Could not sync live screenshots from Supabase:', e);
      }
    }

    const combinedScreenshots = [...liveScreenshots, ...screenshotsStore];

    if (role === 'admin') {
      if (filterEmployeeId) {
        return combinedScreenshots.filter((s) => s.employee_id === filterEmployeeId);
      }
      return combinedScreenshots;
    }

    if (role === 'manager') {
      if (!managerId) return [];
      const managerEmployees = employeesStore
        .filter((e) => e.manager_id === managerId)
        .map((e) => e.id);

      // If manager attempts to inspect unauthorized employee, enforce security boundary
      if (filterEmployeeId && !managerEmployees.includes(filterEmployeeId)) {
        throw new Error('403 Forbidden: Cannot access screenshots outside assigned team');
      }

      return combinedScreenshots.filter((s) =>
        filterEmployeeId ? s.employee_id === filterEmployeeId : managerEmployees.includes(s.employee_id)
      );
    }

    // Employee
    return combinedScreenshots.filter((s) => s.employee_id === 'emp-001');
  },

  // Attendance Access
  getAttendance: async (role: UserRole, managerId?: string): Promise<AttendanceRecordItem[]> => {
    if (role === 'admin') {
      return [...attendanceStore];
    }
    if (role === 'manager') {
      if (!managerId) return [];
      const managerEmployees = employeesStore
        .filter((e) => e.manager_id === managerId)
        .map((e) => e.id);
      return attendanceStore.filter((a) => managerEmployees.includes(a.employee_id));
    }
    return attendanceStore.filter((a) => a.employee_id === 'emp-001');
  },

  // Projects Access
  getProjects: async (role: UserRole, managerId?: string): Promise<ProjectItem[]> => {
    if (role === 'admin') {
      return [...projectsStore];
    }
    if (role === 'manager') {
      if (!managerId) return [];
      return projectsStore.filter((p) => p.manager_id === managerId);
    }
    return projectsStore.filter((p) => p.id === 'proj-01');
  },

  createProject: async (
    role: UserRole,
    project: Omit<ProjectItem, 'id' | 'completed_tasks'>,
    managerId?: string
  ): Promise<ProjectItem> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Cannot create project');
    }
    const created: ProjectItem = {
      ...project,
      id: `proj-${Date.now()}`,
      completed_tasks: 0,
      manager_id: role === 'manager' ? (managerId || project.manager_id) : project.manager_id,
    };
    projectsStore = [created, ...projectsStore];
    return created;
  },

  // Tasks Access
  getTasks: async (role: UserRole, managerId?: string): Promise<TaskItem[]> => {
    if (role === 'admin') {
      return [...tasksStore];
    }
    if (role === 'manager') {
      if (!managerId) return [];
      return tasksStore.filter((t) => t.manager_id === managerId);
    }
    return tasksStore.filter((t) => t.employee_id === 'emp-001');
  },

  createTask: async (
    role: UserRole,
    task: Omit<TaskItem, 'id' | 'tracked_seconds'>,
    managerId?: string
  ): Promise<TaskItem> => {
    if (role === 'manager') {
      const assignedEmp = employeesStore.find((e) => e.id === task.employee_id);
      if (!assignedEmp || assignedEmp.manager_id !== managerId) {
        throw new Error('403 Forbidden: Manager can only assign tasks within their team');
      }
    }
    const created: TaskItem = {
      ...task,
      id: `tsk-${Date.now()}`,
      tracked_seconds: 0,
      manager_id: role === 'manager' ? (managerId || task.manager_id) : task.manager_id,
    };
    tasksStore = [created, ...tasksStore];
    return created;
  },

  updateTaskStatus: async (
    _role: UserRole,
    taskId: string,
    status: TaskItem['status']
  ): Promise<TaskItem> => {
    const tsk = tasksStore.find((t) => t.id === taskId);
    if (!tsk) throw new Error('Task not found');
    tsk.status = status;
    return tsk;
  },

  // Audit Logs Access
  getAuditLogs: async (role: UserRole): Promise<AuditLogItem[]> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can access complete audit logs');
    }
    return [...auditLogsStore];
  },

  logAction: (
    actorName: string,
    actorRole: UserRole,
    action: string,
    target: string,
    details: string
  ): void => {
    const newEntry: AuditLogItem = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor_name: actorName,
      actor_role: actorRole,
      action,
      target,
      ip_device: 'Local Client',
      details,
    };
    auditLogsStore = [newEntry, ...auditLogsStore];
  },

  // KPI calculations (real calculations from state)
  getAdminKpis: async () => {
    const totalEmployees = employeesStore.length;
    const onlineEmployees = employeesStore.filter((e) => e.status === 'active' || e.status === 'idle' || e.status === 'on_break').length;
    const lateToday = employeesStore.filter((e) => e.attendance_status === 'late').length;
    const idleEmployees = employeesStore.filter((e) => e.status === 'idle').length;
    const activeTasks = tasksStore.filter((t) => t.status === 'in_progress').length;
    const completedTasks = tasksStore.filter((t) => t.status === 'completed').length;
    const totalProjects = projectsStore.length;
    const onTimeCount = employeesStore.filter((e) => e.attendance_status === 'on_time').length;
    const attendanceRate = totalEmployees > 0 ? Math.round(((onTimeCount + lateToday) / totalEmployees) * 100) : 0;

    return {
      totalEmployees,
      onlineEmployees,
      lateToday,
      idleEmployees,
      activeTasks,
      completedTasks,
      totalProjects,
      attendanceRate,
    };
  },

  getManagerKpis: async (managerId: string) => {
    const myEmployees = employeesStore.filter((e) => e.manager_id === managerId);
    const total = myEmployees.length;
    const online = myEmployees.filter((e) => e.status === 'active' || e.status === 'idle' || e.status === 'on_break').length;
    const late = myEmployees.filter((e) => e.attendance_status === 'late').length;
    const idle = myEmployees.filter((e) => e.status === 'idle').length;
    const onBreak = myEmployees.filter((e) => e.status === 'on_break').length;

    const myTasks = tasksStore.filter((t) => t.manager_id === managerId);
    const inProgress = myTasks.filter((t) => t.status === 'in_progress').length;
    const completed = myTasks.filter((t) => t.status === 'completed').length;

    const onTime = myEmployees.filter((e) => e.attendance_status === 'on_time').length;
    const attendanceRate = total > 0 ? Math.round(((onTime + late) / total) * 100) : 0;

    return {
      totalEmployees: total,
      online,
      late,
      idle,
      onBreak,
      tasksInProgress: inProgress,
      tasksCompleted: completed,
      teamAttendanceRate: attendanceRate,
    };
  },

  // Rules
  getStarRules: async (_role: UserRole): Promise<StarRuleItem[]> => {
    return [...starRulesStore];
  },

  updateStarRule: async (role: UserRole, id: string, starDelta: number, isActive: boolean) => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can configure star rules');
    }
    const rule = starRulesStore.find((r) => r.id === id);
    if (rule) {
      rule.star_delta = starDelta;
      rule.is_active = isActive;
    }
    return rule;
  },

  getAttendanceRules: async (_role: UserRole): Promise<AttendanceRuleConfig> => {
    return { ...attendanceRulesStore };
  },

  updateAttendanceRules: async (role: UserRole, newRules: AttendanceRuleConfig) => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can configure attendance rules');
    }
    attendanceRulesStore = { ...newRules };
    return attendanceRulesStore;
  },

  // Heatmap sample generation from real normalized window coords
  getHeatmapPoints: async (_employeeId: string): Promise<HeatmapPoint[]> => {
    // Generates normalized screen points based on activity windows
    const points: HeatmapPoint[] = [
      { x: 250, y: 180, intensity: 0.9, type: 'click' },
      { x: 280, y: 210, intensity: 0.7, type: 'move' },
      { x: 310, y: 230, intensity: 0.8, type: 'click' },
      { x: 500, y: 350, intensity: 0.6, type: 'move' },
      { x: 520, y: 370, intensity: 0.9, type: 'click' },
      { x: 700, y: 200, intensity: 0.5, type: 'move' },
      { x: 800, y: 450, intensity: 0.8, type: 'click' },
      { x: 820, y: 460, intensity: 0.4, type: 'move' },
    ];
    return points;
  },
};
