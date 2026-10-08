import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderKanban, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import type { ProjectItem } from '../types/roles';

export const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const loadData = async () => {
    try {
      const list = await dataService.getProjects('employee', undefined, user.id);
      setProjects(list);
    } catch (err) {
      console.error('Failed to load employee projects:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'projects' || payload.table === 'tasks') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [user.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span className="pulse-beacon" />
            <span>Project Operations</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Assigned Workstreams
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Active workstreams, milestones, and deliverable ratios for {user.name}
          </p>
        </div>

        <button type="button" className="btn-icon-circle" onClick={loadData} title="Refresh projects">
          <RefreshCw size={15} />
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No projects assigned yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {projects.map((proj) => (
            <div key={proj.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="stitch-brand-icon" style={{ width: 32, height: 32 }}>
                    <FolderKanban size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{proj.name}</h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Code: {proj.code}</span>
                  </div>
                </div>
                <span className="status-pill active">{proj.progress_percentage}% Done</span>
              </div>

              {/* Progress track */}
              <div style={{ margin: '0.5rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Completion Status</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{proj.completed_tasks}/{proj.total_tasks} Tasks</span>
                </div>
                <div style={{ width: '100%', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${proj.progress_percentage}%`,
                      background: 'var(--color-secondary)',
                      borderRadius: 'var(--radius-pill)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--surface-border-subtle)', paddingTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> Target: {proj.due_date}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sprint Cadence Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
