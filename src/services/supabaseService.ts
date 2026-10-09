import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import type { BreakTelemetrySnapshot, UserRole } from '../types/roles';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  team_id?: string;
  team_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface ActivityPayload {
  employee_id: string;
  device_id: string;
  window_start: string;
  window_end: string;
  key_press_count: number;
  mouse_move_count: number;
  mouse_click_count: number;
  active_seconds: number;
  idle_seconds: number;
  is_idle: boolean;
}

export interface AttendancePayload {
  employee_id: string;
  device_id: string;
  date: string;
  first_activity_at: string;
  event_type: 'punch_in' | 'punch_out' | 'break_start' | 'break_end';
  status?: string;
}

export interface TaskSessionPayload {
  task_id?: string;
  task_title: string;
  project_name?: string;
  employee_id: string;
  start_time: string;
  end_time?: string;
  total_seconds: number;
  break_seconds?: number;
  status: string;
}

export const supabaseAuth = {
  isConfigured: isSupabaseConfigured,

  signIn: async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signUp: async (email: string, password: string, fullName: string, role: UserRole = 'employee') => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: async (): Promise<Session | null> => {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  getUser: async (): Promise<User | null> => {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  getProfile: async (userId: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Could not fetch user profile from Supabase:', error.message);
      return null;
    }
    return data as UserProfile;
  },

  /**
   * Upsert profile for any role into public.profiles (+ users / employees mirrors).
   * Creates the row when missing so demo and signed-in users both persist.
   */
  upsertProfile: async (params: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    department?: string;
    team_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    team_id?: string | null;
  }): Promise<UserProfile> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured');
    }
    const now = new Date().toISOString();
    const row = {
      id: params.id,
      email: params.email.trim(),
      full_name: params.full_name.trim(),
      role: params.role,
      department: (params.department || 'General').trim(),
      team_name: params.team_name?.trim() || null,
      phone: params.phone?.trim() || null,
      avatar_url: params.avatar_url || null,
      team_id: params.team_id || null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Mirror into users table (ignore if schema differs)
    try {
      await supabase.from('users').upsert(
        {
          id: params.id,
          email: row.email,
          full_name: row.full_name,
          role: params.role,
          department: row.department,
          avatar_url: row.avatar_url,
          team_name: row.team_name,
          phone: row.phone,
        },
        { onConflict: 'id' }
      );
    } catch (e) {
      console.warn('users mirror skipped:', e);
    }

    // Employees table — employees + managers often have rows here
    if (params.role === 'employee' || params.role === 'manager' || params.role === 'project_manager') {
      try {
        const { data: existing } = await supabase
          .from('employees')
          .select('id')
          .or(`id.eq.${params.id},user_id.eq.${params.id}`)
          .maybeSingle();
        if (existing?.id) {
          await supabase
            .from('employees')
            .update({
              full_name: row.full_name,
              email: row.email,
              department: row.department,
              avatar_url: row.avatar_url,
              phone: row.phone,
              team_name: row.team_name,
              updated_at: now,
            })
            .eq('id', existing.id);
        }
      } catch (e) {
        console.warn('employees mirror skipped:', e);
      }
    }

    return data as UserProfile;
  },

  /** Upload avatar image bytes to the public `avatars` bucket; returns public URL. */
  uploadAvatar: async (userId: string, fileOrDataUrl: File | string): Promise<string> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured');
    }

    let blob: Blob;
    let ext = 'jpg';
    let contentType = 'image/jpeg';

    if (typeof fileOrDataUrl === 'string') {
      if (!fileOrDataUrl.startsWith('data:')) {
        // Already a remote URL — keep as-is
        return fileOrDataUrl;
      }
      const match = fileOrDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid image data');
      contentType = match[1];
      ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: contentType });
    } else {
      blob = fileOrDataUrl;
      contentType = fileOrDataUrl.type || 'image/jpeg';
      ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    }

    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Failed to resolve avatar public URL');
    return data.publicUrl;
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },
};

export const resolveSafeEmployeeId = (employeeId?: string): string => {
  if (!employeeId || employeeId.trim() === '' || employeeId === 'undefined' || employeeId === 'null') {
    return 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(employeeId)) {
    return 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  }
  return employeeId;
};

