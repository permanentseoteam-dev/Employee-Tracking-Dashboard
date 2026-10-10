import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
import type {
  ProjectItem,
  ProjectMemberAssignment,
  ProjectAccessLevel,
  ProjectAccessScope,
  ProjectTreeItem,
} from '../../types/roles';

interface ProjectManagerOption {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

export const ManagerProjectAccessPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectManagers, setProjectManagers] = useState<ProjectManagerOption[]>([]);
  const [assignments, setAssignments] = useState<ProjectMemberAssignment[]>([]);
  const [treeItems, setTreeItems] = useState<ProjectTreeItem[]>([]);

  // Grant Form state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPmId, setSelectedPmId] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<ProjectAccessLevel>('admin');
  const [scope, setScope] = useState<ProjectAccessScope>('project');
  const [resourceId, setResourceId] = useState<string>('');
  const [makeLeadManager, setMakeLeadManager] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Designate/Create PM modal state
  const [isDesignateModalOpen, setIsDesignateModalOpen] = useState<boolean>(false);
  const [newPmName, setNewPmName] = useState<string>('');
  const [newPmEmail, setNewPmEmail] = useState<string>('');
  const [isDesignating, setIsDesignating] = useState<boolean>(false);

  // Table filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');

  // Status banners / toasts
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [projList, pmList, allAssigns] = await Promise.all([
        dataService.getProjects('manager', user.id),
        dataService.getProjectManagers(),
        dataService.getAllProjectAssignments(),
      ]);

      setProjects(projList);
      setProjectManagers(pmList);
      setAssignments(allAssigns);

      // Default selection if unselected
      if (!selectedProjectId && projList.length > 0) {
        setSelectedProjectId(projList[0].id);
      }
      if (!selectedPmId && pmList.length > 0) {
        setSelectedPmId(pmList[0].id);
      }
    } catch (err: any) {
      console.error('Error loading manager project access data:', err);
      showStatus('error', err?.message || 'Failed to load project allocations');
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [user.id]);

  // Load project items (folders & files) when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setTreeItems([]);
      return;
    }
    dataService
      .listProjectItems(selectedProjectId)
      .then((items) => {
        setTreeItems(items);
        setResourceId('');
      })
      .catch((err) => {
        console.error('Failed to load project items for tree:', err);
      });
  }, [selectedProjectId]);

  const folders = useMemo(
    () => treeItems.filter((item) => item.item_type === 'folder'),
    [treeItems]
  );
  const files = useMemo(
    () => treeItems.filter((item) => item.item_type !== 'folder'),
    [treeItems]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Active grants belonging to PMs or assigned by Manager
  const pmGrants = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        searchQuery === '' ||
        a.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.employee_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.project_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProject =
        filterProjectId === 'all' || a.project_id === filterProjectId;

      return matchesSearch && matchesProject;
    });
  }, [assignments, searchQuery, filterProjectId]);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedPmId) {
      showStatus('error', 'Please select both a Project and a Project Manager.');
      return;
    }

    if (scope !== 'project' && !resourceId) {
      showStatus('error', `Please select a specific ${scope} for this grant.`);
      return;
    }

    const pm = projectManagers.find((p) => p.id === selectedPmId);
    const proj = projects.find((p) => p.id === selectedProjectId);

    if (!pm || !proj) {
      showStatus('error', 'Selected project or project manager record was not found.');
      return;
    }

    let resourceName: string | undefined;
    let resourcePath: string | undefined;

    if (scope !== 'project' && resourceId) {
      const item = treeItems.find((i) => i.id === resourceId);
      resourceName = item?.name;
      resourcePath = item ? `${scope.toUpperCase()}: ${item.name}` : undefined;
    }

    setIsSubmitting(true);
    try {
      await dataService.grantProjectAccessToPM({
        managerId: user.id,
        managerName: user.name,
        projectId: proj.id,
        projectName: proj.name,
        projectManagerId: pm.id,
        projectManagerName: pm.name,
        projectManagerEmail: pm.email,
        accessLevel,
        scope,
        resourceId: scope === 'project' ? null : resourceId,
        resourceName,
        resourcePath,
        includeDescendants: true,
        makeLeadManager,
      });

      showStatus(
        'success',
        `Successfully granted ${accessLevel.toUpperCase()} access to ${pm.name} for ${proj.name}.`
      );
      await loadData();
    } catch (err: any) {
      console.error('Grant error:', err);
      showStatus('error', err?.message || 'Failed to grant project access.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeGrant = async (assignmentId: string, empName: string, projName?: string) => {
    if (!window.confirm(`Revoke project access for ${empName} on ${projName || 'this project'}?`)) {
      return;
    }

    try {
      await dataService.revokeProjectAccessFromPM(assignmentId, user.name);
      showStatus('success', `Revoked access grant for ${empName}.`);
      await loadData();
    } catch (err: any) {
      console.error('Revoke error:', err);
      showStatus('error', err?.message || 'Failed to revoke access.');
    }
  };

  const handleDesignatePm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmName.trim() || !newPmEmail.trim()) {
      showStatus('error', 'Full Name and Email are required to designate a Project Manager.');
      return;
    }

    setIsDesignating(true);
    try {
      const created = await dataService.createOrDesignateProjectManager({
        fullName: newPmName.trim(),
        email: newPmEmail.trim(),
      });

      showStatus('success', `Project Manager ${created.name} registered and ready for allocation.`);
      setIsDesignateModalOpen(false);
      setNewPmName('');
      setNewPmEmail('');

      await loadData();
      setSelectedPmId(created.id);
    } catch (err: any) {
      console.error('Designation error:', err);
      showStatus('error', err?.message || 'Failed to designate Project Manager.');
    } finally {
      setIsDesignating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: 1400 }}>
      {/* Header Banner */}
      <div className="grid-operations-header" style={{ marginBottom: 0 }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-secondary)',
            }}
          >
            <FolderKanban size={15} />
            <span>Project Governance & Access Control</span>
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginTop: 4,
            }}
          >
            Project Allocations to Project Managers
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Grant, delegate, and manage full administrative or scoped access for Project Managers across company projects.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshButton onRefresh={loadData} title="Refresh project allocations" />
          <button
            type="button"
            className="btn-pill btn-pill-primary"
            onClick={() => setIsDesignateModalOpen(true)}
            style={{ gap: 6 }}
          >
            <UserPlus size={15} />
            <span>Designate New PM</span>
          </button>
        </div>
      </div>

      {/* Notifications Alert */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background:
                statusMessage.type === 'success'
                  ? 'var(--status-success-bg)'
                  : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${
                statusMessage.type === 'success'
                  ? 'var(--status-success-border)'
                  : 'rgba(239, 68, 68, 0.3)'
              }`,
              color: statusMessage.type === 'success' ? 'var(--status-success)' : '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Stats Grid */}
      <div className="telemetry-kpi-grid">
        <div className="telemetry-kpi-tile">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Available Projects
            </span>
            <FolderKanban size={16} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {projects.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Non-admin initiatives
          </div>
        </div>

        <div className="telemetry-kpi-tile">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Project Managers
            </span>
            <UserCheck size={16} color="var(--color-secondary)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {projectManagers.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Registered delivery leads
          </div>
        </div>

        <div className="telemetry-kpi-tile">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active PM Grants
            </span>
            <ShieldCheck size={16} color="var(--status-success)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {assignments.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Granted project permissions
          </div>
        </div>

        <div className="telemetry-kpi-tile">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Lead PM Assignments
            </span>
            <ShieldAlert size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {projects.filter((p) => p.manager_id && p.manager_id !== user.id).length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Primary project owners
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Grant Project Access Form */}
        <div className="frosted-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <ShieldCheck size={20} color="var(--color-secondary)" />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
              Grant Access to Project Manager
            </h2>
          </div>

          <form onSubmit={handleGrantAccess} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Project Selection Dropdown */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Target Project <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="input-frosted"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{ padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                required
              >
                {projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} {p.manager_name ? `(Owner: ${p.manager_name})` : ''}
                    </option>
                  ))
                )}
              </select>
              {selectedProject && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Current Status: <strong>{selectedProject.status}</strong> · {selectedProject.total_tasks} tasks · {selectedProject.completed_tasks} completed
                </div>
              )}
            </div>

            {/* Project Manager Selection Dropdown */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Project Manager <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsDesignateModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={12} /> Designate New PM
                </button>
              </div>

              <select
                className="input-frosted"
                value={selectedPmId}
                onChange={(e) => setSelectedPmId(e.target.value)}
                style={{ padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                required
              >
                {projectManagers.length === 0 ? (
                  <option value="">No Project Managers registered — click Designate New PM</option>
                ) : (
                  projectManagers.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.email})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Access Level Selector */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Access Level <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(['admin', 'edit', 'view'] as ProjectAccessLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAccessLevel(lvl)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-card-sm)',
                      border: `1.5px solid ${
                        accessLevel === lvl ? 'var(--color-primary)' : 'var(--surface-border)'
                      }`,
                      background:
                        accessLevel === lvl ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface-subtle)',
                      color: accessLevel === lvl ? 'var(--color-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      textTransform: 'uppercase',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{lvl}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'none', opacity: 0.8 }}>
                      {lvl === 'admin' ? 'Full Control' : lvl === 'edit' ? 'Read/Write' : 'Read-only'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Grant Scope
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(
                  [
                    { id: 'project', label: 'Entire Project' },
                    { id: 'folder', label: 'Folder' },
                    { id: 'item', label: 'Single File' },
                  ] as { id: ProjectAccessScope; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setScope(s.id);
                      setResourceId('');
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: 'var(--radius-card-sm)',
                      border: `1px solid ${
                        scope === s.id ? 'var(--color-secondary)' : 'var(--surface-border)'
                      }`,
                      background:
                        scope === s.id ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-subtle)',
                      color: scope === s.id ? 'var(--color-secondary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-resource selection if folder or item */}
            {scope === 'folder' && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Select Target Folder <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="input-frosted"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                  required
                >
                  <option value="">-- Choose a Folder --</option>
                  {folders.length === 0 ? (
                    <option value="" disabled>No folders exist in this project</option>
                  ) : (
                    folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {scope === 'item' && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Select Target Document / File <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="input-frosted"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                  required
                >
                  <option value="">-- Choose a Document/File --</option>
                  {files.length === 0 ? (
                    <option value="" disabled>No files exist in this project</option>
                  ) : (
                    files.map((file) => (
                      <option key={file.id} value={file.id}>
                        📄 {file.name} ({file.item_type})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Make Lead Manager Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-card-sm)',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Designate as Project Lead Owner
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Updates database owner (<code>projects.manager_id</code>) to this Project Manager.
                </div>
              </div>
              <input
                type="checkbox"
                checked={makeLeadManager}
                onChange={(e) => setMakeLeadManager(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedProjectId || !selectedPmId}
              className="btn-pill btn-pill-primary"
              style={{
                padding: '11px',
                fontSize: 13,
                fontWeight: 700,
                marginTop: 6,
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <ShieldCheck size={16} />
              <span>{isSubmitting ? 'Granting Access…' : 'Grant PM Access to Project'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Active Grants List & Audit */}
        <div className="frosted-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                Active Project Manager Grants
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Current access delegations across all projects
              </p>
            </div>
            <span className="live-telemetry-badge">
              {pmGrants.length} Active Grants
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="stitch-search-pill" style={{ flex: 1, padding: '4px 10px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="search"
                placeholder="Search PM or project…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
            <select
              className="input-frosted"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-card-sm)' }}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grants List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
            {pmGrants.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                No active Project Manager grants found matching filter.
              </div>
            ) : (
              pmGrants.map((grant) => {
                const badgeColor =
                  grant.access === 'admin'
                    ? '#8b5cf6'
                    : grant.access === 'edit'
                    ? 'var(--color-primary)'
                    : 'var(--status-success)';

                return (
                  <div
                    key={grant.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-card-sm)',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--surface-border-subtle)',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {grant.employee_name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: `${badgeColor}22`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}44`,
                          }}
                        >
                          {grant.access}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Project: <strong>{grant.project_name || 'Project'}</strong> · Scope:{' '}
                        <strong>
                          {grant.scope === 'project'
                            ? 'Entire Project'
                            : grant.resource_name || grant.resource_path || grant.scope}
                        </strong>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        Assigned by: {grant.assigned_by || 'Manager'} ·{' '}
                        {new Date(grant.assigned_at).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-icon-circle"
                      onClick={() =>
                        handleRevokeGrant(grant.id, grant.employee_name, grant.project_name)
                      }
                      title="Revoke access"
                      style={{
                        width: 30,
                        height: 30,
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Designate New PM Modal */}
      <AnimatePresence>
        {isDesignateModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="frosted-card"
              style={{
                width: '100%',
                maxWidth: 440,
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-secondary)',
                  }}
                >
                  <UserPlus size={14} />
                  <span>Designate Project Manager</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  Add / Designate PM
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Register or designate a Project Manager so they can be assigned projects immediately.
                </p>
              </div>

              <form onSubmit={handleDesignatePm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-frosted"
                    placeholder="e.g. Alex Morgan"
                    value={newPmName}
                    onChange={(e) => setNewPmName(e.target.value)}
                    style={{ padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input-frosted"
                    placeholder="e.g. alex.pm@company.com"
                    value={newPmEmail}
                    onChange={(e) => setNewPmEmail(e.target.value)}
                    style={{ padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-card-sm)' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsDesignateModalOpen(false)}
                    disabled={isDesignating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-pill btn-pill-primary"
                    disabled={isDesignating}
                  >
                    {isDesignating ? 'Designating…' : 'Confirm PM'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
