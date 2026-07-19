'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Settings,
  Search,
  X,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  User,
  FileText,
  Package,
  ShoppingBag,
  Moon,
  Sun,
  Shield,
  Briefcase,
  ExternalLink,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'stock' | 'rfq' | 'task' | 'doc' | 'general';
  link: string;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Low stock warning: Portland Cement',
    description: 'Current stock is below minimum threshold (4 pcs remaining in Main Warehouse). Reorder recommended.',
    time: '10 mins ago',
    read: false,
    type: 'stock',
    link: '/inventory',
  },
  {
    id: 'notif-2',
    title: 'RFQ Awarded: Concrete Materials',
    description: 'Quote accepted from Acme Materials Ltd. Purchase Order #PO-0001 has been drafted and awaits receiving.',
    time: '1 hour ago',
    read: false,
    type: 'rfq',
    link: '/marketplace',
  },
  {
    id: 'notif-3',
    title: 'New task assigned to you',
    description: 'Review site safety guidelines & concrete delivery schedule for Eastside Offices.',
    time: '3 hours ago',
    read: false,
    type: 'task',
    link: '/projects',
  },
  {
    id: 'notif-4',
    title: 'New document uploaded',
    description: 'Foundation inspection certificate v1 uploaded by team engineer.',
    time: 'Yesterday',
    read: true,
    type: 'doc',
    link: '/documents',
  },
];

