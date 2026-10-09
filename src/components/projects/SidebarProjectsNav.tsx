import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderKanban,
  Plus,
  FileText,
  Table2,
  Presentation,
  FileUp,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { useAppRefresh } from '../../hooks/useAppRefresh';
import { requestAppRefresh } from '../../utils/appRefresh';
import type { ProjectItem, ProjectTreeItem, ProjectTreeItemType, UserRole } from '../../types/roles';

interface SidebarProjectsNavProps {
  role: UserRole;
  projectsRoute: string;
  isActive: boolean;
  collapsed?: boolean;
  onNavigate: (route: string) => void;
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
  opacity: 0.85,
};

function fileIcon(type: ProjectTreeItemType) {
  switch (type) {
    case 'folder':
      return <Folder size={13} color="#f59e0b" />;
    case 'document':
      return <FileText size={13} color="#3b82f6" />;
    case 'spreadsheet':
      return <Table2 size={13} color="#10b981" />;
    case 'presentation':
      return <Presentation size={13} color="#a855f7" />;
    default:
      return <FileUp size={13} color="var(--text-muted)" />;
  }
}

/**
 * Sidebar "Projects & Folders" pill with + / ⌄ on the right,
 * expanding an inline Drive-style project tree (not a separate nav destination chrome).
 */
export const SidebarProjectsNav: React.FC<SidebarProjectsNavProps> = ({
  role,
  projectsRoute,
  isActive,
  collapsed = false,
  onNavigate,
}) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [itemsByProject, setItemsByProject] = useState<Record<string, ProjectTreeItem[]>>({});
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await dataService.getProjects(role, user.id, user.id);
      setProjects(list);
    } catch (e) {
      console.error('SidebarProjectsNav loadProjects:', e);
    }
  }, [role, user.id]);

  const loadItems = useCallback(async (projectId: string) => {
    try {
      const items = await dataService.listProjectItems(projectId, {
        role,
        employeeId: role === 'employee' ? user.id : undefined,
      });
      setItemsByProject((prev) => ({ ...prev, [projectId]: items }));
    } catch (e) {
      console.error('SidebarProjectsNav loadItems:', e);
    }
  }, [role, user.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useAppRefresh(loadProjects);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const childrenOf = (projectId: string, parentId: string | null) =>
    (itemsByProject[projectId] || [])
      .filter((i) => (i.parent_id || null) === parentId)
      .sort((a, b) => {
        if (a.item_type === 'folder' && b.item_type !== 'folder') return -1;
        if (a.item_type !== 'folder' && b.item_type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = window.prompt('New project name');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await dataService.createProject(
        role,
        {
          name: name.trim(),
          code: name.trim().substring(0, 4).toUpperCase(),
          manager_id: user.id,
          manager_name: user.name,
          members_count: 1,
          status: 'active',
          progress_percentage: 0,
          total_tasks: 0,
          completed_tasks: 0,
          due_date: '',
          description: '',
        } as any,
        user.id
      );
      dataService.logAction(user.name, role, 'CREATE_PROJECT', name.trim(), 'Created from sidebar');
      await loadProjects();
      setExpanded(true);
      onNavigate(projectsRoute);
      requestAppRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to create project');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFolder = async (e: React.MouseEvent, projectId: string, parentId: string | null) => {
    e.stopPropagation();
    const name = window.prompt('New folder name');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await dataService.createProjectItem({
        projectId,
        parentId,
        itemType: 'folder',
        name: name.trim(),
        createdBy: user.id,
      });
      await loadItems(projectId);
      if (parentId) setOpenFolders((prev) => new Set(prev).add(parentId));
      else setOpenProjects((prev) => new Set(prev).add(projectId));
      onNavigate(projectsRoute);
      requestAppRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  };

  const toggleProjectNode = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setOpenProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    if (!itemsByProject[projectId]) await loadItems(projectId);
  };

  const toggleFolderNode = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderItems = (projectId: string, parentId: string | null, depth: number): React.ReactNode => {
    const items = childrenOf(projectId, parentId);
    if (!items.length && depth === 0) {
      return (
        <div style={{ padding: '4px 8px 4px 28px', fontSize: 10, color: 'var(--text-muted)' }}>
          Empty — use + to add a folder
        </div>
      );
    }
    return items.map((item) => {
      const isFolder = item.item_type === 'folder';
      const isOpen = openFolders.has(item.id);
      return (
        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            className="nav-pill-item"
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              padding: '4px 8px 4px 12px',
              fontSize: 11,
              marginLeft: Math.min(depth, 3) * 8,
              gap: 4,
            }}
            onClick={() => onNavigate(projectsRoute)}
            title={item.name}
          >
            <span style={{ flexShrink: 0 }}>{fileIcon(item.item_type)}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left',
              }}
            >
              {item.name}
            </span>
            {isFolder && (
              <button
                type="button"
                style={iconBtn}
                title="Create folder"
                aria-label="Create folder"
                disabled={busy}
                onClick={(e) => handleCreateFolder(e, projectId, item.id)}
              >
                <Plus size={12} />
              </button>
            )}
            {isFolder ? (
              <button
                type="button"
                style={iconBtn}
                title={isOpen ? 'Collapse' : 'Expand'}
                aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
                onClick={(e) => toggleFolderNode(e, item.id)}
              >
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span style={{ width: 22 }} />
            )}
          </div>
          {isFolder && isOpen && renderItems(projectId, item.id, depth + 1)}
        </div>
      );
    });
  };

  if (collapsed) {
    return (
      <button
        type="button"
        className={`nav-pill-item ${isActive ? 'active' : ''}`}
        onClick={() => onNavigate(projectsRoute)}
        title="Projects & Folders"
        style={{ justifyContent: 'center', padding: '8px 0', fontSize: 12 }}
      >
        <FolderKanban size={16} />
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        className={`nav-pill-item ${isActive ? 'active' : ''}`}
        style={{
          width: '100%',
          justifyContent: 'flex-start',
          padding: '7px 8px 7px 12px',
          fontSize: 12,
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => onNavigate(projectsRoute)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            font: 'inherit',
            textAlign: 'left',
          }}
          title="Open Projects & Folders"
        >
          <FolderKanban size={16} style={{ flexShrink: 0 }} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Projects & Folders
          </span>
        </button>
        <button
          type="button"
          style={iconBtn}
          title="Create project"
          aria-label="Create project"
          disabled={busy}
          onClick={handleCreateProject}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          style={iconBtn}
          title={expanded ? 'Collapse projects' : 'Expand projects'}
          aria-label={expanded ? 'Collapse projects' : 'Expand projects'}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
            if (!expanded) loadProjects();
          }}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            paddingLeft: 4,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {projects.length === 0 ? (
            <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>
              No projects yet. Click + to create one.
            </div>
          ) : (
            projects.map((project) => {
              const open = openProjects.has(project.id);
              return (
                <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className="nav-pill-item"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '5px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      gap: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(projectsRoute)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flex: 1,
                        minWidth: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit',
                        textAlign: 'left',
                      }}
                      title={project.name}
                    >
                      <FolderKanban size={13} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {project.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      style={iconBtn}
                      title="Create folder"
                      aria-label={`Create folder in ${project.name}`}
                      disabled={busy}
                      onClick={(e) => handleCreateFolder(e, project.id, null)}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      style={iconBtn}
                      title={open ? 'Collapse project' : 'Expand project'}
                      aria-label={open ? `Collapse ${project.name}` : `Expand ${project.name}`}
                      aria-expanded={open}
                      onClick={(e) => toggleProjectNode(e, project.id)}
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </div>
                  {open && renderItems(project.id, null, 0)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
