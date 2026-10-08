import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Settings, Save, RefreshCw, CheckCircle, AlertTriangle, CalendarCheck } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { AttendanceRecordItem, AttendanceRuleConfig } from '../../types/roles';

export const AdminAttendancePage: React.FC = () => {
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);
  const [rules, setRules] = useState<AttendanceRuleConfig | null>(null);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [attList, ruleConfig] = await Promise.all([
        dataService.getAttendance('admin'),
        dataService.getAttendanceRules('admin'),
      ]);
      setAttendance(attList);
      setRules(ruleConfig);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules) return;
    setIsSavingRules(true);
    try {
      await dataService.updateAttendanceRules('admin', rules);
      dataService.logAction(
        'Super Admin',
        'admin',
        'UPDATE_ATTENDANCE_RULES',
        `Start: ${rules.work_start_time}, Grace: ${rules.grace_period_minutes}m`,
        'Configured organizational shift schedule'
      );
      setSaveMessage('Attendance shift and grace period updated.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingRules(false);
    }
  };

  const onTimeCount = attendance.filter((a) => a.status === 'on_time').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;

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
            <span>Attendance & Policy</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Attendance & Shift Scheduling
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Organization-wide daily attendance ledger and automated grace period policy calculation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>On-Time Arrivals</span>
            <CheckCircle size={16} color="var(--status-success)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--status-success)' }}>{onTimeCount}</div>
          <div className="stat-footer">Checked in within designated grace window</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Late Arrivals</span>
            <AlertTriangle size={16} color="var(--status-warning)" />
          </div>
          <div className="stat-value" style={{ color: lateCount > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
            {lateCount}
          </div>
          <div className="stat-footer">Grace period exceeded &bull; Penalty evaluated</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Absent / Inactive</span>
            <Clock size={16} color="var(--status-error)" />
          </div>
          <div className="stat-value" style={{ color: absentCount > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
            {absentCount}
          </div>
          <div className="stat-footer">No desktop agent heartbeat logged today</div>
        </div>
      </div>

      {/* Two column layout: Ledger Table and Shift Rules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Attendance Ledger */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Today's Attendance Ledger</span>
              <span className="live-telemetry-badge">{attendance.length} records</span>
            </div>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Team</th>
                  <th>First Activity</th>
                  <th>Status</th>
                  <th>Late By</th>
                  <th style={{ textAlign: 'right' }}>Active Tracked</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee_name}</td>
                    <td>{rec.team_name}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                        {rec.first_activity_at}
                      </span>
                    </td>
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
                    <td>{rec.late_minutes > 0 ? `${rec.late_minutes}m` : '--'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {rec.active_hours}h
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No attendance records logged for today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Rules Form */}
        {rules && (
          <form className="frosted-card" onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Shift Calculation Policy</span>
              </div>
            </div>

            {saveMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  borderRadius: 'var(--radius-card-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {saveMessage}
              </div>
            )}

            <div className="stitch-form-group">
              <label className="stitch-label">Shift Start Time</label>
              <input
                type="time"
                className="stitch-input"
                value={rules.work_start_time}
                onChange={(e) => setRules({ ...rules, work_start_time: e.target.value })}
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Shift End Time</label>
              <input
                type="time"
                className="stitch-input"
                value={rules.work_end_time}
                onChange={(e) => setRules({ ...rules, work_end_time: e.target.value })}
              />
            </div>

            <div className="stitch-form-group">
              <label className="stitch-label">Grace Period Window (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                className="stitch-input"
                value={rules.grace_period_minutes}
                onChange={(e) =>
                  setRules({ ...rules, grace_period_minutes: parseInt(e.target.value) || 0 })
                }
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Employees checking in within {rules.grace_period_minutes} minutes of {rules.work_start_time} are counted on-time.
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <button type="submit" className="btn-pill btn-pill-primary" disabled={isSavingRules} style={{ width: '100%' }}>
                <Save size={15} />
                <span>{isSavingRules ? 'Saving Schedule...' : 'Deploy Shift Schedule Policy'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
};
