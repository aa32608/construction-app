'use client';

import { useState, useTransition } from 'react';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  FileText,
  Download,
  Trash2,
  MoreHorizontal,
  Loader2,
  Upload,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { formatFileSize, getFileIcon, formatDue } from '@/lib/format';
import type { Document, DocumentStats, ProjectListItem, DashboardUser, Membership, DashboardStats } from '@/lib/data';
import { uploadDocumentAction, deleteDocumentAction, getDocumentDownloadUrlAction } from '@/app/actions/documents';

type DocumentsClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  documents: Document[];
  stats: DocumentStats;
  projects: ProjectListItem[];
  dashboardStats: DashboardStats;
};

const MIME_TYPE_GROUPS = [
  { value: 'all', label: 'All types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'other', label: 'Other' },
];

export default function DocumentsClient({ user, membership, documents: initialDocuments, stats, projects, dashboardStats }: DocumentsClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const canManage = membership && ['owner', 'manager'].includes(membership.role);
  const canUpload = membership !== null;

  const filteredDocuments = documents.filter((doc) => {
    const matchesQuery = doc.name.toLowerCase().includes(query.toLowerCase());
    const matchesProject = projectFilter === 'all' || doc.projectId === projectFilter;
    const mimePrefix = doc.mimeType?.split('/')[0] ?? 'other';
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'pdf' && mimePrefix === 'application' && doc.mimeType?.includes('pdf')) ||
      (typeFilter === mimePrefix);
    return matchesQuery && matchesProject && matchesType;
  });

  function getTypeLabel(mimeType: string | null) {
    if (!mimeType) return 'Unknown';
    const [type, subtype] = mimeType.split('/');
    if (type === 'application' && subtype?.includes('pdf')) return 'PDF';
    if (type === 'application' && subtype?.includes('word')) return 'Word';
    if (type === 'application' && subtype?.includes('excel') || subtype?.includes('spreadsheet')) return 'Excel';
    if (type === 'application' && subtype?.includes('powerpoint')) return 'PowerPoint';
    if (type === 'image') return 'Image';
    if (type === 'video') return 'Video';
    if (type === 'text') return 'Text';
    return subtype?.toUpperCase() ?? type;
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file') as File;
    if (!file) return;

    setBusy(true);
    setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const current = prev[file.name] ?? 0;
        if (current >= 90) return prev;
        return { ...prev, [file.name]: current + 10 };
      });
    }, 100);

    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      clearInterval(progressInterval);
      setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      setBusy(false);

      if (result.error) {
        alert(result.error);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
        return;
      }

      if (result.document) {
        setDocuments((prev) => [result.document!, ...prev]);
      }
      setShowUpload(false);
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }, 1000);
    });
  }

  async function handleDownload(documentId: string, filePath: string, name: string) {
    setBusy(true);
    const result = await getDocumentDownloadUrlAction(filePath);
    setBusy(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.url) {
      const a = document.createElement('a');
      a.href = result.url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function handleDelete(documentId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const result = await deleteDocumentAction(documentId);
    setBusy(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  }

  const projectOptions = [
    { value: 'all', label: 'All projects' },
    { value: 'none', label: 'Unassigned' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

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
          <a href="/projects" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Projects</span>
            <b>{dashboardStats.activeProjects}</b>
          </a>
          <a href="/people" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>People</span>
          </a>
          <a href="/inventory" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>Inventory</span>
            {dashboardStats.lowStock && <b>{dashboardStats.lowStock}</b>}
          </a>
          <a href="/documents" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Documents</span>
            <b>{stats.totalDocuments}</b>
          </a>
        </nav>
        <div className="nav-label market-label">Connect</div>
        <nav>
          <a href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Marketplace</span>
          </a>
          <a href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifications</span>
            <b>3</b>
          </a>
        </nav>
        <div className="side-bottom">
          <a href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
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
            Workspace <span>/</span> <strong>Documents</strong>
          </div>
          <div className="header-actions">
            <div className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents..."
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="filter-select">
              <Filter size={17} />
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                {projectOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <div className="filter-select">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {MIME_TYPE_GROUPS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            {canUpload && (
              <button className="primary" onClick={() => setShowUpload(true)} disabled={busy || isPending}>
                <Upload size={17} /> Upload
              </button>
            )}
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">Files</p>
              <h1>Documents</h1>
              <p className="subhead">
                {stats.totalDocuments} document{stats.totalDocuments === 1 ? '' : 's'} • {formatFileSize(stats.totalSize)}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-top">
                <span>Total documents</span>
                <div className="stat-icon blue"><FileText size={18} /></div>
              </div>
              <strong>{stats.totalDocuments}</strong>
              <p><span className="up">{formatFileSize(stats.totalSize)} total</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>By project</span>
                <div className="stat-icon green"><FolderOpen size={18} /></div>
              </div>
              <strong>{Object.keys(stats.byProject).length}</strong>
              <p><em>{Object.values(stats.byProject).reduce((a, b) => a + b, 0)} documents</em></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>File types</span>
                <div className="stat-icon orange"><FileText size={18} /></div>
              </div>
              <strong>{Object.keys(stats.byType).length}</strong>
              <p><em>{Object.entries(stats.byType).map(([k, v]) => `${k}:${v}`).join(', ')}</em></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Storage used</span>
                <div className="stat-icon purple"><FileText size={18} /></div>
              </div>
              <strong>{formatFileSize(stats.totalSize)}</strong>
              <p><em>Of 50MB per file limit</em></p>
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 16 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No documents found</h2>
              <p className="subhead" style={{ margin: 0 }}>
                {query || projectFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No documents uploaded yet.'}
              </p>
              {canUpload && !query && projectFilter === 'all' && typeFilter === 'all' && (
                <button className="primary" onClick={() => setShowUpload(true)} style={{ marginTop: 16 }}>
                  <Upload size={16} /> Upload first document
                </button>
              )}
            </div>
          ) : (
            <div className="panel">
              <div className="documents-table">
                <div className="table-header">
                  <span style={{ flex: '3' }}>Document</span>
                  <span>Project</span>
                  <span>Type</span>
                  <span style={{ textAlign: 'right' }}>Size</span>
                  <span>Uploaded</span>
                  <span style={{ width: 100 }}></span>
                </div>
                {filteredDocuments.map((doc) => {
                  const progress = uploadProgress[doc.name];
                  const isUploading = progress !== undefined && progress < 100;
                  return (
                    <div key={doc.id} className="table-row" style={{ opacity: isUploading ? 0.7 : 1 }}>
                      <div className="doc-cell" style={{ flex: '3', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="doc-icon" style={{ fontSize: 24 }}>{getFileIcon(doc.mimeType)}</div>
                        <div>
                          <strong>{doc.name}</strong>
                          <small style={{ color: '#a0a6b0', display: 'block' }}>{getTypeLabel(doc.mimeType)} • v{doc.version}</small>
                          {isUploading && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ height: 4, background: '#eef1ff', borderRadius: 2, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: '#5267dc',
                                    borderRadius: 2,
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <span>{doc.projectName ?? '—'}</span>
                      <span className="status-badge" style={{ background: '#eef1ff', color: '#5267dc' }}>
                        {getTypeLabel(doc.mimeType)}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <small style={{ color: '#9299a7' }}>{formatFileSize(doc.sizeBytes)}</small>
                      </div>
                      <span>{formatDue(doc.createdAt.split('T')[0])}</span>
                      <div className="doc-actions" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="icon-btn"
                          onClick={() => handleDownload(doc.id, doc.filePath, doc.name)}
                          title="Download"
                          disabled={busy || isPending || isUploading}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleDownload(doc.id, doc.filePath, doc.name)}
                          title="Preview"
                          disabled={busy || isPending || isUploading}
                        >
                          <Eye size={16} />
                        </button>
                        {canManage && (
                          <button
                            className="icon-btn danger"
                            onClick={() => handleDelete(doc.id, doc.name)}
                            title="Delete"
                            disabled={busy || isPending || isUploading}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="modal-backdrop" onClick={() => setShowUpload(false)}>
            <form className="modal" onSubmit={handleUpload} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Documents</p>
                  <h2>Upload document</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowUpload(false)} disabled={busy || isPending}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <label>
                File <span style={{ color: '#ef4444' }}>*</span>
                <input
                  type="file"
                  name="file"
                  required
                  disabled={busy || isPending}
                  style={{ display: 'block', width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #e0e3e9', borderRadius: 6, font: "12px 'DM Sans'" }}
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Document name (optional)
                <input
                  name="name"
                  placeholder="Leave empty to use filename"
                  disabled={busy || isPending}
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Project (optional)
                <select
                  name="projectId"
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
                  <option value="">No project (General)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <p className="subhead" style={{ marginTop: 12, fontSize: 10 }}>
                Max file size: 50MB. Supported: PDF, images, Word, Excel, PowerPoint, text, ZIP, and more.
              </p>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowUpload(false)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {(busy || isPending) ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} {(busy || isPending) ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}