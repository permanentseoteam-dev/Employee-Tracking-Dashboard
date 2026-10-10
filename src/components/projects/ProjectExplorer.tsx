import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderKanban,
  FileUp,
  Globe,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Pencil,
  Download,
  Copy,
  FolderInput,
  X,
  Check,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import {
  canEdit as accessCanEdit,
  resolveItemAccess,
  resolveProjectAccess,
} from '../../utils/projectAccess';
import {
  parseAndTransformEmbedUrl,
  extractUrlFromHtml,
  normalizeRawUrl,
  type EmbedUrlInfo,
} from '../../utils/embedUrl';
import type {
  ProjectAccessLevel,
  ProjectItem,
  ProjectMemberAssignment,
  ProjectTreeItem,
  ProjectTreeItemType,
  UserRole,
} from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface ProjectExplorerProps {
  role: UserRole;
  managerId?: string;
}

type CreateMenuKind = 'project' | 'folder' | 'file';

function itemIcon(type: ProjectTreeItemType, size = 16) {
  switch (type) {
    case 'folder':
      return <Folder size={size} color="#f59e0b" />;
    case 'embed':
      return <Globe size={size} color="#06b6d4" />;
    default:
      return <FileUp size={size} color="var(--text-muted)" />;
  }
}

function normalizeUrl(url: string): string {
  return normalizeRawUrl(url);
}

function getEmbedUrl(item: ProjectTreeItem): string {
  const raw = item.embed_url || (item.content as any)?.embed_url || item.data_url || '';
  if (!raw) return '';
  return parseAndTransformEmbedUrl(raw).embedUrl;
}

