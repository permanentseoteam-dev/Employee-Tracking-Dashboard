import type {
  ProjectAccessLevel,
  ProjectMemberAssignment,
  ProjectTreeItem,
} from '../types/roles';

const RANK: Record<ProjectAccessLevel, number> = { view: 1, edit: 2, admin: 3 };

export function accessRank(level: ProjectAccessLevel | null | undefined): number {
  return level ? RANK[level] : 0;
}

export function maxAccess(
  a: ProjectAccessLevel | null,
  b: ProjectAccessLevel | null
): ProjectAccessLevel | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

export function canView(level: ProjectAccessLevel | null): boolean {
  return accessRank(level) >= RANK.view;
}

export function canEdit(level: ProjectAccessLevel | null): boolean {
  return accessRank(level) >= RANK.edit;
}

export function canAdmin(level: ProjectAccessLevel | null): boolean {
  return accessRank(level) >= RANK.admin;
}

/** Normalize legacy localStorage rows that lack scope/resource_id. */
export function normalizeAssignment(
  raw: Partial<ProjectMemberAssignment> & {
    project_id: string;
    employee_id: string;
    employee_name: string;
    access: ProjectAccessLevel;
  }
): ProjectMemberAssignment {
  return {
    id: raw.id || `assign-${Date.now()}`,
    project_id: raw.project_id,
    project_name: raw.project_name,
    employee_id: raw.employee_id,
    employee_name: raw.employee_name,
    employee_email: raw.employee_email,
    access: raw.access,
    scope: raw.scope || 'project',
    resource_id: raw.scope && raw.scope !== 'project' ? raw.resource_id ?? null : null,
    resource_name: raw.resource_name,
    resource_path: raw.resource_path,
    include_descendants: raw.include_descendants !== false,
    assigned_by: raw.assigned_by,
    assigned_at: raw.assigned_at || new Date().toISOString(),
    project_manager_id: raw.project_manager_id,
  };
}

export function itemAncestors(
  itemId: string,
  items: ProjectTreeItem[]
): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const chain: string[] = [];
  let cur = byId.get(itemId);
  const guard = new Set<string>();
  while (cur?.parent_id) {
    if (guard.has(cur.parent_id)) break;
    guard.add(cur.parent_id);
    chain.push(cur.parent_id);
    cur = byId.get(cur.parent_id);
  }
  return chain;
}

export function isUnderFolder(
  itemId: string,
  folderId: string,
  items: ProjectTreeItem[]
): boolean {
  if (itemId === folderId) return true;
  return itemAncestors(itemId, items).includes(folderId);
}

/** Whether a single grant covers a specific tree item. */
export function grantCoversItem(
  grant: ProjectMemberAssignment,
  itemId: string,
  items: ProjectTreeItem[]
): boolean {
  const g = normalizeAssignment(grant);
  if (g.scope === 'project') return true;
  if (!g.resource_id) return false;
  if (g.scope === 'item') return g.resource_id === itemId;
  // folder
  if (g.resource_id === itemId) return true;
  if (g.include_descendants === false) return false;
  return isUnderFolder(itemId, g.resource_id, items);
}

/** Effective access on one item (highest covering grant). */
export function resolveItemAccess(
  grants: ProjectMemberAssignment[],
  itemId: string,
  items: ProjectTreeItem[]
): ProjectAccessLevel | null {
  let best: ProjectAccessLevel | null = null;
  for (const g of grants) {
    if (grantCoversItem(g, itemId, items)) {
      best = maxAccess(best, normalizeAssignment(g).access);
    }
  }
  return best;
}

/** Highest project-level access (any grant on the project counts as "can open project"). */
export function resolveProjectAccess(
  grants: ProjectMemberAssignment[]
): ProjectAccessLevel | null {
  let best: ProjectAccessLevel | null = null;
  for (const g of grants) {
    best = maxAccess(best, normalizeAssignment(g).access);
  }
  return best;
}