export default function GlobalModals() {
  const router = useRouter();

  // Modals state
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Settings state
  const [settingsTab, setSettingsTab] = useState<'workspace' | 'profile' | 'security'>('workspace');
  const [companyName, setCompanyName] = useState('Ardent Build Co.');
  const [currency, setCurrency] = useState('EUR (€)');
  const [fullName, setFullName] = useState('Alex Morgan');
  const [email, setEmail] = useState('alex.morgan@constructos.com');
  const [language, setLanguage] = useState('en');
  const [darkMode, setDarkMode] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load persisted notifications
    const savedNotifs = localStorage.getItem('constructos_notifications');
    if (savedNotifs) {
      try {
        setNotifications(JSON.parse(savedNotifs));
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }

    // Load persisted settings
    const savedCompany = localStorage.getItem('constructos_company_name');
    if (savedCompany) setCompanyName(savedCompany);

    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLanguage(savedLang);

    const savedDark = localStorage.getItem('constructos_dark_mode');
    if (savedDark === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
      const appEl = document.querySelector('.app');
      if (appEl) appEl.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    // Event listeners for global triggers
    const handleOpenNotifs = () => setShowNotifications(true);
    const handleOpenSettings = () => {
      setShowSettings(true);
      setSavedMessage('');
    };
    const handleOpenSearch = () => {
      setShowSearch(true);
      setSearchQuery('');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowSettings(false);
        setShowSearch(false);
      }
    };

    window.addEventListener('open-notifications', handleOpenNotifs);
    window.addEventListener('open-settings', handleOpenSettings);
    window.addEventListener('open-search', handleOpenSearch);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-notifications', handleOpenNotifs);
      window.removeEventListener('open-settings', handleOpenSettings);
      window.removeEventListener('open-search', handleOpenSearch);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleRead = (id: string) => {
    const next = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifications(next);
    localStorage.setItem('constructos_notifications', JSON.stringify(next));
  };

  const markAllRead = () => {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(next);
    localStorage.setItem('constructos_notifications', JSON.stringify(next));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.setItem('constructos_notifications', JSON.stringify([]));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('constructos_company_name', companyName);
    localStorage.setItem('lang', language);
    localStorage.setItem('constructos_dark_mode', String(darkMode));

    window.dispatchEvent(new Event('storage'));
    setSavedMessage('Settings successfully saved!');
    setTimeout(() => setSavedMessage(''), 3000);
    router.refresh();
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('constructos_dark_mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
      const appEl = document.querySelector('.app');
      if (appEl) appEl.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      const appEl = document.querySelector('.app');
      if (appEl) appEl.classList.remove('dark');
    }
  };

  type SearchItem = {
    label: string;
    icon: any;
    category: string;
    href?: string;
    action?: () => void;
  };

  // Quick search items
  const quickNav: SearchItem[] = [
    { label: 'Overview Dashboard', icon: FolderOpen, href: '/', category: 'Pages' },
    { label: 'Projects Index', icon: FolderOpen, href: '/projects', category: 'Pages' },
    { label: 'People & Team Members', icon: User, href: '/people', category: 'Pages' },
    { label: 'Inventory & Materials', icon: Package, href: '/inventory', category: 'Pages' },
    { label: 'Documents & Files', icon: FileText, href: '/documents', category: 'Pages' },
    { label: 'Marketplace & Procurement', icon: ShoppingBag, href: '/marketplace', category: 'Pages' },
  ];

  const quickActions: SearchItem[] = [
    { label: 'Create New Project', icon: Plus, action: () => { setShowSearch(false); router.push('/projects?action=new'); }, category: 'Actions' },
    { label: 'Add Inventory Material', icon: Plus, action: () => { setShowSearch(false); router.push('/inventory?action=new'); }, category: 'Actions' },
    { label: 'Invite Team Member', icon: Plus, action: () => { setShowSearch(false); router.push('/people?action=invite'); }, category: 'Actions' },
    { label: 'Upload Document', icon: Plus, action: () => { setShowSearch(false); router.push('/documents?action=upload'); }, category: 'Actions' },
    { label: 'Create Request For Quote (RFQ)', icon: Plus, action: () => { setShowSearch(false); router.push('/marketplace?action=rfq'); }, category: 'Actions' },
  ];

  const filteredSearch: SearchItem[] = [
    ...quickNav.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    ...quickActions.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase())),
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Notifications Modal / Drawer */}
      {showNotifications && (
        <div className="modal-backdrop" onClick={() => setShowNotifications(false)} style={{ zIndex: 100 }}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 480px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #edf0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Activity & Alerts</p>
                <h2 style={{ fontSize: 18, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Notifications {unreadCount > 0 && <span style={{ background: '#5267dc', color: '#fff', fontSize: 11, borderRadius: 12, padding: '2px 8px' }}>{unreadCount} new</span>}
                </h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowNotifications(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '10px 24px', borderBottom: '1px solid #edf0f4', display: 'flex', justifyContent: 'space-between', background: '#fff' }}>
              <button
                type="button"
                className="text-btn"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                style={{ fontSize: 12, opacity: unreadCount === 0 ? 0.5 : 1 }}
              >
                Mark all as read
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={clearAllNotifications}
                disabled={notifications.length === 0}
                style={{ fontSize: 12, color: '#df7f73', opacity: notifications.length === 0 ? 0.5 : 1 }}
              >
                Clear all
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 24px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                  <Bell size={40} style={{ color: '#c4c9d3', margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, color: '#313947', margin: '0 0 4px' }}>No notifications</p>
                  <p className="subhead" style={{ margin: 0 }}>You caught up with everything happening across your workspace.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {notifications.map((n) => {
                    const iconBg =
                      n.type === 'stock' ? '#fff4e6' : n.type === 'rfq' ? '#eef1ff' : n.type === 'task' ? '#e8f7f0' : '#f4f5f7';
                    const iconColor =
                      n.type === 'stock' ? '#d99a42' : n.type === 'rfq' ? '#5267dc' : n.type === 'task' ? '#45a77b' : '#68707d';
                    const IconComp =
                      n.type === 'stock' ? AlertTriangle : n.type === 'rfq' ? ShoppingBag : n.type === 'task' ? CheckCircle : FileText;

                    return (
                      <div
                        key={n.id}
                        style={{
                          padding: 14,
                          borderRadius: 8,
                          border: '1px solid #edf0f4',
                          background: n.read ? '#fff' : '#f8f9fe',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                          position: 'relative',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: iconBg, color: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <IconComp size={17} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: 13, color: n.read ? '#566070' : '#1e2433', fontWeight: n.read ? 500 : 700 }}>
                              {n.title}
                            </strong>
                            <small style={{ color: '#9aa1ad', fontSize: 10, whiteSpace: 'nowrap', marginLeft: 8 }}>{n.time}</small>
                          </div>
                          <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#68707d', lineHeight: 1.5 }}>{n.description}</p>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="text-btn"
                              onClick={() => {
                                setShowNotifications(false);
                                router.push(n.link);
                              }}
                              style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              View details <ExternalLink size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleRead(n.id)}
                              style={{ border: 0, background: 'none', color: '#8f97a5', fontSize: 11, cursor: 'pointer', padding: 0 }}
                            >
                              {n.read ? 'Mark unread' : 'Mark read'}
                            </button>
                          </div>
                        </div>
                        {!n.read && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#5267dc', position: 'absolute', top: 14, right: 14 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)} style={{ zIndex: 100 }}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 580px)', padding: 0, overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #edf0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Preferences</p>
                <h2 style={{ fontSize: 18, margin: '4px 0 0' }}>Workspace & Account Settings</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #edf0f4', background: '#fff', padding: '0 24px' }}>
              <button
                type="button"
                onClick={() => setSettingsTab('workspace')}
                style={{
                  padding: '12px 16px',
                  border: 0,
                  background: 'none',
                  borderBottom: settingsTab === 'workspace' ? '2px solid #5267dc' : 'none',
                  color: settingsTab === 'workspace' ? '#5267dc' : '#777f8e',
                  fontWeight: settingsTab === 'workspace' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('profile')}
                style={{
                  padding: '12px 16px',
                  border: 0,
                  background: 'none',
                  borderBottom: settingsTab === 'profile' ? '2px solid #5267dc' : 'none',
                  color: settingsTab === 'profile' ? '#5267dc' : '#777f8e',
                  fontWeight: settingsTab === 'profile' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Profile & Appearance
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('security')}
                style={{
                  padding: '12px 16px',
                  border: 0,
                  background: 'none',
                  borderBottom: settingsTab === 'security' ? '2px solid #5267dc' : 'none',
                  color: settingsTab === 'security' ? '#5267dc' : '#777f8e',
                  fontWeight: settingsTab === 'security' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Security & System
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ padding: '24px', background: '#fff' }}>
              {settingsTab === 'workspace' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  <label>
                    Company Name
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label>
                      Default Currency
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 12px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                      >
                        <option value="EUR (€)">EUR (€)</option>
                        <option value="USD ($)">USD ($)</option>
                        <option value="GBP (£)">GBP (£)</option>
                      </select>
                    </label>
                    <label>
                      Industry Sector
                      <select
                        defaultValue="Commercial & Residential Construction"
                        style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 12px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                      >
                        <option value="Commercial & Residential Construction">Commercial & Residential Construction</option>
                        <option value="Civil Engineering & Infrastructure">Civil Engineering & Infrastructure</option>
                        <option value="Industrial & Heavy Construction">Industrial & Heavy Construction</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {settingsTab === 'profile' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  <label>
                    Full Name
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label>
                      Language
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 12px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                      >
                        <option value="en">English (EN)</option>
                        <option value="sq">Shqip (SQ)</option>
                        <option value="mk">Makeдонски (MK)</option>
                      </select>
                    </label>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8 }}>Interface Theme</label>
                      <button
                        type="button"
                        onClick={toggleDarkMode}
                        style={{
                          width: '100%',
                          height: 42,
                          border: '1px solid #e0e3e9',
                          borderRadius: 6,
                          background: darkMode ? '#1e2433' : '#fff',
                          color: darkMode ? '#fff' : '#313947',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          font: "600 12px 'DM Sans'",
                        }}
                      >
                        {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                        {darkMode ? 'Dark Mode (Active)' : 'Light Mode (Active)'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'security' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ background: '#f8f9fb', padding: 16, borderRadius: 8, border: '1px solid #edf0f4' }}>
                    <strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Password Authentication</strong>
                    <p style={{ fontSize: 12, color: '#68707d', margin: '0 0 12px' }}>
                      Change your account login password or send a password reset link to your email.
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => alert(`Password reset link sent to ${email}`)}
                      style={{ fontSize: 11 }}
                    >
                      Send Password Reset Email
                    </button>
                  </div>
                  <div style={{ background: '#fff4e6', padding: 16, borderRadius: 8, border: '1px solid #fde2ba' }}>
                    <strong style={{ fontSize: 13, color: '#d99a42', display: 'block', marginBottom: 4 }}>Active Sessions & Data</strong>
                    <p style={{ fontSize: 12, color: '#8c672b', margin: '0 0 12px' }}>
                      Clear local browser preferences or sign out of all active ConstructOS sessions.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          localStorage.clear();
                          alert('Local preferences cleared.');
                          window.location.reload();
                        }}
                        style={{ fontSize: 11, background: '#fff' }}
                      >
                        Reset Local Cache
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {savedMessage && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#e8f7f0', color: '#3eae83', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} /> {savedMessage}
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #edf0f4' }}>
                <button type="button" className="secondary" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  <Check size={16} /> Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Command Palette / Quick Search Modal */}
      {showSearch && (
        <div className="modal-backdrop" onClick={() => setShowSearch(false)} style={{ zIndex: 110, alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 580px)', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #edf0f4', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
              <Search size={18} style={{ color: '#8f97a5' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ConstructOS across pages, actions, and features... (ESC to close)"
                style={{ border: 0, outline: 0, width: '100%', font: "14px 'DM Sans'", color: '#1e2433', margin: 0, height: 'auto', padding: 0 }}
              />
              <kbd style={{ fontSize: 11, background: '#f4f5f7', padding: '3px 6px', borderRadius: 4, color: '#8f97a5' }}>ESC</kbd>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', padding: '12px', background: '#f8f9fe' }}>
              {filteredSearch.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8f97a5', fontSize: 13 }}>
                  No matches found for &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {['Pages', 'Actions'].map((cat) => {
                    const items = filteredSearch.filter((item) => item.category === cat);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#9aa1ad', fontWeight: 700, padding: '6px 8px 4px' }}>
                          {cat}
                        </div>
                        {items.map((item, i) => {
                          const IconComp = item.icon;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setShowSearch(false);
                                if (item.href) router.push(item.href);
                                if (item.action) item.action();
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                width: '100%',
                                padding: '10px 12px',
                                border: 0,
                                background: '#fff',
                                borderRadius: 6,
                                textAlign: 'left',
                                cursor: 'pointer',
                                font: "500 13px 'DM Sans'",
                                color: '#202635',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              }}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eef1ff', color: '#5267dc', display: 'grid', placeItems: 'center' }}>
                                <IconComp size={15} />
                              </div>
                              <span>{item.label}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a0a6b0' }}>Jump →</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
