import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Save, Trash2, Shield, Eye, Pencil, Users, FolderKanban, Folder, FileText, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { buildResourcePath } from '../../utils/projectAccess';
import type {
  EmployeeRecord,
  ProjectAccessLevel,
  ProjectAccessScope,
  ProjectItem,
  ProjectMemberAssignment,
  ProjectTreeItem,
} from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
const ALL_EMPLOYEES = '__all__';

export const ProjectAllocationsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [assignments, setAssignments] = useState<ProjectMemberAssignment[]>([]);
  const [treeItems, setTreeItems] = useState<ProjectTreeItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [access, setAccess] = useState<ProjectAccessLevel>('edit');
  const [scope, setScope] = useState<ProjectAccessScope>('project');
  const [resourceId, setResourceId] = useState('');
  const [includeDescendants, setIncludeDescendants] = useState(true);
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

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [user.id]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTreeItems([]);
      return;
    }
    dataService.listProjectItems(selectedProjectId).then(setTreeItems).catch(console.error);
    setResourceId('');
  }, [selectedProjectId]);

  const projectAssignments = useMemo(
    () => assignments.filter((a) => a.project_id === selectedProjectId),
    [assignments, selectedProjectId]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const folders = useMemo(
    () => treeItems.filter((i) => i.item_type === 'folder'),
    [treeItems]
  );
  const files = useMemo(
    () => treeItems.filter((i) => i.item_type !== 'folder'),
    [treeItems]
  );

  const scopeLabel = (a: ProjectMemberAssignment) => {
    if (a.scope === 'project' || !a.scope) return 'Whole project';
    if (a.scope === 'folder') {
      const base = a.resource_path || a.resource_name || a.resource_id || 'Folder';
      return a.include_descendants === false ? `Folder only: ${base}` : `Folder + children: ${base}`;
    }
    return `File: ${a.resource_path || a.resource_name || a.resource_id}`;
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedEmployeeId) return;
    if (scope !== 'project' && !resourceId) {
      alert('Pick a folder or file for scoped access.');
      return;
    }

    const targets =
      selectedEmployeeId === ALL_EMPLOYEES
        ? employees
        : employees.filter((x) => x.id === selectedEmployeeId);
    if (!targets.length) return;

    const resource = treeItems.find((i) => i.id === resourceId);
    const resourcePath =
      scope !== 'project' && resourceId ? buildResourcePath(resourceId, treeItems) : undefined;

    setIsSaving(true);
    try {
      for (const emp of targets) {
        await dataService.assignUserToProject({
          projectId: selectedProjectId,
          projectName: selectedProject?.name,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email,
          access,
          scope,
          resourceId: scope === 'project' ? null : resourceId,
          resourceName: resource?.name,
          resourcePath,
          includeDescendants: scope === 'folder' ? includeDescendants : true,
          assignedBy: user.name,
          projectManagerId: user.id,
        });
      }
      const who =
        selectedEmployeeId === ALL_EMPLOYEES
          ? `All ${targets.length} employees`
          : targets[0].name;
      const where =
        scope === 'project'
          ? selectedProject?.name || 'project'
          : scope === 'folder'
            ? `folder “${resourcePath || resource?.name}”`
            : `file “${resourcePath || resource?.name}”`;
      dataService.logAction(
        user.name,
        'project_manager',
        'ASSIGN_PROJECT_MEMBER',
        `${who} → ${where}`,
        `Access: ${access}; scope: ${scope}`
      );
      setMessage(`${who} granted ${access} on ${where}.`);
      setTimeout(() => setMessage(null), 4000);
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
        'Revoked scoped access'
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
            Grant view / edit / admin on the whole project, a folder (+ children), or a single file —
            to one employee or everyone.
          </p>
        </div>
        <RefreshButton onRefresh={loadData} />
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
              <span style={{ fontSize: 16, fontWeight: 700 }}>Grant Access</span>
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
              <option value={ALL_EMPLOYEES}>All employees ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.team_name ? ` · ${emp.team_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="stitch-form-group">
            <label className="stitch-label">Scope</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  { id: 'project' as const, label: 'Whole project', icon: <FolderKanban size={13} /> },
                  { id: 'folder' as const, label: 'Folder', icon: <Folder size={13} /> },
                  { id: 'item' as const, label: 'File', icon: <FileText size={13} /> },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`nav-pill-item ${scope === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setScope(s.id);
                    setResourceId('');
                  }}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {scope === 'folder' && (
            <>
              <div className="stitch-form-group">
                <label className="stitch-label">Folder</label>
                <select
                  className="stitch-input"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  required
                >
                  <option value="">Select folder…</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {buildResourcePath(f.id, treeItems)}
                    </option>
                  ))}
                  {!folders.length && (
                    <option value="" disabled>No folders in project</option>
                  )}
                </select>
                {!folders.length && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    No folders in this project yet — create one under Projects & Folders.
                  </span>
                )}
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeDescendants}
                  onChange={(e) => setIncludeDescendants(e.target.checked)}
                />
                <CheckSquare size={14} />
                Include all nested folders & files
              </label>
            </>
          )}

          {scope === 'item' && (
            <div className="stitch-form-group">
              <label className="stitch-label">File / document</label>
              <select
                className="stitch-input"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                required
              >
                <option value="">Select file…</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {buildResourcePath(f.id, treeItems)} ({f.item_type})
                  </option>
                ))}
                {!files.length && (
                  <option value="" disabled>No files in project</option>
                )}
              </select>
              {!files.length && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  No files in this project yet.
                </span>
              )}
            </div>
          )}

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
              View = open/download · Edit = create/upload/rename · Admin = same as edit + manage
              members on this project
            </span>
          </div>

          <button
            type="submit"
            className="btn-pill btn-pill-primary"
            disabled={isSaving || !projects.length}
            style={{ marginTop: 4 }}
          >
            <Save size={15} />
            <span>{isSaving ? 'Granting…' : 'Grant access'}</span>
          </button>
        </form>

        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {selectedProject ? `${selectedProject.name} Grants` : 'Project Grants'}
              </span>
            </div>
            <span className="live-telemetry-badge">{projectAssignments.length} grants</span>
          </div>

          {projectAssignments.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              No grants on this project yet. Employees will not see it until you allocate access.
            </p>
          ) : (
            <div className="stitch-table-wrapper">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Scope</th>
                    <th>Access</th>
                    <th>Assigned</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projectAssignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {a.employee_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {a.employee_email || a.employee_id}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220 }}>
                        {scopeLabel(a)}
                      </td>
                      <td>
                        <span
                          className="status-pill active"
                          style={{
                            textTransform: 'capitalize',
                            display: 'inline-flex',
                            gap: 4,
                            alignItems: 'center',
                          }}
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
