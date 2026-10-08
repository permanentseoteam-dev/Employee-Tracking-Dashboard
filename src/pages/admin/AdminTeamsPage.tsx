import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { TeamRecord } from '../../types/roles';

export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  const loadData = async () => {
    try {
      const list = await dataService.getTeams('admin');
      setTeams(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams & Operational Units</h1>
          <p className="page-subtitle">
            Cross-department team breakdown, manager leads, and member distribution
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
        {teams.map((team) => (
          <div key={team.id} className="stat-card">
            <div className="stat-header">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</span>
              <Building2 size={15} color="var(--primary)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {team.department} &bull; Lead: {team.manager_name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Members</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{team.member_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Now</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>
                  {team.active_count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Attendance</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                  {team.attendance_rate}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
