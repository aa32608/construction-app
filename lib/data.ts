import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBudget, formatDue, getInitials, pickColor } from '@/lib/format';

export type Membership = {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
  role: string;
};

export type ProjectView = {
  id: string;
  name: string;
  client: string;
  progress: number;
  statusLabel: string;
  risk: boolean;
  color: string;
  due: string;
  budget: string;
};

export type TaskView = {
  id: string;
  text: string;
  project: string;
  due: string;
  done: boolean;
};

export type DashboardUser = {
  id: string;
  fullName: string;
  initials: string;
};

export type DashboardStats = {
  activeProjects: number;
  committedBudget: string;
  openTasks: number;
  lowStock: number;
};

export type DashboardData = {
  user: DashboardUser;
  membership: Membership | null;
  projects: ProjectView[];
  tasks: TaskView[];
  stats: DashboardStats;
};

export type ProjectInventoryAssignment = {
  id: string;
  projectId: string;
  inventoryItemId: string;
  itemName: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  currentStock: number;
  warehouse: string | null;
  createdAt: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  clientName: string | null;
  description: string | null;
  status: string;
  progress: number;
  budget: number;
  startDate: string | null;
  dueDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  tasks: ProjectTask[];
  assignedMaterials: ProjectInventoryAssignment[];
  stats: ProjectStats;
};

export type ProjectMember = {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  jobTitle: string | null;
  joinedAt: string;
};

export type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
  createdAt: string;
};

export type ProjectStats = {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  budgetUsed: number;
  budgetRemaining: number;
};

export type ProjectListItem = {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  progress: number;
  budget: number;
  dueDate: string | null;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
};

const STATUS_MAP: Record<string, { label: string; risk: boolean }> = {
  planning: { label: 'Planning', risk: false },
  active: { label: 'On track', risk: false },
  on_hold: { label: 'On hold', risk: true },
  completed: { label: 'Completed', risk: false },
  archived: { label: 'Archived', risk: false },
};

const ACTIVE_STATUSES = new Set(['planning', 'active', 'on_hold']);

export type AuditLogView = {
  id: string;
  action: string;
  entityType: string;
  actorName: string;
  actorInitials: string;
  timeAgo: string;
  createdAt: string;
};

export async function getAuditLogs(
  supabase: SupabaseClient,
  limit: number = 10,
): Promise<AuditLogView[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data } = await supabase
    .from('audit_logs')
    .select(`
      id, action, entity_type, created_at,
      actor:profiles!audit_logs_actor_id_fkey(full_name)
    `)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((log: any) => {
    const actorName = log.actor?.full_name || 'System User';
    return {
      id: String(log.id),
      action: log.action,
      entityType: log.entity_type,
      actorName,
      actorInitials: getInitials(actorName),
      timeAgo: formatDue(log.created_at.split('T')[0]),
      createdAt: log.created_at,
    };
  });
}

/**
 * Loads everything the operations dashboard needs for the signed-in user.
 * All reads are tenant-scoped through the company membership; RLS provides
 * the authoritative isolation at the database layer.
 */
