import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  Folder,
  FolderPlus,
  File,
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  Plus,
  X,
  Upload,
  Download,
  Eye,
  Trash2,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Search,
  Paperclip,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import type { ProjectItem, ProjectFolder, ProjectFolderFile } from '../../types/roles';

interface ProjectWorkspaceProps {
  role: 'admin' | 'manager' | 'project_manager' | 'employee';
  managerId?: string;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ role, managerId }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Create Project Modal State
  const [isCreateProjOpen, setIsCreateProjOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjDueDate, setNewProjDueDate] = useState('2026-11-30');

  // 2. Create Folder Modal State
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');

  // 3. Embed File Modal State
  const [isEmbedFileOpen, setIsEmbedFileOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [embedFileName, setEmbedFileName] = useState('');
  const [embedFileDesc, setEmbedFileDesc] = useState('');
  const [embedFileDataUrl, setEmbedFileDataUrl] = useState('');
  const [embedFileSize, setEmbedFileSize] = useState<number>(0);
  const [embedFileSizeFormatted, setEmbedFileSizeFormatted] = useState('0 KB');
  const [embedFileMime, setEmbedFileMime] = useState('application/octet-stream');
  const [isDragging, setIsDragging] = useState(false);

  // 4. File Preview Modal State
  const [previewFile, setPreviewFile] = useState<ProjectFolderFile | null>(null);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const list = await dataService.getProjects(role, managerId);
      setProjects(list);
      // If a project is currently selected, refresh its folders
      if (selectedProject) {
        const updatedSelected = list.find((p) => p.id === selectedProject.id) || list[0] || null;
        setSelectedProject(updatedSelected);
        if (updatedSelected) {
          loadFolders(updatedSelected.id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async (projId: string) => {
    try {
      const fList = await dataService.getProjectFolders(projId, role);
      setFolders(fList);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [role, managerId]);

  const handleSelectProject = (proj: ProjectItem) => {
    setSelectedProject(proj);
    loadFolders(proj.id);
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    try {
      const createRole =
        role === 'admin' ? 'admin' : role === 'project_manager' ? 'project_manager' : 'manager';
      const created = await dataService.createProject(
        createRole,
        {
          name: newProjName.trim(),
          code: newProjCode.trim().toUpperCase() || newProjName.substring(0, 4).toUpperCase(),
          manager_id: managerId || user.id,
          manager_name: user.name,
          members_count: 2,
          status: 'active',
          progress_percentage: 0,
          total_tasks: 0,
          due_date: newProjDueDate,
          description: newProjDesc,
        },
        managerId
      );

      // Seed default initial folders for the new project
      await dataService.createProjectFolder(created.id, 'Project Specifications', '#3b82f6');
      await dataService.createProjectFolder(created.id, 'Deliverables & Builds', '#10b981');

      dataService.logAction(user.name, role, 'CREATE_PROJECT', newProjName, 'Created project with folder workspace');

      setIsCreateProjOpen(false);
      setNewProjName('');
      setNewProjCode('');
      setNewProjDesc('');
      await loadProjects();
      handleSelectProject(created);
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    }
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newFolderName.trim()) return;

    try {
      await dataService.createProjectFolder(selectedProject.id, newFolderName.trim(), newFolderColor);
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      loadFolders(selectedProject.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create folder');
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!selectedProject) return;
    if (!confirm('Are you sure you want to delete this folder and all its embedded files?')) return;

    try {
      await dataService.deleteProjectFolder(selectedProject.id, folderId);
      loadFolders(selectedProject.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Local File Selection
  const handleFilePicked = (file: globalThis.File) => {
    setEmbedFileName(file.name);
    setEmbedFileSize(file.size);
    setEmbedFileMime(file.type || 'application/octet-stream');

    const formatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;
    setEmbedFileSizeFormatted(formatted);

    // Read as Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setEmbedFileDataUrl((e.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  // Embed File
  const handleEmbedFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !targetFolderId || !embedFileName.trim()) return;

    try {
      await dataService.embedFileInFolder(selectedProject.id, targetFolderId, {
        name: embedFileName.trim(),
        size: embedFileSize || 1024,
        size_formatted: embedFileSizeFormatted || '1 KB',
        mime_type: embedFileMime,
        uploaded_by: user.name,
        data_url: embedFileDataUrl,
        description: embedFileDesc.trim(),
      });

      setIsEmbedFileOpen(false);
      setEmbedFileName('');
      setEmbedFileDesc('');
      setEmbedFileDataUrl('');
      setEmbedFileSize(0);
      loadFolders(selectedProject.id);
    } catch (err: any) {
      alert(err.message || 'Failed to embed file');
    }
  };

  // Delete File
  const handleDeleteFile = async (folderId: string, fileId: string) => {
    if (!selectedProject) return;
    if (!confirm('Delete this embedded file?')) return;

    try {
      await dataService.deleteFileFromFolder(selectedProject.id, folderId, fileId);
      loadFolders(selectedProject.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Download File Helper
  const handleDownloadFile = (f: ProjectFolderFile) => {
    if (f.data_url) {
      const a = document.createElement('a');
      a.href = f.data_url;
      a.download = f.name;
      a.click();
    } else {
      // Mock text payload if empty data_url
      const blob = new Blob([`Embedded Project Deliverable: ${f.name}\nSize: ${f.size_formatted}\nDescription: ${f.description || 'Verified DPAPI artifact'}`], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name.endsWith('.txt') || f.name.includes('.') ? f.name : `${f.name}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Get File Icon based on extension / mime
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext || '')) {
      return <FileImage size={18} color="#a855f7" />;
    }
    if (['json', 'js', 'ts', 'tsx', 'rs', 'py', 'html', 'css'].includes(ext || '')) {
      return <FileCode size={18} color="#f59e0b" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext || '')) {
      return <FileArchive size={18} color="#10b981" />;
    }
    if (['pdf', 'doc', 'docx', 'md', 'txt'].includes(ext || '')) {
      return <FileText size={18} color="#3b82f6" />;
    }
    return <File size={18} color="var(--text-muted)" />;
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* 1. Header with Title & Add Project (+) Icon Button */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <FolderKanban size={14} color="var(--color-secondary)" />
            <span>Workspace Operations</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            {selectedProject ? selectedProject.name : 'Projects & Deliverables Workspace'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedProject
              ? `Code: ${selectedProject.code} • Target Due: ${selectedProject.due_date} • Folder & Embedded File System`
              : 'Enterprise project repository with subfolder hierarchies and interactive file embeddings'}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedProject ? (
            <>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => setSelectedProject(null)}
              >
                <ArrowLeft size={14} />
                <span>All Projects</span>
              </button>

              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={() => setIsCreateFolderOpen(true)}
              >
                <FolderPlus size={15} />
                <span>+ New Folder</span>
              </button>
            </>
          ) : (
            <>
              {/* Global Project Search */}
              <div className="stitch-search-pill" style={{ width: 220, padding: '4px 12px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* The requested prominent + button to create projects */}
              <button
                type="button"
                className="btn-icon-circle accent"
                onClick={() => setIsCreateProjOpen(true)}
                title="Create New Project (+)"
                style={{ width: 34, height: 34 }}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={() => setIsCreateProjOpen(true)}
                title="Create New Project"
                style={{ padding: '8px 18px', fontWeight: 800, gap: 6 }}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>New Project</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Manager / Project Manager scope ribbon */}
      {(role === 'manager' || role === 'project_manager') && (
        <div
          className="frosted-card frosted-card-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.22)',
            borderRadius: 'var(--radius-card-sm)',
            fontSize: 12,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={16} color="var(--color-primary)" />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {role === 'project_manager' ? 'Project Manager Scope:' : 'Manager Workstream Scope:'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {role === 'project_manager'
                ? 'Full control of projects you own — folders, file embeds, and member allocation.'
                : 'Viewing your own managed projects and employee activity deliverables. Admin projects and folders isolated.'}
            </span>
          </div>
          <span
            className="status-pill active"
            style={{
              fontSize: 10,
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              fontWeight: 700,
            }}
          >
            Admin Isolated
          </span>
        </div>
      )}

      {/* 2. Main Content: ALL PROJECTS GRID or SELECTED PROJECT FOLDERS */}
      {!selectedProject ? (
        // Grid of Projects
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isLoading && projects.length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
              <div className="pulse-beacon" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Loading Workspaces...</h3>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
              <FolderKanban size={40} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>No projects found</h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>Click the + New Project button above to create your first project workspace.</p>
              <button
                type="button"
                className="btn-pill btn-pill-primary"
                style={{ marginTop: 14 }}
                onClick={() => setIsCreateProjOpen(true)}
              >
                <Plus size={15} />
                <span>Create First Project</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredProjects.map((proj) => (
                <motion.div
                  key={proj.id}
                  whileHover={{ y: -3 }}
                  className="frosted-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: 14,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => handleSelectProject(proj)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className="stitch-brand-icon"
                          style={{
                            width: 36,
                            height: 36,
                            background: 'var(--surface-frosted-subdued)',
                            borderRadius: 'var(--radius-card-sm)',
                          }}
                        >
                          <FolderKanban size={18} color="var(--color-secondary)" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {proj.name}
                          </h3>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-secondary)' }}>
                            [{proj.code}]
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {proj.scope_type === 'employee_activity' && (
                          <span
                            className="status-pill active"
                            style={{
                              fontSize: 10,
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              padding: '2px 8px',
                              fontWeight: 700,
                            }}
                          >
                            Employee Activity &bull; {proj.assigned_employees?.join(', ') || 'Arsal'}
                          </span>
                        )}
                        {proj.scope_type === 'manager_owned' && (
                          <span
                            className="status-pill active"
                            style={{
                              fontSize: 10,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '2px 8px',
                              fontWeight: 700,
                            }}
                          >
                            Manager Workstream
                          </span>
                        )}
                        <span className="status-pill active" style={{ fontSize: 10, padding: '2px 8px' }}>
                          {proj.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                      {proj.description || 'Active organization workstream with document folders & embedded deliverables.'}
                    </p>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Sprint Progress</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{proj.progress_percentage}%</strong>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${proj.progress_percentage}%`,
                            background: 'var(--color-secondary)',
                            borderRadius: 'var(--radius-pill)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer Stats & Open Action */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 10,
                        borderTop: '1px solid var(--surface-border-subtle)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        <span>Due: {proj.due_date}</span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--color-secondary)',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        <span>Open Workspace</span>
                        <span>&rarr;</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Quick + Add Project Card */}
              <motion.div
                whileHover={{ y: -3 }}
                className="frosted-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  minHeight: 200,
                  border: '2px dashed var(--surface-border)',
                  gap: 10,
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
                onClick={() => setIsCreateProjOpen(true)}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>+ Create New Project</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Add repository with folders & deliverables
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      ) : (
        // Detailed Project Workspace with Folders and Embedded Files
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Project Banner Stats */}
          <div
            className="frosted-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-card-sm)',
                  background: 'var(--color-secondary-container)',
                  color: 'var(--color-on-secondary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderKanban size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedProject.name}
                  </h2>
                  <span className="live-telemetry-badge">{selectedProject.code}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Lead: <strong style={{ color: 'var(--text-primary)' }}>{selectedProject.manager_name}</strong></span>
                  <span>&bull;</span>
                  <span>Target Due Date: <strong style={{ color: 'var(--text-primary)' }}>{selectedProject.due_date}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Folder Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="frosted-card frosted-card-sm" style={{ padding: '6px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Folders</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{folders.length}</div>
              </div>

              <div className="frosted-card frosted-card-sm" style={{ padding: '6px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Files</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-secondary)' }}>
                  {folders.reduce((acc, f) => acc + (f.files?.length || 0), 0)}
                </div>
              </div>

              <button
                type="button"
                className="btn-icon-circle accent"
                onClick={() => setIsCreateFolderOpen(true)}
                title="Create Folder (+)"
                style={{ width: 34, height: 34 }}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={() => setIsCreateFolderOpen(true)}
              >
                <FolderPlus size={15} />
                <span>+ Create Folder</span>
              </button>
            </div>
          </div>

          {/* Folders & Embedded Files Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Folder size={18} color="var(--color-secondary)" />
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Project Folders & Embedded Files
                </h3>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Organize deliverables, specs, and wireframes into folders with direct file embedding
              </span>
            </div>

            {folders.length === 0 ? (
              <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                <FolderPlus size={36} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No folders in this project yet</h4>
                <p style={{ fontSize: 12, marginTop: 4 }}>Create a folder to start embedding project deliverables, diagrams, and files.</p>
                <button
                  type="button"
                  className="btn-pill btn-pill-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => setIsCreateFolderOpen(true)}
                >
                  <FolderPlus size={14} />
                  <span>Create First Folder</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="frosted-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      borderTop: `3px solid ${folder.color || 'var(--color-secondary)'}`,
                    }}
                  >
                    {/* Folder Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-card-sm)',
                            background: folder.color ? `${folder.color}22` : 'var(--surface-frosted-subdued)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Folder size={17} color={folder.color || 'var(--color-secondary)'} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {folder.name}
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Created: {folder.created_at} • {folder.files?.length || 0} file(s)
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Embed File Button */}
                        <button
                          type="button"
                          className="btn-pill btn-pill-primary"
                          style={{ padding: '5px 12px', fontSize: 11, gap: 5, fontWeight: 700 }}
                          onClick={() => {
                            setTargetFolderId(folder.id);
                            setIsEmbedFileOpen(true);
                          }}
                          title="Embed a file into this folder"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                          <Upload size={12} />
                          <span>Embed File</span>
                        </button>

                        <button
                          type="button"
                          className="btn-icon-circle"
                          style={{ width: 28, height: 28 }}
                          onClick={() => handleDeleteFolder(folder.id)}
                          title="Delete folder"
                        >
                          <Trash2 size={13} color="var(--status-error)" />
                        </button>
                      </div>
                    </div>

                    {/* Files inside this folder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60 }}>
                      {(!folder.files || folder.files.length === 0) ? (
                        <div
                          style={{
                            padding: '1.25rem',
                            textAlign: 'center',
                            borderRadius: 'var(--radius-card-sm)',
                            background: 'var(--surface-frosted-subdued)',
                            border: '1px dashed var(--surface-border-subtle)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span>Empty folder. Embed project deliverables or files.</span>
                          <button
                            type="button"
                            className="btn-pill btn-pill-secondary"
                            style={{ padding: '4px 12px', fontSize: 11, gap: 5 }}
                            onClick={() => {
                              setTargetFolderId(folder.id);
                              setIsEmbedFileOpen(true);
                            }}
                          >
                            <Plus size={13} strokeWidth={2.5} />
                            <span>Embed File</span>
                          </button>
                        </div>
                      ) : (
                        folder.files.map((file) => (
                          <div
                            key={file.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-card-sm)',
                              background: 'var(--surface-frosted-subdued)',
                              border: '1px solid var(--surface-border-subtle)',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              {getFileIcon(file.name)}
                              <div style={{ overflow: 'hidden' }}>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 180,
                                  }}
                                  title={file.name}
                                >
                                  {file.name}
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                  {file.size_formatted} • {file.uploaded_at}
                                </span>
                              </div>
                            </div>

                            {/* File Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                className="btn-icon-circle"
                                style={{ width: 26, height: 26 }}
                                onClick={() => setPreviewFile(file)}
                                title="View embedded file"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon-circle"
                                style={{ width: 26, height: 26 }}
                                onClick={() => handleDownloadFile(file)}
                                title="Download file"
                              >
                                <Download size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon-circle"
                                style={{ width: 26, height: 26 }}
                                onClick={() => handleDeleteFile(folder.id, file.id)}
                                title="Delete file"
                              >
                                <Trash2 size={12} color="var(--status-error)" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}

                {/* Dashed + Create Folder Card */}
                <div
                  className="frosted-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    minHeight: 180,
                    border: '2px dashed var(--surface-border)',
                    gap: 10,
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                  onClick={() => setIsCreateFolderOpen(true)}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>+ Create Folder</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Add folder to this project
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE PROJECT (+) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCreateProjOpen && (
          <div className="stitch-modal-backdrop" onClick={() => setIsCreateProjOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 18, fontWeight: 800 }}>Create New Project Workspace</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsCreateProjOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                <div className="stitch-form-group">
                  <label className="stitch-label">Project Name *</label>
                  <input
                    type="text"
                    className="stitch-input"
                    required
                    placeholder="e.g. Core Engine Rust Daemon v2"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Project Code</label>
                    <input
                      type="text"
                      className="stitch-input"
                      placeholder="e.g. ENG-01"
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
                </div>

                <div className="stitch-form-group">
                  <label className="stitch-label">Project Scope & Description</label>
                  <textarea
                    className="stitch-input"
                    rows={3}
                    placeholder="Objectives, team deliverables, and folder requirements..."
                    value={newProjDesc}
                    onChange={(e) => setNewProjDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsCreateProjOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Create Project Workspace
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE FOLDER WITHIN PROJECT */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCreateFolderOpen && (
          <div className="stitch-modal-backdrop" onClick={() => setIsCreateFolderOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 420 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderPlus size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Create Project Folder</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsCreateFolderOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                <div className="stitch-form-group">
                  <label className="stitch-label">Folder Name *</label>
                  <input
                    type="text"
                    className="stitch-input"
                    required
                    placeholder="e.g. Design Assets, API Specs, Sprint Deliverables"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                  />
                </div>

                <div className="stitch-form-group">
                  <label className="stitch-label">Folder Color Accent</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewFolderColor(col)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: col,
                          border: newFolderColor === col ? '3px solid #ffffff' : 'none',
                          cursor: 'pointer',
                          boxShadow: newFolderColor === col ? '0 0 8px rgba(0,0,0,0.4)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsCreateFolderOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: EMBED A FILE INTO FOLDER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEmbedFileOpen && (
          <div className="stitch-modal-backdrop" onClick={() => setIsEmbedFileOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Embed File in Folder</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsEmbedFileOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleEmbedFile} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                {/* Target Folder Selector */}
                <div className="stitch-form-group">
                  <label className="stitch-label">Select Destination Folder</label>
                  <select
                    className="stitch-select"
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.files?.length || 0} files)
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Dropzone or Native File Picker */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFilePicked(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    padding: '1.75rem 1rem',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-card-sm)',
                    background: isDragging ? 'var(--color-secondary-container)' : 'var(--surface-frosted-subdued)',
                    border: '2px dashed var(--surface-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onClick={() => document.getElementById('file-embed-input')?.click()}
                >
                  <Upload size={28} color="var(--color-secondary)" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      Click to browse or drag & drop file
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Supports PDF, PNG, JPG, JSON, DOCX, ZIP, TXT (up to 50 MB)
                    </span>
                  </div>
                  <input
                    id="file-embed-input"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFilePicked(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {/* File Details (Auto populated or manual) */}
                <div className="stitch-form-group">
                  <label className="stitch-label">File Name *</label>
                  <input
                    type="text"
                    className="stitch-input"
                    required
                    placeholder="e.g. Architecture_Specification.pdf"
                    value={embedFileName}
                    onChange={(e) => setEmbedFileName(e.target.value)}
                  />
                </div>

                {embedFileSizeFormatted !== '0 KB' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-secondary)' }}>
                    <Paperclip size={13} />
                    <span>Selected File: <strong>{embedFileName}</strong> ({embedFileSizeFormatted})</span>
                  </div>
                )}

                <div className="stitch-form-group">
                  <label className="stitch-label">Deliverable Notes / Description</label>
                  <input
                    type="text"
                    className="stitch-input"
                    placeholder="e.g. Approved by engineering team for sprint deployment"
                    value={embedFileDesc}
                    onChange={(e) => setEmbedFileDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsEmbedFileOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Embed File
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW EMBEDDED FILE LIGHTBOX PREVIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewFile && (
          <div className="stitch-modal-backdrop" onClick={() => setPreviewFile(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 680, width: '92vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {getFileIcon(previewFile.name)}
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {previewFile.name}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {previewFile.size_formatted} • Uploaded by {previewFile.uploaded_by} on {previewFile.uploaded_at}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => handleDownloadFile(previewFile)}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    className="btn-icon-circle"
                    style={{ width: 30, height: 30 }}
                    onClick={() => setPreviewFile(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Preview Body */}
              <div style={{ marginTop: 14 }}>
                {previewFile.data_url && previewFile.mime_type.startsWith('image/') ? (
                  <div style={{ borderRadius: 'var(--radius-card-sm)', overflow: 'hidden', border: '1px solid var(--surface-border)', maxHeight: 380, background: '#090d16', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={previewFile.data_url}
                      alt={previewFile.name}
                      style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '1.5rem',
                      borderRadius: 'var(--radius-card-sm)',
                      background: 'var(--surface-frosted-subdued)',
                      border: '1px solid var(--surface-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={16} color="var(--status-success)" />
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Embedded Deliverable Verified</strong>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {previewFile.description || 'This file has been embedded into the project folder hierarchy and is linked to sprint deliverables.'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, borderTop: '1px solid var(--surface-border-subtle)', paddingTop: 10 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>MIME Type:</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{previewFile.mime_type}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Payload Size:</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{previewFile.size_formatted}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
