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

const STATUS_MAP: Record<string, { label: string; risk: boolean }> = {
  planning: { label: 'Planning', risk: false },
  active: { label: 'On track', risk: false },
  on_hold: { label: 'On hold', risk: true },
  completed: { label: 'Completed', risk: false },
  archived: { label: 'Archived', risk: false },
};

const ACTIVE_STATUSES = new Set(['planning', 'active', 'on_hold']);

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
