import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

export const ManagerTeamPage: React.FC = () => {
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
          <h1 className="page-title">My Assigned Team Members</h1>
          <p className="page-subtitle">
            Team: {user.team_name || 'Core Backend Team'} &bull; Managed by {user.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {employees.map((emp) => (
          <div key={emp.id} className="content-card">
            <div className="content-card-title">
              <div>
                <div style={{ fontSize: 16 }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: emp.status === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: emp.status === 'active' ? 'var(--success)' : 'var(--warning)',
                }}
              >
                {emp.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Task:</span>
                <span style={{ fontWeight: 500, maxWidth: 180, textAlign: 'right' }}>
                  {emp.current_task || 'Idle / No active task'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>First Check-in:</span>
                <span style={{ fontFamily: 'monospace' }}>{emp.first_activity}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tracked Today:</span>
                <span style={{ fontWeight: 600 }}>{(emp.active_seconds / 3600).toFixed(1)} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Device Binding:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{emp.device_id}</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                ⭐ {emp.stars} Stars
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined: {emp.joined_at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
