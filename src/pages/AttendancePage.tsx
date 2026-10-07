import React, { useState } from 'react';
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { AgentStatusDto } from '../types';

interface AttendancePageProps {
  status: AgentStatusDto;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ status }) => {
  const [markedToday, setMarkedToday] = useState(true);
  const [checkInTime] = useState('09:02 AM');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance & Shift Records</h1>
          <p className="page-subtitle">
            Automated first-meaningful-activity detection &bull; Schedule: 09:00 AM – 06:00 PM
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Shift Status</span>
            <CheckCircle size={14} color="var(--success)" />
          </div>
          <div className="stat-value">{markedToday ? 'Present' : 'Not Marked'}</div>
          <div className="stat-footer">
            <span>First activity detected automatically</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Check-in Timestamp</span>
            <Clock size={14} color="var(--primary)" />
          </div>
          <div className="stat-value">{checkInTime}</div>
          <div className="stat-footer">
            <span>Grace period: 15 minutes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Work Duration</span>
            <Clock size={14} color="var(--text-muted)" />
          </div>
          <div className="stat-value">6h 45m</div>
          <div className="stat-footer">
            <span>Excludes break intervals</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Today's Attendance Events</span>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setMarkedToday(true);
              alert('Attendance punch synchronized with local SQLite outbox queue.');
            }}
          >
            Manual Attendance Punch
          </button>
        </div>

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
              <td>Today, 09:02:14 AM</td>
              <td>
                <span style={{ color: 'var(--success)', fontWeight: 500 }}>On Time</span>
              </td>
              <td>
                <span style={{ color: status.is_online ? 'var(--success)' : 'var(--warning)' }}>
                  {status.is_online ? 'Synced (UUID-8f4b)' : 'Local Outbox'}
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
              <td>Today, 09:00:03 AM</td>
              <td>Verified</td>
              <td>Synced</td>
            </tr>
          </tbody>
        </table>

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
            Backend calculates final attendance status based on shift rules, schedules, and verified local outbox timestamps.
          </span>
        </div>
      </div>
    </div>
  );
};
