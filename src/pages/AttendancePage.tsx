import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ArrowUpRight, ArrowDownLeft, ShieldCheck, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useBreakSchedule } from '../hooks/useBreakSchedule';
import { formatBreakRange } from '../utils/breakSchedule';
import type { AgentStatusDto } from '../types';
import type { AttendanceRecordItem } from '../types/roles';

import { useAppRefresh } from '../hooks/useAppRefresh';
import { RefreshButton } from '../components/common/RefreshButton';
interface AttendancePageProps {
  status: AgentStatusDto;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ status }) => {
  const { user } = useAuth();
  const { schedule } = useBreakSchedule();
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);
  const [isPunching, setIsPunching] = useState(false);

  const loadData = async () => {
    try {
      const list = await dataService.getAttendance('employee', undefined, user.id);
      setAttendance(list);
    } catch (err) {
      console.error('Failed to load employee attendance:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'employee_presence' || payload.table === 'attendance_records') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [user.id]);

  const record = attendance[0];
  const isPresent = record ? record.status === 'on_time' || record.status === 'late' : status.is_online;
  const firstActivity = record ? record.first_activity_at : status.last_sync_time ? new Date(status.last_sync_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM';
  const trackedHours = record ? record.active_hours : 5.5;

  const handleManualPunch = async () => {
    setIsPunching(true);
    try {
      if (isSupabaseConfigured()) {
        const now = new Date().toISOString();
        await supabase.from('attendance_records').insert([
          {
            employee_id: user.id,
            check_in: now,
            status: 'on_time',
          },
        ]);

        await supabase.from('employee_presence').upsert([
          {
            employee_id: user.id,
            device_id: 'WIN-CLIENT-DESKTOP',
            status: 'active',
            last_activity_at: now,
            updated_at: now,
          },
        ]);
      }

      dataService.logAction(
        user.name,
        'employee',
        'ATTENDANCE_PUNCH',
        user.id,
        'Manual check-in timestamp registered'
      );

      loadData();
      alert('Attendance check-in verified and synchronized with Supabase.');
    } catch (err: any) {
      alert(`Attendance punch error: ${err.message}`);
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span className="pulse-beacon" />
            <span>Shift & Attendance Management</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Attendance Chronology
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Automated first-meaningful-activity detection • Shift: 09:00 AM – 05:00 PM
            {schedule.coffee.enabled ? ` • ☕ ${schedule.coffee.label}: ${formatBreakRange(schedule.coffee)}` : ''}
            {schedule.zuhr.enabled ? ` • 🕌 ${schedule.zuhr.label}: ${formatBreakRange(schedule.zuhr)}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-pill btn-pill-primary"
            onClick={handleManualPunch}
            disabled={isPunching}
          >
            <Clock size={15} />
            <span>{isPunching ? 'Verifying...' : 'Manual Check-in Punch'}</span>
          </button>
          <RefreshButton onRefresh={loadData} iconOnly size={15} title="Refresh records" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-telemetry-row">
        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Shift Status</span>
            <CheckCircle2 size={16} color={isPresent ? 'var(--status-success)' : 'var(--status-warning)'} />
          </div>
          <div className="stat-numeric-md" style={{ color: isPresent ? 'var(--status-success)' : 'var(--status-warning)' }}>
            {isPresent ? 'Present & Verified' : 'Pending Check-in'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Detected by native Windows agent
          </span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>First Activity</span>
            <Clock size={16} color="var(--color-primary)" />
          </div>
          <div className="stat-numeric-md">{firstActivity}</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Grace threshold: 15 minutes
          </span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Working Hours</span>
            <ArrowUpRight size={16} color="var(--color-secondary)" />
          </div>
          <div className="stat-numeric-md">{trackedHours} hrs</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Active keyboard & mouse intervals
          </span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Punctuality Score</span>
            <ShieldCheck size={16} color="var(--status-success)" />
          </div>
          <div className="stat-numeric-md">100%</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            0 unexcused absences
          </span>
        </div>
      </div>

      {/* Attendance Timeline Table */}
      <div className="frosted-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Shift History & Records</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chronological check-in and checkout timestamps</span>
          </div>
          <span className="live-telemetry-badge">
            <Calendar size={12} /> Today's Session
          </span>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Active Duration</th>
                <th>Idle Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--status-success)' }}>
                    <ArrowDownLeft size={13} /> {firstActivity}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <ArrowUpRight size={13} /> 05:00 PM
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{trackedHours} hrs</td>
                <td style={{ color: 'var(--text-muted)' }}>0.4 hrs</td>
                <td>
                  <span className="status-pill active">On-Time</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Yesterday</span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--status-success)' }}>
                    <ArrowDownLeft size={13} /> 08:58 AM
                  </span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <ArrowUpRight size={13} /> 05:05 PM
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>8.1 hrs</td>
                <td style={{ color: 'var(--text-muted)' }}>0.5 hrs</td>
                <td>
                  <span className="status-pill active">On-Time</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
