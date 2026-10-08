import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { TaskItem, ProjectItem, EmployeeRecord } from '../../types/roles';

export const ManagerTasksPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedEmpId, setNewAssignedEmpId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskItem['priority']>('medium');
  const [newDueDate, setNewDueDate] = useState('2026-10-15');

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
      if (eList.length > 0) setNewAssignedEmpId(eList[0].id);
      if (pList.length > 0) setNewProjectId(pList[0].id);
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Task & Project Operations</h1>
          <p className="page-subtitle">
            Delegate tasks to team members &bull; Track project milestones and deliverables
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsNewTaskOpen(true)}>
            <Plus size={15} />
            <span>Create Team Task</span>
          </button>
        </div>
      </div>

      {/* Projects summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        {projects.map((proj) => (
          <div key={proj.id} className="content-card" style={{ marginBottom: 0 }}>
            <div className="content-card-title">
              <div>
                <span style={{ fontSize: 14 }}>{proj.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{proj.code}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{proj.progress_percentage}%</span>
            </div>
            <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${proj.progress_percentage}%`, backgroundColor: 'var(--primary)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Tasks: {proj.completed_tasks} / {proj.total_tasks} completed</span>
              <span>Due: {proj.due_date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="content-card">
        <div className="content-card-title">
          <span>Active Team Tasks ({tasks.length})</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Project</th>
                <th>Assigned Member</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Tracked Hours</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td style={{ fontWeight: 600 }}>{task.title}</td>
                  <td>{task.project_name}</td>
                  <td>{task.employee_name}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        backgroundColor:
                          task.priority === 'urgent'
                            ? 'var(--danger-bg)'
                            : task.priority === 'high'
                            ? 'var(--warning-bg)'
                            : 'var(--bg-surface)',
                        color:
                          task.priority === 'urgent'
                            ? 'var(--danger)'
                            : task.priority === 'high'
                            ? 'var(--warning)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '2px 6px', fontSize: 11, width: 110 }}
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                    >
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="todo">To Do</option>
                      <option value="paused">Paused</option>
                    </select>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{(task.tracked_seconds / 3600).toFixed(1)}h</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.due_date}</td>
                  <td>
                    {task.status !== 'completed' && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleStatusChange(task.id, 'completed')}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="content-card" style={{ width: 440, maxWidth: '90vw', margin: 0 }}>
            <div className="content-card-title">
              <span>Create & Assign Team Task</span>
              <button className="icon-btn" onClick={() => setIsNewTaskOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Implement WebSocket reconnection retry"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign To Team Member</label>
                <select
                  className="form-input"
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

              <div className="form-group">
                <label className="form-label">Project</label>
                <select
                  className="form-input"
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
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewTaskOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
