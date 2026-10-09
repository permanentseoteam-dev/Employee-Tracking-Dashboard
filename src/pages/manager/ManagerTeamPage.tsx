import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService, isAdminRecord } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
export const ManagerTeamPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const loadData = async () => {
    try {
      const list = await dataService.getEmployees('manager', user.id);
      setEmployees(list.filter((e) => !isAdminRecord(e.id, e.name, e.email)));
    } catch (err) {
      console.error(err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [user.id]);

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
            <Users size={14} color="var(--color-secondary)" />
            <span>Assigned Team Roster</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            My Assigned Team Members
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Team: <strong style={{ color: 'var(--text-primary)' }}>{user.team_name || user.department || 'Assigned team'}</strong> &bull; Lead: {user.name}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshButton onRefresh={loadData}   />
        </div>
      </div>

      {/* Grid of Team Members */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {employees.map((emp) => (
          <div key={emp.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar-chip" style={{ width: 38, height: 38 }}>
                  {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                </div>
              </div>
              <span className={`status-pill ${emp?.status === 'active' ? 'active' : 'idle'}`}>
                {(emp?.status || 'active').toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Task:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 180, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {emp?.current_task || 'Idle / No active task'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>First Activity:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{emp?.first_activity || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Today:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {(((emp?.active_seconds || 0) / 3600)).toFixed(1)} hrs
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Device Binding:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>{emp.device_id}</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
                borderTop: '1px solid var(--surface-border-subtle)',
                marginTop: 'auto',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                ⭐ {emp.stars} Stars
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined: {emp.joined_at}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
