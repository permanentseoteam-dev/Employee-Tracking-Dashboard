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
} from '../types/roles';
import type { AgentRuntimeConfig } from '../types';
import { DEFAULT_AGENT_RUNTIME_CONFIG } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { supabaseSync } from './supabaseService';
import { generateWorkstationRecordingClip } from '../utils/screenRecordingGenerator';
import { formatCaptureTime, isDummyMediaUrl, parseCaptureDate } from '../utils/datetime';


export const ADMIN_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export const isAdminRecord = (id?: string, name?: string, email?: string): boolean => {
  if (!id && !name && !email) return false;
  if (id === ADMIN_USER_ID) return true;
  if (email && (email.toLowerCase().includes('admin') || email.toLowerCase() === 'arsal.admin@company.com')) return true;
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

let localAuditLogs: AuditLogItem[] = [];
const employeeStarsMap = new Map<string, number>();

/** In-memory cache of recordings created in this session only (no seed/dummy clips). */
let screenRecordingsStore: ScreenRecordingItem[] = [];

let customTeamsStore: TeamRecord[] = [
  {
    id: 'team-backend',
    name: 'Core Backend Team',
    department: 'Engineering',
    manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    manager_name: 'Arsal',
    member_count: 1,
    active_count: 1,
    attendance_rate: 100,
    project_ids: ['proj-01'],
  },
  {
    id: 'team-frontend',
    name: 'UI & Web Architecture',
    department: 'Frontend',
    manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    manager_name: 'Arsal',
    member_count: 1,
    active_count: 1,
    attendance_rate: 100,
    project_ids: ['proj-02'],
  },
  {
    id: 'team-mobile',
    name: 'Mobile & Cloud Infrastructure',
    department: 'Mobile',
    manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    manager_name: 'Arsal',
    member_count: 1,
    active_count: 1,
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
        supabase.from('activity_aggregates').select('*').order('window_end', { ascending: false }),
        supabase.from('activity_events').select('*').order('occurred_at', { ascending: false }).limit(100),
        supabase.from('screenshot_records').select('*').order('captured_at', { ascending: false }).limit(50),
        supabase.from('screenshots').select('*').order('captured_at', { ascending: false }).limit(50),
        supabase.from('tasks').select('*').eq('status', 'in_progress'),
        supabase.from('users').select('id, full_name, email').eq('role', 'manager'),
        supabase.from('employee_star_balances').select('employee_id, stars'),
      ]);

      let filteredEmpRows = empRes.data || [];

      // When role === 'manager', strictly filter out any admin user or manager self-records
      if (role === 'manager') {
        filteredEmpRows = filteredEmpRows.filter((e: any) =>
          !isAdminRecord(e.id, e.full_name, e.email) &&
          !isAdminRecord(e.user_id, e.full_name, e.email) &&
          e.role !== 'admin' &&
          (managerId ? e.id !== managerId && e.user_id !== managerId : true)
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

        // 3. Daily Aggregate Telemetry (Keys, Mouse, Active Time, Idle Time)
        const empAggregates = aggregateRows.filter((a: any) => isMatchingEmp(a.employee_id));
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

        // 6. Presence Status Calculation
        let status: 'active' | 'idle' | 'offline' | 'on_break' = 'offline';
        let firstActivity = '—';

        if (presence) {
          status = (presence.status as any) || 'offline';
          if (presence.last_activity_at) {
            const d = new Date(presence.last_activity_at);
            firstActivity = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } else if (e.status) {
          status = e.status;
        } else if (latestEvent || totalActiveSecs > 0) {
          status = 'active';
        }

        return {
          id: e.id,
          name: e.full_name || e.email || 'Unknown employee',
          email: e.email || '',
          department: e.department || 'Unassigned',
          team_id: e.team_id || '',
          team_name: e.department ? `${e.department} Team` : 'Unassigned',
          manager_id: e.manager_id || '',
          manager_name: mgr?.full_name || 'Unassigned',
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
      manager_name: employeeData.manager_name || 'Alex Vance',
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
          name: m.full_name || 'Manager',
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
      manager_name: teamData.manager_name || 'Arsal (Manager)',
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
    filterEmployeeId?: string
  ): Promise<{ success: boolean; deleted: number; message: string }> => {
    const items = await dataService.getScreenshots(role, managerId, filterEmployeeId);
    if (items.length === 0) {
      return { success: true, deleted: 0, message: 'No screenshots to delete.' };
    }

    let deleted = 0;
    const paths = items.map((s) => s.file_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from('screenshots').remove(paths);
      if (storageErr) console.warn('Bulk storage delete warning:', storageErr.message);
    }

    for (const item of items) {
      try {
        if (item.id) {
          await supabase.from('screenshot_records').delete().eq('id', item.id);
          await supabase.from('screenshots').delete().eq('id', item.id);
        }
        if (item.file_path) {
          await supabase.from('screenshot_records').delete().eq('storage_path', item.file_path);
          await supabase.from('screenshots').delete().eq('storage_path', item.file_path);
        }
        deleted += 1;
      } catch (e) {
        console.warn('Failed deleting screenshot row', item.id, e);
      }
    }

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
          employeeId === 'cccccccc-cccc-cccc-cccc-cccccccccccc' ? 'Arsal' : 'Employee',
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
    employeeId?: string
  ): Promise<{
    byHour: Record<string, number>;
    totalKeys: number;
    hourlyKeysArray: number[];
  }> => {
    if (!isSupabaseConfigured()) {
      return { byHour: {}, totalKeys: 0, hourlyKeysArray: [] };
    }
    try {
      const { data: aggs } = await supabase
        .from('activity_aggregates')
        .select('window_start, key_press_count, employee_id')
        .order('window_start', { ascending: true });

      const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      const byHour: Record<string, number> = {};
      let totalKeys = 0;

      for (const slot of timeSlots) {
        byHour[slot] = 0;
      }

      for (const a of aggs || []) {
        if (role === 'manager') {
          if (a.employee_id === ADMIN_USER_ID || isAdminRecord(a.employee_id)) {
            continue;
          }
        }
        if (employeeId && employeeId !== 'all' && a.employee_id !== employeeId) {
          continue;
        }

        const keys = Number(a.key_press_count) || 0;
        totalKeys += keys;

        if (a.window_start) {
          const date = new Date(a.window_start);
          const hour = date.getHours();
          const slotStr = `${hour.toString().padStart(2, '0')}:00`;
          if (byHour[slotStr] !== undefined) {
            byHour[slotStr] += keys;
          } else {
            const mappedSlot = timeSlots.find((s) => Number(s.split(':')[0]) === hour) || '09:00';
            byHour[mappedSlot] = (byHour[mappedSlot] || 0) + keys;
          }
        }
      }

      const hourlyKeysArray = timeSlots.map((s) => byHour[s] || 0);
      return { byHour, totalKeys, hourlyKeysArray };
    } catch (e) {
      console.warn('Failed to fetch live keystroke telemetry:', e);
      return { byHour: {}, totalKeys: 0, hourlyKeysArray: [] };
    }
  },

  // 5f. Real-time Mouse Telemetry Stream from Supabase activity_aggregates
  getLiveMouseTelemetry: async (
    role?: UserRole,
    employeeId?: string
  ): Promise<{
    byHour: Record<string, { moves: number; clicks: number; intensityPct: number }>;
    totalMoves: number;
    totalClicks: number;
    hourlyIntensityArray: number[];
  }> => {
    if (!isSupabaseConfigured()) {
      return { byHour: {}, totalMoves: 0, totalClicks: 0, hourlyIntensityArray: [] };
    }
    try {
      const { data: aggs } = await supabase
        .from('activity_aggregates')
        .select('window_start, mouse_move_count, mouse_click_count, active_seconds, employee_id')
        .order('window_start', { ascending: true });

      const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      const byHour: Record<string, { moves: number; clicks: number; intensityPct: number }> = {};
      let totalMoves = 0;
      let totalClicks = 0;

      for (const slot of timeSlots) {
        byHour[slot] = { moves: 0, clicks: 0, intensityPct: 0 };
      }

      for (const a of aggs || []) {
        if (role === 'manager') {
          if (a.employee_id === ADMIN_USER_ID || isAdminRecord(a.employee_id)) {
            continue;
          }
        }
        if (employeeId && employeeId !== 'all' && a.employee_id !== employeeId) {
          continue;
        }

        const moves = Number(a.mouse_move_count) || 0;
        const clicks = Number(a.mouse_click_count) || 0;
        totalMoves += moves;
        totalClicks += clicks;

        if (a.window_start) {
          const date = new Date(a.window_start);
          const hour = date.getHours();
          const slotStr = `${hour.toString().padStart(2, '0')}:00`;
          const targetSlot = byHour[slotStr] ? slotStr : (timeSlots.find((s) => Number(s.split(':')[0]) === hour) || '09:00');
          byHour[targetSlot].moves += moves;
          byHour[targetSlot].clicks += clicks;
          const pct = Math.min(98, Math.round(((byHour[targetSlot].moves + byHour[targetSlot].clicks * 5) / 1200) * 100));
          byHour[targetSlot].intensityPct = Math.max(byHour[targetSlot].intensityPct, pct);
        }
      }

      const hourlyIntensityArray = timeSlots.map((s) => byHour[s]?.intensityPct || 0);
      return { byHour, totalMoves, totalClicks, hourlyIntensityArray };
    } catch (e) {
      console.warn('Failed to fetch live mouse telemetry:', e);
      return { byHour: {}, totalMoves: 0, totalClicks: 0, hourlyIntensityArray: [] };
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
            candId === e.id ||
            candId === e.user_id ||
            (e.full_name?.toLowerCase().includes('arsal') &&
              (candId === 'cccccccc-cccc-cccc-cccc-cccccccccccc' || candId === 'd9b4bfb3-9953-522d-84af-3de709e7caa8'));
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
            team_name: 'Core Backend Team',
            manager_name: 'Alex Vance',
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
      } else if (role === 'employee' && _employeeId) {
        projRows = allProjects.filter((p: any) => {
          const tasks = p.tasks || [];
          return tasks.some((t: any) => t.assigned_to === _employeeId);
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

        let scopeType: 'manager_owned' | 'employee_activity' | 'organization' = 'organization';
        if (role === 'manager') {
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
    if (role !== 'admin' && role !== 'manager') {
      throw new Error('403 Forbidden: Cannot create project');
    }

    const newProj = {
      name: project.name,
      description: project.code || '',
      status: project.status || 'active',
      manager_id: role === 'manager' ? (managerId || project.manager_id) : project.manager_id,
      organization_id: '00000000-0000-0000-0000-000000000001',
    };

    const { data, error } = await supabase.from('projects').insert([newProj]).select().single();
    if (error) throw error;

    return {
      ...project,
      id: data.id,
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
              upBy === 'admin' ||
              upBy.includes('arsal (admin)');
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

  // 8. Tasks Query & Mutations
  getTasks: async (role: UserRole, managerId?: string, employeeId?: string): Promise<TaskItem[]> => {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase.from('tasks').select('*, projects(*), employees(*)');
      
      if (role === 'manager' && managerId) {
        query = query.eq('projects.manager_id', managerId);
      } else if (role === 'employee' && employeeId) {
        query = query.or(`assigned_to.eq.${employeeId},assigned_to.eq.cccccccc-cccc-cccc-cccc-cccccccccccc`);
      }

      const { data: taskRows, error } = await query;
      if (error) throw error;
      if (!taskRows) return [];

      let cleanTaskRows = taskRows;
      if (role === 'manager') {
        cleanTaskRows = taskRows.filter((t: any) =>
          t.assigned_to !== ADMIN_USER_ID &&
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
          project_id: t.project_id || '44444444-4444-4444-4444-444444444444',
          project_name: t.projects?.name || 'Desktop Agent v2',
          employee_id: t.assigned_to || 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          employee_name: t.employees?.full_name || 'Arsal',
          manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          priority: (t.priority as any) || 'medium',
          status,
          tracked_seconds: (t.estimated_hours || 8) * 3600,
          due_date: '2026-10-15',
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
    const newTask = {
      project_id: task.project_id || '44444444-4444-4444-4444-444444444444',
      title: task.title,
      description: '',
      assigned_to: task.employee_id || 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
      manager_id: role === 'manager' ? (managerId || task.manager_id) : task.manager_id,
    };
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
          actor_name: ev.metadata?.actor || 'Arsal (Agent)',
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
    details: string
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
      supabase
        .from('activity_events')
        .insert([
          {
            employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
        teamAttendanceRate: 100,
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
    const employeeId = params.employeeId || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const employeeName = params.employeeName || 'Arsal';
    const breakType = params.breakType;

    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    let slotName: string = params.timeSlot || '11:00';
    let slotIndex = timeSlots.indexOf(slotName);

    if (slotIndex < 0) {
      if (breakType === 'coffee') {
        slotName = '11:00';
        slotIndex = 2;
      } else if (breakType === 'namaz') {
        slotName = '13:00';
        slotIndex = 4;
      } else {
        const curHour = new Date().getHours();
        slotName = `${curHour.toString().padStart(2, '0')}:00`;
        slotIndex = timeSlots.indexOf(slotName);
        if (slotIndex < 0) {
          slotName = '11:00';
          slotIndex = 2;
        }
      }
    }


    const breakTitle =
      breakType === 'coffee'
        ? 'Coffee Break (11:00 – 11:30 AM)'
        : breakType === 'namaz'
        ? 'Zuhr Namaz & Lunch (01:00 – 02:00 PM)'
        : 'Authorized Recess Window';

    // Baseline telemetry values for slot
    const defaultHeatmapVal = breakType === 'coffee' ? 89.3 : 72.1;
    const defaultKeysVal = breakType === 'coffee' ? 3036 : 2451;

    const preBreakHeatmap = params.heatmapData?.[0]?.[slotIndex] ?? defaultHeatmapVal;
    const preBreakKeys = params.keyboardData?.[0]?.[slotIndex] ?? defaultKeysVal;

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

    const snapshot: BreakTelemetrySnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employee_id: employeeId,
      employee_name: employeeName,
      break_type: breakType,
      break_title: breakTitle,
      started_at: new Date().toISOString(),
      current_time_slot: slotName,
      time_slot_index: slotIndex,
      heatmap_data: params.heatmapData || [
        [60.5, 86.7, 89.3, 92.7, 72.1, 70.1, 94.9, 87.6],
        [11.6, 65.6, 81.8, 74.6, 62.5, 57.4, 82.8, 70.3],
        [18.6, 67.6, 83.9, 74.3, 60.1, 58.4, 83.0, 72.8],
        [18.5, 65.4, 78.7, 70.8, 60.6, 52.7, 81.9, 64.4],
        [32.1, 67.2, 84.7, 75.5, 61.1, 57.4, 89.3, 70.3],
        [75.5, 92.3, 93.9, 97.3, 75.2, 92.6, 97.8, 93.0],
        [67.8, 90.8, 92.3, 95.4, 74.3, 88.2, 96.7, 92.2],
        [71.6, 92.2, 92.8, 96.9, 75.1, 92.8, 97.5, 93.1],
      ],
      keyboard_data: params.keyboardData || [
        [2057, 2948, 3036, 3152, 2451, 2383, 3226, 2978],
        [394,  2230, 2781, 2536, 2125, 1951, 2815, 2390],
        [632,  2298, 2852, 2526, 2043, 1985, 2822, 2475],
        [629,  2223, 2675, 2407, 2060, 1791, 2784, 2189],
        [1091, 2284, 2879, 2567, 2077, 1951, 3036, 2390],
        [2567, 3138, 3192, 3308, 2556, 3148, 3325, 3162],
        [2305, 3087, 3138, 3243, 2526, 2998, 3287, 3134],
        [2434, 3134, 3155, 3294, 2553, 3155, 3315, 3165],
      ],
      hourly_state: hourlyState,
      device_id: params.deviceId || 'WIN-DESKTOP-QUVQI4B-ok',
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
    const employeeId = params.employeeId || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const employeeName = params.employeeName || 'Arsal';

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
      // Fallback starter snapshot if none existed
      snapshot = {
        id: `snap-${Date.now()}`,
        employee_id: employeeId,
        employee_name: employeeName,
        break_type: 'coffee',
        break_title: 'Coffee Break (11:00 – 11:30 AM)',
        started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        current_time_slot: '11:00',
        time_slot_index: 2,
        heatmap_data: [],
        keyboard_data: [],
        hourly_state: {
          time_slot: '11:00',
          slot_index: 2,
          pre_break_keys: 1520,
          pre_break_heatmap_pct: 46.5,
        },
        status: 'active_break',
      };
    }

    const breakDuration =
      typeof params.breakSeconds === 'number'
        ? params.breakSeconds
        : Math.max(60, Math.round((Date.now() - new Date(snapshot.started_at).getTime()) / 1000));

    // Calculate continuation on top of preserved state
    const preBreakKeys = snapshot.hourly_state?.pre_break_keys || 1520;
    const preBreakHeatmap = snapshot.hourly_state?.pre_break_heatmap_pct || 46.5;

    // Subsequent work continues seamlessly from preserved state
    const postBreakKeys = typeof params.additionalKeys === 'number' ? params.additionalKeys : 1516;
    const postBreakHeatmap = typeof params.additionalHeatmapPct === 'number' ? params.additionalHeatmapPct : 42.8;

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
    const id = employeeId || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    try {
      const raw =
        localStorage.getItem(`stitch_break_telemetry_${id}`) ||
        localStorage.getItem('stitch_active_break_snapshot');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    return await supabaseSync.fetchLatestBreakSnapshot(id);
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
          employee_name: meta.employee_name || 'Arsal',
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
            pre_break_keys: 1520,
            pre_break_heatmap_pct: 46.5,
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


