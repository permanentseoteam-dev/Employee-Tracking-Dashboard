import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Users,
  ListTodo,
  CheckCircle2,
  ArrowUpRight,
  UserPlus,
  Activity,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { greetUser } from '../../utils/datetime';
import type { ProjectItem, ProjectMemberAssignment, TaskItem } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface ProjectManagerDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const ProjectManagerDashboardPage: React.FC<ProjectManagerDashboardPageProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [assignments, setAssignments] = useState<ProjectMemberAssignment[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const loadData = async () => {
    try {
      const [projList, assignList, taskList] = await Promise.all([
        dataService.getProjects('project_manager', user.id),
        dataService.getAllProjectAssignments(user.id),
        dataService.getTasks('project_manager', user.id),
      ]);
      setProjects(projList);
      setAssignments(assignList);
      setTasks(taskList);
    } catch (e) {
      console.error(e);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const uniqueMembers = new Set(assignments.map((a) => a.employee_id)).size;
  const openTasks = tasks.filter((t) => t.status !== 'completed').length;
  const doneTasks = tasks.filter((t) => t.status === 'completed').length;
  const avgProgress =
    projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.progress_percentage || 0), 0) / projects.length)
      : 0;

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
            <span className="pulse-beacon" />
            <span>Project Delivery Console</span>
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
            {greetUser(user.name)}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Own projects, control folder access, and allocate contributors across delivery streams
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <RefreshButton onRefresh={loadData} title="Refresh dashboard" />
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              onClick={() => onNavigate('/project-manager/projects')}
            >
              <FolderKanban size={15} />
              <span>Open Projects</span>
            </button>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={() => onNavigate('/project-manager/allocations')}
            >
              <UserPlus size={15} />
              <span>Allocate Users</span>
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Active Projects</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <FolderKanban size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{activeProjects}</div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {completedProjects} completed · {projects.length} total
          </span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Allocated Users</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Users size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{uniqueMembers}</div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {assignments.length} access grants across projects
          </span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Open Tasks</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}
            >
              <ListTodo size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{openTasks}</div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{doneTasks} completed this portfolio</span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Avg Progress</span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(168, 85, 247, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a855f7',
              }}
            >
              <Activity size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{avgProgress}%</div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Across owned project portfolio</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem' }}>
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderKanban size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Portfolio Snapshot</span>
            </div>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigate('/project-manager/projects')}
              title="Open projects"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          {projects.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              No projects yet. Create your first workspace to start allocating members and folders.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                    border: '1px solid var(--surface-border-subtle)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.code} · {p.members_count || 0} members · {p.status}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-primary)' }}>
                      {p.progress_percentage}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {p.completed_tasks}/{p.total_tasks} tasks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Delivery Checklist</span>
            </div>
            <span className="live-telemetry-badge">PM</span>
          </div>
          {[
            { t: 'Define project workspaces & folders', d: 'Specs, builds, and shared assets' },
            { t: 'Allocate contributors with access levels', d: 'View / Edit / Admin grants' },
            { t: 'Assign sprint tasks to members', d: 'Track delivery against due dates' },
            { t: 'Review progress & close completed work', d: 'Keep portfolio velocity visible' },
          ].map((item) => (
            <div
              key={item.t}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-card-sm)',
                background: 'var(--surface-frosted-subdued)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <Clock size={14} color="var(--color-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.t}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectManagerDashboardPage;
