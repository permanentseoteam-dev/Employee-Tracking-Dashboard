import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Attendance & Shift Check-ins</h1>
          <p className="page-subtitle">
            Daily punctuality and work hours for {user.team_name || 'assigned team'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>On-Time Team Check-ins</span>
            <CheckCircle size={15} color="var(--success)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{onTimeCount}</div>
          <div className="stat-footer">Within organizational grace window</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Late Arrivals</span>
            <AlertTriangle size={15} color="var(--warning)" />
          </div>
          <div className="stat-value" style={{ color: lateCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {lateCount}
          </div>
          <div className="stat-footer">Grace period exceeded</div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Today's Team Attendance ({attendance.length} records)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Scheduled Start</th>
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
                  <td style={{ color: 'var(--text-muted)' }}>{rec.scheduled_start}</td>
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
                            : 'var(--warning-bg)',
                        color:
                          rec.status === 'on_time'
                            ? 'var(--success)'
                            : 'var(--warning)',
                      }}
                    >
                      {rec.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{rec.late_minutes > 0 ? `${rec.late_minutes} mins` : '--'}</td>
                  <td style={{ fontWeight: 600 }}>{rec.active_hours} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
