'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  Clock3,
  Construction,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Moon,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/format';
import { useLanguage, type Language } from '@/lib/translations';
import type {
  DashboardStats,
  DashboardUser,
  Membership,
  ProjectView,
  TaskView,
} from '@/lib/data';

type DashboardProps = {
  user: DashboardUser;
  membership: Membership | null;
  projects: ProjectView[];
  tasks: TaskView[];
  stats: DashboardStats;
  greeting: string;
  todayLabel: string;
};

function NavItem({
  icon: Icon,
  label,
  active = false,
  badge,
  href,
}: {
  icon: any;
  label: string;
  active?: boolean;
  badge?: string;
  href?: string;
}) {
  return (
    <a href={href || '#'} className={'nav-item ' + (active ? 'active' : '')} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Icon size={18} />
      <span>{label}</span>
      {badge && <b>{badge}</b>}
    </a>
  );
}

export default function Dashboard({
  user,
  membership,
  projects,
  tasks,
  stats,
  greeting,
  todayLabel,
}: DashboardProps) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('en');
  useEffect(() => {
    const saved = localStorage.getItem('lang') as Language;
    if (saved && ['en', 'sq', 'mk'].includes(saved)) {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('lang') as Language;
      if (saved && ['en', 'sq', 'mk'].includes(saved)) {
        setLang(saved);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { t } = useLanguage(lang);
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');

  const [projectItems, setProjectItems] = useState<ProjectView[]>(projects);
  const [taskItems, setTaskItems] = useState<TaskView[]>(tasks);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState('');

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskDue, setTaskDue] = useState('');

  const [companyInput, setCompanyInput] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep local state in sync when the server refetches data after a mutation.
  useEffect(() => {
    setProjectItems(projects);
  }, [projects]);
  useEffect(() => {
    setTaskItems(tasks);
  }, [tasks]);

  const visibleProjects = projectItems.filter((p) =>
    (p.name + ' ' + p.client).toLowerCase().includes(query.toLowerCase()),
  );

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    const name = newProject.trim();
    if (!name || !membership) return;
    setShowNewProject(false);
    setProjectItems((items) => [
      {
        id: 'tmp-' + Date.now(),
        name,
        client: 'New client',
        progress: 0,
        statusLabel: 'Planning',
        risk: false,
        color: '#8b72d9',
        due: '',
        budget: '€0',
      },
      ...items,
    ]);
    setNewProject('');
    const { error } = await createClient().from('projects').insert({
      company_id: membership.companyId,
      name,
      status: 'planning',
      progress: 0,
      budget: 0,
      created_by: user.id,
    });
    if (error) console.error(error);
    router.refresh();
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || !membership) return;
    const projectId = taskProject || null;
    const projectName =
      projectItems.find((p) => p.id === projectId)?.name ?? 'General';
    setShowNewTask(false);
    setTaskItems((items) => [
      { id: 'tmp-' + Date.now(), text: title, project: projectName, due: '', done: false },
      ...items,
    ]);
    setNewTask('');
    setTaskProject('');
    setTaskDue('');
    const { error } = await createClient().from('tasks').insert({
      company_id: membership.companyId,
      project_id: projectId,
      title,
      assignee_id: user.id,
      status: 'todo',
      due_date: taskDue || null,
    });
    if (error) console.error(error);
    router.refresh();
  }

  async function toggleTask(id: string) {
    const target = taskItems.find((t) => t.id === id);
    if (!target) return;
    const next = target.done ? 'todo' : 'done';
    setTaskItems((items) =>
      items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    const { error } = await createClient()
      .from('tasks')
      .update({ status: next })
      .eq('id', id);
    if (error) console.error(error);
  }

  async function createCompany(event: React.FormEvent) {
    event.preventDefault();
    const name = companyInput.trim();
    if (!name) return;
    setBusy(true);
    setCompanyError('');
    const { error } = await createClient().rpc('create_company', {
      p_name: name,
      p_slug: slugify(name),
    });
    setBusy(false);
    if (error) {
      setCompanyError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className={mobile ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">
            <Construction size={19} />
          </div>
          <span>
            construct<strong>OS</strong>
          </span>
          <button className="close" onClick={() => setMobile(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="company">
          <div className="company-logo">
            {(membership?.companyName ?? user.fullName).charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{membership?.companyName ?? 'Set up workspace'}</strong>
            <small>{membership ? 'Workspace' : 'No company yet'}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{t('workspace')}</div>
        <nav>
          <NavItem icon={LayoutDashboard} label={t('overview')} active href="/" />
          <NavItem icon={ClipboardList} label={t('projects')} badge={String(stats.activeProjects)} href="/projects" />
          <NavItem icon={Users} label={t('people')} href="/people" />
          <NavItem icon={Package} label={t('inventory')} badge={stats.lowStock ? String(stats.lowStock) : undefined} href="/inventory" />
          <NavItem icon={FileText} label={t('documents')} href="/documents" />
        </nav>
        <div className="nav-label market-label">{t('connect')}</div>
        <nav>
          <NavItem icon={ShoppingBag} label={t('marketplace')} href="/marketplace" />
          <NavItem icon={Bell} label="Notifications" badge="3" href="#" />
        </nav>
        <div className="side-bottom">
          <NavItem icon={Settings} label={t('settings')} href="#" />
          <div className="profile">
            <div className="avatar">{user.initials}</div>
            <div>
              <strong>{user.fullName}</strong>
              <small style={{ textTransform: 'capitalize' }}>
                {membership?.role ?? 'Owner'}
              </small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              className="dots"
              onClick={signOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header>
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu size={21} />
          </button>
          <div className="crumb">
            {t('workspace')} <span>/</span> <strong>{t('overview')}</strong>
          </div>
          <div className="header-actions">
            <div className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search')}
              />
              <kbd>⌘ K</kbd>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={lang}
                onChange={(e) => {
                  const newLang = e.target.value as Language;
                  setLang(newLang);
                  localStorage.setItem('lang', newLang);
                  window.dispatchEvent(new Event('storage'));
                }}
                style={{
                  border: '1px solid #edf0f3',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 12,
                  background: '#fff',
                  cursor: 'pointer',
                  color: '#3a4150',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="en">EN</option>
                <option value="sq">SQ</option>
                <option value="mk">MK</option>
              </select>
            </div>
            <button className="icon-btn" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn notification">
              <Bell size={18} />
              <i />
            </button>
            <div className="header-avatar">{user.initials}</div>
          </div>
        </header>

        <div className="content">
          {membership ? (
            <>
              <div className="welcome">
                <div>
                  <p className="eyebrow">{todayLabel}</p>
                  <h1>
                    {greeting} <span>✦</span>
                  </h1>
                  <p className="subhead">
                    Here&apos;s what&apos;s happening across {membership.companyName} today.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowNewProject(true)}>
                  <Plus size={17} /> {t('newProject')}
                </button>
              </div>

              <section className="stat-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{t('activeProjects')}</span>
                    <div className="stat-icon blue">
                      <ClipboardList size={18} />
                    </div>
                  </div>
                  <strong>{stats.activeProjects}</strong>
                  <p>
                    <span className="up">Across {membership.companyName}</span>
                  </p>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{t('committedBudget')}</span>
                    <div className="stat-icon green">€</div>
                  </div>
                  <strong>{stats.committedBudget}</strong>
                  <p>
                    <em>Total across active projects</em>
                  </p>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{t('openTasks')}</span>
                    <div className="stat-icon orange">
                      <Clock3 size={18} />
                    </div>
                  </div>
                  <strong>{stats.openTasks}</strong>
                  <p>
                    <span className={stats.openTasks ? 'attention' : 'up'}>
                      {stats.openTasks ? 'Needs attention' : 'All clear'}
                    </span>
                  </p>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{t('lowStockItems')}</span>
                    <div className="stat-icon red">
                      <Package size={18} />
                    </div>
                  </div>
                  <strong>{stats.lowStock}</strong>
                  <p>
                    <span className={stats.lowStock ? 'attention' : 'up'}>
                      {stats.lowStock ? 'Needs attention' : 'Stocked'}
                    </span>
                  </p>
                </div>
              </section>

              <div className="dashboard-grid">
                <section className="panel projects">
                  <div className="panel-head">
                    <div>
                      <h2>{t('projects')}</h2>
                      <p>Your active projects at a glance</p>
                    </div>
                    <button className="text-btn">
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="project-list">
                    {visibleProjects.length === 0 && (
                      <p className="subhead" style={{ padding: '8px 0' }}>
                        No projects yet. Create your first one to get started.
                      </p>
                    )}
                    {visibleProjects.map((p) => (
                      <div className="project" key={p.id}>
                        <div className="project-title">
                          <div className="project-dot" style={{ background: p.color }} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.client}</small>
                          </div>
                          <span className={'status ' + (p.risk ? 'risk' : '')}>
                            {p.statusLabel}
                          </span>
                          <button className="dots">
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                        <div className="project-meta">
                          <span>
                            Progress <b>{p.progress}%</b>
                          </span>
                          <span>
                            Due <b>{p.due || 'TBD'}</b>
                          </span>
                          <span>
                            Budget <b>{p.budget}</b>
                          </span>
                        </div>
                        <div className="progress">
                          <i style={{ width: p.progress + '%', background: p.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel tasks">
                  <div className="panel-head">
                    <div>
                      <h2>{t('openTasks')}</h2>
                      <p>{stats.openTasks} task{stats.openTasks === 1 ? '' : 's'} need your attention</p>
                    </div>
                    <button className="text-btn">
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="task-list">
                    {taskItems.length === 0 && (
                      <p className="subhead" style={{ padding: '8px 0' }}>
                        {t('noTasks')}
                      </p>
                    )}
                    {taskItems.map((t) => (
                      <div className="task" key={t.id}>
                        <button
                          aria-label={t.done ? 'Mark task incomplete' : 'Mark task complete'}
                          className={'check ' + (t.done ? 'checked' : '')}
                          onClick={() => toggleTask(t.id)}
                        >
                          {t.done && <CircleCheck size={18} />}
                        </button>
                        <div>
                          <strong className={t.done ? 'strike' : ''}>{t.text}</strong>
                          <small>{t.project}</small>
                        </div>
                        <span className={t.due === 'Today' ? 'today' : ''}>{t.due}</span>
                      </div>
                    ))}
                  </div>
                  <button className="add-task" onClick={() => setShowNewTask(true)}>
                    <Plus size={16} /> {t('addTask')}
                  </button>
                </section>
              </div>

              <div className="bottom-grid">
                <section className="panel activity">
                  <div className="panel-head">
                    <div>
                      <h2>{t('recentActivity')}</h2>
                      <p>Updates from your team</p>
                    </div>
                    <button className="text-btn">
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="activity-row">
                    <div className="avatar purple">{user.initials}</div>
                    <p>
                      <strong>{user.fullName}</strong> set up the{' '}
                      <b>{membership.companyName}</b> workspace
                      <small>{todayLabel}</small>
                    </p>
                  </div>
                </section>
                <section className="tip">
                  <div className="tip-icon">✦</div>
                  <div>
                    <p className="eyebrow">{t('insight')}</p>
                    <h3>{t('keepMoving')}</h3>
                    <p>
                      {t('assignTasks')}
                    </p>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="welcome" style={{ justifyContent: 'center' }}>
              <div className="panel" style={{ maxWidth: 460, width: '100%', margin: '40px auto' }}>
                <div className="panel-head" style={{ marginBottom: 16 }}>
                  <div>
                    <p className="eyebrow">{t('oneLastStep')}</p>
                    <h2>{t('createWorkspace')}</h2>
                    <p className="subhead">
                      {t('everyProject')}
                    </p>
                  </div>
                </div>
                <form onSubmit={createCompany}>
                  <label className="modal label" style={{ fontSize: 11, fontWeight: 600, color: '#596170', display: 'block' }}>
                    {t('companyName')}
                    <input
                      autoFocus
                      value={companyInput}
                      onChange={(e) => setCompanyInput(e.target.value)}
                      placeholder="e.g. Ardent Build Co."
                      required
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 42,
                        border: '1px solid #e0e3e9',
                        borderRadius: 6,
                        padding: '0 12px',
                        marginTop: 8,
                        font: "12px 'DM Sans'",
                        outline: 0,
                      }}
                    />
                  </label>
                  {companyError && (
                    <p style={{ color: '#df7f73', fontSize: 11, margin: '10px 0 0' }}>{companyError}</p>
                  )}
                  <div className="modal-actions">
                    <button className="primary" type="submit" disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
                      <Plus size={16} /> {busy ? 'Creating...' : 'Create workspace'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {showNewProject && (
          <div className="modal-backdrop" onClick={() => setShowNewProject(false)}>
            <form className="modal" onSubmit={createProject} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h2>Start a new project</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNewProject(false)}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Project name
                <input
                  autoFocus
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  placeholder="e.g. Eastside Offices"
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowNewProject(false)}>
                  Cancel
                </button>
                <button className="primary" type="submit">
                  <Plus size={16} /> Create project
                </button>
              </div>
            </form>
          </div>
        )}

        {showNewTask && (
          <div className="modal-backdrop" onClick={() => setShowNewTask(false)}>
            <form className="modal" onSubmit={createTask} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">My tasks</p>
                  <h2>Add a task</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNewTask(false)}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Task
                <input
                  autoFocus
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g. Review concrete delivery schedule"
                  required
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Project (optional)
                <select
                  value={taskProject}
                  onChange={(e) => setTaskProject(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 42,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '0 10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    background: '#fff',
                  }}
                >
                  <option value="">No project</option>
                  {projectItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ marginTop: 16 }}>
                Due date (optional)
                <input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowNewTask(false)}>
                  Cancel
                </button>
                <button className="primary" type="submit">
                  <Plus size={16} /> Add task
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
