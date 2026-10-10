import type {
  UserRole,
  EmployeeRecord,
  ManagerRecord,
  TeamRecord,
  ScreenshotItem,
  AttendanceRecordItem,
  ProjectItem,
  ProjectFolder,
  ProjectFolderFile,
  TaskItem,
  AuditLogItem,
  StarRuleItem,
  AttendanceRuleConfig,
  HeatmapPoint,
  EmployeeSalaryRecord,
  ConfidentialMessageItem,
  ScreenRecordingItem,
  BreakTelemetrySnapshot,
  BreakType,
  BreakTelemetryHourlyState,
  BreakScheduleConfig,
  ProjectMemberAssignment,
  ProjectAccessLevel,
  ProjectAccessScope,
  ProjectTreeItem,
  ProjectTreeItemType,
} from '../types/roles';
import { DEFAULT_BREAK_SCHEDULE } from '../types/roles';
import {
  filterVisibleItems,
  grantIdentity,
  normalizeAssignment,
  resolveItemAccess,
  resolveProjectAccess,
  canEdit as accessCanEdit,
  canAdmin as accessCanAdmin,
} from '../utils/projectAccess';
import type { AgentRuntimeConfig } from '../types';
import { DEFAULT_AGENT_RUNTIME_CONFIG } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { supabaseSync } from './supabaseService';
import { generateWorkstationRecordingClip } from '../utils/screenRecordingGenerator';
import { formatCaptureTime, isDummyMediaUrl, parseCaptureDate } from '../utils/datetime';
import { formatDisplayName, normalizeDisplayNamePref } from '../utils/displayName';
import {
  breakTimeSlot,
  formatBreakRange,
  mergeBreakSchedule,
  normalizeBreakTime,
} from '../utils/breakSchedule';


export const ADMIN_USER_ID = '';

const TELEMETRY_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

/** Resolve filter (uuid, email, or display name) to employee id set. Empty set = no one. */
function resolveTelemetryEmployeeIds(
  employees: Array<{ id?: string; user_id?: string; full_name?: string; email?: string; manager_id?: string }>,
  role?: UserRole,
  employeeFilter?: string,
  managerId?: string
): Set<string> {
  let pool = employees;
  if (role === 'manager') {
    pool = pool.filter(
      (e) =>
        !isAdminRecord(e.id, e.full_name, e.email) &&
        !isAdminRecord(e.user_id, e.full_name, e.email)
    );
    if (managerId) {
      pool = pool.filter(
        (e) => e.manager_id === managerId || e.id === managerId || e.user_id === managerId
      );
    }
  } else if (role === 'employee' && managerId) {
    // managerId reused as self id for employee scope when no explicit filter
    pool = pool.filter((e) => e.id === managerId || e.user_id === managerId);
  }

  if (!employeeFilter || employeeFilter === 'all') {
    const ids = new Set<string>();
    for (const e of pool) {
      if (e.id) ids.add(e.id);
      if (e.user_id) ids.add(e.user_id);
    }
    return ids;
  }

  const raw = employeeFilter.trim();
  const needle = raw.toLowerCase();
  const bare = needle.split('(')[0].trim();
  const matched = pool.filter((e) => {
    const id = (e.id || '').toLowerCase();
    const uid = (e.user_id || '').toLowerCase();
    const name = (e.full_name || '').toLowerCase();
    const email = (e.email || '').toLowerCase();
    return (
      id === needle ||
      uid === needle ||
      email === needle ||
      name === bare ||
      name === needle ||
      name.startsWith(bare) ||
      bare.startsWith(name)
    );
  });

  const ids = new Set<string>();
  for (const e of matched) {
    if (e.id) ids.add(e.id);
    if (e.user_id) ids.add(e.user_id);
  }
  return ids;
}

function isSeedBreakKeyboardMatrix(data?: number[][]): boolean {
  if (!data?.length) return false;
  const first = data[0] || [];
  // Known legacy seed row from saveBreakTelemetrySnapshot defaults
  return first.length >= 3 && first[0] === 2057 && first[2] === 3036;
}

export const isAdminRecord = (id?: string, name?: string, email?: string): boolean => {
  if (!id && !name && !email) return false;
  if (id && ADMIN_USER_ID && id === ADMIN_USER_ID) return true;
  if (email && email.toLowerCase().includes('admin')) return true;
  if (name && (name.toLowerCase().includes('admin') || name.toLowerCase().includes('(admin)'))) return true;
  return false;
};

// ============================================================================
// Rule Configurations
// ============================================================================
let starRulesStore: StarRuleItem[] = [
  { id: 'sr-1', name: 'On-Time Daily Check-in', condition: 'First activity before 09:00 AM', star_delta: 1, is_active: true },
  { id: 'sr-2', name: 'Sprint Task Completion', condition: 'All assigned sprint tasks completed', star_delta: 3, is_active: true },
  { id: 'sr-3', name: 'Extended Unexcused Inactivity', condition: 'Idle > 90 minutes during work hours', star_delta: -1, is_active: true },
  { id: 'sr-4', name: 'Late Arrival (>30m)', condition: 'Check-in past 09:30 AM without notice', star_delta: -1, is_active: true },
  { id: 'sr-5', name: 'Exemplary Sprint Performance', condition: 'Manager manual award', star_delta: 5, is_active: true },
];

let attendanceRulesStore: AttendanceRuleConfig = {
  work_start_time: '09:00',
  work_end_time: '17:00',
  grace_period_minutes: 15,
  late_threshold_minutes: 30,
};

let breakScheduleStore: BreakScheduleConfig = mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE);
const BREAK_SCHEDULE_LS_KEY = 'stitch_break_schedule_config';

