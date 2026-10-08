import React, { useState, useEffect } from 'react';
import { FolderKanban, CheckSquare, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import type { ProjectItem } from '../types/roles';

export const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await dataService.getProjects('employee', undefined, user.id);
      setProjects(list);
    } catch (err) {
      console.error('Failed to load employee projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'projects' || payload.table === 'tasks') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user.id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assigned Projects</h1>
          <p className="page-subtitle">
            Enterprise work streams, project progress, and active tasks for {user.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Projects">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="content-card" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
          Loading assigned projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="content-card" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
          No projects assigned yet.
        </div>
      ) : (
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

              {/* Progress bar */}
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontWeight: 600 }}>{proj.progress_percentage}%</span>
                </div>
                <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${proj.progress_percentage}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckSquare size={13} />
                  <span>Tasks Done:</span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {proj.completed_tasks} / {proj.total_tasks}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} />
                  <span>Due Date:</span>
                </span>
                <span style={{ fontWeight: 600 }}>{proj.due_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
