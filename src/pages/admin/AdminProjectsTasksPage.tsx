import React, { useState, useEffect } from 'react';
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects & Organization Tasks</h1>
          <p className="page-subtitle">
            Cross-team project roadmaps &bull; Enterprise task assignment and delivery telemetry
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 2, border: '1px solid var(--border-medium)' }}>
            <button
              className={`btn ${view === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 14px' }}
              onClick={() => setView('projects')}
            >
              <FolderKanban size={14} />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              className={`btn ${view === 'tasks' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 14px' }}
              onClick={() => setView('tasks')}
            >
              <CheckSquare size={14} />
              <span>Tasks ({tasks.length})</span>
            </button>
          </div>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {view === 'projects' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {projects.map((proj) => (
            <div key={proj.id} className="content-card">
              <div className="content-card-title">
                <div>
                  <div style={{ fontSize: 15 }}>{proj.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{proj.code}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: proj.status === 'active' ? 'var(--success-bg)' : 'rgba(100,116,139,0.12)',
                    color: proj.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {(proj.status || '').toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Lead: <strong>{proj.manager_name}</strong> &bull; {proj.members_count} team members
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 12 }}>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>
                  Tasks: {proj.completed_tasks} / {proj.total_tasks} done
                </span>
                <span>Due: {proj.due_date}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="content-card">
          <div className="content-card-title">
            <span>All Organization Tasks</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="search-box" style={{ width: 220, padding: '4px 10px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search task, employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="form-input"
                style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
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

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Project</th>
                  <th>Assigned Employee</th>
                  <th>Manager</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Tracked Time</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td>{t.project_name}</td>
                    <td>{t.employee_name}</td>
                    <td>{t.manager_id}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          backgroundColor:
                            t.priority === 'urgent'
                              ? 'var(--danger-bg)'
                              : t.priority === 'high'
                              ? 'var(--warning-bg)'
                              : 'var(--bg-surface)',
                          color:
                            t.priority === 'urgent'
                              ? 'var(--danger)'
                              : t.priority === 'high'
                              ? 'var(--warning)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor:
                            t.status === 'completed'
                              ? 'var(--success-bg)'
                              : t.status === 'in_progress'
                              ? 'var(--primary-light)'
                              : 'var(--bg-surface)',
                          color:
                            t.status === 'completed'
                              ? 'var(--success)'
                              : t.status === 'in_progress'
                              ? 'var(--primary)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {(t.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {(((t.tracked_seconds || 0) / 3600)).toFixed(1)}h
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
