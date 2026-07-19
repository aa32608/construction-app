'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  MoreHorizontal,
  FolderOpen,
  Clock,
  CheckCircle,
  AlertTriangle,
  Archive,
  Download,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatBudget, formatDue } from '@/lib/format';
import type { ProjectListItem, DashboardUser, Membership, DashboardStats } from '@/lib/data';

type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; icon: any; color: string; bg: string }> = {
  planning: { label: 'Planning', icon: FolderOpen, color: '#3b82f6', bg: '#eff6ff' },
  active: { label: 'Active', icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
  on_hold: { label: 'On Hold', icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  completed: { label: 'Completed', icon: CheckCircle, color: '#10b981', bg: '#ecfdf5' },
  archived: { label: 'Archived', icon: Archive, color: '#6b7280', bg: '#f9fafb' },
};

type ProjectsClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  projects: ProjectListItem[];
  stats: DashboardStats;
};

export default function ProjectsClient({ user, membership, projects: initialProjects, stats }: ProjectsClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>(initialProjects);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [busy, setBusy] = useState(false);

  // Edit/Manage Project Modal state
  const [editProject, setEditProject] = useState<ProjectListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editStatus, setEditStatus] = useState<string>('planning');
  const [editProgress, setEditProgress] = useState(0);
  const [editBudget, setEditBudget] = useState(0);
  const [editDue, setEditDue] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesQuery = (p.name + ' ' + (p.clientName ?? '')).toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    const name = newProject.trim();
    if (!name || !membership) return;
    setShowNewProject(false);
    const tempId = 'tmp-' + Date.now();
    setProjects((items) => [
      {
        id: tempId,
        name,
        clientName: 'New client',
        status: 'planning',
        progress: 0,
        budget: 0,
        dueDate: null,
        taskCount: 0,
        completedTaskCount: 0,
        createdAt: new Date().toISOString(),
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

  async function handleUpdateProject(event: React.FormEvent) {
    event.preventDefault();
    if (!editProject) return;
    setBusy(true);

    const updatedProject = {
      name: editName.trim() || editProject.name,
      client_name: editClient.trim() || null,
      status: editStatus,
      progress: editProgress,
      budget: editBudget,
      due_date: editDue || null,
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === editProject.id
          ? {
              ...p,
              name: updatedProject.name,
              clientName: updatedProject.client_name,
              status: editStatus,
              progress: editProgress,
              budget: editBudget,
              dueDate: updatedProject.due_date,
            }
          : p
      )
    );

    const targetId = editProject.id;
    setEditProject(null);
    setBusy(false);

    const { error } = await createClient().from('projects').update(updatedProject).eq('id', targetId);
    if (error) console.error(error);
    router.refresh();
  }

  async function handleDeleteProject(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete project "${name}"? All associated tasks will be deleted.`)) return;
    setBusy(true);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (editProject?.id === id) setEditProject(null);
    setBusy(false);

    const { error } = await createClient().from('projects').delete().eq('id', id);
    if (error) console.error(error);
    router.refresh();
  }

  function exportProjectsCSV() {
    if (filteredProjects.length === 0) {
      alert('No projects available to export.');
      return;
    }
    const headers = ['Project Name', 'Client Name', 'Status', 'Progress (%)', 'Budget (EUR)', 'Due Date', 'Total Tasks', 'Completed Tasks'];
    const rows = filteredProjects.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.clientName ?? 'Internal').replace(/"/g, '""')}"`,
      p.status,
      p.progress,
      p.budget,
      p.dueDate ?? '',
      p.taskCount,
      p.completedTaskCount,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `constructos_projects_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getStatusConfig(status: string) {
    return STATUS_CONFIG[status as ProjectStatus] ?? STATUS_CONFIG.planning;
  }

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
            <strong>{membership?.companyName ?? 'Set up workspace'}</strong>
            <small>{membership ? 'Workspace' : 'No company yet'}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          <a href="/" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Overview</span>
          </a>
          <a href="/projects" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Projects</span>
            <b>{stats.activeProjects}</b>
          </a>
          <a href="/people" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>People</span>
          </a>
          <a href="/inventory" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Inventory</span>
            {stats.lowStock && <b>{stats.lowStock}</b>}
          </a>
          <a href="/documents" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Documents</span>
          </a>
        </nav>
        <div className="nav-label market-label">Connect</div>
        <nav>
          <a href="/marketplace" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Marketplace</span>
          </a>
          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-notifications'));
            }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifications</span>
            <b>3</b>
          </a>
        </nav>
        <div className="side-bottom">
          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-settings'));
            }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <main className="main">
        <header>
          <div className="crumb">
            Workspace <span>/</span> <strong>Projects</strong>
          </div>
          <div className="header-actions">
            <div
              className="search"
              onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
              style={{ cursor: 'pointer' }}
            >
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="filter-select">
              <Filter size={17} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <ChevronDown size={15} />
            </div>
            <button className="secondary" onClick={exportProjectsCSV} title="Export CSV">
              <Download size={16} /> Export CSV
            </button>
            <button className="primary" onClick={() => setShowNewProject(true)}>
              <Plus size={17} /> New project
            </button>
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">Projects overview</p>
              <h1>All projects</h1>
              <p className="subhead">
                {projects.length} project{projects.length === 1 ? '' : 's'} across {membership?.companyName ?? 'your workspace'}
              </p>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 16 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No projects found</h2>
              <p className="subhead" style={{ margin: 0 }}>
                {query || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Create your first project to get started.'}
              </p>
              {!query && statusFilter === 'all' && (
                <button className="primary" onClick={() => setShowNewProject(true)} style={{ marginTop: 16 }}>
                  <Plus size={16} /> Create project
                </button>
              )}
            </div>
          ) : (
            <div className="project-table">
              <div className="table-header">
                <span>Project</span>
                <span>Client</span>
                <span>Status</span>
                <span>Progress</span>
                <span>Budget</span>
                <span>Due date</span>
                <span style={{ width: 48 }}></span>
              </div>
              {filteredProjects.map((p) => {
                const config = getStatusConfig(p.status);
                const Icon = config.icon;
                return (
                  <a
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="table-row"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="project-cell">
                      <div className="project-dot" style={{ background: config.color }} />
                      <div>
                        <strong>{p.name}</strong>
                        <small style={{ color: '#596170' }}>{p.taskCount} task{p.taskCount === 1 ? '' : 's'}</small>
                      </div>
                    </div>
                    <span>{p.clientName ?? 'Internal'}</span>
                    <span className="status-badge" style={{ background: config.bg, color: config.color }}>
                      <Icon size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {config.label}
                    </span>
                    <div className="progress-cell">
                      <div className="progress-bar">
                        <i style={{ width: p.progress + '%', background: config.color }} />
                      </div>
                      <small>{p.progress}%</small>
                    </div>
                    <span>{formatBudget(p.budget)}</span>
                    <span>{p.dueDate ? formatDue(p.dueDate) : '—'}</span>
                    <button
                      className="dots"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditProject(p);
                        setEditName(p.name);
                        setEditClient(p.clientName ?? '');
                        setEditStatus(p.status);
                        setEditProgress(p.progress);
                        setEditBudget(p.budget);
                        setEditDue(p.dueDate ? p.dueDate.split('T')[0] : '');
                      }}
                      title="Manage Project Options"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
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
                  disabled={busy}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowNewProject(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || !newProject.trim()}>
                  <Plus size={16} /> {busy ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit / Manage Project Modal */}
        {editProject && (
          <div className="modal-backdrop" onClick={() => setEditProject(null)}>
            <form className="modal" onSubmit={handleUpdateProject} onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 520px)' }}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Project Management</p>
                  <h2>Edit Project Details</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setEditProject(null)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ gridColumn: 'span 2' }}>
                  Project Name <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Client Name
                  <input
                    value={editClient}
                    onChange={(e) => setEditClient(e.target.value)}
                    placeholder="e.g. Internal / Client Corp"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                  />
                </label>
                <label>
                  Budget (€)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editBudget}
                    onChange={(e) => setEditBudget(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Progress ({editProgress}%)
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editProgress}
                    onChange={(e) => setEditProgress(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#5267dc', marginTop: 16 }}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #edf0f4' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(editProject.id, editProject.name)}
                  style={{
                    border: '1px solid #fde2ba',
                    background: '#fff0ef',
                    color: '#df7f73',
                    borderRadius: 7,
                    padding: '8px 12px',
                    font: "600 12px 'DM Sans'",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  disabled={busy}
                >
                  <Trash2 size={15} /> Delete Project
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => setEditProject(null)} disabled={busy}>
                    Cancel
                  </button>
                  <button className="primary" type="submit" disabled={busy || !editName.trim()}>
                    {busy ? <Loader2 size={16} className="spin" /> : null} Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