export async function getDashboardData(
  supabase: SupabaseClient,
): Promise<DashboardData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('company_members')
      .select('role, company:companies(id, name, logo_url)')
      .eq('user_id', user.id),
  ]);

  // PostgREST returns the joined company as a single object for this
  // many-to-one relation; the loose (untyped) client infers an array, so we
  // coerce to the shape we actually receive at runtime.
  const first = (memberships ?? [])[0] as
    | { role: string; company?: { id: string; name: string; logo_url: string | null } | { id: string; name: string; logo_url: string | null }[] }
    | undefined;

  const company =
    first?.company && !Array.isArray(first.company) ? first.company : undefined;

  const membership: Membership | null = company
    ? {
        companyId: company.id,
        companyName: company.name,
        logoUrl: company.logo_url,
        role: first?.role ?? 'employee',
      }
    : null;

  const fullName: string =
    profile?.full_name || (user.email ? user.email.split('@')[0] : 'User');
  const dashUser: DashboardUser = {
    id: user.id,
    fullName,
    initials: getInitials(fullName),
  };

  let projects: ProjectView[] = [];
  let tasks: TaskView[] = [];
  let stats: DashboardStats = {
    activeProjects: 0,
    committedBudget: formatBudget(0),
    openTasks: 0,
    lowStock: 0,
  };

  if (membership) {
    const cid = membership.companyId;

    const [{ data: projectRows }, { data: taskRows }, { count }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, client_name, progress, status, budget, due_date')
        .eq('company_id', cid)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('id, title, status, due_date, project:projects(name)')
        .eq('company_id', cid)
        .or(`assignee_id.eq.${user.id},assignee_id.is.null`)
        .order('created_at', { ascending: false }),
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', cid)
        .eq('low_stock', true),
    ]);

    projects = (projectRows ?? []).map((p: any) => {
      const status = STATUS_MAP[p.status] ?? STATUS_MAP.planning;
      return {
        id: p.id,
        name: p.name,
        client: p.client_name ?? 'Internal',
        progress: p.progress ?? 0,
        statusLabel: status.label,
        risk: status.risk,
        color: pickColor(p.name),
        due: formatDue(p.due_date),
        budget: formatBudget(p.budget),
      };
    });

    tasks = (taskRows ?? []).map((t: any) => ({
      id: t.id,
      text: t.title,
      project: t.project?.name ?? 'General',
      due: formatDue(t.due_date),
      done: t.status === 'done',
    }));

    const committed = (projectRows ?? []).reduce(
      (sum: number, p: any) => sum + (Number(p.budget) || 0),
      0,
    );

    stats = {
      activeProjects: (projectRows ?? []).filter((p: any) =>
        ACTIVE_STATUSES.has(p.status),
      ).length,
      committedBudget: formatBudget(committed),
      openTasks: (taskRows ?? []).filter((t: any) => t.status !== 'done').length,
      lowStock: count ?? 0,
    };
  }

  return { user: dashUser, membership, projects, tasks, stats };
}

export async function getProjectInventoryAssignments(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectInventoryAssignment[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data } = await supabase
    .from('project_inventory_assignments')
    .select(
      `id, project_id, inventory_item_id, quantity, created_at,
       inventory_item:inventory_items!project_inventory_assignments_inventory_item_id_fkey(name, sku, category, unit, current_stock, warehouse)`,
    )
    .eq('project_id', projectId)
    .eq('company_id', membership.company_id);

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    inventoryItemId: row.inventory_item_id,
    itemName: row.inventory_item?.name ?? 'Unknown item',
    sku: row.inventory_item?.sku ?? null,
    category: row.inventory_item?.category ?? null,
    quantity: Number(row.quantity) || 0,
    unit: row.inventory_item?.unit ?? 'pcs',
    currentStock: Number(row.inventory_item?.current_stock) || 0,
    warehouse: row.inventory_item?.warehouse ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Fetches full project detail including members, tasks, and computed stats.
 */
export async function getProjectDetail(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectDetail | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return null;

  // Fetch project base data
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (projectError || !project) return null;

  // Fetch project members with profiles
  const { data: members } = await supabase
    .from('project_members')
    .select(
      `user_id, profiles!inner(id, full_name, avatar_url)`,
    )
    .eq('project_id', projectId);

  // Fetch tasks with assignee profiles
  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      `id, title, description, status, priority, due_date, assignee_id, created_at,
       assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)`,
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  // Fetch assigned materials
  const assignedMaterials = await getProjectInventoryAssignments(supabase, projectId);

  // Compute stats
  const taskRows = tasks ?? [];
  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.status === 'done').length;
  const inProgressTasks = taskRows.filter((t) => t.status === 'in_progress').length;
  const todoTasks = taskRows.filter((t) => t.status === 'todo').length;

  return {
    id: project.id,
    name: project.name,
    clientName: project.client_name,
    description: project.description,
    status: project.status,
    progress: project.progress ?? 0,
    budget: Number(project.budget) || 0,
    startDate: project.start_date,
    dueDate: project.due_date,
    createdBy: project.created_by,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    members: (members ?? []).map((m: any) => ({
      id: m.user_id,
      userId: m.user_id,
      fullName: m.profiles?.full_name ?? 'Unknown',
      avatarUrl: m.profiles?.avatar_url ?? null,
      role: membership.role,
      jobTitle: null,
      joinedAt: project.created_at,
    })),
    tasks: taskRows.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            fullName: t.assignee.full_name,
            avatarUrl: t.assignee.avatar_url,
          }
        : null,
      createdAt: t.created_at,
    })),
    assignedMaterials,
    stats: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      budgetUsed: 0,
      budgetRemaining: Number(project.budget) || 0,
    },
  };
}

/**
 * Fetches all projects for the current user's company.
 * Returns a lightweight list suitable for a projects index page.
 */
