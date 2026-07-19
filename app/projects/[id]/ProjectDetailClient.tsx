'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  Package,
  Settings,
  Trash2,
  Edit,
  ArrowUpRight,
  Calendar,
  DollarSign,
  User,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatBudget, formatDue, getInitials } from '@/lib/format';
import type { ProjectDetail, ProjectTask, ProjectMember, DashboardUser, Membership } from '@/lib/data';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  planning: { label: 'Planning', color: '#3b82f6', bg: '#eff6ff', icon: FileText },
  active: { label: 'Active', color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle },
  on_hold: { label: 'On Hold', color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  completed: { label: 'Completed', color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
  archived: { label: 'Archived', color: '#6b7280', bg: '#f9fafb', icon: FileText },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'To do', color: '#6b7280', bg: '#f9fafb' },
  in_progress: { label: 'In progress', color: '#3b82f6', bg: '#eff6ff' },
  done: { label: 'Done', color: '#22c55e', bg: '#f0fdf4' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#3b82f6' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

type ProjectDetailClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  project: ProjectDetail;
};

export default function ProjectDetailClient({ user, membership, project: initialProject }: ProjectDetailClientProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail>(initialProject);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'team' | 'activity'>('overview');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDescription, setTaskDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');

  // Sync with server data on refresh
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const canManage = membership && ['owner', 'manager', 'engineer'].includes(membership.role);

  async function toggleTask(taskId: string, currentStatus: string) {
    const next = currentStatus === 'done' ? 'todo' : 'done';
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: next } : t)),
      stats: {
        ...prev.stats,
        completedTasks: next === 'done' ? prev.stats.completedTasks + 1 : prev.stats.completedTasks - 1,
        todoTasks: next === 'todo' ? prev.stats.todoTasks + 1 : prev.stats.todoTasks - 1,
      },
    }));
    const { error } = await createClient().from('tasks').update({ status: next }).eq('id', taskId);
    if (error) console.error(error);
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || !membership) return;
    setShowNewTask(false);
    const tempId = 'tmp-' + Date.now();
    const newTaskObj: ProjectTask = {
      id: tempId,
      title,
      description: taskDescription || null,
      status: 'todo',
      priority: taskPriority,
      dueDate: taskDue || null,
      assignee: { id: user.id, fullName: user.fullName, avatarUrl: null },
      createdAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      tasks: [newTaskObj, ...prev.tasks],
      stats: { ...prev.stats, totalTasks: prev.stats.totalTasks + 1, todoTasks: prev.stats.todoTasks + 1 },
    }));
    setNewTask('');
    setTaskDescription('');
    setTaskDue('');
    setTaskPriority('medium');
    const { error } = await createClient().from('tasks').insert({
      company_id: membership.companyId,
      project_id: project.id,
      title,
      description: taskDescription || null,
      priority: taskPriority,
      due_date: taskDue || null,
      assignee_id: user.id,
      status: 'todo',
    });
    if (error) console.error(error);
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return;
    setProject((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
        stats: {
          ...prev.stats,
          totalTasks: prev.stats.totalTasks - 1,
          completedTasks: task?.status === 'done' ? prev.stats.completedTasks - 1 : prev.stats.completedTasks,
          todoTasks: task?.status === 'todo' ? prev.stats.todoTasks - 1 : prev.stats.todoTasks,
          inProgressTasks: task?.status === 'in_progress' ? prev.stats.inProgressTasks - 1 : prev.stats.inProgressTasks,
        },
      };
    });
    const { error } = await createClient().from('tasks').delete().eq('id', taskId);
    if (error) console.error(error);
  }

  const filteredTasks = project.tasks.filter((t) =>
    (t.title + ' ' + (t.description ?? '')).toLowerCase().includes(taskQuery.toLowerCase())
  );

  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planning;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span>construct<strong>OS</strong></span>
        </div>
        <div className="company">
          <div className="company-logo">
            {(membership?.companyName ?? user.fullName).charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{membership?.companyName ?? 'Workspace'}</strong>
            <small>Workspace</small>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          <Link href="/" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Overview</span>
          </Link>
          <Link href="/projects" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Projects</span>
          </Link>
          <Link href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>People</span>
          </Link>
          <Link href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>Inventory</span>
          </Link>
          <Link href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Documents</span>
          </Link>
        </nav>
      </aside>

      <main className="main">
        <header>
          <Link href="/projects" className="back-link" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeft size={20} />
            <span>Projects</span>
          </Link>
          <div className="crumb">
            {project.name} <span>/</span> <strong>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
          </div>
          <div className="header-actions">
            {canManage && activeTab === 'tasks' && (
              <button className="primary" onClick={() => setShowNewTask(true)}>
                <Plus size={17} /> Add task
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {/* Project Header */}
          <div className="project-header">
            <div className="project-header-main">
              <div className="project-status-badge" style={{ background: statusConfig.bg, color: statusConfig.color }}>
                <StatusIcon size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {statusConfig.label}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{project.name}</h1>
                {project.clientName && (
                  <p className="subhead" style={{ margin: '4px 0 0' }}>Client: {project.clientName}</p>
                )}
              </div>
            </div>
            <div className="project-progress">
              <div className="progress-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="#e0e3e9"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke={statusConfig.color}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (project.progress / 100) * 213.6}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                  <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1a1d23">
                    {project.progress}%
                  </text>
                </svg>
              </div>
              <div className="project-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Budget</span>
                  <span className="meta-value"><DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {formatBudget(project.budget)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due date</span>
                  <span className="meta-value"><Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {project.dueDate ? formatDue(project.dueDate) : 'Not set'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Tasks</span>
                  <span className="meta-value">{project.stats.completedTasks} / {project.stats.totalTasks} done</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Team</span>
                  <span className="meta-value"><Users size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {project.members.length} members</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={activeTab === 'tasks' ? 'active' : ''}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks <b>{project.stats.totalTasks}</b>
            </button>
            <button
              className={activeTab === 'team' ? 'active' : ''}
              onClick={() => setActiveTab('team')}
            >
              Team <b>{project.members.length}</b>
            </button>
            <button
              className={activeTab === 'activity' ? 'active' : ''}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Description</h2>
                      <p>Project overview and details</p>
                    </div>
                  </div>
                  <div className="description">
                    {project.description ? (
                      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{project.description}</p>
                    ) : (
                      <p className="subhead">No description added yet.</p>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Key metrics</h2>
                      <p>Project health at a glance</p>
                    </div>
                  </div>
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Completion</span>
                        <div className="stat-icon blue"><CheckCircle size={18} /></div>
                      </div>
                      <strong>{project.stats.totalTasks > 0 ? Math.round((project.stats.completedTasks / project.stats.totalTasks) * 100) : 0}%</strong>
                      <p><span className="up">{project.stats.completedTasks} of {project.stats.totalTasks} tasks</span></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>In progress</span>
                        <div className="stat-icon orange"><Clock size={18} /></div>
                      </div>
                      <strong>{project.stats.inProgressTasks}</strong>
                      <p><em>Tasks being worked on</em></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>To do</span>
                        <div className="stat-icon gray"><FileText size={18} /></div>
                      </div>
                      <strong>{project.stats.todoTasks}</strong>
                      <p><em>Tasks not started</em></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Budget</span>
                        <div className="stat-icon green"><DollarSign size={18} /></div>
                      </div>
                      <strong>{formatBudget(project.budget)}</strong>
                      <p><em>Total project budget</em></p>
                    </div>
                  </div>
                </section>
              </div>

              {canManage && (
                <div className="panel" style={{ marginTop: 24 }}>
                  <div className="panel-head">
                    <div>
                      <h2>Quick actions</h2>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Add task
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} /> Invite member
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={16} /> Upload document
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Settings size={16} /> Project settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Tasks</h2>
                    <p>{project.stats.todoTasks} to do, {project.stats.inProgressTasks} in progress, {project.stats.completedTasks} done</p>
                  </div>
                </div>
                <div className="search" style={{ marginBottom: 16 }}>
                  <Search size={17} />
                  <input
                    value={taskQuery}
                    onChange={(e) => setTaskQuery(e.target.value)}
                    placeholder="Search tasks..."
                  />
                </div>
                {filteredTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 12 }}>
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    </svg>
                    <p className="subhead">No tasks yet</p>
                    {canManage && (
                      <button className="primary" onClick={() => setShowNewTask(true)} style={{ marginTop: 12 }}>
                        <Plus size={16} /> Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="task-list">
                    {filteredTasks.map((t) => {
                      const statusCfg = TASK_STATUS_CONFIG[t.status];
                      const priorityCfg = PRIORITY_CONFIG[t.priority];
                      return (
                        <div key={t.id} className="task-row">
                          <button
                            className={'check ' + (t.status === 'done' ? 'checked' : '')}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTask(t.id, t.status); }}
                            aria-label={t.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {t.status === 'done' && <CheckCircle size={18} />}
                          </button>
                          <div className="task-content" style={{ flex: 1 }}>
                            <strong className={t.status === 'done' ? 'strike' : ''}>{t.title}</strong>
                            {t.description && <p className="subhead" style={{ margin: '4px 0 0', maxWidth: 500 }}>{t.description}</p>}
                            <div className="task-meta">
                              {t.assignee && (
                                <span className="assignee">
                                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{getInitials(t.assignee.fullName)}</div>
                                  {t.assignee.fullName}
                                </span>
                              )}
                              <span className="priority-badge" style={{ background: priorityCfg.color + '20', color: priorityCfg.color }}>
                                {priorityCfg.label}
                              </span>
                              <span className="status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                {statusCfg.label}
                              </span>
                              {t.dueDate && (
                                <span className={formatDue(t.dueDate) === 'Today' ? 'today' : ''}>
                                  <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                  {formatDue(t.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <div className="task-actions">
                              <button className="icon-btn" title="Edit" onClick={(e) => e.stopPropagation()}>
                                <Edit size={16} />
                              </button>
                              <button className="icon-btn danger" title="Delete" onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Team members</h2>
                    <p>{project.members.length} member{project.members.length === 1 ? '' : 's'} on this project</p>
                  </div>
                  {canManage && (
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Invite
                    </button>
                  )}
                </div>
                <div className="team-list">
                  {project.members.map((m) => (
                    <div key={m.userId} className="team-member">
                      <div className="avatar" style={{ background: '#8b72d9' }}>{getInitials(m.fullName)}</div>
                      <div>
                        <strong>{m.fullName}</strong>
                        <small>{m.role}</small>
                      </div>
                      {canManage && m.userId !== user.id && (
                        <button className="icon-btn" title="Remove">
                          <MoreHorizontal size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent activity</h2>
                    <p>Updates from your team</p>
                  </div>
                </div>
                <div className="activity-feed">
                  <div className="activity-row">
                    <div className="avatar purple">{getInitials(user.fullName)}</div>
                    <p>
                      <strong>{user.fullName}</strong> created project <b>{project.name}</b>
                      <small>{formatDue(project.createdAt.split('T')[0])}</small>
                    </p>
                  </div>
                  <div className="activity-row">
                    <div className="avatar blue">T</div>
                    <p>
                      <strong>Team member</strong> added a task
                      <small>2 hours ago</small>
                    </p>
                  </div>
                  <div className="activity-row">
                    <div className="avatar green">M</div>
                    <p>
                      <strong>Maria Santos</strong> updated project status to <b>{statusConfig.label}</b>
                      <small>Yesterday</small>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Task Modal */}
        {showNewTask && (
          <div className="modal-backdrop" onClick={() => setShowNewTask(false)}>
            <form className="modal" onSubmit={createTask} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Tasks</p>
                  <h2>Add a task</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNewTask(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <label>
                Task title
                <input
                  autoFocus
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g. Review concrete delivery schedule"
                  required
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Description (optional)
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 80,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    resize: 'vertical',
                  }}
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Priority
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
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
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
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
                <button type="button" className="secondary" onClick={() => setShowNewTask(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || !newTask.trim()}>
                  <Plus size={16} /> {busy ? 'Adding...' : 'Add task'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}