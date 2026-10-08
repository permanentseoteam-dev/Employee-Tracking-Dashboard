import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, AlertTriangle, CalendarCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { AttendanceRecordItem } from '../../types/roles';

export const ManagerAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);

  const loadData = async () => {
    try {
      const list = await dataService.getAttendance('manager', user.id);
      setAttendance(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const onTimeCount = attendance.filter((a) => a.status === 'on_time').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* Header */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <CalendarCheck size={14} color="var(--color-secondary)" />
            <span>Team Shift Management</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Team Attendance & Shift Check-ins
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Daily punctuality and work hours for <strong style={{ color: 'var(--text-primary)' }}>{user.team_name || 'assigned team'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>On-Time Team Check-ins</span>
            <CheckCircle size={16} color="var(--status-success)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--status-success)' }}>{onTimeCount}</div>
          <div className="stat-footer">Within organizational shift grace window</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Late Arrivals</span>
            <AlertTriangle size={16} color="var(--status-warning)" />
          </div>
          <div className="stat-value" style={{ color: lateCount > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
            {lateCount}
          </div>
          <div className="stat-footer">Grace period exceeded today</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="frosted-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Today's Team Attendance</span>
            <span className="live-telemetry-badge">{attendance.length} records</span>
          </div>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Scheduled Start</th>
                <th>First Activity</th>
                <th>Status</th>
                <th>Late By</th>
                <th style={{ textAlign: 'right' }}>Active Tracked</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((rec) => (
                <tr key={rec.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar-chip" style={{ width: 26, height: 26, fontSize: 10 }}>
                        {rec.employee_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee_name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{rec.scheduled_start}</td>
                  <td style={{ fontFamily: 'monospace' }}>{rec.first_activity_at}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        rec.status === 'on_time'
                          ? 'active'
                          : rec.status === 'late'
                          ? 'late'
                          : 'absent'
                      }`}
                    >
                      {(rec.status || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td>{rec.late_minutes > 0 ? `${rec.late_minutes} mins` : '--'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {rec.active_hours ?? 0} hrs
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No team attendance entries for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