export async function getProjectsList(
  supabase: SupabaseClient,
): Promise<ProjectListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data: projects } = await supabase
    .from('projects')
    .select(
      `id, name, client_name, status, progress, budget, due_date, created_at,
       tasks:tasks(count)`,
    )
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false });

  return (projects ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    clientName: p.client_name,
    status: p.status,
    progress: p.progress ?? 0,
    budget: Number(p.budget) || 0,
    dueDate: p.due_date,
    taskCount: p.tasks?.[0]?.count ?? 0,
    completedTaskCount: 0, // Would need a separate query for accuracy
    createdAt: p.created_at,
  }));
}

export type CompanyMember = {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  jobTitle: string | null;
  joinedAt: string;
};

export type InviteResult = {
  success: boolean;
  error?: string;
};

/**
 * Fetches all company members with their profiles.
 */
export async function getCompanyMembers(
  supabase: SupabaseClient,
): Promise<CompanyMember[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data: members } = await supabase
    .from('company_members')
    .select(
      `user_id, role, job_title, joined_at,
       profiles!inner(id, full_name, avatar_url, email)`,
    )
    .eq('company_id', membership.company_id)
    .order('joined_at', { ascending: true });

  return (members ?? []).map((m: any) => ({
    id: m.user_id,
    userId: m.user_id,
    fullName: m.profiles?.full_name ?? 'Unknown',
    email: m.profiles?.email ?? null,
    avatarUrl: m.profiles?.avatar_url ?? null,
    role: m.role,
    jobTitle: m.job_title,
    joinedAt: m.joined_at,
  }));
}

/**
 * Invites a user to the company by email.
 * Uses Supabase Auth Admin API to send an invite.
 * Note: Requires service role key on server, or use client-side invite flow.
 */
export async function inviteUserToCompany(
  supabase: SupabaseClient,
  email: string,
  role: string = 'employee',
  jobTitle?: string,
): Promise<InviteResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Check if user can invite (owner/manager)
  const canInvite = ['owner', 'manager'].includes(membership.role);
  if (!canInvite) return { success: false, error: 'Insufficient permissions' };

  // Use Supabase's inviteUserByEmail (client-side) or admin.inviteUserByEmail (server)
  // For client-side, we use the auth.inviteUserByEmail which sends an invite link
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { company_id: membership.company_id, role, job_title: jobTitle },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
  });

  if (error) return { success: false, error: error.message };

  return { success: true };
}

/**
 * Updates a member's role and job title.
 */
export async function updateMemberRole(
  supabase: SupabaseClient,
  targetUserId: string,
  newRole: string,
  jobTitle?: string,
): Promise<InviteResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Only owners can change roles
  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can change roles' };
  }

  // Cannot change own role
  if (targetUserId === user.id) {
    return { success: false, error: 'Cannot change your own role' };
  }

  const { error } = await supabase
    .from('company_members')
    .update({ role: newRole as any, job_title: jobTitle ?? null })
    .eq('company_id', membership.company_id)
    .eq('user_id', targetUserId);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

/**
 * Removes a member from the company.
 */
export async function removeMember(
  supabase: SupabaseClient,
  targetUserId: string,
): Promise<InviteResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Only owners can remove members
  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can remove members' };
  }

  // Cannot remove self
  if (targetUserId === user.id) {
    return { success: false, error: 'Cannot remove yourself' };
  }

  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', membership.company_id)
    .eq('user_id', targetUserId);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

// ============================================
// INVENTORY
// ============================================

export type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  warehouse: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryStats = {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  categories: string[];
  warehouses: string[];
};

export type InventoryFilters = {
  query?: string;
  category?: string;
  warehouse?: string;
  lowStockOnly?: boolean;
};

/**
 * Fetches inventory items with optional filters.
 */
export async function getInventoryItems(
  supabase: SupabaseClient,
  filters: InventoryFilters = {},
): Promise<InventoryItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name', { ascending: true });

  if (filters.query) {
    query = query.ilike('name', `%${filters.query}%`);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.warehouse) {
    query = query.eq('warehouse', filters.warehouse);
  }
  if (filters.lowStockOnly) {
    query = query.eq('low_stock', true);
  }

  const { data } = await query;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    category: item.category,
    warehouse: item.warehouse,
    unit: item.unit ?? 'pcs',
    currentStock: Number(item.current_stock) || 0,
    minimumStock: Number(item.minimum_stock) || 0,
    lowStock: item.low_stock ?? false,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

/**
 * Fetches inventory statistics for the company.
 */
