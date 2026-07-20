'use client';

import { useState, useTransition, useEffect } from 'react';
import { useLanguage, type Language } from '@/lib/translations';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
  Minus,
  Plus as PlusIcon,
  Loader2,
  Download,
  Bell,
  Settings,
  X,
} from 'lucide-react';
import { getInitials } from '@/lib/format';
import type { InventoryItem, InventoryStats, DashboardUser, Membership, DashboardStats } from '@/lib/data';
import { createInventoryItemAction, updateInventoryItemAction, adjustStockAction, deleteInventoryItemAction } from '@/app/actions/inventory';

type InventoryClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  items: InventoryItem[];
  stats: InventoryStats;
  dashboardStats: DashboardStats;
};

const UNITS = ['pcs', 'm', 'm²', 'm³', 'kg', 't', 'L', 'boxes', 'pallets', 'rolls', 'sets'];

export default function InventoryClient({ user, membership, items: initialItems, stats, dashboardStats }: InventoryClientProps) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState<InventoryItem | null>(null);
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustQtyInput, setAdjustQtyInput] = useState(10);
  const [adjustReason, setAdjustReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  const canManage = membership && ['owner', 'manager'].includes(membership.role);

  // Extract unique categories and warehouses
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort();
  const warehouses = [...new Set(items.map((i) => i.warehouse).filter((w): w is string => Boolean(w)))].sort();

  const filteredItems = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(query.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesWarehouse = warehouseFilter === 'all' || item.warehouse === warehouseFilter;
    const matchesLowStock = !lowStockOnly || item.lowStock;
    return matchesQuery && matchesCategory && matchesWarehouse && matchesLowStock;
  });

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const itemData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string || null,
      category: formData.get('category') as string || null,
      warehouse: formData.get('warehouse') as string || null,
      unit: formData.get('unit') as string,
      currentStock: Number(formData.get('currentStock')) || 0,
      minimumStock: Number(formData.get('minimumStock')) || 0,
      unitCost: Number(formData.get('unitCost')) || 0,
    };

    startTransition(async () => {
      const result = await createInventoryItemAction(itemData);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.item) {
        setItems((prev) => [result.item!, ...prev]);
      }
      setShowNewItem(false);
    });
  }

  async function handleUpdateItem(itemId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const updates = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string || null,
      category: formData.get('category') as string || null,
      warehouse: formData.get('warehouse') as string || null,
      unit: formData.get('unit') as string,
      currentStock: Number(formData.get('currentStock')) || 0,
      minimumStock: Number(formData.get('minimumStock')) || 0,
      unitCost: Number(formData.get('unitCost')) || 0,
    };

    startTransition(async () => {
      const result = await updateInventoryItemAction(itemId, updates);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
      );
      setShowEditItem(null);
    });
  }

  async function handleAdjustStock(itemId: string, delta: number) {
    setBusy(true);
    startTransition(async () => {
      const result = await adjustStockAction(itemId, delta);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.newStock !== undefined) {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, currentStock: result.newStock! } : i))
        );
      }
    });
  }

  async function handleBatchAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustModalItem) return;
    const delta = adjustType === 'add' ? adjustQtyInput : -adjustQtyInput;
    if (adjustType === 'remove' && adjustQtyInput > adjustModalItem.currentStock) {
      alert(`Cannot issue ${adjustQtyInput} ${adjustModalItem.unit}. Only ${adjustModalItem.currentStock} ${adjustModalItem.unit} currently in stock.`);
      return;
    }

    setBusy(true);
    startTransition(async () => {
      const result = await adjustStockAction(adjustModalItem.id, delta);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.newStock !== undefined) {
        setItems((prev) =>
          prev.map((i) => (i.id === adjustModalItem.id ? { ...i, currentStock: result.newStock! } : i))
        );
      }
      setAdjustModalItem(null);
      setAdjustReason('');
      setAdjustQtyInput(10);
    });
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Delete this inventory item? This cannot be undone.')) return;
    setBusy(true);
    startTransition(async () => {
      const result = await deleteInventoryItemAction(itemId);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    });
  }

  function exportInventoryCSV() {
    if (filteredItems.length === 0) {
      alert('No inventory items available to export.');
      return;
    }
    const headers = ['Item Name', 'SKU', 'Category', 'Warehouse', 'Current Stock', 'Minimum Stock', 'Unit Cost', 'Unit', 'Status'];
    const rows = filteredItems.map((item) => {
      const status = getStockStatus(item);
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${(item.sku ?? '').replace(/"/g, '""')}"`,
        `"${(item.category ?? '').replace(/"/g, '""')}"`,
        `"${(item.warehouse ?? '').replace(/"/g, '""')}"`,
        item.currentStock,
        item.minimumStock,
        item.unitCost,
        item.unit,
        `"${status.label}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `constructos_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getStockStatus(item: InventoryItem) {
    if (item.currentStock === 0) return { label: 'Out of stock', color: '#ef4444', bg: '#fef2f2' };
    if (item.lowStock) return { label: 'Low stock', color: '#f59e0b', bg: '#fffbeb' };
    return { label: 'In stock', color: '#22c55e', bg: '#f0fdf4' };
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
          <a href="/inventory" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>Inventory</span>
            {stats.lowStockCount && <b>{stats.lowStockCount}</b>}
          </a>
          <a href="/documents" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
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
            Workspace <span>/</span> <strong>Inventory</strong>
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
                placeholder="Search items (name, SKU)..."
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
              <Filter size={17} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <div className="filter-select">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="all">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              <span>Low stock only</span>
            </label>
            <button className="secondary" onClick={exportInventoryCSV} title="Export inventory report">
              <Download size={16} /> Export CSV
            </button>
            {canManage && (
              <button className="primary" onClick={() => setShowNewItem(true)} disabled={busy || isPending}>
                <Plus size={17} /> Add item
              </button>
            )}
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">Warehouse</p>
              <h1>Inventory</h1>
              <p className="subhead">
                {stats.totalItems} item{stats.totalItems === 1 ? '' : 's'} tracked across {warehouses.length} warehouse{warehouses.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-top">
                <span>Total items</span>
                <div className="stat-icon blue"><Package size={18} /></div>
              </div>
              <strong>{stats.totalItems}</strong>
              <p><span className="up">{categories.length} categories</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Low stock</span>
                <div className="stat-icon orange"><AlertTriangle size={18} /></div>
              </div>
              <strong>{stats.lowStockCount}</strong>
              <p><span className={stats.lowStockCount ? 'attention' : 'up'}>{stats.lowStockCount ? 'Needs reorder' : 'All stocked'}</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Out of stock</span>
                <div className="stat-icon red"><Package size={18} /></div>
              </div>
              <strong>{stats.outOfStockCount}</strong>
              <p><span className={stats.outOfStockCount ? 'attention' : 'up'}>{stats.outOfStockCount ? 'Critical' : 'None'}</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Warehouses</span>
                <div className="stat-icon green"><Package size={18} /></div>
              </div>
              <strong>{warehouses.length}</strong>
              <p><em>{categories.length} categories</em></p>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 16 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No items found</h2>
              <p className="subhead" style={{ margin: 0 }}>
                {query || categoryFilter !== 'all' || warehouseFilter !== 'all' || lowStockOnly
                  ? 'Try adjusting your search or filters.'
                  : 'Inventory is empty. Add your first item to get started.'}
              </p>
              {canManage && !query && categoryFilter === 'all' && warehouseFilter === 'all' && !lowStockOnly && (
                <button className="primary" onClick={() => setShowNewItem(true)} style={{ marginTop: 16 }}>
                  <Plus size={16} /> Add first item
                </button>
              )}
            </div>
          ) : (
            <div className="panel">
              <div className="inventory-table">
                <div className="table-header">
                  <span style={{ flex: '2' }}>Item</span>
                  <span>SKU</span>
                  <span>Category</span>
                  <span>Warehouse</span>
                  <span style={{ textAlign: 'right' }}>Stock</span>
                  <span style={{ textAlign: 'right' }}>Min</span>
                  <span>Status</span>
                  <span style={{ width: 120 }}></span>
                </div>
                {filteredItems.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <div key={item.id} className="table-row">
                      <div className="item-cell" style={{ flex: '2', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="item-icon" style={{ background: '#eef1ff', color: '#5267dc' }}>
                          <Package size={20} />
                        </div>
                        <div>
                          <strong>{item.name}</strong>
                          {item.sku && <small style={{ color: '#a0a6b0', display: 'block' }}>SKU: {item.sku}</small>}
                          <small style={{ color: '#8f97a5', display: 'block', fontSize: 11, marginTop: 2 }}>Unit Cost: €{(item.unitCost ?? 0).toFixed(2)}</small>
                        </div>
                      </div>
                      <span>{item.sku ?? '—'}</span>
                      <span>{item.category ?? '—'}</span>
                      <span>{item.warehouse ?? '—'}</span>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flex: 1 }}>
                        <strong suppressHydrationWarning>{item.currentStock.toLocaleString()}</strong>
                        <small style={{ color: '#9299a7' }}>{item.unit}</small>
                      </div>
                      <div style={{ textAlign: 'right', flex: 1 }}>
                        <small style={{ color: '#9299a7' }} suppressHydrationWarning>{item.minimumStock.toLocaleString()} {item.unit}</small>
                      </div>
                      <span className="status-badge" style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                      {canManage && (
                        <div className="item-actions" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', width: 140 }}>
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setAdjustModalItem(item);
                              setAdjustType('add');
                              setAdjustQtyInput(10);
                            }}
                            title="Adjust / Restock Quantity"
                            disabled={busy || isPending}
                          >
                            <Package size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleAdjustStock(item.id, -1)}
                            title="Quick Issue (-1)"
                            disabled={busy || isPending || item.currentStock <= 0}
                          >
                            <Minus size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleAdjustStock(item.id, 1)}
                            title="Quick Receive (+1)"
                            disabled={busy || isPending}
                          >
                            <PlusIcon size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => setShowEditItem(item)}
                            title="Edit Item Details"
                            disabled={busy || isPending}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete Item"
                            disabled={busy || isPending}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add Item Modal */}
        {showNewItem && (
          <div className="modal-backdrop" onClick={() => setShowNewItem(false)}>
            <form className="modal" onSubmit={handleCreateItem} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Inventory</p>
                  <h2>Add inventory item</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNewItem(false)} disabled={busy || isPending}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label>
                  Item name <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    name="name"
                    required
                    placeholder="e.g. Portland Cement 50kg"
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  SKU
                  <input
                    name="sku"
                    placeholder="e.g. CEM-PORT-50"
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Category
                  <input
                    name="category"
                    placeholder="e.g. Cement"
                    list="categories"
                    disabled={busy || isPending}
                  />
                  <datalist id="categories">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </label>
                <label>
                  Warehouse
                  <input
                    name="warehouse"
                    placeholder="e.g. Main Warehouse"
                    list="warehouses"
                    disabled={busy || isPending}
                  />
                  <datalist id="warehouses">
                    {warehouses.map((w) => <option key={w} value={w} />)}
                  </datalist>
                </label>
                <label>
                  Unit
                  <select name="unit" disabled={busy || isPending}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label>
                  Current stock
                  <input
                    type="number"
                    name="currentStock"
                    min="0"
                    step="1"
                    defaultValue="0"
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Unit Cost (€)
                  <input
                    type="number"
                    name="unitCost"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 12.50"
                    defaultValue="0"
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Minimum stock
                  <input
                    type="number"
                    name="minimumStock"
                    min="0"
                    step="1"
                    defaultValue="10"
                    disabled={busy || isPending}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowNewItem(false)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {(busy || isPending) ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} {(busy || isPending) ? 'Adding...' : 'Add item'}
                </button>
              </div>
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditItem && (
          <div className="modal-backdrop" onClick={() => setShowEditItem(null)}>
            <form className="modal" onSubmit={(e) => handleUpdateItem(showEditItem.id, e)} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Inventory</p>
                  <h2>Edit item</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowEditItem(null)} disabled={busy || isPending}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label>
                  Item name <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    name="name"
                    required
                    defaultValue={showEditItem.name}
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  SKU
                  <input
                    name="sku"
                    defaultValue={showEditItem.sku ?? ''}
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Category
                  <input
                    name="category"
                    defaultValue={showEditItem.category ?? ''}
                    list="categories-edit"
                    disabled={busy || isPending}
                  />
                  <datalist id="categories-edit">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </label>
                <label>
                  Warehouse
                  <input
                    name="warehouse"
                    defaultValue={showEditItem.warehouse ?? ''}
                    list="warehouses-edit"
                    disabled={busy || isPending}
                  />
                  <datalist id="warehouses-edit">
                    {warehouses.map((w) => <option key={w} value={w} />)}
                  </datalist>
                </label>
                <label>
                  Unit
                  <select name="unit" defaultValue={showEditItem.unit} disabled={busy || isPending}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label>
                  Current stock
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleAdjustStock(showEditItem.id, -1)}
                      disabled={busy || isPending}
                      title="Decrease"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      name="currentStock"
                      min="0"
                      step="1"
                      defaultValue={showEditItem.currentStock}
                      style={{ width: 100, textAlign: 'center' }}
                      disabled={busy || isPending}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleAdjustStock(showEditItem.id, 1)}
                      disabled={busy || isPending}
                      title="Increase"
                    >
                      <PlusIcon size={16} />
                    </button>
                  </div>
                </label>
                <label>
                  Unit Cost (€)
                  <input
                    type="number"
                    name="unitCost"
                    min="0"
                    step="0.01"
                    defaultValue={showEditItem.unitCost}
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Minimum stock
                  <input
                    type="number"
                    name="minimumStock"
                    min="0"
                    step="1"
                    defaultValue={showEditItem.minimumStock}
                    disabled={busy || isPending}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowEditItem(null)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {(busy || isPending) ? <Loader2 size={16} className="spin" /> : <Package size={16} />} {(busy || isPending) ? 'Saving...' : 'Save changes'}
                </button>
              </div>
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          </div>
        )}

        {/* Batch Adjust Stock Modal */}
        {adjustModalItem && (
          <div className="modal-backdrop" onClick={() => setAdjustModalItem(null)}>
            <form className="modal" onSubmit={handleBatchAdjustStock} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Inventory Stock Movement</p>
                  <h2>Adjust Stock: {adjustModalItem.name}</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setAdjustModalItem(null)} disabled={busy || isPending}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ background: '#f8f9fe', border: '1px solid #edf0f4', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: '#8f97a5' }}>
                  Current Stock: <strong style={{ color: '#202635' }}>{adjustModalItem.currentStock} {adjustModalItem.unit}</strong>
                  {adjustModalItem.warehouse && ` (${adjustModalItem.warehouse})`}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  Movement Direction
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAdjustType('add')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e0e3e9',
                        background: adjustType === 'add' ? '#eaf7f0' : '#fff',
                        color: adjustType === 'add' ? '#166534' : '#313947',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Receive / Add (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('remove')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e0e3e9',
                        background: adjustType === 'remove' ? '#fff1f0' : '#fff',
                        color: adjustType === 'remove' ? '#991b1b' : '#313947',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ➖ Issue / Deduct (-)
                    </button>
                  </div>
                </label>

                <label>
                  Quantity ({adjustModalItem.unit})
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustQtyInput}
                    onChange={(e) => setAdjustQtyInput(Number(e.target.value) || 1)}
                  />
                </label>

                <label>
                  Reason / Reference Notes (optional)
                  <input
                    placeholder="e.g. Delivered to Sector 3 or Supplier top-up"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setAdjustModalItem(null)} disabled={busy || isPending}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {busy || isPending ? <Loader2 size={16} className="spin" /> : <Package size={16} />} Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
