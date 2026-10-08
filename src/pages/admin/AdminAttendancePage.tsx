import React, { useState, useEffect } from 'react';
import { Clock, Settings, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance & Shift Scheduling</h1>
          <p className="page-subtitle">
            Organization-wide daily attendance ledger &bull; Automated grace period calculation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>On Time Arrivals</span>
            <CheckCircle size={15} color="var(--success)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{onTimeCount}</div>
          <div className="stat-footer">Checked in within grace window</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Late Arrivals</span>
            <AlertTriangle size={15} color="var(--warning)" />
          </div>
          <div className="stat-value" style={{ color: lateCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {lateCount}
          </div>
          <div className="stat-footer">Penalty rule evaluated</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Absent / Inactive</span>
            <Clock size={15} color="var(--danger)" />
          </div>
          <div className="stat-value" style={{ color: absentCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {absentCount}
          </div>
          <div className="stat-footer">No telemetry received today</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Attendance Table */}
        <div className="content-card">
          <div className="content-card-title">
            <span>Today's Attendance Ledger ({attendance.length} records)</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Team</th>
                  <th>First Activity</th>
                  <th>Status</th>
                  <th>Late By</th>
                  <th>Active Tracked</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600 }}>{rec.employee_name}</td>
                    <td>{rec.team_name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{rec.first_activity_at}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor:
                            rec.status === 'on_time'
                              ? 'var(--success-bg)'
                              : rec.status === 'late'
                              ? 'var(--warning-bg)'
                              : 'var(--danger-bg)',
                          color:
                            rec.status === 'on_time'
                              ? 'var(--success)'
                              : rec.status === 'late'
                              ? 'var(--warning)'
                              : 'var(--danger)',
                        }}
                      >
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{rec.late_minutes > 0 ? `${rec.late_minutes} mins` : '--'}</td>
                    <td>{rec.active_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Rules Form */}
        {rules && (
          <form className="content-card" onSubmit={handleSaveRules}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} color="var(--primary)" />
                <span>Attendance Calculation Rules</span>
              </div>
            </div>

            {saveMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                {saveMessage}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Default Shift Start Time</label>
              <input
                type="time"
                className="form-input"
                value={rules.work_start_time}
                onChange={(e) => setRules({ ...rules, work_start_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Shift End Time</label>
              <input
                type="time"
                className="form-input"
                value={rules.work_end_time}
                onChange={(e) => setRules({ ...rules, work_end_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Grace Period Window (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                className="form-input"
                value={rules.grace_period_minutes}
                onChange={(e) =>
                  setRules({ ...rules, grace_period_minutes: parseInt(e.target.value) || 0 })
                }
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Employees clocking in within {rules.grace_period_minutes} mins of {rules.work_start_time} are counted On-Time.
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSavingRules}>
              <Save size={15} />
              <span>{isSavingRules ? 'Saving...' : 'Update Attendance Rules'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