export async function getInventoryStats(
  supabase: SupabaseClient,
): Promise<InventoryStats> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValue: 0,
    categories: [],
    warehouses: [],
  };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return {
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValue: 0,
    categories: [],
    warehouses: [],
  };

  const [{ data: items }, { count: lowStockCount }, { count: outOfStockCount }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('*')
      .eq('company_id', membership.company_id),
    supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', membership.company_id)
      .eq('low_stock', true),
    supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', membership.company_id)
      .eq('current_stock', 0),
  ]);

  const itemRows = items ?? [];
  const categories = [...new Set(itemRows.map((i: any) => i.category).filter(Boolean))] as string[];
  const warehouses = [...new Set(itemRows.map((i: any) => i.warehouse).filter(Boolean))] as string[];

  return {
    totalItems: itemRows.length,
    lowStockCount: lowStockCount ?? 0,
    outOfStockCount: outOfStockCount ?? 0,
    totalValue: 0, // Would need unit cost field
    categories,
    warehouses,
  };
}

/**
 * Creates a new inventory item.
 */
export async function createInventoryItem(
  supabase: SupabaseClient,
  item: Omit<InventoryItem, 'id' | 'lowStock' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; error?: string; item?: InventoryItem }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Check permissions (owner/manager can manage inventory)
  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      company_id: membership.company_id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      warehouse: item.warehouse,
      unit: item.unit,
      current_stock: item.currentStock,
      minimum_stock: item.minimumStock,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    item: {
      id: data.id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      warehouse: data.warehouse,
      unit: data.unit,
      currentStock: Number(data.current_stock) || 0,
      minimumStock: Number(data.minimum_stock) || 0,
      lowStock: data.low_stock ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * Updates an inventory item.
 */
export async function updateInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  const { error } = await supabase
    .from('inventory_items')
    .update({
      name: updates.name,
      sku: updates.sku,
      category: updates.category,
      warehouse: updates.warehouse,
      unit: updates.unit,
      current_stock: updates.currentStock,
      minimum_stock: updates.minimumStock,
    })
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

/**
 * Adjusts stock quantity (in/out).
 */
export async function adjustStock(
  supabase: SupabaseClient,
  itemId: string,
  delta: number,
): Promise<{ success: boolean; error?: string; newStock?: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  // Get current stock
  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('current_stock')
    .eq('id', itemId)
    .eq('company_id', membership.company_id)
    .single();

  if (fetchError || !item) return { success: false, error: 'Item not found' };

  const newStock = Math.max(0, Number(item.current_stock) + delta);

  const { error } = await supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  return { success: true, newStock };
}

/**
 * Deletes an inventory item.
 */
export async function deleteInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Only owners can delete
  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can delete items' };
  }

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

// ============================================
// DOCUMENTS
// ============================================

export type Document = {
  id: string;
  name: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number;
  version: number;
  projectId: string | null;
  projectName: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentStats = {
  totalDocuments: number;
  totalSize: number;
  byProject: Record<string, number>;
  byType: Record<string, number>;
};

export type DocumentFilters = {
  query?: string;
  projectId?: string;
  mimeType?: string;
};

/**
 * Fetches documents with optional filters.
 */
export async function getDocuments(
  supabase: SupabaseClient,
  filters: DocumentFilters = {},
): Promise<Document[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('documents')
    .select(
      `id, name, file_path, mime_type, size_bytes, version, project_id, uploaded_by, created_at, updated_at,
       projects!documents_project_id_fkey(name)`,
    )
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false });

  if (filters.query) {
    query = query.ilike('name', `%${filters.query}%`);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.mimeType) {
    query = query.eq('mime_type', filters.mimeType);
  }

  const { data } = await query;

  return (data ?? []).map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    filePath: doc.file_path,
    mimeType: doc.mime_type,
    sizeBytes: Number(doc.size_bytes) || 0,
    version: doc.version ?? 1,
    projectId: doc.project_id,
    projectName: doc.projects?.name ?? null,
    uploadedBy: doc.uploaded_by,
    uploadedByName: '', // Will be filled by separate query if needed
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }));
}

/**
 * Fetches document statistics for the company.
 */
export async function getDocumentStats(
  supabase: SupabaseClient,
): Promise<DocumentStats> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {
    totalDocuments: 0,
    totalSize: 0,
    byProject: {},
    byType: {},
  };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return {
    totalDocuments: 0,
    totalSize: 0,
    byProject: {},
    byType: {},
  };

  const { data: docs } = await supabase
    .from('documents')
    .select('name, mime_type, size_bytes, project_id, projects!documents_project_id_fkey(name)')
    .eq('company_id', membership.company_id);

  const docRows = docs ?? [];
  const byProject: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalSize = 0;

  docRows.forEach((doc: any) => {
    totalSize += Number(doc.size_bytes) || 0;
    const projectName = doc.projects?.name ?? 'Unassigned';
    byProject[projectName] = (byProject[projectName] || 0) + 1;
    const type = doc.mime_type?.split('/')[0] ?? 'other';
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    totalDocuments: docRows.length,
    totalSize,
    byProject,
    byType,
  };
}

