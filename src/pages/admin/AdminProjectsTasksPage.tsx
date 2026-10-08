import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderKanban, CheckSquare, RefreshCw, Search } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { ProjectItem, TaskItem } from '../../types/roles';

interface AdminProjectsTasksPageProps {
  initialView?: 'projects' | 'tasks';
}

export const AdminProjectsTasksPage: React.FC<AdminProjectsTasksPageProps> = ({ initialView = 'projects' }) => {
  const [view, setView] = useState<'projects' | 'tasks'>(initialView);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = async () => {
    try {
      const [pList, tList] = await Promise.all([
        dataService.getProjects('admin'),
        dataService.getTasks('admin'),
      ]);
      setProjects(pList);
      setTasks(tList);
    } catch (err) {
      console.error(err);
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
  }, []);

  const filteredTasks = (tasks || []).filter((t) => {
    const title = t?.title || '';
    const empName = t?.employee_name || '';
    const projName = t?.project_name || '';
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      title.toLowerCase().includes(search) ||
      empName.toLowerCase().includes(search) ||
      projName.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || t?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <FolderKanban size={14} color="var(--color-secondary)" />
            <span>Deliverables & Sprint Management</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Projects & Organization Tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Cross-team project roadmaps, enterprise task assignment, and delivery telemetry
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Segmented Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${view === 'projects' ? 'active' : ''}`}
              onClick={() => setView('projects')}
            >
              <FolderKanban size={14} />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${view === 'tasks' ? 'active' : ''}`}
              onClick={() => setView('tasks')}
            >
              <CheckSquare size={14} />
              <span>Tasks ({tasks.length})</span>
            </button>
          </div>

          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {view === 'projects' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {projects.map((proj) => (
            <div key={proj.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{proj.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{proj.code}</div>
                </div>
                <span className={`status-pill ${proj.status === 'active' ? 'active' : 'neutral'}`}>
                  {(proj.status || '').toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Lead: <strong style={{ color: 'var(--text-primary)' }}>{proj.manager_name}</strong> &bull; {proj.members_count} members
              </div>

              {/* Progress meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{proj.progress_percentage}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${proj.progress_percentage}%`,
                      background: 'var(--color-secondary)',
                      borderRadius: 'var(--radius-pill)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', paddingTop: 6, borderTop: '1px solid var(--surface-border-subtle)' }}>
                <span>
                  Tasks: <strong style={{ color: 'var(--text-primary)' }}>{proj.completed_tasks}</strong> / {proj.total_tasks} done
                </span>
                <span>Due: {proj.due_date}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="frosted-card">
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Organization Tasks</span>
              <span className="live-telemetry-badge">{filteredTasks.length} tasks</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="stitch-search-pill" style={{ maxWidth: 240 }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search task, assignee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="stitch-select"
                style={{ width: 140, padding: '7px 12px', fontSize: 12 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="todo">To Do</option>
              </select>
            </div>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Project</th>
                  <th>Assigned Member</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Tracked Time</th>
                  <th style={{ textAlign: 'right' }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.project_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="avatar-chip" style={{ width: 24, height: 24, fontSize: 10 }}>
                          {t.employee_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span>{t.employee_name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          t.priority === 'urgent'
                            ? 'critical'
                            : t.priority === 'high'
                            ? 'late'
                            : 'neutral'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          t.status === 'completed'
                            ? 'approved'
                            : t.status === 'in_progress'
                            ? 'active'
                            : 'neutral'
                        }`}
                      >
                        {(t.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {(((t.tracked_seconds || 0) / 3600)).toFixed(1)}h
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{t.due_date}</td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No tasks found matching the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};
