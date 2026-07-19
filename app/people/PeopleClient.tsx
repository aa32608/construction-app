'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  UserCog,
  Mail,
  Shield,
  Briefcase,
  Loader2,
  X,
  Bell,
  Settings,
} from 'lucide-react';
import { getInitials } from '@/lib/format';
import type { CompanyMember, DashboardUser, Membership, DashboardStats } from '@/lib/data';
import { inviteUserAction, updateMemberRoleAction, removeMemberAction } from '@/app/actions/people';
import { useLanguage, type Language } from '@/lib/translations';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  owner: { label: 'Owner', color: '#8b5cf6', bg: '#f5f3ff', icon: Shield },
  manager: { label: 'Manager', color: '#3b82f6', bg: '#eff6ff', icon: Briefcase },
  engineer: { label: 'Engineer', color: '#22c55e', bg: '#f0fdf4', icon: UserCog },
  employee: { label: 'Employee', color: '#6b7280', bg: '#f9fafb', icon: UserCheck },
};

type PeopleClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  members: CompanyMember[];
  stats: DashboardStats;
};

export default function PeopleClient({ user, membership, members: initialMembers, stats }: PeopleClientProps) {
  const [members, setMembers] = useState<CompanyMember[]>(initialMembers);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteJobTitle, setInviteJobTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [isPending, startTransition] = useTransition();

  // Edit Member Modal state
  const [editMember, setEditMember] = useState<CompanyMember | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editRoleInput, setEditRoleInput] = useState('employee');

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

  const [customRoles, setCustomRoles] = useState<{ name: string; permissions: string[] }[]>([]);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('customRoles');
    if (saved) {
      setCustomRoles(JSON.parse(saved));
    }
  }, []);

  const canManage = membership && ['owner', 'manager'].includes(membership.role);
  const isOwner = membership?.role === 'owner';

  const filteredMembers = members.filter((m) => {
    const matchesQuery = (m.fullName + ' ' + (m.email ?? '')).toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  const roleOptions = [
    { value: 'employee', label: 'Employee' },
    { value: 'engineer', label: 'Engineer' },
    { value: 'manager', label: 'Manager' },
    { value: 'owner', label: 'Owner' },
    ...customRoles.map((r) => ({ value: r.name.toLowerCase().replace(/\s+/g, '-'), label: r.name })),
  ];

  function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const exists = customRoles.some((r) => r.name.toLowerCase() === newRoleName.toLowerCase());
    if (exists) {
      alert('A role with this name already exists.');
      return;
    }
    const updated = [...customRoles, { name: newRoleName.trim(), permissions: newRolePermissions }];
    setCustomRoles(updated);
    localStorage.setItem('customRoles', JSON.stringify(updated));
    setNewRoleName('');
    setNewRolePermissions([]);
    setShowCreateRole(false);
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setInviteError('');
    setInviteSuccess('');

    startTransition(async () => {
      const result = await inviteUserAction(inviteEmail.trim(), inviteRole, inviteJobTitle.trim() || undefined);
      setBusy(false);
      if (result.error) {
        setInviteError(result.error);
        return;
      }
      setInviteSuccess('Invitation sent! The user will receive an email to join.');
      setInviteEmail('');
      setInviteJobTitle('');
      setInviteRole('employee');
      setTimeout(() => setShowInvite(false), 2000);
    });
  }

  async function changeRole(memberId: string, newRole: string) {
    if (!isOwner) return;
    setBusy(true);
    const result = await updateMemberRoleAction(memberId, newRole);
    setBusy(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.userId === memberId ? { ...m, role: newRole } : m))
    );
  }

  async function handleUpdateMemberDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!editMember || !isOwner) return;
    setBusy(true);

    const result = await updateMemberRoleAction(editMember.userId, editRoleInput, editTitleInput.trim() || undefined);
    setBusy(false);
    if (result.error) {
      alert(result.error);
      return;
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.userId === editMember.userId
          ? { ...m, role: editRoleInput, jobTitle: editTitleInput.trim() || null }
          : m
      )
    );
    setEditMember(null);
  }

  async function handleRemoveMember(memberId: string) {
    if (!isOwner) return;
    if (!confirm('Remove this member from the company? This cannot be undone.')) return;
    setBusy(true);
    const result = await removeMemberAction(memberId);
    setBusy(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.userId !== memberId));
    if (editMember?.userId === memberId) setEditMember(null);
  }

  function getRoleConfig(role: string) {
    const customMatch = customRoles.find((r) => r.name.toLowerCase().replace(/\s+/g, '-') === role);
    if (customMatch) {
      return {
        label: customMatch.name,
        color: '#d97706',
        bg: '#fef3c7',
        icon: Shield,
      };
    }
    return ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
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
        </div>
        <div className="nav-label">{t('workspace')}</div>
        <nav>
          <a href="/" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>{t('overview')}</span>
          </a>
          <a href="/projects" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t('projects')}</span>
            <b>{stats.activeProjects}</b>
          </a>
          <a href="/people" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>{t('people')}</span>
            <b>{members.length}</b>
          </a>
          <a href="/inventory" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>{t('inventory')}</span>
            {stats.lowStock && <b>{stats.lowStock}</b>}
          </a>
          <a href="/documents" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>{t('documents')}</span>
          </a>
        </nav>
        <div className="nav-label market-label">{t('connect')}</div>
        <nav>
          <a href="/marketplace" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{t('marketplace')}</span>
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
            <Bell size={18} />
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
            <Settings size={18} />
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <main className="main">
        <header>
          <div className="crumb">
            {t('workspace')} <span>/</span> <strong>{t('people')}</strong>
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
            <div className="filter-select">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All roles</option>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="engineer">Engineer</option>
                <option value="employee">Employee</option>
                {customRoles.map((r) => (
                  <option key={r.name} value={r.name.toLowerCase().replace(/\s+/g, '-')}>{r.name}</option>
                ))}
              </select>
            </div>
            {isOwner && (
              <button className="secondary" onClick={() => setShowCreateRole(true)} disabled={busy || isPending} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={17} /> {t('createRole')}
              </button>
            )}
            {canManage && (
              <button className="primary" onClick={() => setShowInvite(true)} disabled={busy || isPending}>
                <Plus size={17} /> {t('inviteMember')}
              </button>
            )}
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">{t('people')}</p>
              <h1>{t('companyMembers')}</h1>
              <p className="subhead">
                {members.length} member{members.length === 1 ? '' : 's'} in {membership?.companyName ?? 'your workspace'}
              </p>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 16 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No members found</h2>
              <p className="subhead" style={{ margin: 0 }}>
                {query || roleFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Your team is empty. Invite colleagues to start collaborating.'}
              </p>
              {canManage && !query && roleFilter === 'all' && (
                <button className="primary" onClick={() => setShowInvite(true)} style={{ marginTop: 16 }} disabled={busy || isPending}>
                  <Plus size={16} /> Invite first member
                </button>
              )}
            </div>
          ) : (
            <div className="people-grid">
              {filteredMembers.map((member) => {
                const config = getRoleConfig(member.role);
                const Icon = config.icon;
                const isCurrentUser = member.userId === user.id;
                return (
                  <div key={member.userId} className="person-card">
                    <div className="person-avatar" style={{ background: config.bg, color: config.color }}>
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.fullName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(member.fullName)
                      )}
                    </div>
                    <div className="person-info">
                      <div className="person-header">
                        <strong>{member.fullName}</strong>
                        {isCurrentUser && <span className="you-badge">You</span>}
                      </div>
                      {member.email && <div className="person-email"><Mail size={12} /> {member.email}</div>}
                      {member.jobTitle && <div className="person-title"><Briefcase size={12} /> {member.jobTitle}</div>}
                      <div className="person-meta">
                        <span className="role-badge" style={{ background: config.bg, color: config.color }}>
                          <Icon size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {config.label}
                        </span>
                        <span className="joined-date" suppressHydrationWarning>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {canManage && !isCurrentUser && (
                      <div className="person-actions">
                        <div className="role-select-wrapper">
                          <select
                            value={member.role}
                            onChange={(e) => changeRole(member.userId, e.target.value)}
                            className="role-select"
                            disabled={!isOwner || busy || isPending}
                          >
                            {roleOptions.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        {isOwner && (
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditMember(member);
                              setEditTitleInput(member.jobTitle || '');
                              setEditRoleInput(member.role);
                            }}
                            title="Edit Role & Job Title"
                            disabled={busy || isPending}
                          >
                            <UserCog size={16} />
                          </button>
                        )}
                        <button
                          className="icon-btn danger"
                          onClick={() => handleRemoveMember(member.userId)}
                          title="Remove member"
                          disabled={busy || isPending}
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invite Member Modal */}
        {showInvite && (
          <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
            <form className="modal" onSubmit={handleInvite} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Team</p>
                  <h2>Invite team member</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowInvite(false)} disabled={busy || isPending}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <label>
                Email address
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  disabled={busy || isPending}
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={busy || isPending}
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
                  <option value="employee">Employee</option>
                  <option value="engineer">Engineer</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <label style={{ marginTop: 16 }}>
                Job title (optional)
                <input
                  value={inviteJobTitle}
                  onChange={(e) => setInviteJobTitle(e.target.value)}
                  placeholder="e.g. Project Manager"
                  disabled={busy || isPending}
                />
              </label>
              {inviteError && (
                <p style={{ color: '#df7f73', fontSize: 11, margin: '10px 0 0' }}>{inviteError}</p>
              )}
              {inviteSuccess && (
                <p style={{ color: '#3eae83', fontSize: 11, margin: '10px 0 0' }}>{inviteSuccess}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowInvite(false)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending || !inviteEmail.trim()}>
                  {(busy || isPending) ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} {(busy || isPending) ? 'Sending...' : 'Send invitation'}
                </button>
              </div>
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          </div>
        )}

        {/* Edit Member Modal */}
        {editMember && (
          <div className="modal-backdrop" onClick={() => setEditMember(null)}>
            <form className="modal" onSubmit={handleUpdateMemberDetails} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Team Member</p>
                  <h2>Edit {editMember.fullName}</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setEditMember(null)} disabled={busy || isPending}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Role
                <select
                  value={editRoleInput}
                  onChange={(e) => setEditRoleInput(e.target.value)}
                  disabled={busy || isPending}
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
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ marginTop: 16 }}>
                Job Title
                <input
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  placeholder="e.g. Lead Engineer"
                  disabled={busy || isPending}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setEditMember(null)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create Role Modal */}
        {showCreateRole && (
          <div className="modal-backdrop" onClick={() => setShowCreateRole(false)}>
            <form className="modal" onSubmit={handleCreateRole} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{t('roles')}</p>
                  <h2>{t('createRole')}</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowCreateRole(false)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  {t('roleName')} <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Lead Architect"
                    required
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  <label style={{ marginBottom: 8, fontWeight: 600 }}>{t('permissions')}</label>
                  <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                    {[
                      { key: 'projects', label: t('manageProjects') },
                      { key: 'inventory', label: t('manageInventory') },
                      { key: 'people', label: t('managePeople') },
                      { key: 'documents', label: t('manageDocuments') },
                      { key: 'marketplace', label: t('manageMarketplace') },
                    ].map((perm) => (
                      <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'normal', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newRolePermissions.includes(perm.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRolePermissions((prev) => [...prev, perm.key]);
                            } else {
                              setNewRolePermissions((prev) => prev.filter((k) => k !== perm.key));
                            }
                          }}
                          style={{ width: 'auto', marginTop: 0 }}
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowCreateRole(false)}>
                  {t('cancel')}
                </button>
                <button className="primary" type="submit" disabled={!newRoleName.trim()}>
                  <Plus size={16} /> {t('saveRole')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
