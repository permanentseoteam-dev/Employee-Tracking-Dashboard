import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

export const ManagerPerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const loadData = async () => {
    try {
      const list = await dataService.getEmployees('manager', user.id);
      setEmployees(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Performance & Star Ledger</h1>
          <p className="page-subtitle">
            Holistic output indicators for {user.team_name || 'assigned team'} &bull; Transparent merit stars
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Assigned Team Performance Metrics</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Metrics combine attendance punctuality, task completion consistency, and merit incentives. Keystrokes/mouse counts are activity indicators rather than an opaque productivity score.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Attendance Punctuality</th>
                <th>Tracked Active Hours</th>
                <th>Idle Time Today</th>
                <th>Current Stars</th>
                <th>Current Sprint Task</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>{emp.name}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        backgroundColor:
                          emp.attendance_status === 'on_time'
                            ? 'var(--success-bg)'
                            : 'var(--warning-bg)',
                        color:
                          emp.attendance_status === 'on_time'
                            ? 'var(--success)'
                            : 'var(--warning)',
                      }}
                    >
                      {emp.attendance_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{(emp.active_seconds / 3600).toFixed(1)} hrs</td>
                  <td style={{ color: emp.idle_seconds > 3600 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(emp.idle_seconds / 3600).toFixed(1)} hrs
                  </td>
                  <td style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>
                    ⭐ {emp.stars}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.current_task || 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