/**
 * Gets a signed URL for downloading a document.
 */
export async function getDocumentDownloadUrl(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Verify the document belongs to the company
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('file_path', filePath)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (!doc) return { success: false, error: 'Document not found' };

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) return { success: false, error: error.message };

  return { success: true, url: data.signedUrl };
}

/**
 * Deletes a document (database record + storage file).
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  // Only owners/managers can delete
  const canDelete = ['owner', 'manager'].includes(membership.role);
  if (!canDelete) return { success: false, error: 'Insufficient permissions' };

  // Get the file path first
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('company_id', membership.company_id)
    .single();

  if (fetchError || !doc) return { success: false, error: 'Document not found' };

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([doc.file_path]);

  if (storageError) return { success: false, error: storageError.message };

  // Delete from database
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('company_id', membership.company_id);

  if (dbError) return { success: false, error: dbError.message };

  return { success: true };
}

/**
 * Formats file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Gets a file type icon based on mime type.
 */
export function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📄';
  const type = mimeType.split('/')[0];
  switch (type) {
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'application': {
      const subtype = mimeType.split('/')[1];
      if (subtype?.includes('pdf')) return '📕';
      if (subtype?.includes('word') || subtype?.includes('document')) return '📘';
      if (subtype?.includes('excel') || subtype?.includes('spreadsheet')) return '📗';
      if (subtype?.includes('powerpoint') || subtype?.includes('presentation')) return '📙';
      if (subtype?.includes('zip') || subtype?.includes('compressed')) return '📦';
      return '📄';
    }
    case 'text': return '📝';
    default: return '📄';
  }
}

// ============================================
// MARKETPLACE
// ============================================

export type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  categories: string[];
  rating: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  minOrderQty: number;
  leadTimeDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RFQ = {
  id: string;
  rfqNumber: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  description: string | null;
  status: 'draft' | 'sent' | 'received_quotes' | 'awarded' | 'closed';
  dueDate: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  items: RFQItem[];
  quotesCount: number;
};

export type RFQItem = {
  id: string;
  rfqId: string;
  productName: string;
  description: string | null;
  quantity: number;
  unit: string;
  category: string | null;
  neededBy: string | null;
};

export type Quote = {
  id: string;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'withdrawn';
  totalAmount: number;
  currency: string;
  validUntil: string | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
};

export type QuoteItem = {
  id: string;
  quoteId: string;
  rfqItemId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  notes: string | null;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  rfqId: string | null;
  rfqNumber: string | null;
  vendorId: string;
  vendorName: string;
  projectId: string | null;
  projectName: string | null;
  status: 'draft' | 'sent' | 'confirmed' | 'partial_received' | 'received' | 'cancelled';
  totalAmount: number;
  currency: string;
  expectedDate: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  items: POItem[];
};

export type POItem = {
  id: string;
  purchaseOrderId: string;
  productName: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty: number;
  inventoryItemId: string | null;
};

export type MarketplaceStats = {
  totalVendors: number;
  totalProducts: number;
  activeRFQs: number;
  pendingQuotes: number;
  openPOs: number;
  totalSpend: number;
};

export type MarketplaceFilters = {
  query?: string;
  category?: string;
  status?: string;
  projectId?: string;
};

/**
 * Fetches all vendors for the company.
 */
export async function getVendors(
  supabase: SupabaseClient,
  filters: MarketplaceFilters = {},
): Promise<Vendor[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('vendors')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('name', { ascending: true });

  if (filters.query) {
    query = query.ilike('name', `%${filters.query}%`);
  }
  if (filters.category) {
    query = query.contains('categories', [filters.category]);
  }

  const { data } = await query;

  return (data ?? []).map((v: any) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    phone: v.phone,
    address: v.address,
    categories: v.categories ?? [],
    rating: Number(v.rating) || 0,
    isVerified: v.is_verified ?? false,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  }));
}

/**
 * Fetches all products from vendors.
 */
