import React from 'react';
import { FolderKanban, CheckSquare, Clock } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const projects = [
    {
      id: 'PRJ-1',
      name: 'Desktop Agent Architecture',
      code: 'CORE',
      activeTasks: 4,
      totalHours: '32h 10m',
      status: 'Active',
    },
    {
      id: 'PRJ-2',
      name: 'Manager & Admin Dashboard Sync',
      code: 'API',
      activeTasks: 2,
      totalHours: '18h 40m',
      status: 'Active',
    },
    {
      id: 'PRJ-3',
      name: 'Encrypted Offline Queue',
      code: 'STORAGE',
      activeTasks: 3,
      totalHours: '12h 15m',
      status: 'Active',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assigned Projects</h1>
          <p className="page-subtitle">
            Enterprise work streams and assigned cost centers
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {projects.map((proj) => (
          <div key={proj.id} className="stat-card" style={{ gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <FolderKanban size={18} color="var(--primary)" />
                <span>{proj.name}</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {proj.code}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 12 }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckSquare size={13} />
                <span>Active Tasks:</span>
              </span>
              <span style={{ fontWeight: 600 }}>{proj.activeTasks}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} />
                <span>Tracked Time:</span>
              </span>
              <span style={{ fontWeight: 600 }}>{proj.totalHours}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