export const supabaseSync = {
  // Sync an activity aggregate window
  syncActivityWindow: async (payload: ActivityPayload) => {
    if (!isSupabaseConfigured()) return false;
    const safePayload = {
      ...payload,
      employee_id: resolveSafeEmployeeId(payload.employee_id),
    };
    const { error } = await supabase.from('activity_aggregates').insert([safePayload]);
    if (error) {
      console.error('Failed to sync activity to Supabase:', error);
      throw error;
    }
    return true;
  },

  // Sync an attendance record punch
  syncAttendance: async (payload: AttendancePayload) => {
    if (!isSupabaseConfigured()) return false;
    const safePayload = {
      ...payload,
      employee_id: resolveSafeEmployeeId(payload.employee_id),
    };
    const { error } = await supabase.from('attendance_records').insert([safePayload]);
    if (error) {
      console.error('Failed to sync attendance to Supabase:', error);
      throw error;
    }
    return true;
  },

  // Sync a task work session
  syncTaskSession: async (payload: TaskSessionPayload) => {
    if (!isSupabaseConfigured()) return false;
    const safePayload = {
      ...payload,
      employee_id: resolveSafeEmployeeId(payload.employee_id),
    };
    const { error } = await supabase.from('task_sessions').insert([safePayload]);
    if (error) {
      console.error('Failed to sync task session to Supabase:', error);
      throw error;
    }
    return true;
  },

  // Upload screenshot binary/blob to Supabase Storage
  uploadScreenshot: async (
    fileBlob: Blob,
    employeeId: string,
    deviceId: string,
    capturedAt: string,
    width: number = 1920,
    height: number = 1080
  ) => {
    if (!isSupabaseConfigured()) return null;

    const safeEmpId = resolveSafeEmployeeId(employeeId);
    const timestamp = new Date(capturedAt).getTime() || Date.now();
    const filePath = `${safeEmpId}/${timestamp}_${deviceId}.jpg`;

    // 1. Upload to storage bucket 'screenshots'
    let uploadError: any = null;
    try {
      const res = await supabase.storage
        .from('screenshots')
        .upload(filePath, fileBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      uploadError = res.error;
    } catch (e: any) {
      uploadError = e;
    }

    if (uploadError) {
      console.warn('Screenshot storage upload warning (apply supabase/fix_rls_and_storage.sql to enable storage.objects insert):', uploadError.message || uploadError);
    }

    // 2. Obtain public URL
    const { data: pubUrlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(filePath);
    const publicUrl = pubUrlData?.publicUrl || '';

    // 3. Insert record in database (screenshot_records)
    const { data, error: dbError } = await supabase
      .from('screenshot_records')
      .insert([
        {
          employee_id: safeEmpId,
          device_id: deviceId,
          captured_at: capturedAt,
          storage_path: filePath,
          file_size_bytes: fileBlob.size,
          width,
          height,
        },
      ])
      .select()
      .maybeSingle();

    if (dbError) {
      console.warn('Failed to log screenshot record in Supabase DB (screenshot_records):', dbError);
    }

    // Also attempt insert into legacy screenshots table if it exists
    try {
      await supabase.from('screenshots').insert([
        {
          employee_id: safeEmpId,
          device_id: deviceId,
          captured_at: capturedAt,
          storage_path: filePath,
          file_size_bytes: fileBlob.size,
          width,
          height,
        },
      ]);
    } catch {
      // ignore
    }

    return {
      storage_path: filePath,
      publicUrl,
      record: data,
    };
  },

  // Upload screen recording video and thumbnail to Supabase Storage
  uploadScreenRecording: async (params: {
    videoBlob: Blob;
    thumbnailBlob?: Blob;
    employeeId: string;
    deviceId?: string;
    startedAt: string;
    durationSeconds?: number;
    recordedBy?: string;
    activeWindow?: string;
    employeeName?: string;
    department?: string;
  }) => {
    if (!isSupabaseConfigured()) return null;

    const {
      videoBlob,
      thumbnailBlob,
      employeeId,
      deviceId = 'WIN-CLIENT',
      startedAt,
      durationSeconds = 10,
      recordedBy = 'Admin',
      activeWindow = 'Visual Studio Code',
      employeeName = 'Employee',
      department = 'Engineering',
    } = params;

    const safeEmpId = resolveSafeEmployeeId(employeeId);
    const timestamp = new Date(startedAt).getTime() || Date.now();
    const recordId = `rec-${timestamp}`;

    // Bucket selection: try primary 'recordings' bucket, fallback to 'screenshots' bucket
    let bucketName = 'recordings';
    let videoStoragePath = `${safeEmpId}/${timestamp}_${recordId}.webm`;
    let thumbStoragePath = `${safeEmpId}/${timestamp}_${recordId}_thumb.jpg`;

    // 1. Upload video to storage bucket
    let videoError: any = null;
    try {
      const res = await supabase.storage
        .from(bucketName)
        .upload(videoStoragePath, videoBlob, {
          contentType: videoBlob.type || 'video/webm',
          upsert: true,
        });
      videoError = res.error;
    } catch (e: any) {
      videoError = e;
    }

    // Fallback if 'recordings' bucket does not exist or access denied
    if (
      videoError &&
      (videoError.message?.includes('Bucket not found') ||
        (videoError as any).statusCode === '404' ||
        (videoError as any).code === 'NoSuchBucket' ||
        (videoError as any).statusCode === '403')
    ) {
      bucketName = 'screenshots';
      videoStoragePath = `${safeEmpId}/recordings/${timestamp}_${recordId}.webm`;
      thumbStoragePath = `${safeEmpId}/thumbnails/${timestamp}_${recordId}.jpg`;

      try {
        const fallbackRes = await supabase.storage
          .from(bucketName)
          .upload(videoStoragePath, videoBlob, {
            contentType: videoBlob.type || 'video/webm',
            upsert: true,
          });
        videoError = fallbackRes.error;
      } catch (e: any) {
        videoError = e;
      }
    }

    if (videoError) {
      console.warn('Storage upload warning for screen recording (apply supabase/fix_rls_and_storage.sql):', videoError.message || videoError);
    }

    // 2. Upload thumbnail if available
    let thumbnailUrl = '';
    if (thumbnailBlob) {
      try {
        const { error: thumbErr } = await supabase.storage
          .from(bucketName)
          .upload(thumbStoragePath, thumbnailBlob, {
            contentType: thumbnailBlob.type || 'image/jpeg',
            upsert: true,
          });

        if (!thumbErr) {
          const { data: thumbPub } = supabase.storage.from(bucketName).getPublicUrl(thumbStoragePath);
          thumbnailUrl = thumbPub?.publicUrl || '';
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Resolve public URL for video
    const { data: vidPub } = supabase.storage.from(bucketName).getPublicUrl(videoStoragePath);
    const videoUrl = vidPub?.publicUrl || '';

    // 4. Insert metadata into public.screen_recordings table
    try {
      await supabase.from('screen_recordings').insert([
        {
          id: recordId,
          employee_id: safeEmpId,
          device_id: deviceId,
          started_at: startedAt,
          duration_seconds: durationSeconds,
          storage_path: videoStoragePath,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          recorded_by: recordedBy,
          active_window: activeWindow,
          file_size_bytes: videoBlob.size,
          status: 'completed',
          trigger_type: 'on_demand',
          metadata: {
            employee_name: employeeName,
            department,
            bucket: bucketName,
            thumbnail_storage_path: thumbStoragePath,
          },
        },
      ]);
    } catch (err) {
      console.warn('Could not insert directly into screen_recordings table:', err);
    }

    // 5. Also insert into public.activity_events for immediate realtime feed compatibility
    try {
      await supabase.from('activity_events').insert([
        {
          employee_id: safeEmpId,
          device_id: deviceId,
          event_type: 'screen_recording',
          occurred_at: startedAt,
          metadata: {
            session_id: recordId,
            employee_name: employeeName,
            department,
            duration_seconds: durationSeconds,
            requested_by: recordedBy,
            active_window: activeWindow,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            storage_path: videoStoragePath,
            file_size_bytes: videoBlob.size,
            bucket: bucketName,
            status: 'completed',
          },
        },
      ]);
    } catch (err) {
      console.warn('Could not insert recording into activity_events:', err);
    }

    return {
      recordId,
      bucketName,
      videoStoragePath,
      videoUrl,
      thumbnailUrl,
      fileSizeBytes: videoBlob.size,
    };
  },

  // Upload Mouse Heatmaps & Keyboard Activity Snapshot to Supabase Storage Bucket & Table
  uploadBreakTelemetrySnapshot: async (snapshot: BreakTelemetrySnapshot) => {
    if (!isSupabaseConfigured()) return null;

    const safeEmpId = resolveSafeEmployeeId(snapshot.employee_id);
    const timestamp = new Date(snapshot.started_at).getTime() || Date.now();
    const bucketName = 'screenshots';
    const filePath = `telemetry_snapshots/${safeEmpId}/${timestamp}_${snapshot.break_type}.json`;

    // 1. Convert snapshot payload to JSON Blob and upload to bucket
    const jsonBlob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });

    let storagePath = filePath;
    let uploadError: any = null;

    try {
      const { data: uploadData, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, jsonBlob, {
          contentType: 'application/json',
          upsert: true,
        });

      if (error) {
        uploadError = error;
        console.warn('Bucket upload error (falling back to memory/table):', error);
      } else if (uploadData) {
        storagePath = uploadData.path;
      }
    } catch (e) {
      console.warn('Failed storage upload for break snapshot:', e);
    }

    // 2. Insert record into public.activity_events table
    let eventRecord: any = null;
    try {
      const { data, error } = await supabase.from('activity_events').insert([
        {
          employee_id: safeEmpId,
          device_id: snapshot.device_id || 'WIN-CLIENT-DESKTOP',
          event_type: 'BREAK_TELEMETRY_SNAPSHOT',
          occurred_at: snapshot.started_at,
          metadata: {
            snapshot_id: snapshot.id,
            employee_name: snapshot.employee_name,
            break_type: snapshot.break_type,
            break_title: snapshot.break_title,
            current_time_slot: snapshot.current_time_slot,
            time_slot_index: snapshot.time_slot_index,
            storage_path: storagePath,
            bucket: bucketName,
            heatmap_data: snapshot.heatmap_data,
            keyboard_data: snapshot.keyboard_data,
            hourly_state: snapshot.hourly_state,
            status: snapshot.status,
          },
        },
      ]).select();

      if (!error && data && data.length > 0) {
        eventRecord = data[0];
      }
    } catch (err) {
      console.warn('Could not insert break snapshot into activity_events:', err);
    }

    return {
      storagePath,
      bucket: bucketName,
      eventRecord,
      uploadError,
    };
  },

  // Record Telemetry Resumption in Supabase Table
  resumeBreakTelemetrySnapshot: async (params: {
    employeeId: string;
    deviceId?: string;
    snapshotId: string;
    employeeName: string;
    breakType: string;
    breakDurationSeconds: number;
    resumedAt: string;
    timeSlot: string;
    timeSlotIndex: number;
    resumedState?: any;
  }) => {
    if (!isSupabaseConfigured()) return null;

    const safeEmpId = resolveSafeEmployeeId(params.employeeId);
    try {
      const { data, error } = await supabase.from('activity_events').insert([
        {
          employee_id: safeEmpId,
          device_id: params.deviceId || 'WIN-CLIENT-DESKTOP',
          event_type: 'BREAK_TELEMETRY_RESUMED',
          occurred_at: params.resumedAt,
          metadata: {
            snapshot_id: params.snapshotId,
            employee_name: params.employeeName,
            break_type: params.breakType,
            break_duration_seconds: params.breakDurationSeconds,
            resumed_at: params.resumedAt,
            current_time_slot: params.timeSlot,
            time_slot_index: params.timeSlotIndex,
            resumed_state: params.resumedState,
            status: 'resumed',
          },
        },
      ]).select();

      if (error) {
        console.warn('Failed to insert BREAK_TELEMETRY_RESUMED into activity_events:', error);
      }
      return data;
    } catch (e) {
      console.warn('Error recording break resumption:', e);
      return null;
    }
  },

  // Fetch Latest Telemetry Snapshot for an Employee from Supabase
  fetchLatestBreakSnapshot: async (employeeId: string): Promise<BreakTelemetrySnapshot | null> => {
    if (!isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .eq('employee_id', employeeId)
        .in('event_type', ['BREAK_TELEMETRY_SNAPSHOT', 'BREAK_TELEMETRY_RESUMED'])
        .order('occurred_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      const meta = row.metadata || {};

      return {
        id: meta.snapshot_id || row.id,
        employee_id: row.employee_id,
        employee_name: meta.employee_name || 'Arsal',
        break_type: meta.break_type || 'coffee',
        break_title: meta.break_title || 'Authorized Break',
        started_at: row.occurred_at,
        resumed_at: meta.resumed_at,
        break_duration_seconds: meta.break_duration_seconds,
        current_time_slot: meta.current_time_slot || '11:00',
        time_slot_index: typeof meta.time_slot_index === 'number' ? meta.time_slot_index : 2,
        heatmap_data: meta.heatmap_data || [],
        keyboard_data: meta.keyboard_data || [],
        hourly_state: meta.hourly_state || {
          time_slot: meta.current_time_slot || '11:00',
          slot_index: meta.time_slot_index || 2,
          pre_break_keys: meta.pre_break_keys || 1500,
          pre_break_heatmap_pct: meta.pre_break_heatmap_pct || 45,
        },
        storage_path: meta.storage_path,
        bucket: meta.bucket || 'screenshots',
        device_id: row.device_id,
        status: meta.status || (row.event_type === 'BREAK_TELEMETRY_RESUMED' ? 'resumed' : 'active_break'),
      };
    } catch (e) {
      console.warn('Error fetching latest break snapshot from Supabase:', e);
      return null;
    }
  },
};