export async function getProducts(
  supabase: SupabaseClient,
  filters: MarketplaceFilters = {},
): Promise<Product[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('products')
    .select(`*, vendors!products_vendor_id_fkey(name)`)
    .eq('company_id', membership.company_id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (filters.query) {
    query = query.ilike('name', `%${filters.query}%`);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const { data } = await query;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    vendorId: p.vendor_id,
    vendorName: p.vendors?.name ?? 'Unknown',
    name: p.name,
    description: p.description,
    sku: p.sku,
    category: p.category,
    unit: p.unit ?? 'pcs',
    unitPrice: Number(p.unit_price) || 0,
    currency: p.currency ?? 'EUR',
    minOrderQty: Number(p.min_order_qty) || 1,
    leadTimeDays: Number(p.lead_time_days) || 0,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

/**
 * Fetches all RFQs for the company.
 */
export async function getRFQs(
  supabase: SupabaseClient,
  filters: MarketplaceFilters = {},
): Promise<RFQ[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('rfqs')
    .select(`*, projects!rfqs_project_id_fkey(name), rfq_items(count)`)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false });

  if (filters.query) {
    query = query.ilike('title', `%${filters.query}%`);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }

  const { data } = await query;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    rfqNumber: r.rfq_number,
    projectId: r.project_id,
    projectName: r.projects?.name ?? null,
    title: r.title,
    description: r.description,
    status: r.status,
    dueDate: r.due_date,
    createdBy: r.created_by,
    createdByName: '', // Would need join
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: [],
    quotesCount: r.rfq_items?.[0]?.count ?? 0,
  }));
}

/**
 * Fetches a single RFQ with items.
 */
export async function getRFQDetail(
  supabase: SupabaseClient,
  rfqId: string,
): Promise<RFQ | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return null;

  const { data: rfq } = await supabase
    .from('rfqs')
    .select(`*, projects!rfqs_project_id_fkey(name)`)
    .eq('id', rfqId)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (!rfq) return null;

  const { data: items } = await supabase
    .from('rfq_items')
    .select('*')
    .eq('rfq_id', rfqId);

  return {
    id: rfq.id,
    rfqNumber: rfq.rfq_number,
    projectId: rfq.project_id,
    projectName: rfq.projects?.name ?? null,
    title: rfq.title,
    description: rfq.description,
    status: rfq.status,
    dueDate: rfq.due_date,
    createdBy: rfq.created_by,
    createdByName: '',
    createdAt: rfq.created_at,
    updatedAt: rfq.updated_at,
    items: (items ?? []).map((i: any) => ({
      id: i.id,
      rfqId: i.rfq_id,
      productName: i.product_name,
      description: i.description,
      quantity: Number(i.quantity) || 0,
      unit: i.unit ?? 'pcs',
      category: i.category,
      neededBy: i.needed_by,
    })),
    quotesCount: 0,
  };
}

/**
 * Creates a new RFQ.
 */
export async function createRFQ(
  supabase: SupabaseClient,
  rfq: Omit<RFQ, 'id' | 'rfqNumber' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt' | 'quotesCount'>,
  items: Omit<RFQItem, 'id' | 'rfqId'>[],
): Promise<{ success: boolean; error?: string; rfq?: RFQ }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager', 'engineer'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  // Generate RFQ number
  const { data: lastRFQ } = await supabase
    .from('rfqs')
    .select('rfq_number')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (lastRFQ && lastRFQ.length > 0) {
    const match = lastRFQ[0].rfq_number?.match(/RFQ-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const rfqNumber = `RFQ-${String(nextNum).padStart(4, '0')}`;

  const { data: newRFQ, error } = await supabase
    .from('rfqs')
    .insert({
      company_id: membership.company_id,
      rfq_number: rfqNumber,
      project_id: rfq.projectId,
      title: rfq.title,
      description: rfq.description,
      status: 'draft',
      due_date: rfq.dueDate,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Insert RFQ items
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('rfq_items')
      .insert(
        items.map((item) => ({
          rfq_id: newRFQ.id,
          product_name: item.productName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          needed_by: item.neededBy,
        })),
      );

    if (itemsError) {
      await supabase.from('rfqs').delete().eq('id', newRFQ.id);
      return { success: false, error: itemsError.message };
    }
  }

  return {
    success: true,
    rfq: {
      id: newRFQ.id,
      rfqNumber: newRFQ.rfq_number,
      projectId: newRFQ.project_id,
      projectName: rfq.projectName,
      title: newRFQ.title,
      description: newRFQ.description,
      status: newRFQ.status,
      dueDate: newRFQ.due_date,
      createdBy: newRFQ.created_by,
      createdByName: '',
      createdAt: newRFQ.created_at,
      updatedAt: newRFQ.updated_at,
      items: items.map((item) => ({
        ...item,
        id: '',
        rfqId: newRFQ.id,
      })),
      quotesCount: 0,
    },
  };
}

/**
 * Fetches quotes for an RFQ.
 */
export async function getQuotesForRFQ(
  supabase: SupabaseClient,
  rfqId: string,
): Promise<Quote[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`*, vendors!quotes_vendor_id_fkey(name), quote_items(*)`)
    .eq('rfq_id', rfqId)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false });

  return (quotes ?? []).map((q: any) => ({
    id: q.id,
    rfqId: q.rfq_id,
    rfqNumber: '',
    vendorId: q.vendor_id,
    vendorName: q.vendors?.name ?? 'Unknown',
    status: q.status,
    totalAmount: Number(q.total_amount) || 0,
    currency: q.currency ?? 'EUR',
    validUntil: q.valid_until,
    notes: q.notes,
    submittedAt: q.submitted_at,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    items: (q.quote_items ?? []).map((qi: any) => ({
      id: qi.id,
      quoteId: qi.quote_id,
      rfqItemId: qi.rfq_item_id,
      productName: qi.product_name,
      quantity: Number(qi.quantity) || 0,
      unit: qi.unit ?? 'pcs',
      unitPrice: Number(qi.unit_price) || 0,
      totalPrice: Number(qi.total_price) || 0,
      leadTimeDays: Number(qi.lead_time_days) || 0,
      notes: qi.notes,
    })),
  }));
}