/**
 * Visible items for an employee: keep an item if they have access to it,
 * OR it is an ancestor of something they can access (so the tree path stays open).
 */
export function filterVisibleItems(
  grants: ProjectMemberAssignment[],
  items: ProjectTreeItem[]
): ProjectTreeItem[] {
  if (!grants.length) return [];
  // Whole-project grant → everything
  if (grants.some((g) => normalizeAssignment(g).scope === 'project')) return items;

  const allowed = new Set<string>();
  for (const item of items) {
    if (resolveItemAccess(grants, item.id, items)) {
      allowed.add(item.id);
      for (const a of itemAncestors(item.id, items)) allowed.add(a);
    }
  }
  // Folder grant with no children yet: still show the folder itself
  for (const g of grants) {
    const n = normalizeAssignment(g);
    if ((n.scope === 'folder' || n.scope === 'item') && n.resource_id) {
      allowed.add(n.resource_id);
      for (const a of itemAncestors(n.resource_id, items)) allowed.add(a);
    }
  }
  return items.filter((i) => allowed.has(i.id));
}

export function buildResourcePath(
  itemId: string,
  items: ProjectTreeItem[]
): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const names: string[] = [];
  let cur = byId.get(itemId);
  const guard = new Set<string>();
  while (cur) {
    if (guard.has(cur.id)) break;
    guard.add(cur.id);
    names.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return names.join(' / ');
}

/** Unique key so one employee can hold many scoped grants on one project. */
export function grantIdentity(a: {
  project_id: string;
  employee_id: string;
  scope?: string;
  resource_id?: string | null;
}): string {
  const scope = a.scope || 'project';
  const res = scope === 'project' ? '' : a.resource_id || '';
  return `${a.project_id}::${a.employee_id}::${scope}::${res}`;
}

// --- self-check (ponytail) ---
export function __projectAccessSelfCheck(): void {
  const items: ProjectTreeItem[] = [
    {
      id: 'f1',
      project_id: 'p',
      parent_id: null,
      item_type: 'folder',
      name: 'Docs',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'f2',
      project_id: 'p',
      parent_id: 'f1',
      item_type: 'folder',
      name: 'Specs',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'd1',
      project_id: 'p',
      parent_id: 'f2',
      item_type: 'document',
      name: 'brief',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'd2',
      project_id: 'p',
      parent_id: 'f1',
      item_type: 'document',
      name: 'readme',
      created_at: '',
      updated_at: '',
    },
  ];
  const folderGrant = normalizeAssignment({
    id: '1',
    project_id: 'p',
    employee_id: 'e',
    employee_name: 'E',
    access: 'edit',
    scope: 'folder',
    resource_id: 'f2',
  });
  const itemGrant = normalizeAssignment({
    id: '2',
    project_id: 'p',
    employee_id: 'e',
    employee_name: 'E',
    access: 'view',
    scope: 'item',
    resource_id: 'd2',
  });
  console.assert(resolveItemAccess([folderGrant], 'd1', items) === 'edit', 'folder inherits');
  console.assert(resolveItemAccess([folderGrant], 'd2', items) === null, 'sibling not covered');
  console.assert(resolveItemAccess([itemGrant], 'd2', items) === 'view', 'item grant');
  const visible = filterVisibleItems([folderGrant, itemGrant], items);
  console.assert(visible.some((i) => i.id === 'd1'), 'visible d1');
  console.assert(visible.some((i) => i.id === 'f1'), 'ancestor f1');
  console.assert(visible.some((i) => i.id === 'd2'), 'visible d2');
  const proj = normalizeAssignment({
    id: '3',
    project_id: 'p',
    employee_id: 'e',
    employee_name: 'E',
    access: 'admin',
    scope: 'project',
    resource_id: null,
  });
  console.assert(filterVisibleItems([proj], items).length === items.length, 'project = all');
}
