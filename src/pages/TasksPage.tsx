import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, X, CheckSquare, FolderKanban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import type { TaskItem } from '../types/roles';

import { useAppRefresh } from '../hooks/useAppRefresh';
import { RefreshButton } from '../components/common/RefreshButton';
interface TasksPageProps {
  onStartTask: (title: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onStartTask }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [list, projList] = await Promise.all([
        dataService.getTasks('employee', undefined, user.id),
        dataService.getProjects('employee'),
      ]);
      setTasks(list);
      setProjects(projList || []);
      if (projList && projList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projList[0].id);
      }
    } catch (err) {
      console.error('Failed to load employee tasks:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'tasks') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [user.id]);

  const toggleTaskStatus = async (task: TaskItem) => {
    const nextStatus: TaskItem['status'] =
      task.status === 'completed' ? 'in_progress' : 'completed';
    try {
      await dataService.updateTaskStatus('employee', task.id, nextStatus);
      dataService.logAction(
        user.name,
        'employee',
        nextStatus === 'completed' ? 'COMPLETE_TASK' : 'REOPEN_TASK',
        task.title,
        `Task status changed to ${nextStatus}`
      );
      loadData();
    } catch (err: any) {
      alert(`Failed to update task: ${err.message}`);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreateError(null);

    const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0];

    try {
      await dataService.createTask('employee', {
        title: newTaskTitle.trim(),
        project_id: activeProj?.id || '',
        project_name: activeProj?.name || 'General',
        employee_id: user.id,
        employee_name: user.name,
        manager_id: user.assigned_manager_id || '',
        priority: 'medium',
        status: 'in_progress',
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });

      dataService.logAction(
        user.name,
        'employee',
        'CREATE_TASK',
        newTaskTitle,
        'Employee created custom task'
      );

      setNewTaskTitle('');
      setIsAdding(false);
      loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create task');
    }
  };

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
            <span>Sprint Deliverables</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            My Assigned Tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Directly synced from Supabase tasks &bull; Integrated task stopwatch
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-pill btn-pill-primary"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={15} />
            <span>Add Custom Task</span>
          </button>
          <RefreshButton onRefresh={loadData} iconOnly size={15} title="Refresh tasks" />
        </div>
      </div>

      {/* Task List Table in Frosted Card */}
      <div className="frosted-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Sprint Task Board</h3>
            <span className="status-pill active" style={{ fontSize: 10 }}>
              {tasks.filter((t) => t.status === 'completed').length}/{tasks.length} Completed
            </span>
          </div>
          <span className="live-telemetry-badge">
            <CheckSquare size={12} /> Active Sprint
          </span>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Done</th>
                <th>Task Title</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Timer</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No assigned tasks found. Create one using the button above.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <tr key={task.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleTaskStatus(task)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>
                          {task.title}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FolderKanban size={13} /> {task.project_name || 'Core Operations'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${task.priority === 'high' ? 'critical' : task.priority === 'medium' ? 'invited' : 'neutral'}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {task.due_date || 'Sprint Close'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-pill btn-pill-secondary"
                          style={{ padding: '3px 10px', fontSize: 11 }}
                          onClick={() => onStartTask(task.title)}
                        >
                          <Play size={11} />
                          <span>Track Time</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="stitch-modal-backdrop" onClick={() => setIsAdding(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Create New Task</h3>
                <button type="button" className="btn-icon-circle" onClick={() => setIsAdding(false)}>
                  <X size={16} />
                </button>
              </div>

              {createError && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--status-error-bg)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: 'var(--status-error)',
                    fontSize: 12,
                  }}
                >
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Implement real-time WebSocket listeners"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-frosted-subdued)',
                      border: '1px solid var(--surface-border-subtle)',
                      borderRadius: 'var(--radius-card-sm)',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                </div>

                {projects.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Associated Project
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--surface-frosted-subdued)',
                        border: '1px solid var(--surface-border-subtle)',
                        borderRadius: 'var(--radius-card-sm)',
                        padding: '10px 14px',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn-pill btn-pill-secondary" onClick={() => setIsAdding(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
