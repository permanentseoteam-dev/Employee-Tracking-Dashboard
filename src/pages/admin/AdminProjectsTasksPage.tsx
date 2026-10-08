import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderKanban, CheckSquare, RefreshCw, Search, Plus, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import type { ProjectItem, TaskItem, EmployeeRecord, ManagerRecord } from '../../types/roles';

interface AdminProjectsTasksPageProps {
  initialView?: 'projects' | 'tasks';
}

export const AdminProjectsTasksPage: React.FC<AdminProjectsTasksPageProps> = ({ initialView = 'projects' }) => {
  const { navigate } = useAuth();
  const [view, setView] = useState<'projects' | 'tasks'>(initialView);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Project Modal State
  const [isAddProjOpen, setIsAddProjOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjManagerId, setNewProjManagerId] = useState('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  const [newProjDueDate, setNewProjDueDate] = useState('2026-11-30');

  // Create Task Modal State
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjId, setNewTaskProjId] = useState('');
  const [newTaskEmpId, setNewTaskEmpId] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskItem['priority']>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-10-20');

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);

  const loadData = async () => {
    try {
      const [pList, tList, empList, mgrList] = await Promise.all([
        dataService.getProjects('admin'),
        dataService.getTasks('admin'),
        dataService.getEmployees('admin'),
        dataService.getManagers('admin'),
      ]);
      setProjects(pList);
      setTasks(tList);
      setEmployees(empList);
      setManagers(mgrList);
      if (pList.length > 0 && !newTaskProjId) setNewTaskProjId(pList[0].id);
      if (empList.length > 0 && !newTaskEmpId) setNewTaskEmpId(empList[0].id);
      if (mgrList.length > 0 && !newProjManagerId) setNewProjManagerId(mgrList[0].id);
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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    const mgr = managers.find((m) => m.id === newProjManagerId);

    try {
      await dataService.createProject('admin', {
        name: newProjName.trim(),
        code: newProjCode.trim().toUpperCase() || newProjName.substring(0, 4).toUpperCase(),
        manager_id: newProjManagerId,
        manager_name: mgr?.name || 'Alex Vance',
        members_count: 2,
        status: 'active',
        progress_percentage: 0,
        total_tasks: 0,
        due_date: newProjDueDate,
      });

      dataService.logAction('Super Admin', 'admin', 'CREATE_PROJECT', newProjName, 'Created organization project');
      setIsAddProjOpen(false);
      setNewProjName('');
      setNewProjCode('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const assignedEmp = employees.find((emp) => emp.id === newTaskEmpId);
    const proj = projects.find((p) => p.id === newTaskProjId);

    try {
      await dataService.createTask('admin', {
        title: newTaskTitle.trim(),
        project_id: proj?.id || 'proj-01',
        project_name: proj?.name || 'Assigned Project',
        employee_id: assignedEmp?.id || 'emp-001',
        employee_name: assignedEmp?.name || 'Team Member',
        manager_id: assignedEmp?.manager_id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        priority: newTaskPriority,
        status: 'in_progress',
        due_date: newTaskDueDate,
      });

      dataService.logAction('Super Admin', 'admin', 'CREATE_TASK', newTaskTitle, `Assigned to ${assignedEmp?.name}`);
      setIsAddTaskOpen(false);
      setNewTaskTitle('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
              onClick={() => {
                setView('projects');
                navigate('/admin/projects');
              }}
            >
              <FolderKanban size={14} />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${view === 'tasks' ? 'active' : ''}`}
              onClick={() => {
                setView('tasks');
                navigate('/admin/tasks');
              }}
            >
              <CheckSquare size={14} />
              <span>Tasks ({tasks.length})</span>
            </button>
          </div>

          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          {view === 'projects' ? (
            <button className="btn-pill btn-pill-primary" onClick={() => setIsAddProjOpen(true)}>
              <Plus size={15} />
              <span>Create Project</span>
            </button>
          ) : (
            <button className="btn-pill btn-pill-primary" onClick={() => setIsAddTaskOpen(true)}>
              <Plus size={15} />
              <span>Create Task</span>
            </button>
          )}
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

      {/* Create Project Modal */}
      {isAddProjOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAddProjOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderKanban size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Create New Project</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsAddProjOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Project Name</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Core Telemetry Service"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Project Code</label>
                <input
                  type="text"
                  className="stitch-input"
                  placeholder="e.g. CORE-TEL"
                  value={newProjCode}
                  onChange={(e) => setNewProjCode(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Project Lead Manager</label>
                <select
                  className="stitch-select"
                  value={newProjManagerId}
                  onChange={(e) => setNewProjManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Target Due Date</label>
                <input
                  type="date"
                  className="stitch-input"
                  value={newProjDueDate}
                  onChange={(e) => setNewProjDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsAddProjOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isAddTaskOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAddTaskOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Create & Assign Task</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsAddTaskOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Task Title</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Optimize SQLite WAL checkpoint frequency"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign Project</label>
                <select
                  className="stitch-select"
                  value={newTaskProjId}
                  onChange={(e) => setNewTaskProjId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign Employee</label>
                <select
                  className="stitch-select"
                  value={newTaskEmpId}
                  onChange={(e) => setNewTaskEmpId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="stitch-form-group">
                  <label className="stitch-label">Priority</label>
                  <select
                    className="stitch-select"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="stitch-form-group">
                  <label className="stitch-label">Due Date</label>
                  <input
                    type="date"
                    className="stitch-input"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsAddTaskOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
