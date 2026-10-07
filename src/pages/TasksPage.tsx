import React, { useState } from 'react';
import { Play, CheckCircle2, Clock, Plus } from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  project: string;
  status: 'todo' | 'in_progress' | 'completed';
  timeSpent: string;
}

interface TasksPageProps {
  onStartTask: (title: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onStartTask }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 'TASK-101',
      title: 'Windows Desktop Agent Architecture & Phase 1 Scaffold',
      project: 'Agent Core',
      status: 'in_progress',
      timeSpent: '02h 45m',
    },
    {
      id: 'TASK-102',
      title: 'SQLite Migrations & Outbox Queue Idempotency',
      project: 'Storage Engine',
      status: 'todo',
      timeSpent: '00h 00m',
    },
    {
      id: 'TASK-103',
      title: 'Aggregate Keyboard & Mouse Telemetry Engine',
      project: 'Activity Monitor',
      status: 'todo',
      timeSpent: '00h 00m',
    },
  ]);

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus =
            t.status === 'in_progress' ? 'completed' : 'in_progress';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Assigned Tasks</h1>
          <p className="page-subtitle">
            Synchronized with Admin/Manager Dashboard &bull; Timestamp-tracked sessions
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            const title = prompt('Enter new task name:');
            if (title) {
              const newTask: TaskItem = {
                id: `TASK-${Date.now().toString().slice(-4)}`,
                title,
                project: 'Ad-hoc Task',
                status: 'todo',
                timeSpent: '00h 00m',
              };
              setTasks([newTask, ...tasks]);
            }
          }}
        >
          <Plus size={15} />
          <span>Add Custom Task</span>
        </button>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Active Task Queue</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {tasks.length} total tasks
          </span>
        </div>

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
                <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {task.id}
                </td>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {task.title}
                </td>
                <td>{task.project}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} color="var(--text-muted)" />
                    <span>{task.timeSpent}</span>
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
                      onClick={() => toggleTaskStatus(task.id)}
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
    </div>
  );
};
