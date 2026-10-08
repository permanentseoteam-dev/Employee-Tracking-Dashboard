import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  team_id?: string;
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

  signUp: async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'employee' = 'employee') => {
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
};

export const supabaseSync = {
  // Sync an activity aggregate window
  syncActivityWindow: async (payload: ActivityPayload) => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('activity_aggregates').insert([payload]);
    if (error) {
      console.error('Failed to sync activity to Supabase:', error);
      throw error;
    }
    return true;
  },

  // Sync an attendance record punch
  syncAttendance: async (payload: AttendancePayload) => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('attendance_records').insert([payload]);
    if (error) {
      console.error('Failed to sync attendance to Supabase:', error);
      throw error;
    }
    return true;
  },

  // Sync a task work session
  syncTaskSession: async (payload: TaskSessionPayload) => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('task_sessions').insert([payload]);
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
    capturedAt: string
  ) => {
    if (!isSupabaseConfigured()) return null;

    const timestamp = new Date(capturedAt).getTime();
    const filePath = `${employeeId}/${timestamp}_${deviceId}.jpg`;

    // 1. Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(filePath, fileBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload screenshot to Supabase Storage:', uploadError);
      throw uploadError;
    }

    // 2. Insert record in database
    const { data, error: dbError } = await supabase
      .from('screenshot_records')
      .insert([
        {
          employee_id: employeeId,
          device_id: deviceId,
          captured_at: capturedAt,
          storage_path: filePath,
          file_size_bytes: fileBlob.size,
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Failed to log screenshot record in Supabase DB:', dbError);
      throw dbError;
    }

    return data;
  },
};