function getOriginalUrl(item: ProjectTreeItem): string {
  const content = item.content as any;
  if (content?.original_url) return content.original_url;
  if (item.data_url && /^https?:\/\//i.test(item.data_url)) return item.data_url;
  const raw = item.embed_url || content?.embed_url || '';
  if (!raw) return '';
  return parseAndTransformEmbedUrl(raw).originalUrl;
}

function getEmbedInfo(item: ProjectTreeItem): EmbedUrlInfo {
  const raw = item.embed_url || (item.content as any)?.embed_url || item.data_url || '';
  return parseAndTransformEmbedUrl(raw);
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ role, managerId }) => {
  const { user, navigate } = useAuth();
  const isEmployee = role === 'employee';
  const isPrivileged = role === 'admin' || role === 'manager' || role === 'project_manager';
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [itemsByProject, setItemsByProject] = useState<Record<string, ProjectTreeItem[]>>({});
  const [grantsByProject, setGrantsByProject] = useState<Record<string, ProjectMemberAssignment[]>>(
    {}
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fileMenuOpen, setFileMenuOpen] = useState<string | null>(null);
  const [createMenu, setCreateMenu] = useState<{
    projectId: string;
    parentId: string | null;
    kind: CreateMenuKind;
    preferredType?: ProjectTreeItemType;
  } | null>(null);
  const [createModalTab, setCreateModalTab] = useState<'embed' | 'upload'>('embed');
  const [embedUrlDraft, setEmbedUrlDraft] = useState('');
  const [embedViewerItem, setEmbedViewerItem] = useState<ProjectTreeItem | null>(null);
  const [embedEditMode, setEmbedEditMode] = useState(false);
  const [embedViewMode, setEmbedViewMode] = useState<'embed' | 'card'>('embed');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [editEmbedUrlDraft, setEditEmbedUrlDraft] = useState('');
  const [editEmbedNameDraft, setEditEmbedNameDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [renameTarget, setRenameTarget] = useState<{
    scope: 'project' | 'item';
    projectId: string;
    id: string;
    name: string;
  } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    projectId: string;
    itemId: string;
    name: string;
  } | null>(null);
  const [moveParentId, setMoveParentId] = useState<string>('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadCtx = useRef<{ projectId: string; parentId: string | null } | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await dataService.getProjects(role, managerId || user.id, user.id);
      setProjects(list);
    } catch (e: any) {
      showToast('err', e?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [role, managerId, user.id]);

  const loadItems = useCallback(
    async (projectId: string) => {
      try {
        const items = await dataService.listProjectItems(
          projectId,
          isEmployee ? { role: 'employee', employeeId: user.id } : undefined
        );
        setItemsByProject((prev) => ({ ...prev, [projectId]: items }));
        if (isEmployee) {
          const grants = await dataService.getEmployeeProjectGrants(user.id, projectId);
          setGrantsByProject((prev) => ({ ...prev, [projectId]: grants }));
        }
      } catch (e: any) {
        showToast('err', e?.message || 'Failed to load project items');
      }
    },
    [isEmployee, user.id]
  );

  const refreshExplorer = useCallback(async () => {
    await loadProjects();
    const openIds = Array.from(expandedProjects);
    await Promise.all(openIds.map((id) => loadItems(id)));
  }, [loadProjects, loadItems, expandedProjects]);

  useAppRefresh(refreshExplorer);

  const ownsProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    return !!(p && (p.manager_id === user.id || p.manager_id === managerId));
  };

  const itemAccessLevel = (projectId: string, itemId: string): ProjectAccessLevel | null => {
    if (isPrivileged || ownsProject(projectId)) return 'admin';
    const grants = grantsByProject[projectId] || [];
    const items = itemsByProject[projectId] || [];
    return resolveItemAccess(grants, itemId, items);
  };

  const canMutate = (projectId: string, itemId?: string | null) => {
    if (isPrivileged || ownsProject(projectId)) return true;
    if (itemId) return accessCanEdit(itemAccessLevel(projectId, itemId));
    // Root writes need an explicit whole-project edit/admin grant (not folder-only)
    const rootGrants = (grantsByProject[projectId] || []).filter(
      (g) => (g.scope || 'project') === 'project'
    );
    return accessCanEdit(resolveProjectAccess(rootGrants));
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('stitch_project_explorer_expanded');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.projects)) setExpandedProjects(new Set(parsed.projects));
        if (Array.isArray(parsed.folders)) setExpandedFolders(new Set(parsed.folders));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'stitch_project_explorer_expanded',
        JSON.stringify({
          projects: Array.from(expandedProjects),
          folders: Array.from(expandedFolders),
        })
      );
    } catch {
      /* ignore */
    }
  }, [expandedProjects, expandedFolders]);

  const toggleProject = async (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    if (!itemsByProject[projectId]) await loadItems(projectId);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      if (p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)) return true;
      const items = itemsByProject[p.id] || [];
      return items.some((i) => i.name.toLowerCase().includes(q));
    });
  }, [projects, searchQuery, itemsByProject]);

  const childrenOf = (projectId: string, parentId: string | null) => {
    const items = itemsByProject[projectId] || [];
    return items
      .filter((i) => (i.parent_id || null) === parentId)
      .sort((a, b) => {
        if (a.item_type === 'folder' && b.item_type !== 'folder') return -1;
        if (a.item_type !== 'folder' && b.item_type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const folderOptions = (projectId: string) =>
    (itemsByProject[projectId] || []).filter((i) => i.item_type === 'folder');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) {
      showToast('err', 'Project name is required');
      return;
    }
    setBusy(true);
    try {
      const created = await dataService.createProject(
        role,
        {
          name,
          code: name.substring(0, 4).toUpperCase(),
          manager_id: managerId || user.id,
          manager_name: user.name,
          members_count: 1,
          status: 'active',
          progress_percentage: 0,
          total_tasks: 0,
          completed_tasks: 0,
          due_date: '',
          description: '',
        } as any,
        managerId || user.id
      );
      dataService.logAction(user.name, role, 'CREATE_PROJECT', name, 'Created via Project Explorer');
      setNewProjectOpen(false);
      setNewProjectName('');
      await loadProjects();
      setExpandedProjects((prev) => new Set(prev).add(created.id));
      await loadItems(created.id);
      showToast('ok', `Project “${name}” created`);
    } catch (err: any) {
      showToast('err', err?.message || 'Failed to create project');
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (
    projectId: string,
    parentId: string | null,
    kind: CreateMenuKind,
    preferredType?: ProjectTreeItemType
  ) => {
    if (!canMutate(projectId, parentId)) {
      showToast('err', 'View-only access — ask your project manager for edit rights');
      return;
    }
    setCreateMenu({ projectId, parentId, kind, preferredType });
    setNameDraft(kind === 'folder' ? 'New Folder' : '');
    setEmbedUrlDraft('');
    setCreateModalTab(preferredType === 'uploaded_file' ? 'upload' : 'embed');
    setFileMenuOpen(null);
  };

  const handleCreateFolder = async () => {
    if (!createMenu) return;
    const name = nameDraft.trim();
    if (!name) {
      showToast('err', 'Folder name is required');
      return;
    }
    setBusy(true);
    try {
      await dataService.createProjectItem({
        projectId: createMenu.projectId,
        parentId: createMenu.parentId,
        itemType: 'folder',
        name,
        createdBy: user.id,
      });
      await loadItems(createMenu.projectId);
      if (createMenu.parentId) {
        setExpandedFolders((prev) => new Set(prev).add(createMenu.parentId!));
      }
      setExpandedProjects((prev) => new Set(prev).add(createMenu.projectId));
      setCreateMenu(null);
      setNameDraft('');
      showToast('ok', `Folder “${name}” created`);
    } catch (err: any) {
      showToast('err', err?.message || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEmbed = async () => {
    if (!createMenu) return;
    const name = nameDraft.trim();
    const rawUrl = embedUrlDraft.trim();
    if (!name) {
      showToast('err', 'Name is required');
      return;
    }
    if (!rawUrl) {
      showToast('err', 'Embed URL is required');
      return;
    }
    const info = parseAndTransformEmbedUrl(rawUrl);
    setBusy(true);
    try {
      const item = await dataService.createProjectItem({
        projectId: createMenu.projectId,
        parentId: createMenu.parentId,
        itemType: 'embed',
        name,
        embedUrl: info.embedUrl,
        dataUrl: info.originalUrl,
        content: {
          embed_url: info.embedUrl,
          original_url: info.originalUrl,
          provider: info.provider,
          format: 'embed',
        },
        createdBy: user.id,
      });
      await loadItems(createMenu.projectId);
      if (createMenu.parentId) {
        setExpandedFolders((prev) => new Set(prev).add(createMenu.parentId!));
      }
      setExpandedProjects((prev) => new Set(prev).add(createMenu.projectId));
      setCreateMenu(null);
      setNameDraft('');
      setEmbedUrlDraft('');
      showToast('ok', `Embed link “${item.name}” added`);
      openEditor(item);
    } catch (err: any) {
      showToast('err', err?.message || 'Failed to add embed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEmbedEdit = async () => {
    if (!embedViewerItem) return;
    const rawUrl = editEmbedUrlDraft.trim();
    const newName = editEmbedNameDraft.trim() || embedViewerItem.name;
    if (!rawUrl) {
      showToast('err', 'Valid embed URL is required');
      return;
    }
    const info = parseAndTransformEmbedUrl(rawUrl);
    setBusy(true);
    try {
      await dataService.updateProjectItem(embedViewerItem.project_id, embedViewerItem.id, {
        name: newName,
        embed_url: info.embedUrl,
        data_url: info.originalUrl,
        content: {
          ...(typeof embedViewerItem.content === 'object' && embedViewerItem.content !== null ? embedViewerItem.content : {}),
          embed_url: info.embedUrl,
          original_url: info.originalUrl,
          provider: info.provider,
          format: 'embed',
        },
      });
      await loadItems(embedViewerItem.project_id);
      setEmbedViewerItem({
        ...embedViewerItem,
        name: newName,
        embed_url: info.embedUrl,
        data_url: info.originalUrl,
        external_provider: info.provider,
        content: {
          ...(typeof embedViewerItem.content === 'object' && embedViewerItem.content !== null ? embedViewerItem.content : {}),
          embed_url: info.embedUrl,
          original_url: info.originalUrl,
          provider: info.provider,
          format: 'embed',
        },
      });
      setEmbedEditMode(false);
      setIframeKey((k) => k + 1);
      setIframeLoading(true);
      showToast('ok', 'Embed updated successfully');
    } catch (err: any) {
      showToast('err', err?.message || 'Failed to update embed');
    } finally {
      setBusy(false);
    }
  };

  const triggerUpload = (projectId: string, parentId: string | null) => {
    if (!canMutate(projectId, parentId)) {
      showToast('err', 'View-only access');
      return;
    }
    uploadCtx.current = { projectId, parentId };
    uploadRef.current?.click();
  };

  const onUploadPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadCtx.current) return;
    const { projectId, parentId } = uploadCtx.current;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      await dataService.createProjectItem({
        projectId,
        parentId,
        itemType: 'uploaded_file',
        name: file.name,
        dataUrl,
        mimeType: file.type || 'application/octet-stream',
        createdBy: user.id,
        content: { size: file.size, format: 'uploaded_file' },
      });
      await loadItems(projectId);
      if (parentId) setExpandedFolders((prev) => new Set(prev).add(parentId));
      showToast('ok', `Uploaded “${file.name}”`);
    } catch (err: any) {
      showToast('err', err?.message || 'Upload failed');
    } finally {
      setBusy(false);
      uploadCtx.current = null;
    }
  };

  const openEditor = (item: ProjectTreeItem) => {
    if (item.item_type === 'uploaded_file') {
      downloadItem(item);
      return;
    }
    const info = getEmbedInfo(item);
    setEmbedViewerItem(item);
    setEmbedEditMode(false);
    setEmbedViewMode(info.isKnownFrameBlocked ? 'card' : 'embed');
    setIframeLoading(true);
    setIframeKey((k) => k + 1);
    setEditEmbedUrlDraft(info.originalUrl || info.embedUrl);
    setEditEmbedNameDraft(item.name);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const name = nameDraft.trim();
    if (!name) {
      showToast('err', 'Name is required');
      return;
    }
    setBusy(true);
    try {
      if (renameTarget.scope === 'project') {
        await dataService.renameProject(role, renameTarget.id, name);
        await loadProjects();
      } else {
        await dataService.updateProjectItem(renameTarget.projectId, renameTarget.id, { name });
        await loadItems(renameTarget.projectId);
      }
      setRenameTarget(null);
      showToast('ok', 'Renamed');
    } catch (err: any) {
      showToast('err', err?.message || 'Rename failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProject = async (project: ProjectItem) => {
    if (!confirm(`Delete project “${project.name}” and all of its folders/files?`)) return;
    setBusy(true);
    try {
      await dataService.deleteProject(role, project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      showToast('ok', 'Project deleted');
    } catch (err: any) {
      showToast('err', err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (projectId: string, item: ProjectTreeItem) => {
    if (!confirm(`Delete “${item.name}”?`)) return;
    setBusy(true);
    try {
      await dataService.deleteProjectItem(projectId, item.id);
      await loadItems(projectId);
      setFileMenuOpen(null);
      showToast('ok', 'Deleted');
    } catch (err: any) {
      showToast('err', err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (projectId: string, item: ProjectTreeItem) => {
    setBusy(true);
    try {
      const embedUrl = getEmbedUrl(item);
      const originalUrl = getOriginalUrl(item);
      await dataService.createProjectItem({
        projectId,
        parentId: item.parent_id,
        itemType: item.item_type,
        name: `${item.name} (copy)`,
        content: (item.content as any) || (embedUrl ? { embed_url: embedUrl, original_url: originalUrl, format: 'embed' } : {}),
        embedUrl: embedUrl || undefined,
        dataUrl: originalUrl || item.data_url,
        mimeType: item.mime_type,
        createdBy: user.id,
      });
      await loadItems(projectId);
      setFileMenuOpen(null);
      showToast('ok', 'Duplicated');
    } catch (err: any) {
      showToast('err', err?.message || 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    setBusy(true);
    try {
      await dataService.updateProjectItem(moveTarget.projectId, moveTarget.itemId, {
        parent_id: moveParentId || null,
      });
      await loadItems(moveTarget.projectId);
      setMoveTarget(null);
      showToast('ok', 'Moved');
    } catch (err: any) {
      showToast('err', err?.message || 'Move failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadItem = (item: ProjectTreeItem) => {
    if (item.item_type === 'embed') {
      const url = getOriginalUrl(item) || getEmbedUrl(item);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.data_url) {
      const a = document.createElement('a');
      a.href = item.data_url;
      a.download = item.name;
      a.click();
      return;
    }
    const content = item.content as any;
    const blob = new Blob([JSON.stringify(content ?? {}, null, 2)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name.includes('.') ? item.name : `${item.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pillStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'var(--surface-frosted-subdued)',
    border: '1px solid var(--surface-border-subtle)',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  };

  const renderTree = (projectId: string, parentId: string | null, depth: number): React.ReactNode => {
    const kids = childrenOf(projectId, parentId);
    const parentWritable = canMutate(projectId, parentId);
    if (kids.length === 0 && depth === 0) {
      return (
        <div
          style={{
            marginLeft: 16,
            padding: '12px 14px',
            fontSize: 12,
            color: 'var(--text-muted)',
            borderRadius: 12,
            border: '1px dashed var(--surface-border-subtle)',
          }}
        >
          {parentWritable
            ? <>Empty project — use <strong>+</strong> to create a folder or file.</>
            : 'Empty or no items shared with you in this project.'}
        </div>
      );
    }
    return kids.map((item) => {
      const isFolder = item.item_type === 'folder';
      const isOpen = expandedFolders.has(item.id);
      const menuOpen = fileMenuOpen === item.id;
      const writable = canMutate(projectId, item.id);
      return (
        <div key={item.id} style={{ marginLeft: Math.min(depth * 18, 72), display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              ...pillStyle,
              cursor: isFolder ? 'pointer' : 'default',
              userSelect: 'none',
            }}
            onClick={() => {
              if (isFolder) toggleFolder(item.id);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-frosted)';
              e.currentTarget.style.borderColor = 'var(--surface-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-frosted-subdued)';
              e.currentTarget.style.borderColor = 'var(--surface-border-subtle)';
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>{itemIcon(item.item_type)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isFolder) toggleFolder(item.id);
                else if (item.item_type !== 'uploaded_file') openEditor(item);
                else setFileMenuOpen(menuOpen ? null : item.id);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: 0,
              }}
              title={item.name}
            >
              {item.name}
            </button>
            {isFolder ? (
              <>
                {writable && (
                  <button
                    type="button"
                    style={iconBtnStyle}
                    title="Create inside folder"
                    aria-label="Create inside folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileMenuOpen(menuOpen ? null : item.id);
                    }}
                  >
                    <Plus size={15} />
                  </button>
                )}
                <button
                  type="button"
                  style={iconBtnStyle}
                  title={isOpen ? 'Collapse folder' : 'Expand folder'}
                  aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.id);
                  }}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              </>
            ) : (
              <>
                {parentWritable && (
                  <button
                    type="button"
                    style={iconBtnStyle}
                    title="Create in parent folder"
                    aria-label="Create in parent folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreate(projectId, item.parent_id, 'file');
                    }}
                  >
                    <Plus size={15} />
                  </button>
                )}
                <button
                  type="button"
                  style={iconBtnStyle}
                  title="File actions"
                  aria-label="File actions"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileMenuOpen(menuOpen ? null : item.id);
                  }}
                >
                  {menuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              </>
            )}
          </div>

          {/* Folder create menu */}
          {isFolder && menuOpen && writable && (
            <div
              className="frosted-card frosted-card-sm"
              style={{
                marginLeft: 12,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                zIndex: 5,
              }}
            >
              <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start' }} onClick={() => openCreate(projectId, item.id, 'folder')}>
                <Folder size={14} /> New folder
              </button>
              <button
                type="button"
                className="nav-pill-item"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => openCreate(projectId, item.id, 'file', 'embed')}
              >
                <Globe size={14} color="#06b6d4" /> Add embed link
              </button>
              <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start' }} onClick={() => triggerUpload(projectId, item.id)}>
                <FileUp size={14} /> Upload file
              </button>
              <div style={{ height: 1, background: 'var(--surface-border-subtle)', margin: '4px 0' }} />
              <button
                type="button"
                className="nav-pill-item"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  setRenameTarget({ scope: 'item', projectId, id: item.id, name: item.name });
                  setNameDraft(item.name);
                  setFileMenuOpen(null);
                }}
              >
                <Pencil size={14} /> Rename
              </button>
              <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start', color: '#ef4444' }} onClick={() => handleDeleteItem(projectId, item)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}

          {/* File actions menu */}
          {!isFolder && menuOpen && (
            <div
              className="frosted-card frosted-card-sm"
              style={{ marginLeft: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start' }} onClick={() => { openEditor(item); setFileMenuOpen(null); }}>
                {item.item_type === 'embed' ? <Globe size={14} color="#06b6d4" /> : null}
                {item.item_type === 'embed' ? 'Open Embed' : 'Open'}
              </button>
              {item.item_type === 'embed' && (
                <>
                  <button
                    type="button"
                    className="nav-pill-item"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      const url = getOriginalUrl(item) || getEmbedUrl(item);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                      setFileMenuOpen(null);
                    }}
                  >
                    <ExternalLink size={14} /> Open in New Tab
                  </button>
                  <button
                    type="button"
                    className="nav-pill-item"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      const url = getOriginalUrl(item) || getEmbedUrl(item);
                      if (url) {
                        navigator.clipboard?.writeText(url);
                        showToast('ok', 'Link copied to clipboard');
                      }
                      setFileMenuOpen(null);
                    }}
                  >
                    <Copy size={14} /> Copy Embed Link
                  </button>
                </>
              )}
              {writable && (
                <>
                  <button
                    type="button"
                    className="nav-pill-item"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      setRenameTarget({ scope: 'item', projectId, id: item.id, name: item.name });
                      setNameDraft(item.name);
                      setFileMenuOpen(null);
                    }}
                  >
                    <Pencil size={14} /> Rename
                  </button>
                  <button
                    type="button"
                    className="nav-pill-item"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      setMoveTarget({ projectId, itemId: item.id, name: item.name });
                      setMoveParentId(item.parent_id || '');
                      setFileMenuOpen(null);
                    }}
                  >
                    <FolderInput size={14} /> Move
                  </button>
                  <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start' }} onClick={() => handleDuplicate(projectId, item)}>
                    <Copy size={14} /> Duplicate
                  </button>
                </>
              )}
              {item.item_type !== 'embed' && (
                <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start' }} onClick={() => downloadItem(item)}>
                  <Download size={14} /> Download
                </button>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px' }}>
                Type: {item.item_type}
                {item.external_provider ? ` · ${item.external_provider}` : ' · internal'}
                <br />
                Updated: {new Date(item.updated_at).toLocaleString()}
                {!writable && isEmployee ? ' · view only' : ''}
              </div>
              {writable && (
                <button type="button" className="nav-pill-item" style={{ justifyContent: 'flex-start', color: '#ef4444' }} onClick={() => handleDeleteItem(projectId, item)}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}

          {isFolder && isOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {childrenOf(projectId, item.id).length === 0 ? (
                <div style={{ marginLeft: 16, fontSize: 11, color: 'var(--text-muted)' }}>Empty folder</div>
              ) : (
                renderTree(projectId, item.id, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
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
            <FolderKanban size={14} color="var(--color-secondary)" />
            <span>Projects & Folders</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Projects & Folders
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Drive-style hierarchy — expand projects, nest folders, upload files, and manage embedded links
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="stitch-search-pill" style={{ width: 220, padding: '4px 12px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="search"
              placeholder="Search projects & items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: 12 }}
              aria-label="Search projects and items"
            />
          </div>
          <RefreshButton onRefresh={refreshExplorer} title="Refresh projects tree" />
          {role === 'manager' && (
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={() => navigate('/manager/allocations')}
              title="Allocate projects & grant access to Project Managers"
            >
              <ShieldCheck size={14} color="var(--color-secondary)" />
              <span>PM Allocations</span>
            </button>
          )}
          <button type="button" className="btn-pill btn-pill-primary" onClick={() => setNewProjectOpen(true)}>
            <Plus size={15} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-card-sm)',
            background: toast.type === 'ok' ? 'var(--status-success-bg)' : 'rgba(239,68,68,0.12)',
            color: toast.type === 'ok' ? 'var(--status-success)' : '#ef4444',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.text}
        </div>
      )}

      <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={16} className="spin" /> Loading projects…
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <>
              No projects yet. Click <strong>New Project</strong> to get started.
              {isEmployee ? ' Shared projects from your manager will also appear here.' : null}
            </>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const open = expandedProjects.has(project.id);
            const projWritable = canMutate(project.id, null);
            return (
              <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    ...pillStyle,
                    background: 'var(--surface-frosted)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleProject(project.id)}
                  title={open ? `Collapse ${project.name}` : `Expand ${project.name}`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--surface-border-subtle)';
                  }}
                >
                  <FolderKanban size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    title={project.name}
                  >
                    {project.name}
                    {isEmployee && !projWritable ? (
                      <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                        (view)
                      </span>
                    ) : null}
                  </span>
                  {projWritable && (
                    <button
                      type="button"
                      style={iconBtnStyle}
                      title="Create folder"
                      aria-label={`Create folder in ${project.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreate(project.id, null, 'folder');
                        if (!open) toggleProject(project.id);
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    style={iconBtnStyle}
                    title={open ? 'Collapse project' : 'Expand project'}
                    aria-label={open ? `Collapse ${project.name}` : `Expand ${project.name}`}
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProject(project.id);
                    }}
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}
                    >
                      <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
                        {projWritable && (
                          <>
                            <button
                              type="button"
                              className="btn-pill btn-pill-secondary"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => openCreate(project.id, null, 'file', 'embed')}
                            >
                              <Globe size={13} color="#06b6d4" /> + Embed Link
                            </button>
                            <button
                              type="button"
                              className="btn-pill btn-pill-secondary"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => triggerUpload(project.id, null)}
                            >
                              <FileUp size={13} /> + Upload File
                            </button>
                          </>
                        )}
                        {projWritable && (
                          <button
                            type="button"
                            className="btn-pill btn-pill-secondary"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={() => {
                              setRenameTarget({ scope: 'project', projectId: project.id, id: project.id, name: project.name });
                              setNameDraft(project.name);
                            }}
                          >
                            Rename
                          </button>
                        )}
                        {projWritable && (
                          <button
                            type="button"
                            className="btn-pill btn-pill-secondary"
                            style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444' }}
                            onClick={() => handleDeleteProject(project)}
                          >
                            Delete
                          </button>
                        )}
                        {role === 'manager' && (
                          <button
                            type="button"
                            className="btn-pill btn-pill-secondary"
                            style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-secondary)' }}
                            onClick={() => navigate('/manager/allocations')}
                            title="Grant PM Access to this project"
                          >
                            <ShieldCheck size={13} /> Grant PM Access
                          </button>
                        )}
                      </div>
                      {(itemsByProject[project.id] || []).filter((i) => !i.parent_id).length === 0 ? (
                        <div style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                          Empty project — use + to add a folder
                        </div>
                      ) : (
                        renderTree(project.id, null, 0)
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      <input ref={uploadRef} type="file" hidden onChange={onUploadPicked} />

      {/* New project modal */}
      <AnimatePresence>
        {newProjectOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => !busy && setNewProjectOpen(false)}
          >
            <motion.form
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="frosted-card"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateProject}
              style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>New Project</h3>
                <button type="button" className="btn-icon-circle" onClick={() => setNewProjectOpen(false)} aria-label="Close">
                  <X size={14} />
                </button>
              </div>
              <div className="stitch-form-group">
                <label className="stitch-label" htmlFor="new-project-name">
                  Project name
                </label>
                <input
                  id="new-project-name"
                  className="stitch-input"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project Alpha"
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="btn-pill btn-pill-primary" disabled={busy}>
                {busy ? <Loader2 size={14} /> : <Plus size={14} />}
                <span>Create Project</span>
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create item modal */}
      <AnimatePresence>
        {createMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => !busy && setCreateMenu(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="frosted-card"
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {createMenu.kind === 'folder' ? 'New Folder' : 'New Resource'}
                </h3>
                <button type="button" className="btn-icon-circle" onClick={() => setCreateMenu(null)} aria-label="Close">
                  <X size={14} />
                </button>
              </div>

              {createMenu.kind === 'folder' ? (
                <>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Folder Name</label>
                    <input
                      className="stitch-input"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="e.g. Marketing Deliverables"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-pill btn-pill-primary"
                    disabled={busy || !nameDraft.trim()}
                    onClick={handleCreateFolder}
                  >
                    Create Folder
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      padding: 4,
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-card-sm)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCreateModalTab('embed')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-card-sm)',
                        border: 'none',
                        background: createModalTab === 'embed' ? 'var(--color-primary)' : 'transparent',
                        color: createModalTab === 'embed' ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Globe size={14} />
                      <span>Embed Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateModalTab('upload')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-card-sm)',
                        border: 'none',
                        background: createModalTab === 'upload' ? 'var(--color-primary)' : 'transparent',
                        color: createModalTab === 'upload' ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <FileUp size={14} />
                      <span>Upload File</span>
                    </button>
                  </div>

                  {createModalTab === 'embed' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleCreateEmbed();
                      }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                    >
                      <div className="stitch-form-group">
                        <label className="stitch-label">
                          Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          className="stitch-input"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          placeholder="e.g. Project Brief / Figma / Loom Demo"
                          autoFocus
                          required
                        />
                      </div>

                      <div className="stitch-form-group">
                        <label className="stitch-label">
                          Embed Link / URL <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="stitch-input"
                          value={embedUrlDraft}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmbedUrlDraft(extractUrlFromHtml(val));
                          }}
                          placeholder="Paste URL or <iframe> snippet (Google Docs, Sheets, YouTube, Figma...)"
                          required
                        />
                        {embedUrlDraft.trim() && (() => {
                          const info = parseAndTransformEmbedUrl(embedUrlDraft);
                          return (
                            <div
                              style={{
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: 'rgba(6, 182, 212, 0.08)',
                                border: '1px solid rgba(6, 182, 212, 0.2)',
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <Globe size={13} color="#06b6d4" />
                              <span>
                                Detected <strong>{info.provider}</strong>
                                {info.notes ? ` · ${info.notes}` : ' · Ready for in-app preview'}
                              </span>
                            </div>
                          );
                        })()}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Paste any link from Google Docs/Sheets/Slides/Drive, YouTube, Figma, Loom, Vimeo, or any web URL.
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="btn-pill btn-pill-primary"
                        disabled={busy || !nameDraft.trim() || !embedUrlDraft.trim()}
                        style={{ marginTop: 4, justifyContent: 'center' }}
                      >
                        <Globe size={15} />
                        <span>Add Embed Link</span>
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '1.25rem 0' }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Upload documents, PDFs, images or any file from your computer.
                      </p>
                      <button
                        type="button"
                        className="btn-pill btn-pill-primary"
                        onClick={() => {
                          const ctx = createMenu;
                          setCreateMenu(null);
                          triggerUpload(ctx.projectId, ctx.parentId);
                        }}
                        style={{ padding: '9px 18px', gap: 8 }}
                      >
                        <FileUp size={15} />
                        <span>Select File to Upload</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename modal */}
      <AnimatePresence>
        {renameTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setRenameTarget(null)}
          >
            <form
              className="frosted-card"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleRename}
              style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Rename</h3>
              <input className="stitch-input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
              <button type="submit" className="btn-pill btn-pill-primary" disabled={busy}>
                Save name
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move modal */}
      <AnimatePresence>
        {moveTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setMoveTarget(null)}
          >
            <form
              className="frosted-card"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleMove}
              style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Move “{moveTarget.name}”</h3>
              <select className="stitch-input" value={moveParentId} onChange={(e) => setMoveParentId(e.target.value)}>
                <option value="">Project root</option>
                {folderOptions(moveTarget.projectId)
                  .filter((f) => f.id !== moveTarget.itemId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
              <button type="submit" className="btn-pill btn-pill-primary" disabled={busy}>
                Move here
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embed Resource Viewer & Editor Modal */}
      <AnimatePresence>
        {embedViewerItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => {
              setEmbedViewerItem(null);
              setEmbedEditMode(false);
            }}
          >
            <div
              className="frosted-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 1040,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '1.25rem',
                borderRadius: 'var(--radius-card-lg)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid var(--surface-border-subtle)',
                  paddingBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(6, 182, 212, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Globe size={18} color="#06b6d4" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {embedViewerItem.name}
                      </h3>
                      <span className="live-telemetry-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#0891b2' }}>
                        Embed
                      </span>
                    </div>
                    {getEmbedUrl(embedViewerItem) && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                          maxWidth: 520,
                        }}
                      >
                        {getEmbedUrl(embedViewerItem)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getEmbedUrl(embedViewerItem) && (
                    <>
                      <button
                        type="button"
                        className="btn-pill btn-pill-secondary"
                        style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
                        onClick={() => {
                          const url = getEmbedUrl(embedViewerItem);
                          if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        title="Open embed in new browser tab"
                      >
                        <ExternalLink size={13} />
                        <span>Open in Tab</span>
                      </button>
                      <button
                        type="button"
                        className="btn-pill btn-pill-secondary"
                        style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
                        onClick={() => {
                          const url = getEmbedUrl(embedViewerItem);
                          if (url) {
                            navigator.clipboard?.writeText(url);
                            showToast('ok', 'Link copied to clipboard');
                          }
                        }}
                        title="Copy embed link"
                      >
                        <Copy size={13} />
                        <span>Copy Link</span>
                      </button>
                    </>
                  )}

                  {canMutate(embedViewerItem.project_id, embedViewerItem.id) && (
                    <button
                      type="button"
                      className="btn-pill btn-pill-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        gap: 6,
                        background: embedEditMode ? 'var(--color-primary)' : undefined,
                        color: embedEditMode ? '#fff' : undefined,
                      }}
                      onClick={() => setEmbedEditMode(!embedEditMode)}
                      title="Edit embed link or name"
                    >
                      <Pencil size={13} />
                      <span>{embedEditMode ? 'Editing' : 'Edit Link'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-icon-circle"
                    onClick={() => {
                      setEmbedViewerItem(null);
                      setEmbedEditMode(false);
                    }}
                    aria-label="Close embed modal"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Inline Edit Form */}
              {embedEditMode && canMutate(embedViewerItem.project_id, embedViewerItem.id) && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--surface-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                    <div>
                      <label className="stitch-label" style={{ fontSize: 11 }}>Item Name</label>
                      <input
                        className="stitch-input"
                        value={editEmbedNameDraft}
                        onChange={(e) => setEditEmbedNameDraft(e.target.value)}
                        placeholder="Resource title"
                      />
                    </div>
                    <div>
                      <label className="stitch-label" style={{ fontSize: 11 }}>Embed URL</label>
                      <input
                        className="stitch-input"
                        value={editEmbedUrlDraft}
                        onChange={(e) => setEditEmbedUrlDraft(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-pill btn-pill-secondary"
                      style={{ padding: '5px 12px', fontSize: 12 }}
                      onClick={() => setEmbedEditMode(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-pill btn-pill-primary"
                      style={{ padding: '5px 14px', fontSize: 12 }}
                      disabled={busy || !editEmbedUrlDraft.trim()}
                      onClick={handleSaveEmbedEdit}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Embed Iframe / Preview Container */}
              <div
                style={{
                  flex: 1,
                  minHeight: '52vh',
                  maxHeight: '68vh',
                  width: '100%',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#ffffff',
                  border: '1px solid var(--surface-border-subtle)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {getEmbedUrl(embedViewerItem) ? (
                  <iframe
                    src={getEmbedUrl(embedViewerItem)}
                    title={embedViewerItem.name}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
                    allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: 440,
                      border: 'none',
                      flex: 1,
                      borderRadius: 10,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: 24,
                      color: 'var(--text-muted)',
                      gap: 8,
                    }}
                  >
                    <Globe size={32} color="var(--text-muted)" />
                    <p style={{ margin: 0, fontSize: 13 }}>No embed link configured for this item.</p>
                  </div>
                )}
              </div>

              {/* Security / X-Frame-Options notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  paddingTop: 4,
                }}
              >
                <span>
                  Tip: If the embedded page refuses to connect due to provider security (e.g. Google Docs login restrictions), click <strong>Open in Tab</strong>.
                </span>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  style={{ padding: '5px 12px', fontSize: 11 }}
                  onClick={() => {
                    setEmbedViewerItem(null);
                    setEmbedEditMode(false);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectExplorer;