function loadBreakScheduleFromLocal(): BreakScheduleConfig | null {
  try {
    const raw = localStorage.getItem(BREAK_SCHEDULE_LS_KEY);
    if (!raw) return null;
    return mergeBreakSchedule(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistBreakScheduleLocal(cfg: BreakScheduleConfig) {
  try {
    localStorage.setItem(BREAK_SCHEDULE_LS_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore quota */
  }
}

const PROJECT_ASSIGNMENTS_KEY = 'stitch_project_member_assignments';

function loadAllProjectAssignments(): ProjectMemberAssignment[] {
  try {
    const raw = localStorage.getItem(PROJECT_ASSIGNMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => normalizeAssignment(row));
  } catch {
    return [];
  }
}

function saveAllProjectAssignments(rows: ProjectMemberAssignment[]) {
  try {
    localStorage.setItem(PROJECT_ASSIGNMENTS_KEY, JSON.stringify(rows.map(normalizeAssignment)));
  } catch {
    /* ignore */
  }
}

/** projects.manager_id FK → public.users(id). Upsert missing owners before insert. */
async function ensureProjectManagerUser(params: {
  id: string;
  email?: string;
  fullName?: string;
  role: UserRole;
}): Promise<void> {
  if (!params.id || !isSupabaseConfigured()) return;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (existing?.id) return;

  const email = params.email || `${params.id.slice(0, 8)}@company.internal`;

  // Live DB may still reject project_manager on users_role_check — fall back to manager.
  const attempts: Array<'project_manager' | 'manager' | 'employee' | 'admin'> =
    params.role === 'project_manager'
      ? ['project_manager', 'manager']
      : params.role === 'admin'
        ? ['admin']
        : params.role === 'manager'
          ? ['manager']
          : ['employee'];

  let lastErr: string | null = null;
  const emails = [email, `${params.id}@local.users`];
  for (const dbRole of attempts) {
    for (const tryEmail of emails) {
      const { error } = await supabase.from('users').upsert({
        id: params.id,
        organization_id: '00000000-0000-0000-0000-000000000001',
        email: tryEmail,
        full_name: params.fullName || 'Project Owner',
        role: dbRole,
      });
      if (!error) {
        await supabase.from('profiles').upsert({
          id: params.id,
          email: tryEmail,
          full_name: params.fullName || 'Project Owner',
          role: dbRole,
          department: 'Delivery',
        });
        return;
      }
      lastErr = error.message;
      // try next email on unique conflict; next role on check constraint
      if (error.code === '23505') continue;
      if (error.code === '23514' || error.message.includes('users_role_check')) break;
      throw new Error(error.message);
    }
  }
  throw new Error(
    lastErr ||
      `Cannot create project: manager_id ${params.id} is not in users (FK projects_manager_id_fkey)`
  );
}

const projectItemsLocalKey = (projectId: string) => `stitch_project_items_${projectId}`;

function loadLocalProjectItems(projectId: string): ProjectTreeItem[] {
  try {
    const raw = localStorage.getItem(projectItemsLocalKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalProjectItems(projectId: string, items: ProjectTreeItem[]) {
  try {
    localStorage.setItem(projectItemsLocalKey(projectId), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function mapDbProjectItem(row: any): ProjectTreeItem {
  return {
    id: row.id,
    project_id: row.project_id,
    parent_id: row.parent_id ?? null,
    item_type: row.item_type,
    name: row.name,
    content: row.content ?? null,
    storage_path: row.storage_path ?? null,
    data_url: row.data_url ?? null,
    mime_type: row.mime_type ?? null,
    external_provider: row.external_provider ?? null,
    external_file_id: row.external_file_id ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/** Raw project tree fetch (no employee ACL filter) — avoids circular dataService refs. */
async function fetchProjectItemsRaw(projectId: string): Promise<ProjectTreeItem[]> {
  if (!projectId) return [];
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', projectId)
        .order('item_type', { ascending: true })
        .order('name', { ascending: true });
      if (!error && data) {
        const mapped = data.map(mapDbProjectItem);
        saveLocalProjectItems(projectId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('fetchProjectItemsRaw supabase fallback:', e);
    }
  }
  return loadLocalProjectItems(projectId);
}

let localAuditLogs: AuditLogItem[] = [];
const employeeStarsMap = new Map<string, number>();

/** In-memory cache of recordings created in this session only (no seed/dummy clips). */
let screenRecordingsStore: ScreenRecordingItem[] = [];

let customTeamsStore: TeamRecord[] = [
  {
    id: 'team-backend',
    name: 'Core Backend Team',
    department: 'Engineering',
    manager_id: '',
    manager_name: 'Unassigned',
    member_count: 0,
    active_count: 0,
    attendance_rate: 100,
    project_ids: ['proj-01'],
  },
  {
    id: 'team-frontend',
    name: 'UI & Web Architecture',
    department: 'Frontend',
    manager_id: '',
    manager_name: 'Unassigned',
    member_count: 0,
    active_count: 0,
    attendance_rate: 100,
    project_ids: ['proj-02'],
  },
  {
    id: 'team-mobile',
    name: 'Mobile & Cloud Infrastructure',
    department: 'Mobile',
    manager_id: '',
    manager_name: 'Unassigned',
    member_count: 0,
    active_count: 0,
    attendance_rate: 100,
    project_ids: ['proj-03'],
  },
];

// Global Broadcast Sets for Realtime Subscriptions
const eventListeners = new Set<(payload: any) => void>();
const statusListeners = new Set<(status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void>();
let globalRealtimeChannel: any = null;
let currentChannelStatus: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' = 'CLOSED';

function initGlobalRealtimeChannel() {
  if (globalRealtimeChannel || !isSupabaseConfigured()) return;

  const broadcastEvent = (payload: any) => {
    eventListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Error in realtime event listener:', err);
      }
    });
  };

  globalRealtimeChannel = supabase
    .channel('realtime:live_dashboard_global')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'screenshots' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_presence' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_activity' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, broadcastEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_events' }, broadcastEvent)
    .subscribe((status) => {
      currentChannelStatus = status as any;
      if (status === 'SUBSCRIBED') {
        console.log('📡 [Supabase Realtime] Connected to live schema updates');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`📡 [Supabase Realtime] Channel status: ${status}`);
      }
      statusListeners.forEach((cb) => {
        try {
          cb(currentChannelStatus);
        } catch (err) {
          console.error('Error in realtime status listener:', err);
        }
      });
    });
}

// ============================================================================
// Real-Time Data Service Connected Directly to Supabase
// ============================================================================

export const dataService = {
  // 1. Centralized Real-Time Subscription Listener
  subscribeToRealtime: (
    onEvent: (payload: any) => void,
    onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void
  ) => {
    if (!isSupabaseConfigured()) {
      onStatusChange?.('CLOSED');
      return () => {};
    }

    eventListeners.add(onEvent);
    if (onStatusChange) {
      statusListeners.add(onStatusChange);
      if (currentChannelStatus === 'SUBSCRIBED') {
        onStatusChange(currentChannelStatus);
      }
    }

    initGlobalRealtimeChannel();

    return () => {
      eventListeners.delete(onEvent);
      if (onStatusChange) {
        statusListeners.delete(onStatusChange);
      }
    };
  },

  // 2. Employees Query with Real-time Presence, Live Telemetry & Device Info
  getEmployees: async (role: UserRole, managerId?: string, employeeId?: string): Promise<EmployeeRecord[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      let query = supabase.from('employees').select('*, devices(*)');
      
      if (role === 'manager' && managerId) {
        query = query.eq('manager_id', managerId);
      } else if (role === 'employee' && employeeId) {
        query = query.or(`id.eq.${employeeId},user_id.eq.${employeeId}`);
      }
      // project_manager: organization roster (non-admin) for allocation — no manager_id filter

      const dayStartIso = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      })();

      const [
        empRes,
        presRes,
        devRes,
        aggRes,
        eventRes,
        scRes,
        legacyScRes,
        taskRes,
        mgrRes,
        starBalRes,
      ] = await Promise.all([
        query,
        supabase.from('employee_presence').select('*').order('updated_at', { ascending: false }),
        supabase.from('devices').select('*').order('last_seen_at', { ascending: false }),
        supabase
          .from('activity_aggregates')
          .select('*')
          .gte('window_start', dayStartIso)
          .order('window_end', { ascending: false }),
        supabase.from('activity_events').select('*').order('occurred_at', { ascending: false }).limit(100),
        supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(50),
        supabase.from('screenshots').select('*').order('captured_at', { ascending: false }).limit(50),
        supabase.from('tasks').select('*').eq('status', 'in_progress'),
        supabase.from('users').select('id, full_name, email, display_name_pref').eq('role', 'manager'),
        supabase.from('employee_star_balances').select('employee_id, stars'),
      ]);

      let filteredEmpRows = empRes.data || [];

      // When role === 'manager' or project_manager, strictly filter out admin records
      if (role === 'manager' || role === 'project_manager') {
        filteredEmpRows = filteredEmpRows.filter((e: any) =>
          !isAdminRecord(e.id, e.full_name, e.email) &&
          !isAdminRecord(e.user_id, e.full_name, e.email) &&
          e.role !== 'admin' &&
          (role === 'manager' && managerId ? e.id !== managerId && e.user_id !== managerId : true)
        );
      }
      const empRows = filteredEmpRows;
      const starBalanceRows = starBalRes.data || [];
      for (const row of starBalanceRows) {
        if (row?.employee_id != null) {
          employeeStarsMap.set(String(row.employee_id), Number(row.stars) || 0);
        }
      }
      if (empRows.length === 0) return [];

      const presenceRows = presRes.data || [];
      const deviceRows = devRes.data || [];
      const aggregateRows = aggRes.data || [];
      const eventRows = eventRes.data || [];
      const screenshotRows = [...(scRes.data || []), ...(legacyScRes.data || [])].sort(
        (a: any, b: any) => new Date(b.captured_at || b.created_at || 0).getTime() - new Date(a.captured_at || a.created_at || 0).getTime()
      );
      const taskRows = taskRes.data || [];
      const mgrRows = mgrRes.data || [];

      const mappedEmployees: EmployeeRecord[] = empRows.map((e: any) => {
        const isMatchingEmp = (candId?: string) =>
          !!candId && (candId === e.id || candId === e.user_id);

        // 1. Presence & Activity (prioritize active presence if one is active)
        const empPresences = presenceRows.filter((p: any) => isMatchingEmp(p.employee_id));
        const activePres = empPresences.find((p: any) => p.status === 'active');
        const presence = activePres || empPresences[0];
        const activeTask = taskRows.find((t: any) => t.assigned_to === e.id);
        const mgr = mgrRows.find((m: any) => m.id === e.manager_id);

        // 2. Primary Connected Device
        const empDevices = deviceRows.filter((d: any) => isMatchingEmp(d.employee_id));
        const primaryDevice = empDevices[0] || (e.devices && e.devices[0]);
        const deviceIdentifier = primaryDevice?.device_identifier || primaryDevice?.device_name || '—';
        const deviceName = primaryDevice?.device_name || '—';
        const osVersion = primaryDevice?.os_version || '—';

        // 3. Today's Aggregate Telemetry only (never lifetime totals — those look like fake static readings)
        const dayStartMs = new Date();
        dayStartMs.setHours(0, 0, 0, 0);
        const dayStartTs = dayStartMs.getTime();
        const empAggregates = aggregateRows.filter((a: any) => {
          if (!isMatchingEmp(a.employee_id)) return false;
          const t = new Date(a.window_start || a.window_end || 0).getTime();
          return Number.isFinite(t) && t >= dayStartTs;
        });
        const totalActiveSecs = empAggregates.reduce((acc: number, a: any) => acc + (Number(a.active_seconds) || 0), 0);
        const totalIdleSecs = empAggregates.reduce((acc: number, a: any) => acc + (Number(a.idle_seconds) || 0), 0);
        const totalKeys = empAggregates.reduce((acc: number, a: any) => acc + (Number(a.key_press_count) || 0), 0);
        const totalMoves = empAggregates.reduce((acc: number, a: any) => acc + (Number(a.mouse_move_count) || 0), 0);
        const totalClicks = empAggregates.reduce((acc: number, a: any) => acc + (Number(a.mouse_click_count) || 0), 0);

        // 4. Latest Event (Real Active Window Title)
        const empEvents = eventRows.filter((ev: any) => isMatchingEmp(ev.employee_id));
        const latestEvent = empEvents[0];
        const activeWindow =
          latestEvent?.metadata?.window ||
          latestEvent?.metadata?.window_title ||
          activeTask?.title ||
          '';

        // 5. Latest Screenshot
        const empScreenshots = screenshotRows.filter((s: any) => isMatchingEmp(s.employee_id));
        const latestSc = empScreenshots[0];

        let latestScUrl = '';
        let lastScStr = 'No captures';

        if (latestSc?.storage_path) {
          const { data: pubUrl } = supabase.storage.from('screenshots').getPublicUrl(latestSc.storage_path);
          latestScUrl = pubUrl?.publicUrl || '';
          if (latestSc.captured_at) {
            lastScStr = formatCaptureTime(latestSc.captured_at);
          }
        }

        // 6. Presence Status — expire stale "active" rows (>5 min without activity)
        let status: 'active' | 'idle' | 'offline' | 'on_break' = 'offline';
        let firstActivity = '—';
        const STALE_MS = 5 * 60 * 1000;
        const lastActMs = presence?.last_activity_at
          ? new Date(presence.last_activity_at).getTime()
          : latestEvent?.occurred_at
            ? new Date(latestEvent.occurred_at).getTime()
            : primaryDevice?.last_seen_at
              ? new Date(primaryDevice.last_seen_at).getTime()
              : 0;
        const isFresh = lastActMs > 0 && Date.now() - lastActMs < STALE_MS;

        if (presence) {
          status = (presence.status as any) || 'offline';
          if ((status === 'active' || status === 'idle' || status === 'on_break') && !isFresh) {
            status = 'offline';
          }
          if (presence.last_activity_at) {
            const d = new Date(presence.last_activity_at);
            firstActivity = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } else if (isFresh && (latestEvent || totalActiveSecs > 0)) {
          status = 'active';
        }

        return {
          id: e.id,
          name: formatDisplayName(
            e.full_name || e.email,
            normalizeDisplayNamePref(e.display_name_pref),
            'Employee'
          ),
          email: e.email || '',
          department: e.department || 'Unassigned',
          team_id: e.team_id || '',
          team_name: e.department ? `${e.department} Team` : 'Unassigned',
          manager_id: e.manager_id || '',
          manager_name: formatDisplayName(
            mgr?.full_name,
            normalizeDisplayNamePref(mgr?.display_name_pref),
            'Unassigned'
          ),
          status,
          attendance_status: status === 'offline' ? 'absent' : 'on_time',
          first_activity: firstActivity,
          active_seconds: totalActiveSecs,
          idle_seconds: totalIdleSecs,
          key_press_count: totalKeys,
          mouse_move_count: totalMoves,
          mouse_click_count: totalClicks,
          active_window: activeWindow || '—',
          last_screenshot: lastScStr,
          latest_screenshot_url: latestScUrl,
          latest_screenshot_time: latestSc?.captured_at || undefined,
          current_task: activeTask?.title || (latestEvent ? activeWindow : '—'),
          stars: employeeStarsMap.get(e.id) ?? employeeStarsMap.get(e.user_id) ?? 0,
          device_id: deviceIdentifier,
          device_name: deviceName,
          os_version: osVersion,
          last_activity_at:
            presence?.last_activity_at ||
            latestEvent?.occurred_at ||
            primaryDevice?.last_seen_at ||
            undefined,
          joined_at: e.created_at ? e.created_at.split('T')[0] : '',
        };
      });

      if (role === 'manager') {
        return mappedEmployees.filter((r) => !isAdminRecord(r.id, r.name, r.email));
      }
      return mappedEmployees;
    } catch (err) {
      console.error('getEmployees Supabase Error:', err);
      return [];
    }
  },

  // 2b. Add Employee Mutation
  addEmployee: async (
    role: UserRole,
    employeeData: {
      name: string;
      email: string;
      department: string;
      manager_id: string;
      manager_name?: string;
      team_id?: string;
      team_name?: string;
    }
  ): Promise<EmployeeRecord> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can add new employees');
    }

    // 1. Create or ensure user profile
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .insert([
        {
          email: employeeData.email,
          full_name: employeeData.name,
          role: 'employee',
          organization_id: '00000000-0000-0000-0000-000000000001',
        },
      ])
      .select()
      .single();

    if (userErr && !userErr.message.includes('unique')) {
      console.warn('Could not insert user record:', userErr);
    }

    const userId = userData?.id || crypto.randomUUID();

    // 2. Insert employee
    let registeredEmpId = userId;
    let registeredName = employeeData.name;
    let registeredEmail = employeeData.email;
    let registeredDept = employeeData.department;

    try {
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .insert([
          {
            id: userId,
            user_id: userId,
            organization_id: '00000000-0000-0000-0000-000000000001',
            manager_id: employeeData.manager_id,
            full_name: employeeData.name,
            email: employeeData.email,
            department: employeeData.department,
            status: 'offline',
          },
        ])
        .select()
        .single();

      if (empErr) {
        console.warn('Could not insert employee into Supabase employees table (apply supabase/fix_rls_and_storage.sql):', empErr.message);
      } else if (empData) {
        registeredEmpId = empData.id;
        registeredName = empData.full_name;
        registeredEmail = empData.email;
        registeredDept = empData.department;
      }
    } catch (e: any) {
      console.warn('Exception inserting employee:', e?.message || e);
    }

    // 3. Register device placeholder
    const devIdentifier = `WIN-${employeeData.name.toUpperCase().replace(/\s+/g, '-')}-01`;
    try {
      await supabase.from('devices').insert([
        {
          employee_id: registeredEmpId,
          device_name: `${employeeData.name}'s Workstation`,
          device_identifier: devIdentifier,
          os_version: 'Windows 10/11 x86_64',
          agent_version: '0.1.0',
        },
      ]);
    } catch {
      // ignore
    }

    return {
      id: registeredEmpId,
      name: registeredName,
      email: registeredEmail,
      department: registeredDept,
      team_id: employeeData.team_id || 'team-backend',
      team_name: employeeData.team_name || `${employeeData.department} Team`,
      manager_id: employeeData.manager_id,
      manager_name: employeeData.manager_name || 'Manager',
      status: 'offline',
      attendance_status: 'absent',
      first_activity: '--:--',
      active_seconds: 0,
      idle_seconds: 0,
      last_screenshot: 'No captures',
      current_task: null,
      stars: 10,
      device_id: devIdentifier,
      joined_at: new Date().toISOString().split('T')[0],
    };
  },

  // 3. Managers Query
  getManagers: async (role: UserRole): Promise<ManagerRecord[]> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can access manager list');
    }
    if (!isSupabaseConfigured()) return [];

    try {
      const { data: mgrRows } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'manager');

      const { data: empRows } = await supabase.from('employees').select('id, manager_id');
      const { data: projRows } = await supabase.from('projects').select('id, manager_id');

      if (!mgrRows) return [];

      return mgrRows.map((m: any) => {
        const assignedEmps = empRows?.filter((e: any) => e.manager_id === m.id).map((e: any) => e.id) || [];
        const activeProjs = projRows?.filter((p: any) => p.manager_id === m.id).length || 0;

        return {
          id: m.id,
          name: formatDisplayName(
            m.full_name,
            normalizeDisplayNamePref(m.display_name_pref),
            'Manager'
          ),
          email: m.email,
          department: 'Engineering',
          teams: ['Core Backend Team'],
          assigned_employee_ids: assignedEmps,
          active_projects_count: activeProjs,
        };
      });
    } catch (err) {
      console.error('getManagers error:', err);
      return [];
    }
  },

  // 4. Teams Query & Add Team Mutation
  getTeams: async (role: UserRole, managerId?: string): Promise<TeamRecord[]> => {
    try {
      let emps: any[] = [];
      let presence: any[] = [];
      let projs: any[] = [];

      if (isSupabaseConfigured()) {
        const [empRes, presRes, projRes] = await Promise.all([
          supabase.from('employees').select('*'),
          supabase.from('employee_presence').select('*'),
          supabase.from('projects').select('id, manager_id'),
        ]);
        emps = empRes.data || [];
        presence = presRes.data || [];
        projs = projRes.data || [];
      }

      const totalCount = emps.length;
      const activeCount = presence.filter((p: any) => p.status === 'active').length;
      const projIds = projs.map((p: any) => p.id);

      // Merge dynamic metrics into teams
      const updatedTeams = customTeamsStore.map((team, idx) => {
        const teamMemberCount = idx === 0 ? totalCount : (totalCount > 0 ? Math.floor(totalCount / 2) : 0);
        const teamActiveCount = idx === 0 ? activeCount : Math.min(teamMemberCount, activeCount);
        return {
          ...team,
          member_count: teamMemberCount,
          active_count: teamActiveCount,
          attendance_rate: teamMemberCount > 0 ? Math.round((teamActiveCount / teamMemberCount) * 100) : 0,
          project_ids: projIds,
        };
      });

      if (role === 'admin') return updatedTeams;
      if (role === 'manager' && managerId) {
        return updatedTeams.filter((t) => t.manager_id === managerId);
      }
      if (role === 'manager') return [];
      return updatedTeams;
    } catch (err) {
      console.error('getTeams error:', err);
      return customTeamsStore;
    }
  },

  addTeam: async (
    role: UserRole,
    teamData: {
      name: string;
      department: string;
      manager_id: string;
      manager_name?: string;
    }
  ): Promise<TeamRecord> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Only Admin and Manager can create new teams');
    }

    const teamId = `team-${Date.now()}`;
    const newTeam: TeamRecord = {
      id: teamId,
      name: teamData.name,
      department: teamData.department,
      manager_id: teamData.manager_id,
      manager_name: teamData.manager_name || 'Manager',
      member_count: 1,
      active_count: 1,
      attendance_rate: 100,
      project_ids: [],
    };

    customTeamsStore = [newTeam, ...customTeamsStore];

    try {
      if (isSupabaseConfigured()) {
        await supabase.from('teams').insert([{
          id: teamId,
          name: teamData.name,
          department: teamData.department,
          manager_id: teamData.manager_id,
        }]);
      }
    } catch {
      // Graceful fallback if table does not exist
    }

    return newTeam;
  },

  updateTeam: async (
    role: UserRole,
    teamId: string,
    updates: Partial<TeamRecord>
  ): Promise<TeamRecord> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Only Admin and Manager can update teams');
    }
    const idx = customTeamsStore.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error('Team not found');

    const updated: TeamRecord = {
      ...customTeamsStore[idx],
      ...updates,
    };
    customTeamsStore[idx] = updated;

    try {
      if (isSupabaseConfigured()) {
        await supabase
          .from('teams')
          .update({
            name: updated.name,
            department: updated.department,
            manager_id: updated.manager_id,
          })
          .eq('id', teamId);
      }
    } catch (e) {
      console.warn('Could not sync team update to Supabase:', e);
    }

    dataService.logAction(
      'Super Admin',
      role,
      'UPDATE_TEAM',
      updated.name,
      `Updated team configuration: ${updated.name} (${updated.department})`
    );

    return updated;
  },

  deleteTeam: async (role: UserRole, teamId: string): Promise<void> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Only Admin and Manager can delete teams');
    }
    const target = customTeamsStore.find((t) => t.id === teamId);
    customTeamsStore = customTeamsStore.filter((t) => t.id !== teamId);

    try {
      if (isSupabaseConfigured()) {
        await supabase.from('teams').delete().eq('id', teamId);
      }
    } catch (e) {
      console.warn('Could not sync team deletion to Supabase:', e);
    }

    if (target) {
      dataService.logAction(
        'Super Admin',
        role,
        'DELETE_TEAM',
        target.name,
        `Deleted operational team: ${target.name}`
      );
    }
  },

  // 5. Screenshots Query with Live Supabase Storage URLs
  getScreenshots: async (
    role: UserRole,
    managerId?: string,
    filterEmployeeId?: string
  ): Promise<ScreenshotItem[]> => {
    if (!isSupabaseConfigured()) return [];

    try {
      const [recordsRes, legacyRes, empRes] = await Promise.all([
        supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(60),
        supabase.from('screenshots').select('*').order('captured_at', { ascending: false }).limit(60),
        supabase.from('employees').select('id, full_name, manager_id, department'),
      ]);

      const scRows = [...(recordsRes.data || []), ...(legacyRes.data || [])];
      if (scRows.length === 0) return [];

      const empList = empRes.data || [];
      const seenPaths = new Set<string>();
      const results: ScreenshotItem[] = [];

      for (const s of scRows) {
        if (!s.storage_path || seenPaths.has(s.storage_path)) continue;
        seenPaths.add(s.storage_path);

        const emp = empList.find((e: any) => e.id === s.employee_id);
        const empName = emp?.full_name || 'Unknown employee';

        if (filterEmployeeId && filterEmployeeId !== 'all' && s.employee_id !== filterEmployeeId) {
          continue;
        }

        // Manager permission enforcement: strictly block any admin activity or screenshots
        if (role === 'manager') {
          if (
            s.employee_id === ADMIN_USER_ID ||
            isAdminRecord(s.employee_id, empName) ||
            (s.storage_path && s.storage_path.toLowerCase().includes('admin')) ||
            (s.window_title && s.window_title.toLowerCase().includes('admin'))
          ) {
            continue;
          }
          if (managerId && emp?.manager_id && emp.manager_id !== managerId) {
            continue;
          }
        }

        // Employee permission enforcement: only see own screenshots
        if (role === 'employee' && filterEmployeeId && s.employee_id !== filterEmployeeId) {
          continue;
        }

        const { data: pubUrl } = supabase.storage.from('screenshots').getPublicUrl(s.storage_path);
        const capturedRaw = s.captured_at || s.created_at || null;
        const capturedDate = parseCaptureDate(capturedRaw);
        const capturedIso = capturedDate ? capturedDate.toISOString() : (capturedRaw || new Date().toISOString());

        results.push({
          id: s.id,
          employee_id: s.employee_id,
          employee_name: empName,
          team_name: emp?.department ? `${emp.department} Team` : '—',
          captured_at: capturedIso,
          file_path: s.storage_path,
          thumbnail_url: pubUrl?.publicUrl || '',
          high_res_url: pubUrl?.publicUrl || '',
          file_size_bytes: Number(s.file_size_bytes) || 0,
          activity_type: 'active',
          window_title: s.window_title || `Workstation capture (${s.width || '?'}x${s.height || '?'})`,
        });
      }

      return results.sort((a, b) => {
        const tb = parseCaptureDate(b.captured_at)?.getTime() || 0;
        const ta = parseCaptureDate(a.captured_at)?.getTime() || 0;
        return tb - ta;
      });
    } catch (err) {
      console.error('getScreenshots Supabase error:', err);
      return [];
    }
  },

  deleteScreenshot: async (screenshot: ScreenshotItem): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase is not configured.' };
    }
    try {
      const path = screenshot.file_path;
      if (path) {
        const { error: storageErr } = await supabase.storage.from('screenshots').remove([path]);
        if (storageErr) {
          console.warn('Storage delete warning:', storageErr.message);
        }
      }

      if (screenshot.id) {
        await supabase.from('screenshot_records').delete().eq('id', screenshot.id);
        await supabase.from('screenshots').delete().eq('id', screenshot.id);
      }
      if (path) {
        await supabase.from('screenshot_records').delete().eq('storage_path', path);
        await supabase.from('screenshots').delete().eq('storage_path', path);
      }

      return { success: true, message: 'Screenshot deleted.' };
    } catch (err: any) {
      console.error('deleteScreenshot failed:', err);
      return { success: false, message: err?.message || 'Failed to delete screenshot.' };
    }
  },

  deleteAllScreenshots: async (
    role: UserRole,
    managerId?: string,
    filterEmployeeId?: string,
    /** Prefer the visible gallery list so UI and DB stay in sync */
    itemsOverride?: ScreenshotItem[]
  ): Promise<{ success: boolean; deleted: number; message: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, deleted: 0, message: 'Supabase is not configured.' };
    }

    const items =
      itemsOverride && itemsOverride.length > 0
        ? itemsOverride
        : await dataService.getScreenshots(role, managerId, filterEmployeeId);

    if (items.length === 0) {
      return { success: true, deleted: 0, message: 'No screenshots to delete.' };
    }

    const ids = [...new Set(items.map((s) => s.id).filter(Boolean))];
    const paths = [...new Set(items.map((s) => s.file_path).filter(Boolean) as string[])];

    // Storage API accepts limited batches
    for (let i = 0; i < paths.length; i += 50) {
      const chunk = paths.slice(i, i + 50);
      const { error: storageErr } = await supabase.storage.from('screenshots').remove(chunk);
      if (storageErr) console.warn('Bulk storage delete warning:', storageErr.message);
    }

    // Batch row deletes (both table names used historically)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('screenshot_records').delete().in('id', chunk),
        supabase.from('screenshots').delete().in('id', chunk),
      ]);
      if (e1) console.warn('screenshot_records bulk delete:', e1.message);
      if (e2) console.warn('screenshots bulk delete:', e2.message);
    }

    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      await Promise.all([
        supabase.from('screenshot_records').delete().in('storage_path', chunk),
        supabase.from('screenshots').delete().in('storage_path', chunk),
      ]);
    }

    const deleted = items.length;
    return {
      success: true,
      deleted,
      message: `Deleted ${deleted} screenshot${deleted === 1 ? '' : 's'}.`,
    };
  },

  // 5b. Screen Recordings Query (Stores and fetches all recorded sessions from Supabase & memory)
  getScreenRecordings: async (
    role: UserRole,
    managerId?: string,
    employeeId?: string
  ): Promise<ScreenRecordingItem[]> => {
    let list: ScreenRecordingItem[] = [...screenRecordingsStore];

    if (isSupabaseConfigured()) {
      try {
        // 1. Check dedicated public.screen_recordings table
        const { data: recData, error: recErr } = await supabase
          .from('screen_recordings')
          .select('*')
          .order('started_at', { ascending: false });

        if (!recErr && recData && recData.length > 0) {
          const mappedFromTable: ScreenRecordingItem[] = recData.map((r: any) => {
            let resolvedVideoUrl = r.video_url;
            let resolvedThumbUrl = r.thumbnail_url;

            // Resolve dynamic live Supabase public URLs if storage path exists
            if (r.storage_path) {
              const bucket = r.metadata?.bucket || (r.storage_path.includes('recordings/') ? 'screenshots' : 'recordings');
              const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(r.storage_path);
              if (pubData?.publicUrl) resolvedVideoUrl = pubData.publicUrl;
            }
            if (r.metadata?.thumbnail_storage_path) {
              const bucket = r.metadata?.bucket || (r.metadata.thumbnail_storage_path.includes('thumbnails/') ? 'screenshots' : 'recordings');
              const { data: thumbData } = supabase.storage.from(bucket).getPublicUrl(r.metadata.thumbnail_storage_path);
              if (thumbData?.publicUrl) resolvedThumbUrl = thumbData.publicUrl;
            }

            return {
              id: r.id,
              employee_id: r.employee_id,
              employee_name: r.metadata?.employee_name || 'Unknown employee',
              department: r.metadata?.department || '—',
              device_id: r.device_id,
              device_name: r.metadata?.device_name || r.device_id,
              started_at: r.started_at,
              duration_seconds: r.duration_seconds || 0,
              video_url: resolvedVideoUrl || '',
              thumbnail_url: resolvedThumbUrl || '',
              trigger_type: r.trigger_type || 'on_demand',
              recorded_by: r.recorded_by || '—',
              active_window: r.active_window || '—',
              file_size_bytes: Number(r.file_size_bytes) || 0,
              status: r.status || 'completed',
            };
          }).filter((r) => !isDummyMediaUrl(r.video_url) && !!r.video_url);
          list = [...mappedFromTable, ...list];
        }

        // 2. Query activity_events where event_type is screen_recording or on_demand_screen_recording
        const { data: evData } = await supabase
          .from('activity_events')
          .select('*')
          .in('event_type', ['screen_recording', 'on_demand_screen_recording'])
          .order('occurred_at', { ascending: false });

        if (evData && evData.length > 0) {
          const mappedFromEvents: ScreenRecordingItem[] = evData.map((e: any) => {
            const meta = e.metadata || {};
            const empName = meta.employee_name || 'Unknown employee';

            let resolvedVideoUrl = meta.video_url;
            let resolvedThumbUrl = meta.thumbnail_url;

            if (meta.storage_path) {
              const bucket = meta.bucket || (meta.storage_path.includes('recordings/') ? 'screenshots' : 'recordings');
              const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(meta.storage_path);
              if (pubData?.publicUrl) resolvedVideoUrl = pubData.publicUrl;
            }

            return {
              id: meta.session_id || e.id,
              employee_id: e.employee_id,
              employee_name: empName,
              department: meta.department || '—',
              device_id: e.device_id || '—',
              device_name: meta.device_name || e.device_id || '—',
              started_at: e.occurred_at || e.created_at,
              duration_seconds: meta.duration_seconds || 0,
              video_url: resolvedVideoUrl || '',
              thumbnail_url: resolvedThumbUrl || '',
              trigger_type: meta.trigger_type || 'on_demand',
              recorded_by: meta.requested_by || meta.recorded_by || '—',
              active_window: meta.active_window || '—',
              file_size_bytes: Number(meta.file_size_bytes) || 0,
              status: meta.status === 'initiated' ? 'completed' : (meta.status || 'completed'),
            };
          }).filter((r) => !isDummyMediaUrl(r.video_url) && !!r.video_url);

          // Deduplicate by ID
          const existingIds = new Set(list.map((r) => r.id));
          for (const evRec of mappedFromEvents) {
            if (!existingIds.has(evRec.id)) {
              list.push(evRec);
              existingIds.add(evRec.id);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching screen recordings from Supabase:', err);
      }
    }

    // Role filtering: strictly block any admin screen recordings for manager
    if (role === 'manager') {
      list = list.filter((r) =>
        r.employee_id !== ADMIN_USER_ID &&
        !isAdminRecord(r.employee_id, r.employee_name) &&
        !(r.employee_name || '').toLowerCase().includes('admin') &&
        (managerId ? r.employee_id !== managerId : true)
      );
    }
    if (employeeId && employeeId !== 'all') {
      list = list.filter((r) => r.employee_id === employeeId);
    }

    // Never surface sample/dummy clips
    list = list.filter((r) => !!r.video_url && !isDummyMediaUrl(r.video_url));

    return list.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  },

  // 5c. On-Demand Live Screen Recording Trigger & Supabase Storage Bucket Persistence
  triggerOnDemandScreenRecording: async (
    role: UserRole,
    employeeId: string,
    requestedBy: string,
    employeeName?: string,
    activeWindow?: string
  ): Promise<{ success: boolean; message: string; recordId: string; recording: ScreenRecordingItem }> => {
    const recordId = `rec-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const resolvedName = employeeName || 'Unknown employee';
    const resolvedWindow = activeWindow || 'Workstation';

    // 1. Generate live workstation video clip and thumbnail
    let videoBlob: Blob | null = null;
    let thumbnailBlob: Blob | null = null;
    try {
      const generated = await generateWorkstationRecordingClip(resolvedName, employeeId, resolvedWindow, 10);
      videoBlob = generated.videoBlob;
      thumbnailBlob = generated.thumbnailBlob;
    } catch (err) {
      console.warn('Could not generate canvas recording clip:', err);
    }

    let videoUrl = '';
    let thumbnailUrl = '';
    let fileSizeBytes = 0;

    // 2. Upload video and thumbnail to Supabase Storage inside bucket under employee folder
    if (videoBlob && isSupabaseConfigured()) {
      try {
        const uploadRes = await supabaseSync.uploadScreenRecording({
          videoBlob,
          thumbnailBlob: thumbnailBlob || undefined,
          employeeId,
          deviceId: 'WIN-DESKTOP-QUVQI4B-ok',
          startedAt,
          durationSeconds: 10,
          recordedBy: requestedBy,
          activeWindow: resolvedWindow,
          employeeName: resolvedName,
          department: 'Engineering',
        });

        if (uploadRes) {
          videoUrl = uploadRes.videoUrl;
          if (uploadRes.thumbnailUrl) thumbnailUrl = uploadRes.thumbnailUrl;
          fileSizeBytes = uploadRes.fileSizeBytes;
        }
      } catch (uploadErr) {
        console.warn('Supabase screen recording storage upload failed:', uploadErr);
      }
    }

    if (!videoUrl || isDummyMediaUrl(videoUrl)) {
      return {
        success: false,
        message: 'Recording failed: no real video was uploaded to storage.',
        recordId,
        recording: null as unknown as ScreenRecordingItem,
      };
    }

    const newRecording: ScreenRecordingItem = {
      id: recordId,
      employee_id: employeeId,
      employee_name: resolvedName,
      department: 'Engineering',
      device_id: 'WIN-DESKTOP-QUVQI4B-ok',
      device_name: 'DESKTOP-QUVQI4B',
      started_at: startedAt,
      duration_seconds: 10,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      trigger_type: 'on_demand',
      recorded_by: requestedBy,
      active_window: resolvedWindow,
      file_size_bytes: fileSizeBytes,
      status: 'completed',
    };

    // Store in local memory store
    screenRecordingsStore.unshift(newRecording);

    dataService.logAction(
      requestedBy,
      role,
      'TRIGGER_SCREEN_RECORDING',
      resolvedName,
      `Captured on-demand 10-second screen recording session for ${resolvedName} (${resolvedWindow}) - Archived in Supabase Storage`
    );

    return {
      success: true,
      message: 'On-demand screen recording recorded and archived to Supabase Storage successfully.',
      recordId,
      recording: newRecording,
    };
  },

  // 5d. Client-side Screenshot Capture & Supabase Storage Bucket Archiving
  captureAndUploadScreenshot: async (
    employeeId: string,
    deviceId: string = 'WIN-CLIENT',
    imageBlob?: Blob,
    activeWindow: string = 'Visual Studio Code'
  ): Promise<{ success: boolean; storagePath?: string; publicUrl?: string; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      let blobToUpload = imageBlob;
      let width = 1920;
      let height = 1080;

      // If no blob provided, generate snapshot from canvas
      if (!blobToUpload) {
        const generated = await generateWorkstationRecordingClip(
          'Employee',
          employeeId,
          activeWindow,
          1
        );
        blobToUpload = generated.thumbnailBlob;
        width = generated.width;
        height = generated.height;
      }

      const uploadResult = await supabaseSync.uploadScreenshot(
        blobToUpload,
        employeeId,
        deviceId,
        new Date().toISOString(),
        width,
        height
      );

      return {
        success: true,
        storagePath: uploadResult?.storage_path,
        publicUrl: uploadResult?.publicUrl,
      };
    } catch (err: any) {
      console.error('Failed to capture and upload screenshot to Supabase Storage:', err);
      return { success: false, error: err.message || 'Upload failed' };
    }
  },

  // 5e. Real-time Keystrokes Telemetry Stream from Supabase activity_aggregates
  getLiveKeystrokeTelemetry: async (
    role?: UserRole,
    employeeFilter?: string,
    scopeUserId?: string
  ): Promise<{
    byHour: Record<string, number>;
    totalKeys: number;
    hourlyKeysArray: number[];
    /** Hourly key arrays keyed by employee full_name (and bare name). */
    byEmployeeName: Record<string, number[]>;
  }> => {
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const empty = {
      byHour: Object.fromEntries(timeSlots.map((s) => [s, 0])) as Record<string, number>,
      totalKeys: 0,
      hourlyKeysArray: timeSlots.map(() => 0),
      byEmployeeName: {} as Record<string, number[]>,
    };
    if (!isSupabaseConfigured()) return empty;

    try {
      let empQuery = supabase.from('employees').select('id, user_id, full_name, email, manager_id');
      if (role === 'manager' && scopeUserId) {
        empQuery = empQuery.eq('manager_id', scopeUserId);
      } else if (role === 'employee' && scopeUserId) {
        empQuery = empQuery.or(`id.eq.${scopeUserId},user_id.eq.${scopeUserId}`);
      }
      const { data: empRows } = await empQuery;

      const employees = empRows || [];
      const idToName = new Map<string, string>();
      for (const e of employees) {
        const name = e.full_name || e.email || e.id;
        if (e.id) idToName.set(e.id, name);
        if (e.user_id) idToName.set(e.user_id, name);
      }

      const allowedIds = resolveTelemetryEmployeeIds(employees, role, employeeFilter, scopeUserId);
      if (allowedIds.size === 0) return empty;

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      let query = supabase
        .from('activity_aggregates')
        .select('window_start, key_press_count, employee_id')
        .gte('window_start', dayStart.toISOString())
        .order('window_start', { ascending: true });

      const { data: aggs, error } = await query;
      if (error) throw error;

      const byHour: Record<string, number> = {};
      for (const slot of timeSlots) byHour[slot] = 0;

      const perEmpHour: Record<string, Record<string, number>> = {};
      let totalKeys = 0;

      for (const a of aggs || []) {
        const empId = a.employee_id as string;
        if (!empId) continue;
        if (role === 'manager' && (empId === ADMIN_USER_ID || isAdminRecord(empId))) continue;
        if (!allowedIds.has(empId)) continue;

        const keys = Number(a.key_press_count) || 0;
        if (!keys || !a.window_start) continue;

        // Always count toward today's real total (even outside chart slots)
        totalKeys += keys;

        const date = new Date(a.window_start);
        const hour = date.getHours();
        const slotStr = timeSlots.includes(`${hour.toString().padStart(2, '0')}:00`)
          ? `${hour.toString().padStart(2, '0')}:00`
          : timeSlots.find((s) => Number(s.split(':')[0]) === hour);
        if (!slotStr) continue;

        byHour[slotStr] = (byHour[slotStr] || 0) + keys;

        const displayName = idToName.get(empId) || empId;
        if (!perEmpHour[displayName]) {
          perEmpHour[displayName] = Object.fromEntries(timeSlots.map((s) => [s, 0]));
        }
        perEmpHour[displayName][slotStr] = (perEmpHour[displayName][slotStr] || 0) + keys;
      }

      const byEmployeeName: Record<string, number[]> = {};
      for (const [name, hours] of Object.entries(perEmpHour)) {
        const row = timeSlots.map((s) => hours[s] || 0);
        byEmployeeName[name] = row;
        byEmployeeName[name.split('(')[0].trim()] = row;
      }

      return {
        byHour,
        totalKeys,
        hourlyKeysArray: timeSlots.map((s) => byHour[s] || 0),
        byEmployeeName,
      };
    } catch (e) {
      console.warn('Failed to fetch live keystroke telemetry:', e);
      return empty;
    }
  },

  // 5f. Real-time Mouse Telemetry Stream from Supabase activity_aggregates
  getLiveMouseTelemetry: async (
    role?: UserRole,
    employeeFilter?: string,
    scopeUserId?: string
  ): Promise<{
    byHour: Record<string, { moves: number; clicks: number; intensityPct: number }>;
    totalMoves: number;
    totalClicks: number;
    hourlyIntensityArray: number[];
    byEmployeeName: Record<string, number[]>;
  }> => {
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const empty = {
      byHour: {} as Record<string, { moves: number; clicks: number; intensityPct: number }>,
      totalMoves: 0,
      totalClicks: 0,
      hourlyIntensityArray: timeSlots.map(() => 0),
      byEmployeeName: {} as Record<string, number[]>,
    };
    if (!isSupabaseConfigured()) return empty;

    try {
      let empQuery = supabase.from('employees').select('id, user_id, full_name, email, manager_id');
      if (role === 'manager' && scopeUserId) {
        empQuery = empQuery.eq('manager_id', scopeUserId);
      } else if (role === 'employee' && scopeUserId) {
        empQuery = empQuery.or(`id.eq.${scopeUserId},user_id.eq.${scopeUserId}`);
      }
      const { data: empRows } = await empQuery;
      const employees = empRows || [];
      const idToName = new Map<string, string>();
      for (const e of employees) {
        const name = e.full_name || e.email || e.id;
        if (e.id) idToName.set(e.id, name);
        if (e.user_id) idToName.set(e.user_id, name);
      }

      const allowedIds = resolveTelemetryEmployeeIds(employees, role, employeeFilter, scopeUserId);
      if (allowedIds.size === 0) return empty;

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const { data: aggs, error } = await supabase
        .from('activity_aggregates')
        .select('window_start, mouse_move_count, mouse_click_count, active_seconds, employee_id')
        .gte('window_start', dayStart.toISOString())
        .order('window_start', { ascending: true });
      if (error) throw error;

      const byHour: Record<string, { moves: number; clicks: number; intensityPct: number }> = {};
      for (const slot of timeSlots) {
        byHour[slot] = { moves: 0, clicks: 0, intensityPct: 0 };
      }

      const perEmp: Record<string, Record<string, { moves: number; clicks: number; active: number }>> = {};
      let totalMoves = 0;
      let totalClicks = 0;

      for (const a of aggs || []) {
        const empId = a.employee_id as string;
        if (!empId) continue;
        if (role === 'manager' && (empId === ADMIN_USER_ID || isAdminRecord(empId))) continue;
        if (!allowedIds.has(empId)) continue;

        const moves = Number(a.mouse_move_count) || 0;
        const clicks = Number(a.mouse_click_count) || 0;
        const active = Number(a.active_seconds) || 0;
        if (!a.window_start) continue;

        // Always count toward today's real totals (even outside chart slots)
        totalMoves += moves;
        totalClicks += clicks;

        const date = new Date(a.window_start);
        const hour = date.getHours();
        const slotStr = `${hour.toString().padStart(2, '0')}:00`;
        const targetSlot = byHour[slotStr] ? slotStr : timeSlots.find((s) => Number(s.split(':')[0]) === hour);
        if (!targetSlot || !byHour[targetSlot]) continue;

        byHour[targetSlot].moves += moves;
        byHour[targetSlot].clicks += clicks;

        const denom = Math.max(1, active || 60);
        const pct = Math.min(
          100,
          Math.round(((byHour[targetSlot].moves + byHour[targetSlot].clicks * 5) / (denom * 8)) * 100)
        );
        byHour[targetSlot].intensityPct = Math.max(byHour[targetSlot].intensityPct, pct);

        const displayName = idToName.get(empId) || empId;
        if (!perEmp[displayName]) {
          perEmp[displayName] = Object.fromEntries(
            timeSlots.map((s) => [s, { moves: 0, clicks: 0, active: 0 }])
          );
        }
        perEmp[displayName][targetSlot].moves += moves;
        perEmp[displayName][targetSlot].clicks += clicks;
        perEmp[displayName][targetSlot].active += active;
      }

      const byEmployeeName: Record<string, number[]> = {};
      for (const [name, hours] of Object.entries(perEmp)) {
        const row = timeSlots.map((s) => {
          const h = hours[s];
          const denom = Math.max(1, h.active || 60);
          return Math.min(100, Math.round(((h.moves + h.clicks * 5) / (denom * 8)) * 100));
        });
        byEmployeeName[name] = row;
        byEmployeeName[name.split('(')[0].trim()] = row;
      }

      return {
        byHour,
        totalMoves,
        totalClicks,
        hourlyIntensityArray: timeSlots.map((s) => byHour[s]?.intensityPct || 0),
        byEmployeeName,
      };
    } catch (e) {
      console.warn('Failed to fetch live mouse telemetry:', e);
      return empty;
    }
  },

  getAttendance: async (
    role: UserRole,
    managerId?: string,
    employeeId?: string
  ): Promise<AttendanceRecordItem[]> => {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data: emps } = await supabase.from('employees').select('*');
      const { data: presence } = await supabase.from('employee_presence').select('*').order('updated_at', { ascending: false });

      if (!emps || emps.length === 0) return [];

      const todayStr = new Date().toISOString().split('T')[0];

      return emps
        .filter((e: any) => {
          if (role === 'manager') {
            if (
              e.id === ADMIN_USER_ID ||
              e.user_id === ADMIN_USER_ID ||
              isAdminRecord(e.id, e.full_name, e.email)
            ) {
              return false;
            }
            if (managerId) return e.manager_id === managerId;
            return true;
          }
          if (role === 'employee' && employeeId) return e.id === employeeId || e.user_id === employeeId;
          return true;
        })
        .map((e: any) => {
          const isMatchingEmp = (candId?: string) =>
            !!candId && (candId === e.id || candId === e.user_id);
          const presList = presence?.filter((p: any) => isMatchingEmp(p.employee_id)) || [];
          const activePres = presList.find((p: any) => p.status === 'active');
          const pres = activePres || presList[0];
          const firstAct = pres?.last_activity_at
            ? new Date(pres.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '09:00 AM';

          const isOnline = pres?.status === 'active' || pres?.status === 'idle';

          return {
            id: `att-${e.id}`,
            employee_id: e.id,
            employee_name: e.full_name || 'Employee',
            team_name: e.team_name || 'Engineering',
            manager_name: 'Manager',
            date: todayStr,
            scheduled_start: '09:00 AM',
            first_activity_at: firstAct,
            status: isOnline ? 'on_time' : 'absent',
            late_minutes: 0,
            active_hours: isOnline ? 5.5 : 0,
            idle_hours: isOnline ? 0.5 : 0,
          };
        });
    } catch (err) {
      console.error('getAttendance error:', err);
      return [];
    }
  },

  // 7. Projects Query & Mutations
  getProjects: async (role: UserRole, managerId?: string, _employeeId?: string): Promise<ProjectItem[]> => {
    if (!isSupabaseConfigured()) return [];

    try {
      const [projRes, empRes] = await Promise.all([
        supabase.from('projects').select('*, tasks(*)'),
        supabase.from('employees').select('id, user_id, full_name, manager_id, email'),
      ]);

      const allProjects = projRes.data || [];
      const allEmps = empRes.data || [];

      const teamEmployees = allEmps.filter((e: any) =>
        managerId ? e.manager_id === managerId : true
      );
      const teamEmpIds = new Set<string>(
        teamEmployees.flatMap((e: any) => [e.id, e.user_id]).filter(Boolean)
      );

      // Filter projects based on role
      let projRows = allProjects;

      if (role === 'manager') {
        projRows = allProjects.filter((p: any) => {
          const isAdminProj =
            p.manager_id === ADMIN_USER_ID ||
            isAdminRecord(p.manager_id, p.manager_name) ||
            p.name?.toLowerCase().startsWith('admin ') ||
            p.name?.toLowerCase().includes('executive') ||
            p.description?.toLowerCase().includes('admin only') ||
            p.description?.toLowerCase().includes('executive');

          if (isAdminProj) {
            return false;
          }

          const isManagerOwn = !!(managerId && p.manager_id === managerId);
          const tasks = p.tasks || [];
          const isEmployeeActivity = tasks.some((t: any) => teamEmpIds.has(t.assigned_to));

          return isManagerOwn || isEmployeeActivity;
        });
      } else if (role === 'project_manager') {
        const assigns = loadAllProjectAssignments();
        const pmOwnedAssignIds = new Set(
          assigns
            .filter((a) => (a as any).project_manager_id === managerId)
            .map((a) => a.project_id)
        );
        projRows = allProjects.filter((p: any) => {
          if (managerId && p.manager_id === managerId) return true;
          return pmOwnedAssignIds.has(p.id);
        });
      } else if (role === 'employee' && _employeeId) {
        const assigns = loadAllProjectAssignments().filter((a) => a.employee_id === _employeeId);
        const assignedIds = new Set(assigns.map((a) => a.project_id));
        projRows = allProjects.filter((p: any) => {
          const tasks = p.tasks || [];
          return (
            p.manager_id === _employeeId ||
            assignedIds.has(p.id) ||
            tasks.some((t: any) => t.assigned_to === _employeeId)
          );
        });
      }

      return projRows.map((p: any) => {
        const tasks = p.tasks || [];
        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.status === 'completed').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        const assignedEmpIds = tasks.map((t: any) => t.assigned_to).filter(Boolean);
        const assignedEmps = allEmps
          .filter(
            (e: any) => assignedEmpIds.includes(e.id) || assignedEmpIds.includes(e.user_id)
          )
          .map((e: any) => e.full_name)
          .filter(Boolean);

        const hasEmployeeActivity = assignedEmpIds.some((id: string) => teamEmpIds.has(id));
        const isManagerOwn = !!(managerId && p.manager_id === managerId);

        let scopeType: 'manager_owned' | 'employee_activity' | 'organization' | 'project_managed' =
          'organization';
        if (role === 'project_manager') {
          scopeType = 'project_managed';
        } else if (role === 'manager') {
          if (hasEmployeeActivity && !isManagerOwn) {
            scopeType = 'employee_activity';
          } else if (isManagerOwn && hasEmployeeActivity) {
            scopeType = 'employee_activity';
          } else {
            scopeType = 'manager_owned';
          }
        }

        const mgr = allEmps.find((e: any) => e.id === p.manager_id || e.user_id === p.manager_id);

        return {
          id: p.id,
          name: p.name,
          code: (p.name || 'PROJ').substring(0, 4).toUpperCase(),
          description: p.description || '',
          manager_id: p.manager_id || '',
          manager_name: p.manager_name || mgr?.full_name || 'Unassigned',
          members_count: Math.max(assignedEmps.length, total > 0 ? 1 : 0),
          status: p.status === 'active' ? 'active' : p.status === 'completed' ? 'completed' : 'on_hold',
          progress_percentage: progress,
          total_tasks: total,
          completed_tasks: completed,
          due_date: p.due_date || '',
          scope_type: scopeType,
          assigned_employees: Array.from(new Set(assignedEmps)),
        };
      });
    } catch (err) {
      console.error('getProjects error:', err);
      return [];
    }
  },

  createProject: async (
    role: UserRole,
    project: Omit<ProjectItem, 'id' | 'completed_tasks'>,
    managerId?: string
  ): Promise<ProjectItem> => {
    if (
      role !== 'admin' &&
      role !== 'manager' &&
      role !== 'project_manager' &&
      role !== 'employee'
    ) {
      throw new Error('403 Forbidden: Cannot create project');
    }

    const manager_id =
      role === 'manager' || role === 'project_manager' || role === 'employee'
        ? managerId || project.manager_id
        : project.manager_id || managerId;

    if (manager_id) {
      await ensureProjectManagerUser({
        id: manager_id,
        fullName: project.manager_name || 'Project Owner',
        role,
      });
    }

    const newProj = {
      name: project.name,
      description: project.code || project.description || '',
      status: project.status || 'active',
      manager_id: manager_id || null,
      organization_id: '00000000-0000-0000-0000-000000000001',
    };

    const { data, error } = await supabase.from('projects').insert([newProj]).select().single();
    if (error) throw error;

    return {
      ...project,
      id: data.id,
      manager_id: data.manager_id || manager_id || '',
      completed_tasks: 0,
    };
  },

  // 7b. Project Folders & Embedded Files
  getProjectFolders: async (projectId: string, role?: UserRole): Promise<ProjectFolder[]> => {
    let folders: ProjectFolder[] = [];
    try {
      const raw = localStorage.getItem(`stitch_project_folders_${projectId}`);
      if (raw) {
        folders = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse folders from localStorage:', e);
    }

    if (!folders) folders = [];

    // Purge legacy demo seed folders (no real uploaded payloads)
    const before = folders.length;
    folders = folders.filter((f) => {
      const isSeedId =
        f.id.startsWith('folder-specs-') ||
        f.id.startsWith('folder-assets-') ||
        f.id.startsWith('folder-deliverables-');
      if (!isSeedId) return true;
      const hasRealFile = (f.files || []).some((file) => !!file.data_url);
      return hasRealFile;
    });
    if (folders.length !== before) {
      try {
        localStorage.setItem(`stitch_project_folders_${projectId}`, JSON.stringify(folders));
      } catch {
        /* ignore */
      }
    }

    // STRICT MANAGER ISOLATION:
    // Manager only sees folders and files of employees and his/her own, NEVER admin
    if (role === 'manager') {
      folders = folders
        .filter((f) => {
          const isAdm =
            f.name.toLowerCase().includes('admin confidential') ||
            f.name.toLowerCase().includes('executive briefs');
          return !isAdm;
        })
        .map((f) => ({
          ...f,
          files: (f.files || []).filter((file) => {
            const upBy = (file.uploaded_by || '').toLowerCase();
            const isAdminFile =
              upBy.includes('super admin') ||
              upBy.includes('admin user') ||
              upBy === 'admin';
            return !isAdminFile;
          }),
        }));
    }

    return folders;
  },

  createProjectFolder: async (projectId: string, name: string, color = '#3b82f6'): Promise<ProjectFolder> => {
    const existing = await dataService.getProjectFolders(projectId);
    const newFolder: ProjectFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      project_id: projectId,
      created_at: new Date().toISOString().split('T')[0],
      color,
      files: [],
    };
    const updated = [newFolder, ...existing];
    try {
      localStorage.setItem(`stitch_project_folders_${projectId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save folder:', e);
    }
    return newFolder;
  },

  deleteProjectFolder: async (projectId: string, folderId: string): Promise<void> => {
    const existing = await dataService.getProjectFolders(projectId);
    const updated = existing.filter((f) => f.id !== folderId);
    try {
      localStorage.setItem(`stitch_project_folders_${projectId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete folder:', e);
    }
  },

  embedFileInFolder: async (
    projectId: string,
    folderId: string,
    fileData: Omit<ProjectFolderFile, 'id' | 'uploaded_at'>
  ): Promise<ProjectFolderFile> => {
    const folders = await dataService.getProjectFolders(projectId);
    const targetFolder = folders.find((f) => f.id === folderId);
    if (!targetFolder) throw new Error('Target folder not found');

    const newFile: ProjectFolderFile = {
      id: `file-${Date.now()}`,
      name: fileData.name,
      size: fileData.size,
      size_formatted: fileData.size_formatted,
      mime_type: fileData.mime_type,
      uploaded_at: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      uploaded_by: fileData.uploaded_by || 'Current User',
      data_url: fileData.data_url || '',
      description: fileData.description || '',
    };

    targetFolder.files = [newFile, ...targetFolder.files];
    try {
      localStorage.setItem(`stitch_project_folders_${projectId}`, JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed to embed file in localStorage:', e);
    }
    return newFile;
  },

  deleteFileFromFolder: async (projectId: string, folderId: string, fileId: string): Promise<void> => {
    const folders = await dataService.getProjectFolders(projectId);
    const targetFolder = folders.find((f) => f.id === folderId);
    if (!targetFolder) return;

    targetFolder.files = targetFolder.files.filter((f) => f.id !== fileId);
    try {
      localStorage.setItem(`stitch_project_folders_${projectId}`, JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed to delete file from localStorage:', e);
    }
  },

  // 7c. Nested Drive-style project items
  listProjectItems: async (
    projectId: string,
    opts?: { employeeId?: string; role?: UserRole }
  ): Promise<ProjectTreeItem[]> => {
    const items = await fetchProjectItemsRaw(projectId);

    // Employees only see granted scopes — unless they own the project
    if (opts?.role === 'employee' && opts.employeeId) {
      if (isSupabaseConfigured()) {
        try {
          const { data: proj } = await supabase
            .from('projects')
            .select('manager_id')
            .eq('id', projectId)
            .maybeSingle();
          if (proj?.manager_id === opts.employeeId) return items;
        } catch {
          /* fall through to grants */
        }
      }
      const grants = loadAllProjectAssignments().filter(
        (a) => a.employee_id === opts.employeeId && a.project_id === projectId
      );
      // Owner-created trees with no grants yet: show all local/remote items
      if (!grants.length) return items;
      return filterVisibleItems(grants, items);
    }
    return items;
  },

  createProjectItem: async (params: {
    projectId: string;
    parentId?: string | null;
    itemType: ProjectTreeItemType;
    name: string;
    content?: Record<string, unknown> | string | null;
    dataUrl?: string | null;
    mimeType?: string | null;
    createdBy?: string | null;
  }): Promise<ProjectTreeItem> => {
    const name = params.name.trim();
    if (!name) throw new Error('Name is required');

    const existing = await fetchProjectItemsRaw(params.projectId);
    const siblings = existing.filter(
      (i: ProjectTreeItem) => (i.parent_id || null) === (params.parentId || null)
    );
    if (siblings.some((s: ProjectTreeItem) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`An item named "${name}" already exists here`);
    }

    if (params.parentId) {
      const parent = existing.find((i: ProjectTreeItem) => i.id === params.parentId);
      if (!parent) throw new Error('Parent folder not found');
      if (parent.item_type !== 'folder') throw new Error('Parent must be a folder');
    }

    const now = new Date().toISOString();
    const defaultContent =
      params.content ??
      (params.itemType === 'document'
        ? { body: '', format: 'internal_document' }
        : params.itemType === 'spreadsheet'
          ? { sheets: [{ name: 'Sheet1', rows: [['', ''], ['', '']] }], format: 'internal_spreadsheet' }
          : params.itemType === 'presentation'
            ? { slides: [{ title: name, body: '' }], format: 'internal_presentation' }
            : null);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('project_items')
          .insert([
            {
              project_id: params.projectId,
              parent_id: params.parentId || null,
              item_type: params.itemType,
              name,
              content: defaultContent ?? {},
              data_url: params.dataUrl || null,
              mime_type: params.mimeType || null,
              created_by: params.createdBy || null,
              updated_at: now,
            },
          ])
          .select()
          .single();
        if (!error && data) {
          const item = mapDbProjectItem(data);
          const local = loadLocalProjectItems(params.projectId);
          saveLocalProjectItems(params.projectId, [item, ...local.filter((x) => x.id !== item.id)]);
          return item;
        }
        if (error && !(error.message.includes('schema cache') || error.code === '42P01')) {
          throw new Error(error.message);
        }
      } catch (e: any) {
        if (e?.message && !String(e.message).includes('schema cache') && e?.code !== '42P01') {
          // fall through to local for missing table; rethrow other errors
          if (!String(e.message).includes('relation') && !String(e.message).includes('project_items')) {
            console.warn('createProjectItem remote warning, using local:', e);
          }
        }
      }
    }

    const item: ProjectTreeItem = {
      id: crypto.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      project_id: params.projectId,
      parent_id: params.parentId || null,
      item_type: params.itemType,
      name,
      content: defaultContent,
      data_url: params.dataUrl || null,
      mime_type: params.mimeType || null,
      external_provider: null,
      external_file_id: null,
      created_by: params.createdBy || null,
      created_at: now,
      updated_at: now,
    };
    const local = loadLocalProjectItems(params.projectId);
    saveLocalProjectItems(params.projectId, [item, ...local]);
    return item;
  },

  updateProjectItem: async (
    projectId: string,
    itemId: string,
    patch: Partial<Pick<ProjectTreeItem, 'name' | 'parent_id' | 'content' | 'data_url' | 'mime_type'>>
  ): Promise<ProjectTreeItem> => {
    const items = await fetchProjectItemsRaw(projectId);
    const current = items.find((i: ProjectTreeItem) => i.id === itemId);
    if (!current) throw new Error('Item not found');

    if (patch.name != null) {
      const name = patch.name.trim();
      if (!name) throw new Error('Name is required');
      const parentId = patch.parent_id !== undefined ? patch.parent_id : current.parent_id;
      const clash = items.some(
        (i: ProjectTreeItem) =>
          i.id !== itemId &&
          (i.parent_id || null) === (parentId || null) &&
          i.name.toLowerCase() === name.toLowerCase()
      );
      if (clash) throw new Error(`An item named "${name}" already exists here`);
      patch.name = name;
    }

    if (patch.parent_id !== undefined && patch.parent_id) {
      if (patch.parent_id === itemId) throw new Error('Cannot move item into itself');
      const parent = items.find((i: ProjectTreeItem) => i.id === patch.parent_id);
      if (!parent || parent.item_type !== 'folder') throw new Error('Move target must be a folder');
      // Prevent moving into own descendant
      const isDescendant = (id: string, ancestorId: string): boolean => {
        let cursor: string | null = id;
        const byId = new Map<string, ProjectTreeItem>(items.map((i: ProjectTreeItem) => [i.id, i]));
        while (cursor) {
          if (cursor === ancestorId) return true;
          cursor = byId.get(cursor)?.parent_id || null;
        }
        return false;
      };
      if (isDescendant(patch.parent_id, itemId)) {
        throw new Error('Cannot move a folder into its own descendant');
      }
    }

    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('project_items')
          .update({ ...patch, updated_at: now })
          .eq('id', itemId)
          .eq('project_id', projectId)
          .select()
          .single();
        if (!error && data) {
          const item = mapDbProjectItem(data);
          saveLocalProjectItems(
            projectId,
            items.map((i) => (i.id === itemId ? item : i))
          );
          return item;
        }
      } catch (e) {
        console.warn('updateProjectItem remote fallback:', e);
      }
    }

    const updated: ProjectTreeItem = {
      ...current,
      ...patch,
      updated_at: now,
    };
    saveLocalProjectItems(
      projectId,
      items.map((i) => (i.id === itemId ? updated : i))
    );
    return updated;
  },

  deleteProjectItem: async (projectId: string, itemId: string): Promise<void> => {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('project_items')
          .delete()
          .eq('id', itemId)
          .eq('project_id', projectId);
        if (error && !(error.message.includes('schema cache') || error.code === '42P01')) {
          console.warn('deleteProjectItem remote:', error.message);
        }
      } catch (e) {
        console.warn('deleteProjectItem remote fallback:', e);
      }
    }
    const items = loadLocalProjectItems(projectId);
    const toRemove = new Set<string>([itemId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const i of items) {
        if (i.parent_id && toRemove.has(i.parent_id) && !toRemove.has(i.id)) {
          toRemove.add(i.id);
          changed = true;
        }
      }
    }
    saveLocalProjectItems(
      projectId,
      items.filter((i) => !toRemove.has(i.id))
    );
  },

  renameProject: async (role: UserRole, projectId: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Project name is required');
    if (role === 'employee') {
      // employees may rename only own projects — enforced loosely via manager_id at call site
    }
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('projects').update({ name: trimmed }).eq('id', projectId);
    if (error) throw error;
  },

  deleteProject: async (role: UserRole, projectId: string): Promise<void> => {
    if (role === 'employee') {
      // allow for own projects
    }
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
    await supabase.from('project_items').delete().eq('project_id', projectId);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
    try {
      localStorage.removeItem(projectItemsLocalKey(projectId));
      localStorage.removeItem(`stitch_project_folders_${projectId}`);
    } catch {
      /* ignore */
    }
  },

  // 8. Tasks Query & Mutations
  getTasks: async (role: UserRole, managerId?: string, employeeId?: string): Promise<TaskItem[]> => {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase.from('tasks').select('*, projects(*), employees(*)');
      
      if ((role === 'manager' || role === 'project_manager') && managerId) {
        query = query.eq('projects.manager_id', managerId);
      } else if (role === 'employee' && employeeId) {
        query = query.or(`assigned_to.eq.${employeeId}`);
      }

      const { data: taskRows, error } = await query;
      if (error) throw error;
      if (!taskRows) return [];

      let cleanTaskRows = taskRows;
      if (role === 'manager' || role === 'project_manager') {
        cleanTaskRows = taskRows.filter((t: any) =>
          !isAdminRecord(t.assigned_to, t.employees?.full_name, t.employees?.email)
        );
      }

      return cleanTaskRows.map((t: any) => {
        let status: TaskItem['status'] = 'todo';
        if (t.status === 'in_progress') status = 'in_progress';
        else if (t.status === 'completed') status = 'completed';
        else if (t.status === 'paused') status = 'paused';

        return {
          id: t.id,
          title: t.title,
          project_id: t.project_id || '',
          project_name: t.projects?.name || 'Project',
          employee_id: t.assigned_to || '',
          employee_name: t.employees?.full_name || 'Employee',
          manager_id: t.projects?.manager_id || managerId || '',
          priority: (t.priority as any) || 'medium',
          status,
          tracked_seconds: (t.estimated_hours || 8) * 3600,
          due_date: t.due_date || '',
        };
      });
    } catch (err) {
      console.error('getTasks error:', err);
      return [];
    }
  },

  createTask: async (
    role: UserRole,
    task: Omit<TaskItem, 'id' | 'tracked_seconds'>,
    managerId?: string
  ): Promise<TaskItem> => {
    if (role === 'employee') {
      throw new Error('403 Forbidden: Employees cannot create organization tasks');
    }

    const newTask = {
      project_id: task.project_id || null,
      title: task.title,
      description: '',
      assigned_to: task.employee_id || null,
      status: task.status === 'todo' ? 'pending' : task.status,
      priority: task.priority,
      estimated_hours: 8,
    };

    const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();
    if (error) throw error;

    return {
      ...task,
      id: data.id,
      tracked_seconds: 0,
      manager_id:
        role === 'manager' || role === 'project_manager'
          ? managerId || task.manager_id
          : task.manager_id,
    };
  },

  getAllProjectAssignments: async (projectManagerId?: string): Promise<ProjectMemberAssignment[]> => {
    const all = loadAllProjectAssignments();
    if (!projectManagerId) return all;
    return all.filter((a) => a.project_manager_id === projectManagerId);
  },

  getProjectAssignments: async (projectId: string): Promise<ProjectMemberAssignment[]> => {
    return loadAllProjectAssignments().filter((a) => a.project_id === projectId);
  },

  getEmployeeProjectGrants: async (
    employeeId: string,
    projectId?: string
  ): Promise<ProjectMemberAssignment[]> => {
    return loadAllProjectAssignments().filter(
      (a) => a.employee_id === employeeId && (!projectId || a.project_id === projectId)
    );
  },

  resolveEmployeeItemAccess: async (
    employeeId: string,
    projectId: string,
    itemId: string
  ): Promise<ProjectAccessLevel | null> => {
    const grants = loadAllProjectAssignments().filter(
      (a) => a.employee_id === employeeId && a.project_id === projectId
    );
    const items = await fetchProjectItemsRaw(projectId);
    return resolveItemAccess(grants, itemId, items);
  },

  resolveEmployeeProjectAccess: async (
    employeeId: string,
    projectId: string
  ): Promise<ProjectAccessLevel | null> => {
    const grants = loadAllProjectAssignments().filter(
      (a) => a.employee_id === employeeId && a.project_id === projectId
    );
    return resolveProjectAccess(grants);
  },

  assignUserToProject: async (params: {
    projectId: string;
    projectName?: string;
    employeeId: string;
    employeeName: string;
    employeeEmail?: string;
    access: ProjectAccessLevel;
    scope?: ProjectAccessScope;
    resourceId?: string | null;
    resourceName?: string;
    resourcePath?: string;
    includeDescendants?: boolean;
    assignedBy?: string;
    projectManagerId?: string;
  }): Promise<ProjectMemberAssignment> => {
    const scope: ProjectAccessScope = params.scope || 'project';
    if (scope !== 'project' && !params.resourceId) {
      throw new Error('resourceId is required for folder/item grants');
    }

    const all = loadAllProjectAssignments();
    const identity = grantIdentity({
      project_id: params.projectId,
      employee_id: params.employeeId,
      scope,
      resource_id: scope === 'project' ? null : params.resourceId,
    });
    const existingIdx = all.findIndex(
      (a) =>
        grantIdentity({
          project_id: a.project_id,
          employee_id: a.employee_id,
          scope: a.scope,
          resource_id: a.resource_id,
        }) === identity
    );

    const row = normalizeAssignment({
      id:
        existingIdx >= 0
          ? all[existingIdx].id
          : `assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      project_id: params.projectId,
      project_name: params.projectName,
      employee_id: params.employeeId,
      employee_name: params.employeeName,
      employee_email: params.employeeEmail,
      access: params.access,
      scope,
      resource_id: scope === 'project' ? null : params.resourceId || null,
      resource_name: params.resourceName,
      resource_path: params.resourcePath,
      include_descendants: params.includeDescendants !== false,
      assigned_by: params.assignedBy,
      assigned_at: new Date().toISOString(),
      project_manager_id: params.projectManagerId,
    });

    if (existingIdx >= 0) all[existingIdx] = row;
    else all.push(row);
    saveAllProjectAssignments(all);
    return row;
  },

  /** Grant the same scoped access to every employee in the list. */
  assignUsersToProjectBulk: async (
    employeeIds: string[],
    params: {
      projectId: string;
      projectName?: string;
      access: ProjectAccessLevel;
      scope?: ProjectAccessScope;
      resourceId?: string | null;
      resourceName?: string;
      resourcePath?: string;
      includeDescendants?: boolean;
      assignedBy?: string;
      projectManagerId?: string;
    },
    roster: { id: string; name: string; email?: string }[]
  ): Promise<ProjectMemberAssignment[]> => {
    const out: ProjectMemberAssignment[] = [];
    for (const id of employeeIds) {
      const emp = roster.find((e) => e.id === id);
      if (!emp) continue;
      out.push(
        await dataService.assignUserToProject({
          ...params,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email,
        })
      );
    }
    return out;
  },

  removeProjectAssignment: async (assignmentId: string, projectManagerId?: string): Promise<void> => {
    const all = loadAllProjectAssignments();
    const target = all.find((a) => a.id === assignmentId);
    if (!target) return;
    if (
      projectManagerId &&
      target.project_manager_id &&
      target.project_manager_id !== projectManagerId
    ) {
      throw new Error("403 Forbidden: Cannot revoke another PM's assignment");
    }
    saveAllProjectAssignments(all.filter((a) => a.id !== assignmentId));
  },

  /** True if employee may mutate items under a parent (or project root). */
  employeeCanEditIn: async (
    employeeId: string,
    projectId: string,
    parentOrItemId: string | null
  ): Promise<boolean> => {
    const grants = loadAllProjectAssignments().filter(
      (a) => a.employee_id === employeeId && a.project_id === projectId
    );
    if (!grants.length) return false;
    if (grants.some((g) => g.scope === 'project' && accessCanEdit(g.access))) return true;
    if (!parentOrItemId) {
      return accessCanEdit(resolveProjectAccess(grants));
    }
    const items = await fetchProjectItemsRaw(projectId);
    return accessCanEdit(resolveItemAccess(grants, parentOrItemId, items));
  },

  employeeCanAdminProject: async (employeeId: string, projectId: string): Promise<boolean> => {
    const grants = loadAllProjectAssignments().filter(
      (a) => a.employee_id === employeeId && a.project_id === projectId
    );
    return accessCanAdmin(resolveProjectAccess(grants));
  },

  updateTaskStatus: async (
    _role: UserRole,
    taskId: string,
    status: TaskItem['status']
  ): Promise<void> => {
    const dbStatus =
      status === 'todo'
        ? 'pending'
        : status === 'in_progress'
        ? 'in_progress'
        : status === 'completed'
        ? 'completed'
        : 'pending';
    const { error } = await supabase.from('tasks').update({ status: dbStatus }).eq('id', taskId);
    if (error) throw error;
  },

  // 9. Audit Logs & Action Logging
  getAuditLogs: async (role: UserRole): Promise<AuditLogItem[]> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can access complete audit logs');
    }
    if (!isSupabaseConfigured()) return localAuditLogs;

    try {
      const { data: events } = await supabase
        .from('activity_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(30);

      if (!events || events.length === 0) return localAuditLogs;

      const remoteLogs: AuditLogItem[] = events.map((ev: any) => {
        let localTimestamp = '';
        if (ev.occurred_at || ev.created_at) {
          const d = new Date(ev.occurred_at || ev.created_at);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            localTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          }
        }
        if (!localTimestamp) {
          const d = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          localTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        return {
          id: ev.id,
          timestamp: localTimestamp,
          actor_name: ev.metadata?.actor || 'Agent',
          actor_role: (ev.metadata?.role as any) || 'employee',
          action: (ev.event_type || 'heartbeat').toUpperCase(),
          target: ev.metadata?.target || ev.device_id || 'Workstation',
          ip_device: ev.device_id || '127.0.0.1',
          details: typeof ev.metadata === 'object' ? JSON.stringify(ev.metadata) : 'Telemetry event',
        };
      });

      return [...remoteLogs, ...localAuditLogs];
    } catch (err) {
      console.error('getAuditLogs error:', err);
      return localAuditLogs;
    }
  },

  logAction: (
    actorName: string,
    actorRole: UserRole,
    action: string,
    target: string,
    details: string,
    actorId?: string
  ): void => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const newEntry: AuditLogItem = {
      id: `aud-${Date.now()}`,
      timestamp: localTimestamp,
      actor_name: actorName,
      actor_role: actorRole,
      action,
      target,
      ip_device: 'Local Client',
      details,
    };
    localAuditLogs = [newEntry, ...localAuditLogs];

    // Also persist to activity_events table if connected
    if (isSupabaseConfigured()) {
      const isUuid = !!actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
      supabase
        .from('activity_events')
        .insert([
          {
            ...(isUuid ? { employee_id: actorId } : {}),
            device_id: 'WIN-CLIENT',
            event_type: action.toLowerCase(),
            occurred_at: new Date().toISOString(),
            metadata: { actor: actorName, role: actorRole, target, details },
          },
        ])
        .then(({ error }) => {
          if (error) console.warn('Could not persist audit event to Supabase:', error.message);
        });
    }
  },

  // 10. Live KPI calculations from Database
  getAdminKpis: async () => {
    if (!isSupabaseConfigured()) {
      return {
        totalEmployees: 0,
        onlineEmployees: 0,
        lateToday: 0,
        idleEmployees: 0,
        activeTasks: 0,
        completedTasks: 0,
        totalProjects: 0,
        attendanceRate: 100,
      };
    }

    try {
      const [emps, presence, tasks, projs] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('employee_presence').select('status'),
        supabase.from('tasks').select('status'),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
      ]);

      const totalEmployees = emps.count ?? 0;
      const presList = presence.data || [];
      const onlineEmployees = presList.filter((p: any) => p.status === 'active' || p.status === 'idle').length;
      const idleEmployees = presList.filter((p: any) => p.status === 'idle').length;
      const taskList = tasks.data || [];
      const activeTasks = taskList.filter((t: any) => t.status === 'in_progress').length;
      const completedTasks = taskList.filter((t: any) => t.status === 'completed').length;
      const totalProjects = projs.count ?? 0;
      const attendanceRate =
        totalEmployees > 0 ? Math.round((onlineEmployees / totalEmployees) * 100) : 0;

      return {
        totalEmployees,
        onlineEmployees,
        lateToday: 0,
        idleEmployees,
        activeTasks,
        completedTasks,
        totalProjects,
        attendanceRate,
      };
    } catch (err) {
      console.error('getAdminKpis error:', err);
      return {
        totalEmployees: 0,
        onlineEmployees: 0,
        lateToday: 0,
        idleEmployees: 0,
        activeTasks: 0,
        completedTasks: 0,
        totalProjects: 0,
        attendanceRate: 0,
      };
    }
  },

  getManagerKpis: async (managerId?: string) => {
    if (!isSupabaseConfigured()) {
      return {
        totalEmployees: 0,
        online: 0,
        late: 0,
        idle: 0,
        onBreak: 0,
        tasksInProgress: 0,
        tasksCompleted: 0,
        teamAttendanceRate: 0,
      };
    }

    try {
      let empQuery = supabase.from('employees').select('id, user_id, full_name, email');
      if (managerId) {
        empQuery = empQuery.eq('manager_id', managerId);
      }
      const { data: rawTeamEmps } = await empQuery;
      const teamEmps = (rawTeamEmps || []).filter((e: any) =>
        e.id !== ADMIN_USER_ID &&
        e.user_id !== ADMIN_USER_ID &&
        !isAdminRecord(e.id, e.full_name, e.email)
      );
      const empIds = teamEmps.map((e: any) => e.id);
      const totalEmployees = empIds.length;

      const { data: presence } = await supabase.from('employee_presence').select('*');
      const teamPresence = presence?.filter((p: any) => empIds.includes(p.employee_id)) || [];
      const online = teamPresence.filter((p: any) => p.status === 'active' || p.status === 'idle').length;
      const idle = teamPresence.filter((p: any) => p.status === 'idle').length;

      const { data: tasks } = await supabase.from('tasks').select('status, assigned_to');
      const teamTasks = tasks?.filter((t: any) => empIds.includes(t.assigned_to)) || [];
      const tasksInProgress = teamTasks.filter((t: any) => t.status === 'in_progress').length;
      const tasksCompleted = teamTasks.filter((t: any) => t.status === 'completed').length;
      const teamAttendanceRate =
        totalEmployees > 0 ? Math.round((online / totalEmployees) * 100) : 0;

      return {
        totalEmployees,
        online,
        late: 0,
        idle,
        onBreak: 0,
        tasksInProgress,
        tasksCompleted,
        teamAttendanceRate,
      };
    } catch (err) {
      console.error('getManagerKpis error:', err);
      return {
        totalEmployees: 0,
        online: 0,
        late: 0,
        idle: 0,
        onBreak: 0,
        tasksInProgress: 0,
        tasksCompleted: 0,
        teamAttendanceRate: 0,
      };
    }
  },

  // 11. Rules & Configuration
  getStarRules: async (_role: UserRole): Promise<StarRuleItem[]> => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('star_rules').select('*').order('id');
      if (!error && data?.length) {
        starRulesStore = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          condition: r.condition || '',
          star_delta: Number(r.star_delta) || 0,
          is_active: Boolean(r.is_active),
        }));
      }
    }
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
    if (isSupabaseConfigured()) {
      await supabase
        .from('star_rules')
        .update({ star_delta: starDelta, is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
    }
    return rule;
  },

  getAttendanceRules: async (_role: UserRole): Promise<AttendanceRuleConfig> => {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('attendance_rule_config').select('*').eq('id', 1).maybeSingle();
      if (data) {
        attendanceRulesStore = {
          work_start_time: data.work_start_time || '09:00',
          work_end_time: data.work_end_time || '17:00',
          grace_period_minutes: Number(data.grace_period_minutes) || 15,
          late_threshold_minutes: Number(data.late_threshold_minutes) || 30,
        };
      }
    }
    return { ...attendanceRulesStore };
  },

  updateAttendanceRules: async (role: UserRole, newRules: AttendanceRuleConfig) => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can configure attendance rules');
    }
    attendanceRulesStore = { ...newRules };
    if (isSupabaseConfigured()) {
      await supabase.from('attendance_rule_config').upsert(
        {
          id: 1,
          work_start_time: newRules.work_start_time,
          work_end_time: newRules.work_end_time,
          grace_period_minutes: newRules.grace_period_minutes,
          late_threshold_minutes: newRules.late_threshold_minutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
    return attendanceRulesStore;
  },

  // 12. Heatmap points — only real pointer samples from activity_events metadata
  getHeatmapPoints: async (employeeId: string): Promise<HeatmapPoint[]> => {
    if (!isSupabaseConfigured() || !employeeId) return [];
    try {
      const { data, error } = await supabase
        .from('activity_events')
        .select('metadata, occurred_at')
        .eq('employee_id', employeeId)
        .order('occurred_at', { ascending: false })
        .limit(500);
      if (error || !data) return [];

      const points: HeatmapPoint[] = [];
      for (const row of data) {
        const meta = row.metadata || {};
        const samples = Array.isArray(meta.pointer_samples)
          ? meta.pointer_samples
          : Array.isArray(meta.heatmap_points)
            ? meta.heatmap_points
            : meta.x != null && meta.y != null
              ? [{ x: meta.x, y: meta.y, type: meta.type || 'click', intensity: meta.intensity }]
              : [];
        for (const s of samples) {
          const x = Number(s.x);
          const y = Number(s.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          points.push({
            x,
            y,
            intensity: Math.max(0, Math.min(1, Number(s.intensity) || 0.5)),
            type: s.type === 'move' ? 'move' : 'click',
          });
        }
      }
      return points;
    } catch {
      return [];
    }
  },

  // 13. Merit Stars & Incentive Mutations
  getEmployeeStars: (employeeId: string): number => {
    return employeeStarsMap.get(employeeId) ?? 0;
  },

  awardEmployeeStars: async (
    role: UserRole,
    employeeId: string,
    starDelta: number,
    reason: string,
    awardedBy: string,
    managerId?: string
  ): Promise<number> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Only Admin and Manager can award stars');
    }

    // Manager Governance: Managers cannot award or edit stars for themselves
    if (role === 'manager') {
      const isSelf =
        employeeId === managerId ||
        (awardedBy &&
          (awardedBy.toLowerCase().includes(employeeId.toLowerCase()) ||
            employeeId.toLowerCase().includes(awardedBy.toLowerCase())));

      if (isSelf) {
        throw new Error('403 Forbidden: Managers cannot edit or award stars to themselves.');
      }
    }

    let current = employeeStarsMap.get(employeeId);
    if (current === undefined && isSupabaseConfigured()) {
      const { data } = await supabase
        .from('employee_star_balances')
        .select('stars')
        .eq('employee_id', employeeId)
        .maybeSingle();
      current = data?.stars != null ? Number(data.stars) : 0;
    }
    if (current === undefined) current = 0;

    const updated = Math.max(0, current + starDelta);
    employeeStarsMap.set(employeeId, updated);

    if (isSupabaseConfigured()) {
      await supabase.from('employee_star_balances').upsert(
        { employee_id: employeeId, stars: updated, updated_at: new Date().toISOString() },
        { onConflict: 'employee_id' }
      );
      await supabase.from('star_award_events').insert([
        {
          employee_id: employeeId,
          star_delta: starDelta,
          reason,
          awarded_by: awardedBy,
          awarded_by_role: role,
        },
      ]);
    }

    dataService.logAction(
      awardedBy,
      role,
      starDelta >= 0 ? 'ALLOCATE_STARS' : 'DEALLOCATE_STARS',
      employeeId,
      `${starDelta >= 0 ? 'Allocated' : 'Deallocated'} ${Math.abs(starDelta)} ⭐ (${reason})`
    );
    return updated;
  },

  setEmployeeStars: async (
    role: UserRole,
    employeeId: string,
    exactStars: number,
    reason: string,
    setBy: string,
    managerId?: string
  ): Promise<number> => {
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Only Admin and Manager can set star balances');
    }

    // Manager Governance: Managers cannot modify their own star balance
    if (role === 'manager') {
      const isSelf =
        employeeId === managerId ||
        (setBy &&
          (setBy.toLowerCase().includes(employeeId.toLowerCase()) ||
            employeeId.toLowerCase().includes(setBy.toLowerCase())));

      if (isSelf) {
        throw new Error('403 Forbidden: Managers cannot modify their own star balance.');
      }
    }

    const updated = Math.max(0, exactStars);
    employeeStarsMap.set(employeeId, updated);

    if (isSupabaseConfigured()) {
      await supabase.from('employee_star_balances').upsert(
        { employee_id: employeeId, stars: updated, updated_at: new Date().toISOString() },
        { onConflict: 'employee_id' }
      );
      await supabase.from('star_award_events').insert([
        {
          employee_id: employeeId,
          star_delta: 0,
          reason: reason || `Set balance to ${updated}`,
          awarded_by: setBy,
          awarded_by_role: role,
        },
      ]);
    }

    dataService.logAction(
      setBy,
      role,
      'SET_STARS',
      employeeId,
      `Set star balance to ${updated} ⭐ (${reason || 'Direct administrative adjustment'})`
    );
    return updated;
  },

  addStarRule: async (
    role: UserRole,
    newRule: Omit<StarRuleItem, 'id'>
  ): Promise<StarRuleItem> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can create star rules');
    }
    const rule: StarRuleItem = {
      ...newRule,
      id: `sr-${Date.now()}`,
    };
    starRulesStore = [...starRulesStore, rule];
    if (isSupabaseConfigured()) {
      await supabase.from('star_rules').upsert({
        id: rule.id,
        name: rule.name,
        condition: rule.condition,
        star_delta: rule.star_delta,
        is_active: rule.is_active,
      });
    }

    dataService.logAction(
      'Super Admin',
      'admin',
      'CREATE_STAR_RULE',
      rule.name,
      `Created rule: ${rule.condition} (${rule.star_delta > 0 ? `+${rule.star_delta}` : rule.star_delta} ⭐)`
    );
    return rule;
  },

  deleteStarRule: async (role: UserRole, id: string): Promise<void> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can delete star rules');
    }
    if (isSupabaseConfigured()) {
      await supabase.from('star_rules').delete().eq('id', id);
    }
    const target = starRulesStore.find((r) => r.id === id);
    starRulesStore = starRulesStore.filter((r) => r.id !== id);

    if (target) {
      dataService.logAction(
        'Super Admin',
        'admin',
        'DELETE_STAR_RULE',
        target.name,
        `Deleted star rule: ${target.name}`
      );
    }
  },

  updateStarRuleFull: async (
    role: UserRole,
    id: string,
    updates: Partial<StarRuleItem>
  ): Promise<StarRuleItem> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can edit star rules');
    }
    const idx = starRulesStore.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Star rule not found');

    const updated = { ...starRulesStore[idx], ...updates };
    starRulesStore[idx] = updated;
    if (isSupabaseConfigured()) {
      await supabase.from('star_rules').upsert({
        id: updated.id,
        name: updated.name,
        condition: updated.condition,
        star_delta: updated.star_delta,
        is_active: updated.is_active,
        updated_at: new Date().toISOString(),
      });
    }

    dataService.logAction(
      'Super Admin',
      'admin',
      'EDIT_STAR_RULE',
      updated.name,
      `Modified rule: ${updated.condition} (${updated.star_delta > 0 ? `+${updated.star_delta}` : updated.star_delta} ⭐)`
    );
    return updated;
  },

  // 14. Manager Scope Assignment
  assignManagerScope: async (
    role: UserRole,
    managerId: string,
    teamName: string
  ): Promise<void> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can assign manager scopes');
    }
    dataService.logAction(
      'Super Admin',
      'admin',
      'ASSIGN_MANAGER_SCOPE',
      managerId,
      `Assigned operational team scope: ${teamName}`
    );
  },

  // =========================================================================
  // 15. Finance & Payroll (Admin Role Only)
  // =========================================================================
  getEmployeeSalaries: async (role: UserRole): Promise<EmployeeSalaryRecord[]> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can access Employee Salaries and Finance records.');
    }

    const key = 'stitch_payroll_records';

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('employee_salaries').select('*').order('employee_name');
      if (!error && data) {
        const mapped = data.map((r: any) => ({
          id: r.id,
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          email: r.email || '',
          department: r.department || '',
          team_name: r.team_name || '',
          base_salary: Number(r.base_salary) || 0,
          currency: r.currency || 'USD',
          pay_frequency: (r.pay_frequency || 'monthly') as EmployeeSalaryRecord['pay_frequency'],
          bonus_amount: Number(r.bonus_amount) || 0,
          deduction_amount: Number(r.deduction_amount) || 0,
          net_salary: Number(r.net_salary) || 0,
          payment_status: (r.payment_status || 'scheduled') as EmployeeSalaryRecord['payment_status'],
          next_pay_date: r.next_pay_date || '',
          bank_account_mask: r.bank_account_mask || '',
          last_payment_date: r.last_payment_date || '',
          notes: r.notes || '',
        })) as EmployeeSalaryRecord[];
        try {
          localStorage.setItem(key, JSON.stringify(mapped));
        } catch {
          /* ignore */
        }
        return mapped;
      }
    }

    let storedSalaries: EmployeeSalaryRecord[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) storedSalaries = JSON.parse(raw);
    } catch (e) {
      console.error('Error parsing stored salaries:', e);
    }

    // Strip known fake seed IDs if still present in old localStorage
    storedSalaries = storedSalaries.filter(
      (s) =>
        !['sal-001', 'sal-002', 'sal-003', 'sal-004', 'sal-005', 'sal-006', 'sal-007'].includes(s.id) &&
        !String(s.employee_id || '').startsWith('emp-')
    );
    try {
      localStorage.setItem(key, JSON.stringify(storedSalaries));
    } catch {
      /* ignore */
    }

    return storedSalaries;
  },

  updateEmployeeSalary: async (
    role: UserRole,
    recordId: string,
    updates: Partial<EmployeeSalaryRecord>
  ): Promise<EmployeeSalaryRecord> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can update employee salaries');
    }

    const key = 'stitch_payroll_records';
    const salaries = await dataService.getEmployeeSalaries('admin');
    const idx = salaries.findIndex((s) => s.id === recordId || s.employee_id === recordId);
    if (idx === -1) {
      throw new Error('Salary record not found');
    }

    const target = salaries[idx];
    const newBase = updates.base_salary !== undefined ? updates.base_salary : target.base_salary;
    const newBonus = updates.bonus_amount !== undefined ? updates.bonus_amount : target.bonus_amount;
    const newDeduct = updates.deduction_amount !== undefined ? updates.deduction_amount : target.deduction_amount;
    const newNet = Math.max(0, newBase + newBonus - newDeduct);

    const updated: EmployeeSalaryRecord = {
      ...target,
      ...updates,
      base_salary: newBase,
      bonus_amount: newBonus,
      deduction_amount: newDeduct,
      net_salary: newNet,
    };

    salaries[idx] = updated;
    localStorage.setItem(key, JSON.stringify(salaries));
    if (isSupabaseConfigured()) {
      await supabase.from('employee_salaries').upsert({ ...updated, updated_at: new Date().toISOString() });
    }

    dataService.logAction(
      'Super Admin',
      'admin',
      'UPDATE_SALARY',
      target.employee_name,
      `Updated compensation: Base $${newBase}, Net $${newNet} (${updated.payment_status})`
    );

    return updated;
  },

  addEmployeeSalary: async (
    role: UserRole,
    newSalary: Omit<EmployeeSalaryRecord, 'id'>
  ): Promise<EmployeeSalaryRecord> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can add employee salary records');
    }

    const key = 'stitch_payroll_records';
    const salaries = await dataService.getEmployeeSalaries('admin');
    const net = Math.max(0, newSalary.base_salary + (newSalary.bonus_amount || 0) - (newSalary.deduction_amount || 0));

    const record: EmployeeSalaryRecord = {
      ...newSalary,
      id: `sal-${Date.now()}`,
      net_salary: net,
    };

    salaries.push(record);
    localStorage.setItem(key, JSON.stringify(salaries));
    if (isSupabaseConfigured()) {
      await supabase.from('employee_salaries').upsert({ ...record, updated_at: new Date().toISOString() });
    }

    dataService.logAction(
      'Super Admin',
      'admin',
      'CREATE_SALARY_RECORD',
      newSalary.employee_name,
      `Configured salary $${newSalary.base_salary} ${newSalary.currency}`
    );

    return record;
  },

  // =========================================================================
  // 16. Confidential Direct Messages (Admin to Specific Employee ONLY)
  // =========================================================================
  sendConfidentialMessage: async (
    role: UserRole,
    msg: Omit<ConfidentialMessageItem, 'id' | 'sent_at' | 'is_read'>
  ): Promise<ConfidentialMessageItem> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can send private direct compensation messages to employees.');
    }

    const key = 'stitch_confidential_messages';
    let storedMessages: ConfidentialMessageItem[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) storedMessages = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    const newMsg: ConfidentialMessageItem = {
      ...msg,
      id: `cmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sent_at: new Date().toISOString(),
      is_read: false,
    };

    storedMessages.unshift(newMsg);
    localStorage.setItem(key, JSON.stringify(storedMessages));
    if (isSupabaseConfigured()) {
      await supabase.from('confidential_messages').upsert(newMsg);
    }

    dataService.logAction(
      'Super Admin',
      'admin',
      'SEND_CONFIDENTIAL_MESSAGE',
      msg.recipient_name,
      `Sent private direct message: "${msg.subject}" [Restricted exclusively to ${msg.recipient_name}]`
    );

    return newMsg;
  },

  getConfidentialMessages: async (
    role: UserRole,
    currentUserId: string,
    currentUserEmail?: string,
    _currentUserName?: string
  ): Promise<ConfidentialMessageItem[]> => {
    // SECURITY CONSTRAINT: Managers are strictly forbidden from viewing private employee messages
    if (role === 'manager') {
      return [];
    }

    const key = 'stitch_confidential_messages';
    let messages: ConfidentialMessageItem[] = [];

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('confidential_messages')
        .select('*')
        .order('sent_at', { ascending: false });
      if (!error && data) {
        messages = data.map((m: any) => ({
          id: m.id,
          recipient_id: m.recipient_id,
          recipient_name: m.recipient_name,
          recipient_email: m.recipient_email,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          sender_role: m.sender_role,
          subject: m.subject,
          message_body: m.message_body,
          salary_slip_reference: m.salary_slip_reference,
          sent_at: m.sent_at,
          is_read: Boolean(m.is_read),
          priority: m.priority || 'normal',
        }));
      }
    }

    if (!messages.length) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) messages = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
      // Drop legacy demo seed message
      messages = messages.filter((m) => m.id !== 'cmsg-init-01');
    }

    // Admin can review all confidential messages sent to employees
    if (role === 'admin') {
      return messages;
    }

    // Employee role: ONLY return messages addressed specifically to THIS employee
    if (role === 'employee') {
      return messages.filter((m) => {
        const idMatch = !!currentUserId && m.recipient_id === currentUserId;
        const emailMatch =
          !!currentUserEmail &&
          m.recipient_email?.toLowerCase() === currentUserEmail.toLowerCase();
        return idMatch || emailMatch;
      });
    }

    return [];
  },

  markConfidentialMessageRead: async (messageId: string): Promise<void> => {
    const key = 'stitch_confidential_messages';
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const messages: ConfidentialMessageItem[] = JSON.parse(raw);
      const updated = messages.map((m) => (m.id === messageId ? { ...m, is_read: true } : m));
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error('Error marking message read:', e);
    }
  },

  // =========================================================================
  // 17. Break Telemetry Preservation & Hourly Continuation (Supabase Bucket & Table)
  // =========================================================================
  saveBreakTelemetrySnapshot: async (params: {
    breakType: BreakType;
    employeeId?: string;
    employeeName?: string;
    heatmapData?: number[][];
    keyboardData?: number[][];
    timeSlot?: string;
    deviceId?: string;
  }): Promise<BreakTelemetrySnapshot> => {
    const employeeId = params.employeeId || '';
    const employeeName = params.employeeName || 'Employee';
    const breakType = params.breakType;

    const schedule = await dataService.getBreakScheduleConfig();
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    let slotName: string = params.timeSlot || breakTimeSlot(schedule.coffee);
    let slotIndex = timeSlots.indexOf(slotName);

    if (slotIndex < 0) {
      if (breakType === 'coffee') {
        slotName = breakTimeSlot(schedule.coffee);
        slotIndex = timeSlots.indexOf(slotName);
      } else if (breakType === 'namaz') {
        slotName = breakTimeSlot(schedule.zuhr);
        slotIndex = timeSlots.indexOf(slotName);
      } else {
        const curHour = new Date().getHours();
        slotName = `${curHour.toString().padStart(2, '0')}:00`;
        slotIndex = timeSlots.indexOf(slotName);
      }
      if (slotIndex < 0) {
        slotName = breakTimeSlot(schedule.coffee);
        slotIndex = Math.max(0, timeSlots.indexOf(slotName));
      }
    }

    const breakTitle =
      breakType === 'coffee'
        ? `${schedule.coffee.label} (${formatBreakRange(schedule.coffee)})`
        : breakType === 'namaz'
        ? `${schedule.zuhr.label} (${formatBreakRange(schedule.zuhr)})`
        : 'Authorized Recess Window';

    // Use only real live telemetry provided by the caller — never invent keystroke/heatmap values
    let liveKeys = params.keyboardData?.[0]?.[slotIndex];
    let liveHeat = params.heatmapData?.[0]?.[slotIndex];
    if (liveKeys == null || liveHeat == null) {
      try {
        const [keysRes, mouseRes] = await Promise.all([
          dataService.getLiveKeystrokeTelemetry('employee', employeeId, employeeId),
          dataService.getLiveMouseTelemetry('employee', employeeId, employeeId),
        ]);
        if (liveKeys == null) liveKeys = keysRes.hourlyKeysArray?.[slotIndex] ?? 0;
        if (liveHeat == null) liveHeat = mouseRes.hourlyIntensityArray?.[slotIndex] ?? 0;
      } catch {
        liveKeys = liveKeys ?? 0;
        liveHeat = liveHeat ?? 0;
      }
    }

    const preBreakKeys = Number(liveKeys) || 0;
    const preBreakHeatmap = Number(liveHeat) || 0;

    const hourlyState: BreakTelemetryHourlyState = {
      time_slot: slotName,
      slot_index: slotIndex,
      pre_break_keys: preBreakKeys,
      pre_break_heatmap_pct: preBreakHeatmap,
      post_break_keys: 0,
      post_break_heatmap_pct: 0,
      adjusted_total_keys: preBreakKeys,
      adjusted_heatmap_pct: preBreakHeatmap,
      hourly_delta_pct: 0,
    };

    const zeroRow = () => TELEMETRY_TIME_SLOTS.map(() => 0);
    const snapshot: BreakTelemetrySnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employee_id: employeeId,
      employee_name: employeeName,
      break_type: breakType,
      break_title: breakTitle,
      started_at: new Date().toISOString(),
      current_time_slot: slotName,
      time_slot_index: slotIndex,
      heatmap_data: params.heatmapData?.length ? params.heatmapData : [zeroRow()],
      keyboard_data: params.keyboardData?.length ? params.keyboardData : [zeroRow()],
      hourly_state: hourlyState,
      device_id: params.deviceId || '',
      status: 'active_break',
    };

    // 1. Upload to Supabase Storage Bucket ('screenshots/telemetry_snapshots') & Table ('activity_events')
    try {
      const syncResult = await supabaseSync.uploadBreakTelemetrySnapshot(snapshot);
      if (syncResult?.storagePath) {
        snapshot.storage_path = syncResult.storagePath;
        snapshot.bucket = syncResult.bucket;
      }
    } catch (err) {
      console.warn('Supabase cloud sync warning for break snapshot:', err);
    }

    // 2. Cache in local storage for instant responsiveness
    try {
      localStorage.setItem(`stitch_break_telemetry_${employeeId}`, JSON.stringify(snapshot));
      localStorage.setItem('stitch_active_break_snapshot', JSON.stringify(snapshot));
    } catch (e) {
      console.error(e);
    }

    // 3. Log into Audit Trail
    dataService.logAction(
      employeeName,
      'employee',
      'BREAK_TELEMETRY_SNAPSHOT',
      breakTitle,
      `Saved mouse heatmap (${preBreakHeatmap}%) and keyboard activity (${preBreakKeys} keys) to Supabase bucket 'screenshots' and 'activity_events' table`
    );

    // 4. Dispatch browser custom event for instant cross-component UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('stitch:telemetry_break_event', {
          detail: { action: 'saved', snapshot },
        })
      );
    }

    return snapshot;
  },

  resumeBreakTelemetry: async (params: {
    employeeId?: string;
    employeeName?: string;
    breakSeconds?: number;
    additionalKeys?: number;
    additionalHeatmapPct?: number;
  }): Promise<BreakTelemetrySnapshot | null> => {
    const employeeId = params.employeeId || '';
    const employeeName = params.employeeName || 'Employee';

    // Retrieve active snapshot
    let snapshot: BreakTelemetrySnapshot | null = null;
    try {
      const raw =
        localStorage.getItem(`stitch_break_telemetry_${employeeId}`) ||
        localStorage.getItem('stitch_active_break_snapshot');
      if (raw) snapshot = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    if (!snapshot) {
      snapshot = await supabaseSync.fetchLatestBreakSnapshot(employeeId);
    }

    if (!snapshot) {
      return null;
    }

    if (isSeedBreakKeyboardMatrix(snapshot.keyboard_data)) {
      snapshot.keyboard_data = [];
      snapshot.heatmap_data = [];
      if (snapshot.hourly_state) {
        snapshot.hourly_state.pre_break_keys = 0;
        snapshot.hourly_state.pre_break_heatmap_pct = 0;
      }
    }

    const breakDuration =
      typeof params.breakSeconds === 'number'
        ? params.breakSeconds
        : Math.max(60, Math.round((Date.now() - new Date(snapshot.started_at).getTime()) / 1000));

    // Calculate continuation on top of preserved state (zeros when unknown — never invent)
    const preBreakKeys = snapshot.hourly_state?.pre_break_keys ?? 0;
    const preBreakHeatmap = snapshot.hourly_state?.pre_break_heatmap_pct ?? 0;

    let postBreakKeys = typeof params.additionalKeys === 'number' ? params.additionalKeys : 0;
    let postBreakHeatmap =
      typeof params.additionalHeatmapPct === 'number' ? params.additionalHeatmapPct : 0;
    if (typeof params.additionalKeys !== 'number') {
      try {
        const keysRes = await dataService.getLiveKeystrokeTelemetry('employee', employeeId, employeeId);
        const slotIdx = snapshot.time_slot_index ?? 2;
        const liveNow = keysRes.hourlyKeysArray?.[slotIdx] ?? 0;
        postBreakKeys = Math.max(0, liveNow - preBreakKeys);
      } catch {
        postBreakKeys = 0;
      }
    }

    const adjustedTotalKeys = preBreakKeys + postBreakKeys;
    const adjustedHeatmap = Math.min(100, Number((preBreakHeatmap + postBreakHeatmap).toFixed(1)));
    const hourlyDelta = Number((adjustedHeatmap - preBreakHeatmap).toFixed(1));

    snapshot.status = 'resumed';
    snapshot.resumed_at = new Date().toISOString();
    snapshot.break_duration_seconds = breakDuration;
    snapshot.hourly_state = {
      ...snapshot.hourly_state,
      post_break_keys: postBreakKeys,
      post_break_heatmap_pct: postBreakHeatmap,
      adjusted_total_keys: adjustedTotalKeys,
      adjusted_heatmap_pct: adjustedHeatmap,
      hourly_delta_pct: hourlyDelta,
    };

    // Update cell values in matrices to reflect resumed continuation
    const sIdx = snapshot.time_slot_index;
    if (snapshot.heatmap_data && snapshot.heatmap_data[0] && snapshot.heatmap_data[0][sIdx] !== undefined) {
      snapshot.heatmap_data[0][sIdx] = adjustedHeatmap;
    }
    if (snapshot.keyboard_data && snapshot.keyboard_data[0] && snapshot.keyboard_data[0][sIdx] !== undefined) {
      snapshot.keyboard_data[0][sIdx] = adjustedTotalKeys;
    }

    // 1. Persist Resumption into Supabase Table ('activity_events')
    try {
      await supabaseSync.resumeBreakTelemetrySnapshot({
        employeeId: snapshot.employee_id,
        snapshotId: snapshot.id,
        employeeName: snapshot.employee_name,
        breakType: snapshot.break_type,
        breakDurationSeconds: breakDuration,
        resumedAt: snapshot.resumed_at,
        timeSlot: snapshot.current_time_slot,
        timeSlotIndex: snapshot.time_slot_index,
        resumedState: snapshot.hourly_state,
      });
    } catch (err) {
      console.warn('Supabase resumption sync warning:', err);
    }

    // 2. Update local storage cache
    try {
      localStorage.setItem(`stitch_break_telemetry_${employeeId}`, JSON.stringify(snapshot));
      localStorage.setItem('stitch_active_break_snapshot', JSON.stringify(snapshot));
    } catch (e) {
      console.error(e);
    }

    // 3. Log Audit Trail
    dataService.logAction(
      employeeName,
      'employee',
      'BREAK_TELEMETRY_RESUMED',
      snapshot.break_title,
      `Break ended (${Math.round(breakDuration / 60)}m): Resumed telemetry at ${snapshot.current_time_slot} continuing from last state (${preBreakKeys} keys + ${postBreakKeys} resumed = ${adjustedTotalKeys} total, ${adjustedHeatmap}% intensity)`
    );

    // 4. Dispatch browser event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('stitch:telemetry_break_event', {
          detail: { action: 'resumed', snapshot },
        })
      );
    }

    return snapshot;
  },

  getLatestBreakTelemetry: async (employeeId?: string): Promise<BreakTelemetrySnapshot | null> => {
    const id = employeeId || '';
    try {
      const raw =
        (id && localStorage.getItem(`stitch_break_telemetry_${id}`)) ||
        localStorage.getItem('stitch_active_break_snapshot');
      if (raw) {
        const parsed = JSON.parse(raw) as BreakTelemetrySnapshot;
        if (isSeedBreakKeyboardMatrix(parsed.keyboard_data)) {
          localStorage.removeItem('stitch_active_break_snapshot');
          if (id) localStorage.removeItem(`stitch_break_telemetry_${id}`);
        } else {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (!id) return null;
    const remote = await supabaseSync.fetchLatestBreakSnapshot(id);
    if (remote && isSeedBreakKeyboardMatrix(remote.keyboard_data)) return null;
    return remote;
  },

  subscribeToBreakTelemetry: (
    callback: (snapshot: BreakTelemetrySnapshot | null, action: 'saved' | 'resumed' | 'sync') => void
  ) => {
    if (typeof window === 'undefined') return () => {};

    const handler = (e: any) => {
      if (e.detail?.snapshot) {
        callback(e.detail.snapshot, e.detail.action || 'sync');
      }
    };

    window.addEventListener('stitch:telemetry_break_event', handler);

    // Also listen to Supabase realtime postgres_changes on activity_events
    const unsubscribeSupabase = dataService.subscribeToRealtime((payload) => {
      if (
        payload.table === 'activity_events' &&
        (payload.new?.event_type === 'BREAK_TELEMETRY_SNAPSHOT' ||
          payload.new?.event_type === 'BREAK_TELEMETRY_RESUMED')
      ) {
        const meta = payload.new.metadata || {};
        const snap: BreakTelemetrySnapshot = {
          id: meta.snapshot_id || payload.new.id,
          employee_id: payload.new.employee_id,
          employee_name: meta.employee_name || 'Employee',
          break_type: meta.break_type || 'coffee',
          break_title: meta.break_title || 'Break Window',
          started_at: payload.new.occurred_at,
          resumed_at: meta.resumed_at,
          break_duration_seconds: meta.break_duration_seconds,
          current_time_slot: meta.current_time_slot || '11:00',
          time_slot_index: meta.time_slot_index ?? 2,
          heatmap_data: meta.heatmap_data || [],
          keyboard_data: meta.keyboard_data || [],
          hourly_state: meta.hourly_state || {
            time_slot: meta.current_time_slot || '11:00',
            slot_index: meta.time_slot_index ?? 2,
            pre_break_keys: 0,
            pre_break_heatmap_pct: 0,
          },
          status: payload.new.event_type === 'BREAK_TELEMETRY_RESUMED' ? 'resumed' : 'active_break',
        };
        callback(snap, payload.new.event_type === 'BREAK_TELEMETRY_RESUMED' ? 'resumed' : 'saved');
      }
    });

    return () => {
      window.removeEventListener('stitch:telemetry_break_event', handler);
      unsubscribeSupabase();
    };
  },

  /** Org-wide coffee & prayer break windows (admin editable). */
  getBreakScheduleConfig: async (): Promise<BreakScheduleConfig> => {
    const cached = loadBreakScheduleFromLocal();
    if (cached) breakScheduleStore = cached;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('break_schedule_config')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) {
          breakScheduleStore = mergeBreakSchedule({
            coffee: {
              enabled: data.coffee_enabled ?? true,
              label: data.coffee_label || DEFAULT_BREAK_SCHEDULE.coffee.label,
              start_time: normalizeBreakTime(data.coffee_start) || DEFAULT_BREAK_SCHEDULE.coffee.start_time,
              end_time: normalizeBreakTime(data.coffee_end) || DEFAULT_BREAK_SCHEDULE.coffee.end_time,
            },
            zuhr: {
              enabled: data.zuhr_enabled ?? true,
              label: data.zuhr_label || DEFAULT_BREAK_SCHEDULE.zuhr.label,
              start_time: normalizeBreakTime(data.zuhr_start) || DEFAULT_BREAK_SCHEDULE.zuhr.start_time,
              end_time: normalizeBreakTime(data.zuhr_end) || DEFAULT_BREAK_SCHEDULE.zuhr.end_time,
            },
            asr: {
              enabled: data.asr_enabled ?? true,
              label: data.asr_label || DEFAULT_BREAK_SCHEDULE.asr.label,
              start_time: normalizeBreakTime(data.asr_start) || DEFAULT_BREAK_SCHEDULE.asr.start_time,
              end_time: normalizeBreakTime(data.asr_end) || DEFAULT_BREAK_SCHEDULE.asr.end_time,
            },
            updated_at: data.updated_at,
          });
          persistBreakScheduleLocal(breakScheduleStore);
        }
      } catch (e) {
        console.warn('break_schedule_config read failed; using local/default:', e);
      }
    }

    return mergeBreakSchedule(breakScheduleStore);
  },

  updateBreakScheduleConfig: async (
    role: UserRole,
    config: BreakScheduleConfig
  ): Promise<BreakScheduleConfig> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can configure break schedules');
    }

    const next = mergeBreakSchedule({ ...config, updated_at: new Date().toISOString() });
    breakScheduleStore = next;
    persistBreakScheduleLocal(next);

    if (isSupabaseConfigured()) {
      const payload = {
        id: 1,
        coffee_enabled: next.coffee.enabled,
        coffee_label: next.coffee.label,
        coffee_start: `${next.coffee.start_time}:00`,
        coffee_end: `${next.coffee.end_time}:00`,
        zuhr_enabled: next.zuhr.enabled,
        zuhr_label: next.zuhr.label,
        zuhr_start: `${next.zuhr.start_time}:00`,
        zuhr_end: `${next.zuhr.end_time}:00`,
        asr_enabled: next.asr.enabled,
        asr_label: next.asr.label,
        asr_start: `${next.asr.start_time}:00`,
        asr_end: `${next.asr.end_time}:00`,
        updated_at: next.updated_at,
      };

      const { error } = await supabase.from('break_schedule_config').upsert(payload, { onConflict: 'id' });
      if (error) {
        throw new Error(
          error.message.includes('schema cache') || error.code === '42P01'
            ? 'Run supabase/migrations/008_break_schedule_config.sql in the Supabase SQL editor first.'
            : error.message
        );
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('stitch:break_schedule_updated'));
    } catch {
      /* non-browser */
    }

    return mergeBreakSchedule(breakScheduleStore);
  },

  /** Global office-hours policy for desktop agents (agent_runtime_config). */
  getAgentRuntimeConfig: async (): Promise<AgentRuntimeConfig> => {
    const { data, error } = await supabase
      .from('agent_runtime_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_AGENT_RUNTIME_CONFIG };
    }

    return {
      id: data.id ?? 1,
      enabled: data.enabled ?? true,
      work_start: normalizeTimeHHMM(data.work_start) || '09:00',
      work_end: normalizeTimeHHMM(data.work_end) || '17:00',
      work_days: Array.isArray(data.work_days) && data.work_days.length
        ? data.work_days.map((d: string) => String(d).toLowerCase())
        : [...DEFAULT_AGENT_RUNTIME_CONFIG.work_days],
      capture_outside_hours: Boolean(data.capture_outside_hours),
      timezone_note: data.timezone_note || DEFAULT_AGENT_RUNTIME_CONFIG.timezone_note,
      updated_at: data.updated_at,
    };
  },

  updateAgentRuntimeConfig: async (
    role: UserRole,
    config: AgentRuntimeConfig
  ): Promise<AgentRuntimeConfig> => {
    if (role !== 'admin') {
      throw new Error('403 Forbidden: Only Admin can change office-hours policy');
    }

    const payload = {
      id: 1,
      enabled: config.enabled,
      work_start: toPgTime(config.work_start),
      work_end: toPgTime(config.work_end),
      work_days: config.work_days,
      capture_outside_hours: config.capture_outside_hours,
      timezone_note: config.timezone_note || DEFAULT_AGENT_RUNTIME_CONFIG.timezone_note,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('agent_runtime_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message.includes('schema cache') || error.code === '42P01'
          ? 'Run supabase/migrations/006_agent_office_hours.sql in the Supabase SQL editor first.'
          : error.message
      );
    }

    return {
      id: data?.id ?? 1,
      enabled: data?.enabled ?? payload.enabled,
      work_start: normalizeTimeHHMM(data?.work_start ?? payload.work_start) || '09:00',
      work_end: normalizeTimeHHMM(data?.work_end ?? payload.work_end) || '17:00',
      work_days: data?.work_days ?? payload.work_days,
      capture_outside_hours: data?.capture_outside_hours ?? payload.capture_outside_hours,
      timezone_note: data?.timezone_note ?? payload.timezone_note,
      updated_at: data?.updated_at ?? payload.updated_at,
    };
  },
};

function normalizeTimeHHMM(raw: string | null | undefined): string {
  if (!raw) return '';
  const parts = String(raw).trim().split(':');
  if (parts.length < 2) return '';
  const h = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
}

function toPgTime(hhmm: string): string {
  const n = normalizeTimeHHMM(hhmm) || '09:00';
  return `${n}:00`;
}


