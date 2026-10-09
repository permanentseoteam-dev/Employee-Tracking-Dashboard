import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ListTodo, Plus, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord, ProjectItem, TaskItem } from '../../types/roles';

export const ProjectManagerTasksPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [priority, setPriority] = useState<TaskItem['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    const [taskList, projList, empList] = await Promise.all([
      dataService.getTasks('project_manager', user.id),
      dataService.getProjects('project_manager', user.id),
      dataService.getEmployees('project_manager', user.id),
    ]);
    setTasks(taskList);
    setProjects(projList);
    setEmployees(empList.filter((e) => e.id !== user.id));
    if (!projectId && projList[0]) setProjectId(projList[0].id);
  };

  useEffect(() => {
    loadData().catch(console.error);
  }, [user.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId || !employeeId) return;
    const proj = projects.find((p) => p.id === projectId);
    const emp = employees.find((x) => x.id === employeeId);
    if (!proj || !emp) return;

    setIsSaving(true);
    try {
      await dataService.createTask(
        'project_manager',
        {
          title: title.trim(),
          project_id: projectId,
          project_name: proj.name,
          employee_id: emp.id,
          employee_name: emp.name,
          manager_id: user.id,
          priority,
          status: 'todo',
          due_date: dueDate || new Date().toISOString().slice(0, 10),
        },
        user.id
      );
      dataService.logAction(
        user.name,
        'project_manager',
        'CREATE_TASK',
        title.trim(),
        `Assigned to ${emp.name} on ${proj.name}`
      );
      setTitle('');
      setEmployeeId('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      <div className="grid-operations-header">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            <ListTodo size={14} color="var(--color-secondary)" />
            <span>Delivery Board</span>
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginTop: 2,
            }}
          >
            Project Tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Assign work items on projects you manage and track completion status
          </p>
        </div>
        <button type="button" className="btn-pill btn-pill-secondary" onClick={() => loadData()}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      <form
        className="frosted-card"
        onSubmit={handleCreate}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
      >
        <div className="stitch-form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="stitch-label">Task title</label>
          <input
            className="stitch-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Implement folder permissions UI"
            required
          />
        </div>
        <div className="stitch-form-group">
          <label className="stitch-label">Project</label>
          <select className="stitch-input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stitch-form-group">
          <label className="stitch-label">Assignee</label>
          <select className="stitch-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stitch-form-group">
          <label className="stitch-label">Priority</label>
          <select
            className="stitch-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskItem['priority'])}
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="stitch-form-group">
          <label className="stitch-label">Due date</label>
          <input className="stitch-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="btn-pill btn-pill-primary" disabled={isSaving || !projects.length}>
            <Plus size={15} />
            <span>{isSaving ? 'Saving…' : 'Create Task'}</span>
            <Save size={14} />
          </button>
        </div>
      </form>

      <div className="frosted-card">
        <div className="content-card-title" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListTodo size={18} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Task Ledger</span>
          </div>
          <span className="live-telemetry-badge">{tasks.length} items</span>
        </div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No tasks on your projects yet.</p>
        ) : (
          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.title}</td>
                    <td>{t.project_name}</td>
                    <td>{t.employee_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.priority}</td>
                    <td>
                      <span className="status-pill active" style={{ textTransform: 'capitalize' }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{t.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProjectManagerTasksPage;
