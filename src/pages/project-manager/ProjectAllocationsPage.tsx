import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Save, Trash2, RefreshCw, Shield, Eye, Pencil, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type {
  EmployeeRecord,
  ProjectAccessLevel,
  ProjectItem,
  ProjectMemberAssignment,
} from '../../types/roles';

export const ProjectAllocationsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [assignments, setAssignments] = useState<ProjectMemberAssignment[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [access, setAccess] = useState<ProjectAccessLevel>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [projList, empList, assignList] = await Promise.all([
        dataService.getProjects('project_manager', user.id),
        dataService.getEmployees('project_manager', user.id),
        dataService.getAllProjectAssignments(user.id),
      ]);
      setProjects(projList);
      setEmployees(
        empList.filter(
          (e) =>
            e.id !== user.id &&
            !e.name?.toLowerCase().includes('admin') &&
            !e.email?.toLowerCase().includes('admin')
        )
      );
      setAssignments(assignList);
      if (!selectedProjectId && projList[0]) setSelectedProjectId(projList[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const projectAssignments = useMemo(
    () => assignments.filter((a) => a.project_id === selectedProjectId),
    [assignments, selectedProjectId]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedEmployeeId) return;
    const emp = employees.find((x) => x.id === selectedEmployeeId);
    if (!emp) return;

    setIsSaving(true);
    try {
      await dataService.assignUserToProject({
        projectId: selectedProjectId,
        projectName: selectedProject?.name,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeEmail: emp.email,
        access,
        assignedBy: user.name,
        projectManagerId: user.id,
      });
      dataService.logAction(
        user.name,
        'project_manager',
        'ASSIGN_PROJECT_MEMBER',
        `${emp.name} → ${selectedProject?.name || selectedProjectId}`,
        `Access: ${access}`
      );
      setMessage(`${emp.name} allocated with ${access} access.`);
      setTimeout(() => setMessage(null), 3500);
      setSelectedEmployeeId('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to allocate user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await dataService.removeProjectAssignment(assignmentId, user.id);
      dataService.logAction(
        user.name,
        'project_manager',
        'REMOVE_PROJECT_MEMBER',
        assignmentId,
        'Revoked project access'
      );
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove assignment');
    }
  };

  const accessIcon = (level: ProjectAccessLevel) => {
    if (level === 'admin') return <Shield size={13} />;
    if (level === 'edit') return <Pencil size={13} />;
    return <Eye size={13} />;
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
            <UserPlus size={14} color="var(--color-secondary)" />
            <span>Access Control</span>
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
            User Allocation
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Grant view, edit, or admin access to employees on projects you own
          </p>
        </div>
        <button type="button" className="btn-pill btn-pill-secondary" onClick={loadData}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '1rem' }}>
        <form
          className="frosted-card"
          onSubmit={handleAssign}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Allocate Contributor</span>
            </div>
          </div>

          {message && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--status-success-bg)',
                color: 'var(--status-success)',
                borderRadius: 'var(--radius-card-sm)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          <div className="stitch-form-group">
            <label className="stitch-label">Project</label>
            <select
              className="stitch-input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="stitch-form-group">
            <label className="stitch-label">Employee</label>
            <select
              className="stitch-input"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.team_name ? ` · ${emp.team_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="stitch-form-group">
            <label className="stitch-label">Access level</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['view', 'edit', 'admin'] as ProjectAccessLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`nav-pill-item ${access === level ? 'active' : ''}`}
                  onClick={() => setAccess(level)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {accessIcon(level)}
                  <span>{level}</span>
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              View = read folders · Edit = upload/embed · Admin = manage members on this project
            </span>
          </div>

          <button
            type="submit"
            className="btn-pill btn-pill-primary"
            disabled={isSaving || !projects.length}
            style={{ marginTop: 4 }}
          >
            <Save size={15} />
            <span>{isSaving ? 'Allocating…' : 'Allocate to Project'}</span>
          </button>
        </form>

        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {selectedProject ? `${selectedProject.name} Members` : 'Project Members'}
              </span>
            </div>
            <span className="live-telemetry-badge">{projectAssignments.length} assigned</span>
          </div>

          {projectAssignments.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              No members allocated to this project yet.
            </p>
          ) : (
            <div className="stitch-table-wrapper">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Access</th>
                    <th>Assigned</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projectAssignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.employee_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.employee_email || a.employee_id}</div>
                      </td>
                      <td>
                        <span
                          className="status-pill active"
                          style={{ textTransform: 'capitalize', display: 'inline-flex', gap: 4, alignItems: 'center' }}
                        >
                          {accessIcon(a.access)}
                          {a.access}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {new Date(a.assigned_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon-circle"
                          title="Revoke access"
                          onClick={() => handleRemove(a.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectAllocationsPage;
