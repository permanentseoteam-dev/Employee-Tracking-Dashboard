export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  team_id?: string;
  team_name?: string;
  assigned_manager_id?: string;
}

export interface EmployeeRecord {
  id: string;
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
  joined_at: string;
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

export interface ProjectItem {
  id: string;
  name: string;
  code: string;
  manager_id: string;
  manager_name: string;
  members_count: number;
  status: 'active' | 'completed' | 'on_hold';
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  due_date: string;
  documents?: { title: string; type: 'doc' | 'sheet'; url: string }[];
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
