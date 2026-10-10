export type UserRole = 'admin' | 'manager' | 'project_manager' | 'employee';

/** URL path segment for a role (kebab-case for multi-word roles). */
export function rolePathPrefix(role: UserRole): string {
  return role === 'project_manager' ? 'project-manager' : role;
}

export function roleFromPath(path: string): UserRole {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/project-manager') || path.startsWith('/project_manager')) return 'project_manager';
  if (path.startsWith('/manager')) return 'manager';
  return 'employee';
}

export type ProjectAccessLevel = 'view' | 'edit' | 'admin';

/** What the grant applies to inside a project. */
export type ProjectAccessScope = 'project' | 'folder' | 'item';

export interface ProjectMemberAssignment {
  id: string;
  project_id: string;
  project_name?: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  access: ProjectAccessLevel;
  /** Defaults to `project` for legacy rows. */
  scope: ProjectAccessScope;
  /** Folder or item id when scope is folder/item; null for whole project. */
  resource_id: string | null;
  resource_name?: string;
  /** Breadcrumb e.g. "Docs / Specs / brief.md" for UI. */
  resource_path?: string;
  /** Folder grants include children (default true). */
  include_descendants?: boolean;
  assigned_by?: string;
  assigned_at: string;
  project_manager_id?: string;
}

/** first = given name (default), last = family name, full = entire full_name */
export type DisplayNamePref = 'first' | 'last' | 'full';

export interface UserProfile {
  id: string;
  /** Name shown in UI (honours display_name_pref). */
  name: string;
  /** Legal / full name stored in profiles.full_name */
  full_name?: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  team_id?: string;
  team_name?: string;
  phone?: string;
  assigned_manager_id?: string;
  /** Which part of full_name to show in greetings / chrome. */
  display_name_pref?: DisplayNamePref;
}

export interface EmployeeRecord {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  department: string;
  team_id: string;
  team_name: string;
  manager_id: string;
  manager_name: string;
  status: 'active' | 'idle' | 'offline' | 'on_break';
  attendance_status: 'on_time' | 'late' | 'absent' | 'leave';
  first_activity: string;
  active_seconds: number;
  idle_seconds: number;
  last_screenshot: string;
  current_task: string | null;
  stars: number;
  device_id: string;
  device_name?: string;
  os_version?: string;
  joined_at: string;
  last_activity_at?: string;
  key_press_count?: number;
  mouse_move_count?: number;
  mouse_click_count?: number;
  active_window?: string;
  latest_screenshot_url?: string;
  latest_screenshot_time?: string;
  is_recording?: boolean;
}

export interface ManagerRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  teams: string[];
  assigned_employee_ids: string[];
  active_projects_count: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  department: string;
  manager_id: string;
  manager_name: string;
  member_count: number;
  active_count: number;
  attendance_rate: number;
  project_ids: string[];
}

export interface ScreenshotItem {
  id: string;
  employee_id: string;
  employee_name: string;
  team_name: string;
  captured_at: string;
  file_path: string;
  thumbnail_url: string;
  high_res_url: string;
  file_size_bytes: number;
  activity_type: 'active' | 'idle';
  window_title: string;
}

export interface ScreenRecordingItem {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  device_id: string;
  device_name?: string;
  started_at: string;
  duration_seconds: number;
  video_url: string;
  thumbnail_url: string;
  trigger_type: 'on_demand' | 'scheduled' | 'rule_triggered';
  recorded_by: string;
  active_window: string;
  file_size_bytes: number;
  status: 'completed' | 'processing' | 'recording';
}

export interface AttendanceRecordItem {
  id: string;
  employee_id: string;
  employee_name: string;
  team_name: string;
  manager_name: string;
  date: string;
  scheduled_start: string;
  first_activity_at: string;
  status: 'on_time' | 'late' | 'absent' | 'leave';
  late_minutes: number;
  active_hours: number;
  idle_hours: number;
}

export interface ProjectFolderFile {
  id: string;
  name: string;
  size: number;
  size_formatted: string;
  mime_type: string;
  uploaded_at: string;
  uploaded_by?: string;
  data_url?: string;
  description?: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  color?: string;
  files: ProjectFolderFile[];
}

