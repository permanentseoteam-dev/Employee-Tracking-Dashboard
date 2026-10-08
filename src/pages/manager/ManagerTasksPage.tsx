import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, CheckSquare, FolderKanban, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { TaskItem, ProjectItem, EmployeeRecord } from '../../types/roles';

interface ManagerTasksPageProps {
  initialView?: 'projects' | 'tasks';
}

export const ManagerTasksPage: React.FC<ManagerTasksPageProps> = ({ initialView = 'tasks' }) => {
  const { user, navigate } = useAuth();
  const [view, setView] = useState<'projects' | 'tasks'>(initialView);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  
  // Task Modal State
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedEmpId, setNewAssignedEmpId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskItem['priority']>('medium');
  const [newDueDate, setNewDueDate] = useState('2026-10-15');

  // Project Modal State
  const [isNewProjOpen, setIsNewProjOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjDueDate, setNewProjDueDate] = useState('2026-11-30');

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);

  const loadData = async () => {
    try {
      const [tList, pList, eList] = await Promise.all([
        dataService.getTasks('manager', user.id),
        dataService.getProjects('manager', user.id),
        dataService.getEmployees('manager', user.id),
      ]);
      setTasks(tList);
      setProjects(pList);
      setTeamEmployees(eList);
      if (eList.length > 0 && !newAssignedEmpId) setNewAssignedEmpId(eList[0].id);
      if (pList.length > 0 && !newProjectId) setNewProjectId(pList[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'tasks' || payload.table === 'projects') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user.id]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    try {
      await dataService.createProject(
        'manager',
        {
          name: newProjName.trim(),
          code: newProjCode.trim().toUpperCase() || newProjName.substring(0, 4).toUpperCase(),
          manager_id: user.id,
          manager_name: user.name,
          members_count: teamEmployees.length || 2,
          status: 'active',
          progress_percentage: 0,
          total_tasks: 0,
          due_date: newProjDueDate,
        },
        user.id
      );

      dataService.logAction(
        user.name,
        'manager',
        'CREATE_TEAM_PROJECT',
        newProjName,
        'Manager created project for team'
      );

      setIsNewProjOpen(false);
      setNewProjName('');
      setNewProjCode('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const assignedEmp = teamEmployees.find((emp) => emp.id === newAssignedEmpId);
    const proj = projects.find((p) => p.id === newProjectId);

    try {
      await dataService.createTask(
        'manager',
        {
          title: newTitle,
          project_id: proj?.id || 'proj-01',
          project_name: proj?.name || 'Assigned Project',
          employee_id: assignedEmp?.id || 'emp-001',
          employee_name: assignedEmp?.name || 'Team Member',
          manager_id: user.id,
          priority: newPriority,
          status: 'in_progress',
          due_date: newDueDate,
        },
        user.id
      );

      dataService.logAction(
        user.name,
        'manager',
        'CREATE_TEAM_TASK',
        newTitle,
        `Assigned to ${assignedEmp?.name}`
      );

      setIsNewTaskOpen(false);
      setNewTitle('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskItem['status']) => {
    try {
      await dataService.updateTaskStatus('manager', taskId, status);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
            <CheckSquare size={14} color="var(--color-secondary)" />
            <span>Task Delegation & Sprint Work</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Team Task & Project Operations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Delegate sprint tasks to members and track milestone delivery in real time
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Segmented View Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${view === 'projects' ? 'active' : ''}`}
              onClick={() => {
                setView('projects');
                navigate('/manager/projects');
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
                navigate('/manager/tasks');
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
            <button className="btn-pill btn-pill-primary" onClick={() => setIsNewProjOpen(true)}>
              <Plus size={15} />
              <span>Create Project</span>
            </button>
          ) : (
            <button className="btn-pill btn-pill-primary" onClick={() => setIsNewTaskOpen(true)}>
              <Plus size={15} />
              <span>Create Team Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects view */}
      {view === 'projects' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {projects.map((proj) => (
            <div key={proj.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{proj.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{proj.code}</div>
                </div>
                <span className="live-telemetry-badge">{proj.progress_percentage}%</span>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Tasks: <strong style={{ color: 'var(--text-primary)' }}>{proj.completed_tasks}</strong> / {proj.total_tasks}</span>
                <span>Due: {proj.due_date}</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No team projects found. Click "Create Project" to start one.
            </div>
          )}
        </div>
      )}

      {/* Tasks Table */}
      {view === 'tasks' && (
        <div className="frosted-card">
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Active Team Tasks</span>
              <span className="live-telemetry-badge">{tasks.length} items</span>
            </div>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Project</th>
                  <th>Assigned Member</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Tracked Hours</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{task.project_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="avatar-chip" style={{ width: 24, height: 24, fontSize: 10 }}>
                          {task.employee_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span>{task.employee_name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          task.priority === 'urgent'
                            ? 'critical'
                            : task.priority === 'high'
                            ? 'late'
                            : 'neutral'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <select
                        className="stitch-select"
                        style={{ padding: '4px 10px', fontSize: 11, width: 120 }}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="todo">To Do</option>
                        <option value="paused">Paused</option>
                      </select>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {(((task.tracked_seconds || 0) / 3600)).toFixed(1)}h
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.due_date}</td>
                    <td style={{ textAlign: 'right' }}>
                      {task.status !== 'completed' && (
                        <button
                          className="btn-pill btn-pill-secondary"
                          style={{ padding: '3px 10px', fontSize: 11 }}
                          onClick={() => handleStatusChange(task.id, 'completed')}
                        >
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No team tasks logged. Click "Create Team Task" to assign one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isNewProjOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsNewProjOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderKanban size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Create Team Project</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsNewProjOpen(false)}
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
                  placeholder="e.g. TEL-CORE"
                  value={newProjCode}
                  onChange={(e) => setNewProjCode(e.target.value)}
                />
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
                  onClick={() => setIsNewProjOpen(false)}
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

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsNewTaskOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Create & Assign Team Task</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsNewTaskOpen(false)}
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
                  placeholder="e.g. Implement WebRTC audio streaming"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign To Member</label>
                <select
                  className="stitch-select"
                  value={newAssignedEmpId}
                  onChange={(e) => setNewAssignedEmpId(e.target.value)}
                >
                  {teamEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Project</label>
                <select
                  className="stitch-select"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="stitch-form-group">
                  <label className="stitch-label">Priority</label>
                  <select
                    className="stitch-select"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
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
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsNewTaskOpen(false)}
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
