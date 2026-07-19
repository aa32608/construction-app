'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Clock,
  ClipboardList,
  Package,
  HardHat,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Plus,
  MessageSquare,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  UserCheck,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDue, getInitials } from '@/lib/format';
import { useLanguage, type Language } from '@/lib/translations';
import type {
  DashboardStats,
  DashboardUser,
  Membership,
  ProjectView,
  TaskView,
  AuditLogView,
} from '@/lib/data';

type WorkerDashboardProps = {
  user: DashboardUser;
  membership: Membership | null;
  projects: ProjectView[];
  tasks: TaskView[];
  stats: DashboardStats;
  auditLogs?: AuditLogView[];
  greeting: string;
  todayLabel: string;
  onSwitchRole: (role: 'manager' | 'worker') => void;
  currentRole: 'manager' | 'worker';
};

type ShiftNote = {
  id: string;
  author: string;
  initials: string;
  text: string;
  time: string;
};

export default function WorkerDashboard({
  user,
  membership,
  projects,
  tasks,
  stats,
  auditLogs,
  greeting,
  todayLabel,
  onSwitchRole,
  currentRole,
}: WorkerDashboardProps) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('en');
  useEffect(() => {
    const saved = localStorage.getItem('lang') as Language;
    if (saved && ['en', 'sq', 'mk'].includes(saved)) {
      setLang(saved);
    }
  }, []);

  const { t } = useLanguage(lang);
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('open');
  const [taskItems, setTaskItems] = useState<TaskView[]>(tasks);
  const [query, setQuery] = useState('');
  
  // Shift logs / site updates
  const [shiftNotes, setShiftNotes] = useState<ShiftNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Shift Check-in & Timer state
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [shiftStart, setShiftStart] = useState<string | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);

  useEffect(() => {
    const savedShift = localStorage.getItem('worker_shift_state');
    if (savedShift) {
      try {
        const parsed = JSON.parse(savedShift);
        if (parsed.isClockedIn && parsed.shiftStart) {
          setIsClockedIn(true);
          setShiftStart(parsed.shiftStart);
          const startMs = new Date(parsed.shiftStart).getTime();
          setShiftSeconds(Math.floor((Date.now() - startMs) / 1000));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isClockedIn && shiftStart) {
      interval = setInterval(() => {
        const startMs = new Date(shiftStart).getTime();
        setShiftSeconds(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClockedIn, shiftStart]);

  function formatTimer(sec: number) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function handleClockIn() {
    const nowIso = new Date().toISOString();
    setIsClockedIn(true);
    setShiftStart(nowIso);
    setShiftSeconds(0);
    localStorage.setItem('worker_shift_state', JSON.stringify({ isClockedIn: true, shiftStart: nowIso }));
  }

  function handleClockOut() {
    if (!confirm('End your active work shift? A shift summary report will be logged to your daily site log.')) return;
    const totalTime = formatTimer(shiftSeconds);
    const autoNote: ShiftNote = {
      id: 'note-' + Date.now(),
      author: user.fullName,
      initials: getInitials(user.fullName),
      text: `⏱ Completed site shift. Total active shift duration: ${totalTime}.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [autoNote, ...shiftNotes];
    setShiftNotes(updated);
    if (membership?.companyId) {
      localStorage.setItem(`worker_shift_notes_${membership.companyId}`, JSON.stringify(updated));
    }

    setIsClockedIn(false);
    setShiftStart(null);
    setShiftSeconds(0);
    localStorage.removeItem('worker_shift_state');
  }

  // Allocated site materials list loaded for worker's projects
  const [allocatedMaterials, setAllocatedMaterials] = useState<
    { id: string; name: string; quantity: number; unit: string; project: string }[]
  >([]);

  useEffect(() => {
    setTaskItems(tasks);
  }, [tasks]);

  // Load shift notes & materials
  useEffect(() => {
    if (membership?.companyId) {
      const savedNotes = localStorage.getItem(`worker_shift_notes_${membership.companyId}`);
      if (savedNotes) {
        try {
          setShiftNotes(JSON.parse(savedNotes));
        } catch (e) {
          console.error(e);
        }
      }

      // Aggregate assigned materials across projects from localStorage or defaults
      const materialsList: { id: string; name: string; quantity: number; unit: string; project: string }[] = [];
      projects.forEach((p) => {
        const savedMat = localStorage.getItem(`assigned_materials_${p.id}`);
        if (savedMat) {
          try {
            const parsed = JSON.parse(savedMat);
            parsed.forEach((m: any) => {
              materialsList.push({
                id: `${p.id}-${m.id}`,
                name: m.name,
                quantity: m.quantity,
                unit: m.unit,
                project: p.name,
              });
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
      setAllocatedMaterials(materialsList);
    }
  }, [membership, projects]);

  async function toggleTaskStatus(taskId: string) {
    const target = taskItems.find((t) => t.id === taskId);
    if (!target) return;
    const nextDone = !target.done;
    const nextStatus = nextDone ? 'done' : 'todo';

    setTaskItems((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t))
    );

    const { error } = await createClient()
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', taskId);

    if (error) console.error('Error updating task:', error);
    router.refresh();
  }

  function handlePostShiftNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteText.trim() || !membership) return;

    const newNote: ShiftNote = {
      id: 'note-' + Date.now(),
      author: user.fullName,
      initials: getInitials(user.fullName),
      text: newNoteText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [newNote, ...shiftNotes];
    setShiftNotes(updated);
    localStorage.setItem(`worker_shift_notes_${membership.companyId}`, JSON.stringify(updated));
    setNewNoteText('');
    setShowNoteModal(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const filteredTasks = taskItems.filter((t) => {
    const matchesQuery = t.text.toLowerCase().includes(query.toLowerCase()) ||
      t.project.toLowerCase().includes(query.toLowerCase());
    const matchesFilter =
      taskFilter === 'all'
        ? true
        : taskFilter === 'open'
        ? !t.done
        : t.done;
    return matchesQuery && matchesFilter;
  });

  const openTasksCount = taskItems.filter((t) => !t.done).length;
  const completedTasksCount = taskItems.filter((t) => t.done).length;

  return (
    <div className={dark ? 'app dark' : 'app'}>
      {/* Sidebar tailored for Worker */}
      <aside className={mobile ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark" style={{ background: '#f59e0b' }}>
            <HardHat size={19} color="#ffffff" />
          </div>
          <span>construct<strong>OS</strong></span>
          <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>
            WORKER
          </span>
          <button className="close" onClick={() => setMobile(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="company">
          <div className="company-logo" style={{ background: '#f59e0b', color: '#fff' }}>
            {(membership?.companyName ?? user.fullName).charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{membership?.companyName ?? 'Workspace'}</strong>
            <small style={{ color: '#f59e0b', fontWeight: 600 }}>Field Site View</small>
          </div>
        </div>

        <div className="nav-label">Worker Portal</div>
        <nav>
          <a href="#" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <HardHat size={18} />
            <span>My Site Dashboard</span>
          </a>
          <a href="/projects" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Building2 size={18} />
            <span>My Projects</span>
            <b>{projects.length}</b>
          </a>
          <a href="/inventory" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Package size={18} />
            <span>Site Supplies</span>
          </a>
          <a href="/documents" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Layers size={18} />
            <span>Documents & Plans</span>
          </a>
        </nav>

        <div className="side-bottom">
          {/* Role Mode Switcher */}
          <div style={{ padding: '8px 12px', marginBottom: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>Dashboard Mode:</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => onSwitchRole('worker')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  background: currentRole === 'worker' ? '#f59e0b' : '#cbd5e1',
                  color: currentRole === 'worker' ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Worker
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('manager')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  background: currentRole === 'manager' ? '#3b82f6' : '#e2e8f0',
                  color: currentRole === 'manager' ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Manager
              </button>
            </div>
          </div>

          <div className="profile">
            <div className="avatar" style={{ background: '#f59e0b' }}>{user.initials}</div>
            <div>
              <strong>{user.fullName}</strong>
              <small style={{ color: '#d97706', fontWeight: 600 }}>Field Worker</small>
            </div>
            <button aria-label="Sign out" className="dots" onClick={signOut}>
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
          <div className="crumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Worker Operations</span> <span>/</span> <strong>Site Dashboard</strong>
            <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              👷 Field Worker View
            </span>
          </div>
          <div className="header-actions">
            <div className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter tasks or site materials..."
              />
            </div>

            {/* Language & Theme */}
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

            <button
              className="secondary"
              onClick={() => onSwitchRole('manager')}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
            >
              <ShieldCheck size={15} /> Switch View
            </button>
          </div>
        </header>

        <div className="content">
          {/* Welcome Banner for Worker */}
          <div className="welcome" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div>
              <p className="eyebrow" style={{ color: '#b45309', fontWeight: 700 }}>
                {todayLabel} · FIELD OPERATIONS
              </p>
              <h1 style={{ color: '#78350f', fontSize: 26, margin: '4px 0' }}>
                {greeting} <span>👷‍♂️</span>
              </h1>
              <p className="subhead" style={{ color: '#92400e', margin: 0 }}>
                Welcome to your site operations portal for {membership?.companyName || 'ConstructOS'}. Here are your tasks, site materials, and project updates for today.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {isClockedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '6px 12px', borderRadius: 8, border: '1px solid #fcd34d', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🟢 SHIFT ACTIVE: {formatTimer(shiftSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={handleClockOut}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 0,
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clock Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClockIn}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 0,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  ⏱ Start Work Shift
                </button>
              )}
              <button className="primary" onClick={() => setShowNoteModal(true)} style={{ background: '#d97706', borderColor: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} /> Post Shift Log
              </button>
            </div>
          </div>

          {/* Quick Stat Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-top">
                <span>My Pending Tasks</span>
                <div className="stat-icon orange"><Clock size={18} /></div>
              </div>
              <strong>{openTasksCount}</strong>
              <p><span className={openTasksCount > 0 ? 'attention' : 'up'}>{openTasksCount > 0 ? 'Requires attention today' : 'All done!'}</span></p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Completed Today</span>
                <div className="stat-icon green"><CheckCircle size={18} /></div>
              </div>
              <strong>{completedTasksCount}</strong>
              <p><span className="up">{completedTasksCount} tasks checked off</span></p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Active Sites</span>
                <div className="stat-icon blue"><Building2 size={18} /></div>
              </div>
              <strong>{projects.length}</strong>
              <p><em>Projects assigned to site team</em></p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Allocated Supplies</span>
                <div className="stat-icon green"><Package size={18} /></div>
              </div>
              <strong>{allocatedMaterials.length}</strong>
              <p><em>Materials on site</em></p>
            </div>
          </div>

          {/* Worker Dashboard Main Grid */}
          <div className="dashboard-grid">
            {/* Left Panel: My Active Tasks */}
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>My Tasks & Field Duties</h2>
                  <p>Check off your assigned duties as you complete them on site</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['open', 'done', 'all'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTaskFilter(mode)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        fontSize: 11,
                        fontWeight: 600,
                        background: taskFilter === mode ? '#f59e0b' : '#fff',
                        color: taskFilter === mode ? '#fff' : '#64748b',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {mode === 'open' ? `To Do (${openTasksCount})` : mode === 'done' ? `Done (${completedTasksCount})` : 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                  <CheckCircle size={40} style={{ color: '#cbd5e1', marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No tasks in this view.</p>
                </div>
              ) : (
                <div className="task-list" style={{ display: 'grid', gap: 10 }}>
                  {filteredTasks.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: t.done ? '#f8fafc' : '#ffffff',
                        border: `1px solid ${t.done ? '#e2e8f0' : '#fde68a'}`,
                        borderRadius: 8,
                        boxShadow: t.done ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <button
                        className={'check ' + (t.done ? 'checked' : '')}
                        onClick={() => toggleTaskStatus(t.id)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: `2px solid ${t.done ? '#22c55e' : '#f59e0b'}`,
                          background: t.done ? '#22c55e' : '#fff',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {t.done && <CheckCircle size={15} />}
                      </button>

                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleTaskStatus(t.id)}>
                        <strong style={{ fontSize: 14, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#94a3b8' : '#1e293b' }}>
                          {t.text}
                        </strong>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                            📌 {t.project}
                          </span>
                          {t.due && (
                            <span style={{ fontSize: 11, color: t.due === 'Today' ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                              🕒 {t.due}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleTaskStatus(t.id)}
                        style={{
                          border: 0,
                          background: t.done ? '#f1f5f9' : '#fffbeb',
                          color: t.done ? '#64748b' : '#b45309',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {t.done ? 'Completed' : 'Mark Done'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right Panel: My Projects & Site Materials */}
            <div style={{ display: 'grid', gap: 20 }}>
              {/* My Active Projects */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>My Assigned Projects</h2>
                    <p>Construction sites you are working on</p>
                  </div>
                  <Link href="/projects" className="text-btn" style={{ fontSize: 12 }}>
                    View All <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {projects.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No projects assigned yet.</p>
                  ) : (
                    projects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => router.push(`/projects/${p.id}`)}
                        style={{
                          padding: '12px 14px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{p.name}</strong>
                          <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            {p.statusLabel}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>Client: {p.client} · Due: {p.due || 'TBD'}</p>
                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.progress}%`, background: '#f59e0b', borderRadius: 3 }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Site Materials & Allocated Supplies */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Site Materials & Tools</h2>
                    <p>Equipment and items allocated for your active projects</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {allocatedMaterials.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                      No materials currently allocated to active project sites.
                    </p>
                  ) : (
                    allocatedMaterials.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 12, color: '#1e293b' }}>{m.name}</strong>
                          <small style={{ display: 'block', color: '#64748b', fontSize: 10 }}>{m.project}</small>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '3px 8px', borderRadius: 4 }}>
                          {m.quantity} {m.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Shift Logs / Notes Feed */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Daily Shift Log</h2>
                    <p>Recent site updates & field communications</p>
                  </div>
                  <button className="text-btn" onClick={() => setShowNoteModal(true)}>
                    + Add Note
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {shiftNotes.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                      No shift notes posted today. Use &quot;Post Shift Log&quot; to leave a note for the site team.
                    </p>
                  ) : (
                    shiftNotes.slice(0, 4).map((note) => (
                      <div key={note.id} style={{ display: 'flex', gap: 10, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {note.initials}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: 12, color: '#1e293b' }}>{note.author}</strong>
                            <small style={{ color: '#94a3b8', fontSize: 10 }}>{note.time}</small>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>{note.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Post Shift Log Modal */}
        {showNoteModal && (
          <div className="modal-backdrop" onClick={() => setShowNoteModal(false)}>
            <form className="modal" onSubmit={handlePostShiftNote} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow" style={{ color: '#d97706' }}>Field Communication</p>
                  <h2>Post Daily Shift Log / Update</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNoteModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <label>
                Shift report / Site notes <span style={{ color: '#ef4444' }}>*</span>
                <textarea
                  autoFocus
                  required
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="e.g. Received concrete mixer on site A. Completed formwork inspection for section 2."
                  rows={4}
                  style={{ display: 'block', width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px', marginTop: 8, font: "13px 'DM Sans'" }}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="secondary" onClick={() => setShowNoteModal(false)}>
                  Cancel
                </button>
                <button className="primary" type="submit" style={{ background: '#d97706', borderColor: '#b45309' }} disabled={!newNoteText.trim()}>
                  Post Shift Update
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