/** Nested Drive-style project tree node (folders & files). */
export type ProjectTreeItemType =
  | 'folder'
  | 'embed'
  | 'uploaded_file'
  | 'document'
  | 'spreadsheet'
  | 'presentation';

export interface ProjectTreeItem {
  id: string;
  project_id: string;
  parent_id: string | null;
  item_type: ProjectTreeItemType;
  name: string;
  content?: Record<string, unknown> | string | null;
  embed_url?: string | null;
  storage_path?: string | null;
  data_url?: string | null;
  mime_type?: string | null;
  external_provider?: string | null;
  external_file_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  manager_id: string;
  manager_name: string;
  members_count: number;
  status: 'active' | 'completed' | 'on_hold';
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  due_date: string;
  documents?: { title: string; type: 'doc' | 'sheet'; url: string }[];
  folders?: ProjectFolder[];
  scope_type?: 'manager_owned' | 'employee_activity' | 'organization' | 'project_managed';
  assigned_employees?: string[];
  member_assignments?: ProjectMemberAssignment[];
}

export interface TaskItem {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  employee_id: string;
  employee_name: string;
  manager_id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'paused' | 'completed' | 'overdue';
  tracked_seconds: number;
  due_date: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target: string;
  ip_device: string;
  details: string;
}

export interface StarRuleItem {
  id: string;
  name: string;
  condition: string;
  star_delta: number;
  is_active: boolean;
}

export interface AttendanceRuleConfig {
  work_start_time: string;
  work_end_time: string;
  grace_period_minutes: number;
  late_threshold_minutes: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
  type: 'click' | 'move';
}

export interface EmployeeSalaryRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  email: string;
  department: string;
  team_name: string;
  base_salary: number; // e.g. 6200
  currency: string; // e.g. 'USD'
  pay_frequency: 'monthly' | 'bi-weekly' | 'hourly';
  bonus_amount: number;
  deduction_amount: number;
  net_salary: number;
  payment_status: 'paid' | 'pending' | 'processing' | 'scheduled';
  next_pay_date: string;
  bank_account_mask: string;
  last_payment_date: string;
  notes?: string;
}

export interface ConfidentialMessageItem {
  id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_email: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'admin';
  subject: string;
  message_body: string;
  salary_slip_reference?: {
    month: string;
    amount: number;
    currency: string;
    pay_status: string;
  };
  sent_at: string;
  is_read: boolean;
  priority: 'normal' | 'urgent' | 'confidential';
}

export type BreakType = 'coffee' | 'namaz' | 'general';

/** Admin-editable coffee / prayer recess windows (org-wide). */
export interface BreakWindowConfig {
  enabled: boolean;
  label: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}

export interface BreakScheduleConfig {
  coffee: BreakWindowConfig;
  zuhr: BreakWindowConfig;
  asr: BreakWindowConfig;
  updated_at?: string;
}

export const DEFAULT_BREAK_SCHEDULE: BreakScheduleConfig = {
  coffee: {
    enabled: true,
    label: 'Coffee Break',
    start_time: '11:00',
    end_time: '11:30',
  },
  zuhr: {
    enabled: true,
    label: 'Zuhr Namaz & Lunch',
    start_time: '13:00',
    end_time: '14:00',
  },
  asr: {
    enabled: true,
    label: 'Asr Prayer',
    start_time: '16:30',
    end_time: '16:45',
  },
};

export interface BreakTelemetryHourlyState {
  time_slot: string; // e.g. '11:00' or '13:00'
  slot_index: number;
  pre_break_keys: number;
  pre_break_heatmap_pct: number;
  post_break_keys?: number;
  post_break_heatmap_pct?: number;
  adjusted_total_keys?: number;
  adjusted_heatmap_pct?: number;
  hourly_delta_pct?: number;
}

export interface BreakTelemetrySnapshot {
  id: string;
  employee_id: string;
  employee_name: string;
  break_type: BreakType;
  break_title: string;
  started_at: string;
  resumed_at?: string;
  break_duration_seconds?: number;
  current_time_slot: string;
  time_slot_index: number;
  heatmap_data: number[][]; // [row][col] activity intensity %
  keyboard_data: number[][]; // [row][col] keystrokes count
  hourly_state: BreakTelemetryHourlyState;
  storage_path?: string;
  bucket?: string;
  device_id?: string;
  status: 'active_break' | 'resumed';
}