/**
 * Fetches all purchase orders.
 */
export async function getPurchaseOrders(
  supabase: SupabaseClient,
  filters: MarketplaceFilters = {},
): Promise<PurchaseOrder[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return [];

  let query = supabase
    .from('purchase_orders')
    .select(`*, projects!purchase_orders_project_id_fkey(name), vendors!purchase_orders_vendor_id_fkey(name), po_items(count)`)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false });

  if (filters.query) {
    query = query.ilike('po_number', `%${filters.query}%`);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }

  const { data } = await query;

  return (data ?? []).map((po: any) => ({
    id: po.id,
    poNumber: po.po_number,
    rfqId: po.rfq_id,
    rfqNumber: null,
    vendorId: po.vendor_id,
    vendorName: po.vendors?.name ?? 'Unknown',
    projectId: po.project_id,
    projectName: po.projects?.name ?? null,
    status: po.status,
    totalAmount: Number(po.total_amount) || 0,
    currency: po.currency ?? 'EUR',
    expectedDate: po.expected_date,
    createdBy: po.created_by,
    createdByName: '',
    createdAt: po.created_at,
    updatedAt: po.updated_at,
    items: [],
  }));
}

/**
 * Creates a purchase order from an accepted quote.
 */
export async function createPurchaseOrderFromQuote(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<{ success: boolean; error?: string; po?: PurchaseOrder }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  // Get quote with items
  const { data: quote } = await supabase
    .from('quotes')
    .select(`*, quote_items(*), rfqs!quotes_rfq_id_fkey(rfq_number, project_id)`)
    .eq('id', quoteId)
    .eq('company_id', membership.company_id)
    .eq('status', 'accepted')
    .single();

  if (!quote) return { success: false, error: 'Quote not found or not accepted' };

  // Check if PO already exists for this quote
  const { data: existingPO } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('rfq_id', quote.rfq_id)
    .eq('vendor_id', quote.vendor_id)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (existingPO) return { success: false, error: 'Purchase order already exists for this quote' };

  // Generate PO number
  const { data: lastPO } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (lastPO && lastPO.length > 0) {
    const match = lastPO[0].po_number?.match(/PO-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const poNumber = `PO-${String(nextNum).padStart(4, '0')}`;

  const { data: newPO, error } = await supabase
    .from('purchase_orders')
    .insert({
      company_id: membership.company_id,
      po_number: poNumber,
      rfq_id: quote.rfq_id,
      vendor_id: quote.vendor_id,
      project_id: quote.rfqs?.project_id,
      status: 'draft',
      total_amount: quote.total_amount,
      currency: quote.currency,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Insert PO items from quote items
  const { error: itemsError } = await supabase
    .from('po_items')
    .insert(
      (quote.quote_items ?? []).map((qi: any) => ({
        purchase_order_id: newPO.id,
        product_name: qi.product_name,
        description: qi.notes,
        quantity: qi.quantity,
        unit: qi.unit,
        unit_price: qi.unit_price,
        total_price: qi.total_price,
        received_qty: 0,
      })),
    );

  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', newPO.id);
    return { success: false, error: itemsError.message };
  }

  // Update quote status
  await supabase
    .from('quotes')
    .update({ status: 'awarded' })
    .eq('id', quoteId);

  // Update RFQ status
  await supabase
    .from('rfqs')
    .update({ status: 'awarded' })
    .eq('id', quote.rfq_id);

  return {
    success: true,
    po: {
      id: newPO.id,
      poNumber: newPO.po_number,
      rfqId: newPO.rfq_id,
      rfqNumber: quote.rfqs?.rfq_number,
      vendorId: newPO.vendor_id,
      vendorName: quote.vendors?.name,
      projectId: newPO.project_id,
      projectName: null,
      status: newPO.status,
      totalAmount: Number(newPO.total_amount) || 0,
      currency: newPO.currency,
      expectedDate: newPO.expected_date,
      createdBy: newPO.created_by,
      createdByName: '',
      createdAt: newPO.created_at,
      updatedAt: newPO.updated_at,
      items: [],
    },
  };
}

/**
 * Receives goods against a PO item (increments inventory).
 */
export async function receivePOItem(
  supabase: SupabaseClient,
  poItemId: string,
  receivedQty: number,
  inventoryItemId?: string,
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  // Get PO item
  const { data: poItem } = await supabase
    .from('po_items')
    .select(`*, purchase_orders!po_items_purchase_order_id_fkey(company_id, vendor_id, project_id)`)
    .eq('id', poItemId)
    .eq('purchase_orders.company_id', membership.company_id)
    .single();

  if (!poItem) return { success: false, error: 'PO item not found' };

  const newReceivedQty = Number(poItem.received_qty) + receivedQty;
  if (newReceivedQty > Number(poItem.quantity)) {
    return { success: false, error: 'Received quantity exceeds ordered quantity' };
  }

  // Update PO item
  const { error: updateError } = await supabase
    .from('po_items')
    .update({ received_qty: newReceivedQty, inventory_item_id: inventoryItemId ?? null })
    .eq('id', poItemId);

  if (updateError) return { success: false, error: updateError.message };

  // If inventory item linked, increment stock
  if (inventoryItemId) {
    const { data: invItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .eq('company_id', membership.company_id)
      .single();

    if (invItem) {
      const newStock = Number(invItem.current_stock) + receivedQty;
      await supabase
        .from('inventory_items')
        .update({ current_stock: newStock })
        .eq('id', inventoryItemId);
    }
  }

  // Check if all items fully received
  const { data: allItems } = await supabase
    .from('po_items')
    .select('quantity, received_qty')
    .eq('purchase_order_id', poItem.purchase_orders.id);

  const allReceived = (allItems ?? []).every((item: any) => Number(item.received_qty) >= Number(item.quantity));

  if (allReceived) {
    await supabase
      .from('purchase_orders')
      .update({ status: 'received' })
      .eq('id', poItem.purchase_orders.id);
  } else {
    await supabase
      .from('purchase_orders')
      .update({ status: 'partial_received' })
      .eq('id', poItem.purchase_orders.id);
  }

  return { success: true };
}

/**
 * Fetches marketplace statistics.
 */
export async function getMarketplaceStats(
  supabase: SupabaseClient,
): Promise<MarketplaceStats> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {
    totalVendors: 0,
    totalProducts: 0,
    activeRFQs: 0,
    pendingQuotes: 0,
    openPOs: 0,
    totalSpend: 0,
  };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return {
    totalVendors: 0,
    totalProducts: 0,
    activeRFQs: 0,
    pendingQuotes: 0,
    openPOs: 0,
    totalSpend: 0,
  };

  const [{ count: vendors }, { count: products }, { count: activeRFQs }, { count: pendingQuotes }, { count: openPOs }] = await Promise.all([
    supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).eq('is_active', true),
    supabase.from('rfqs').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).in('status', ['draft', 'sent', 'received_quotes']),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).eq('status', 'submitted'),
    supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).in('status', ['draft', 'sent', 'confirmed', 'partial_received']),
  ]);

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('total_amount')
    .eq('company_id', membership.company_id)
    .in('status', ['confirmed', 'partial_received', 'received']);

  const totalSpend = (pos ?? []).reduce((sum: number, po: any) => sum + (Number(po.total_amount) || 0), 0);

  return {
    totalVendors: vendors ?? 0,
    totalProducts: products ?? 0,
    activeRFQs: activeRFQs ?? 0,
    pendingQuotes: pendingQuotes ?? 0,
    openPOs: openPOs ?? 0,
    totalSpend,
  };
}
