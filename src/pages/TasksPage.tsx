import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Clock, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import type { TaskItem } from '../types/roles';

interface TasksPageProps {
  onStartTask: (title: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onStartTask }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await dataService.getTasks('employee', undefined, user.id);
      setTasks(list);
    } catch (err) {
      console.error('Failed to load employee tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'tasks') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
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

    try {
      await dataService.createTask('employee', {
        title: newTaskTitle.trim(),
        project_id: '44444444-4444-4444-4444-444444444444',
        project_name: 'Desktop Agent v2',
        employee_id: user.id,
        employee_name: user.name,
        manager_id: user.assigned_manager_id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
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
      alert(`Failed to create task: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Assigned Tasks</h1>
          <p className="page-subtitle">
            Live database sync &bull; Precision timer tracking &bull; Assigned to {user.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Tasks">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={15} />
            <span>Add Custom Task</span>
          </button>
        </div>
      </div>

      {/* Add Task Modal */}
      {isAdding && (
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
          <div className="content-card" style={{ width: 420, maxWidth: '90vw', margin: 0 }}>
            <div className="content-card-title">
              <span>Create New Task</span>
              <button className="icon-btn" onClick={() => setIsAdding(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Implement real-time WebSocket listeners"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-card">
        <div className="content-card-title">
          <span>Active Task Queue</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {tasks.length} total tasks
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            Loading your tasks from Supabase...
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            No tasks assigned yet. Click "Add Custom Task" to create one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Task Title</th>
                  <th>Project</th>
                  <th>Logged Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>
                      {task.id.substring(0, 8)}...
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {task.title}
                    </td>
                    <td>{task.project_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} color="var(--text-muted)" />
                        <span>{(task.tracked_seconds / 3600).toFixed(1)} hrs</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor:
                            task.status === 'in_progress'
                              ? 'var(--primary-light)'
                              : task.status === 'completed'
                              ? 'var(--success-bg)'
                              : 'var(--bg-surface)',
                          color:
                            task.status === 'in_progress'
                              ? 'var(--primary)'
                              : task.status === 'completed'
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {task.status === 'in_progress'
                          ? 'IN PROGRESS'
                          : task.status === 'completed'
                          ? 'COMPLETED'
                          : 'READY'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {task.status !== 'completed' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => onStartTask(task.title)}
                            title="Start Timer for this task"
                          >
                            <Play size={12} />
                            <span>Timer</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => toggleTaskStatus(task)}
                        >
                          {task.status === 'completed' ? (
                            'Reopen'
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} color="var(--success)" />
                              <span>Done</span>
                            </div>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
