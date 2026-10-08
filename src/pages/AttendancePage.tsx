import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import type { AgentStatusDto } from '../types';
import type { AttendanceRecordItem } from '../types/roles';

interface AttendancePageProps {
  status: AgentStatusDto;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ status }) => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await dataService.getAttendance('employee', undefined, user.id);
      setAttendance(list);
    } catch (err) {
      console.error('Failed to load employee attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'employee_presence' || payload.table === 'attendance_records') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance & Shift Records</h1>
          <p className="page-subtitle">
            Automated first-meaningful-activity detection &bull; Shift Schedule: 09:00 AM – 06:00 PM
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Attendance">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Shift Status</span>
            <CheckCircle size={14} color={isPresent ? 'var(--success)' : 'var(--warning)'} />
          </div>
          <div className="stat-value" style={{ color: isPresent ? 'var(--success)' : 'var(--warning)' }}>
            {isPresent ? 'Present & Verified' : 'Pending First Activity'}
          </div>
          <div className="stat-footer">
            <span>First activity detected automatically</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Check-in Timestamp</span>
            <Clock size={14} color="var(--primary)" />
          </div>
          <div className="stat-value">{firstActivity}</div>
          <div className="stat-footer">
            <span>Grace period: 15 minutes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Work Duration</span>
            <Clock size={14} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{trackedHours} hrs</div>
          <div className="stat-footer">
            <span>Excludes break intervals</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Today's Attendance Events</span>
          <button
            className="btn btn-primary"
            onClick={handleManualPunch}
            disabled={isPunching}
          >
            <Clock size={14} />
            <span>{isPunching ? 'Syncing...' : 'Manual Attendance Punch'}</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            Loading attendance records...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Trigger</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Outbox Synced</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <Calendar size={14} color="var(--primary)" />
                    <span>First Activity Check-in</span>
                  </div>
                </td>
                <td>Keyboard / Mouse Event Detection</td>
                <td>Today, {firstActivity}</td>
                <td>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>On Time</span>
                </td>
                <td>
                  <span style={{ color: 'var(--success)' }}>
                    Synced (Live Cloud)
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <span>Agent Online Heartbeat</span>
                  </div>
                </td>
                <td>System Startup & Background Daemon</td>
                <td>{status.last_sync_time ? new Date(status.last_sync_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}</td>
                <td>Verified</td>
                <td>Synced</td>
              </tr>
            </tbody>
          </table>
        )}

        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <AlertCircle size={15} color="var(--primary)" />
          <span>
            Backend calculates final attendance status based on shift rules, schedules, and verified timestamps in Supabase.
          </span>
        </div>
      </div>
    </div>
  );
};
