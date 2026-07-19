'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ChevronDown,
  ShoppingBag,
  Bell,
  Settings,
  LogOut,
  Users,
  Package,
  FileText,
  ClipboardList,
  Store,
  Star,
  CheckCircle,
  Truck,
  FileSpreadsheet,
  AlertTriangle,
  MapPin,
  Mail,
  Phone,
  ArrowUpRight,
  PlusCircle,
  MinusCircle,
  X,
  Loader2,
} from 'lucide-react';
import { getInitials } from '@/lib/format';
import type {
  DashboardUser,
  Membership,
  MarketplaceStats,
  Vendor,
  Product,
  RFQ,
  RFQItem,
  PurchaseOrder,
  ProjectListItem,
  DashboardStats,
} from '@/lib/data';
import {
  createVendorAction,
  createProductAction,
  createRFQAction,
} from '@/app/actions/marketplace';

type MarketplaceClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  stats: MarketplaceStats;
  vendors: Vendor[];
  products: Product[];
  rfqs: RFQ[];
  pos: PurchaseOrder[];
  projects: ProjectListItem[];
  dashboardStats: DashboardStats;
};

const VENDOR_CATEGORIES = ['Cement', 'Steel', 'Timber', 'Electrical', 'Plumbing', 'Aggregates', 'Safety Equipment', 'Tools'];
const PRODUCT_UNITS = ['pcs', 'm', 'm²', 'm³', 'kg', 't', 'L', 'boxes', 'pallets', 'rolls', 'sets'];

export default function MarketplaceClient({
  user,
  membership,
  stats,
  vendors: initialVendors,
  products: initialProducts,
  rfqs: initialRFQs,
  pos: initialPOs,
  projects,
  dashboardStats,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'vendors' | 'products' | 'rfqs' | 'pos'>('vendors');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Modal visibility states
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showCreateRFQ, setShowCreateRFQ] = useState(false);

  // Lists in state
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [rfqs, setRFQs] = useState<RFQ[]>(initialRFQs);
  const [pos, setPOs] = useState<PurchaseOrder[]>(initialPOs);

  // New RFQ form states
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqProjectId, setRfqProjectId] = useState('');
  const [rfqDescription, setRfqDescription] = useState('');
  const [rfqDueDate, setRfqDueDate] = useState('');
  const [rfqItems, setRfqItems] = useState<Omit<RFQItem, 'id' | 'rfqId'>[]>([
    { productName: '', quantity: 1, unit: 'pcs', category: 'Cement', description: '', neededBy: '' },
  ]);

  const canManage = membership && ['owner', 'manager'].includes(membership.role);

  // Sign out function
  async function signOut() {
    // Note: Usually uses supabase auth signout, can match dashboard
    router.push('/login');
    router.refresh();
  }

  // Add Vendor Handler
  async function handleAddVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const vendorData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      address: formData.get('address') as string || null,
      categories: [formData.get('category') as string],
      rating: 5,
      isVerified: true,
    };

    startTransition(async () => {
      const result = await createVendorAction(vendorData);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.vendor) {
        setVendors((prev) => [result.vendor!, ...prev]);
      }
      setShowAddVendor(false);
    });
  }

  // Add Product Handler
  async function handleAddProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const productData = {
      vendorId: formData.get('vendorId') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      sku: formData.get('sku') as string || null,
      category: formData.get('category') as string || null,
      unit: formData.get('unit') as string,
      unitPrice: Number(formData.get('unitPrice')) || 0,
      currency: 'EUR',
      minOrderQty: Number(formData.get('minOrderQty')) || 1,
      leadTimeDays: Number(formData.get('leadTimeDays')) || 0,
      isActive: true,
    };

    startTransition(async () => {
      const result = await createProductAction(productData);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.product) {
        setProducts((prev) => [result.product!, ...prev]);
      }
      setShowAddProduct(false);
    });
  }

  // Create RFQ Handler
  async function handleCreateRFQ(event: React.FormEvent) {
    event.preventDefault();
    if (!rfqTitle.trim()) return;
    setBusy(true);

    const rfqData = {
      title: rfqTitle.trim(),
      projectId: rfqProjectId || null,
      projectName: projects.find((p) => p.id === rfqProjectId)?.name ?? null,
      description: rfqDescription.trim() || null,
      status: 'draft' as const,
      dueDate: rfqDueDate || null,
      items: [],
    };

    startTransition(async () => {
      const result = await createRFQAction(rfqData, rfqItems);
      setBusy(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.rfq) {
        setRFQs((prev) => [result.rfq!, ...prev]);
      }
      // Reset form
      setRfqTitle('');
      setRfqProjectId('');
      setRfqDescription('');
      setRfqDueDate('');
      setRfqItems([{ productName: '', quantity: 1, unit: 'pcs', category: 'Cement', description: '', neededBy: '' }]);
      setShowCreateRFQ(false);
    });
  }

  // Helpers for RFQ dynamic list
  function addRfqItem() {
    setRfqItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, unit: 'pcs', category: 'Cement', description: '', neededBy: '' },
    ]);
  }

  function removeRfqItem(index: number) {
    if (rfqItems.length <= 1) return;
    setRfqItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRfqItem(index: number, field: keyof Omit<RFQItem, 'id' | 'rfqId'>, value: any) {
    setRfqItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  // Filters search lists
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(query.toLowerCase()) ||
    v.categories.some((c) => c.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(query.toLowerCase())) ||
    p.vendorName.toLowerCase().includes(query.toLowerCase())
  );

  const filteredRFQs = rfqs.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()) ||
    r.rfqNumber.toLowerCase().includes(query.toLowerCase())
  );

  const filteredPOs = pos.filter((p) =>
    p.poNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.vendorName.toLowerCase().includes(query.toLowerCase())
  );

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
          <a href="#" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Documents</span>
          </a>
        </nav>
        <div className="nav-label market-label">Connect</div>
        <nav>
          <a href="/marketplace" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
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
            Workspace <span>/</span> <strong>Marketplace</strong>
          </div>
          <div className="header-actions">
            <div className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
              />
              <kbd>⌘ K</kbd>
            </div>
            {canManage && (
              <>
                {activeTab === 'vendors' && (
                  <button className="primary" onClick={() => setShowAddVendor(true)} disabled={busy || isPending}>
                    <Plus size={17} /> Add vendor
                  </button>
                )}
                {activeTab === 'products' && (
                  <button className="primary" onClick={() => setShowAddProduct(true)} disabled={busy || isPending}>
                    <Plus size={17} /> Add product
                  </button>
                )}
                {activeTab === 'rfqs' && (
                  <button className="primary" onClick={() => setShowCreateRFQ(true)} disabled={busy || isPending}>
                    <Plus size={17} /> Create RFQ
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">Connect</p>
              <h1>Marketplace</h1>
              <p className="subhead">Manage company procurement, vendors, RFQs, and purchase orders.</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-top">
                <span>Total Vendors</span>
                <div className="stat-icon blue"><Store size={18} /></div>
              </div>
              <strong suppressHydrationWarning>{stats.totalVendors}</strong>
              <p><span className="up">Procurement partners</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Active RFQs</span>
                <div className="stat-icon orange"><ClipboardList size={18} /></div>
              </div>
              <strong suppressHydrationWarning>{stats.activeRFQs}</strong>
              <p><span className={stats.activeRFQs ? 'attention' : 'up'}>{stats.activeRFQs ? 'Awaiting Quotes' : 'All cleared'}</span></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Open POs</span>
                <div className="stat-icon green"><Truck size={18} /></div>
              </div>
              <strong suppressHydrationWarning>{stats.openPOs}</strong>
              <p><em>Tracked deliveries</em></p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Total Spend</span>
                <div className="stat-icon blue">€</div>
              </div>
              <strong suppressHydrationWarning>€{stats.totalSpend.toLocaleString()}</strong>
              <p><em>Approved orders</em></p>
            </div>
          </div>

          {/* Tabs for Navigation */}
          <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid #e9ebf0', marginBottom: 24, paddingBottom: 1 }}>
            <button
              onClick={() => { setActiveTab('vendors'); setQuery(''); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontWeight: activeTab === 'vendors' ? 600 : 500,
                color: activeTab === 'vendors' ? '#4e64da' : '#777f8e',
                borderBottom: activeTab === 'vendors' ? '2px solid #4e64da' : 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Vendors
            </button>
            <button
              onClick={() => { setActiveTab('products'); setQuery(''); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontWeight: activeTab === 'products' ? 600 : 500,
                color: activeTab === 'products' ? '#4e64da' : '#777f8e',
                borderBottom: activeTab === 'products' ? '2px solid #4e64da' : 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Products / Catalog
            </button>
            <button
              onClick={() => { setActiveTab('rfqs'); setQuery(''); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontWeight: activeTab === 'rfqs' ? 600 : 500,
                color: activeTab === 'rfqs' ? '#4e64da' : '#777f8e',
                borderBottom: activeTab === 'rfqs' ? '2px solid #4e64da' : 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              RFQs
            </button>
            <button
              onClick={() => { setActiveTab('pos'); setQuery(''); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontWeight: activeTab === 'pos' ? 600 : 500,
                color: activeTab === 'pos' ? '#4e64da' : '#777f8e',
                borderBottom: activeTab === 'pos' ? '2px solid #4e64da' : 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Purchase Orders
            </button>
          </div>

          {/* Vendors Tab Content */}
          {activeTab === 'vendors' && (
            filteredVendors.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Store width="64" height="64" style={{ color: '#c4c9d3', marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No vendors found</h2>
                <p className="subhead" style={{ margin: 0 }}>Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="panel" style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {filteredVendors.map((vendor) => (
                    <div key={vendor.id} style={{ border: '1px solid #edf0f4', borderRadius: 8, padding: 18, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: 15, color: '#1e2433' }}>{vendor.name}</strong>
                          {vendor.isVerified && (
                            <span style={{ fontSize: 10, background: '#e8f7f0', color: '#45a77b', borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 600 }}>
                              Verified
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f2b653', fontSize: 13, fontWeight: 600 }}>
                          <Star size={14} fill="#f2b653" />
                          <span>{vendor.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {vendor.categories.map((c) => (
                          <span key={c} style={{ fontSize: 11, background: '#f0f2f5', color: '#68707d', borderRadius: 12, padding: '2px 10px' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginTop: 16, borderTop: '1px solid #edf0f4', paddingTop: 14, display: 'grid', gap: 8, fontSize: 12, color: '#68707d' }}>
                        {vendor.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={13} /> {vendor.email}</div>}
                        {vendor.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={13} /> {vendor.phone}</div>}
                        {vendor.address && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={13} /> {vendor.address}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Products Tab Content */}
          {activeTab === 'products' && (
            filteredProducts.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Package width="64" height="64" style={{ color: '#c4c9d3', marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No products found</h2>
                <p className="subhead" style={{ margin: 0 }}>Try adjusting your search or catalog filters.</p>
              </div>
            ) : (
              <div className="panel">
                <div className="inventory-table">
                  <div className="table-header">
                    <span style={{ flex: '2' }}>Product</span>
                    <span>SKU</span>
                    <span>Vendor</span>
                    <span>Category</span>
                    <span style={{ textAlign: 'right' }}>Min Order</span>
                    <span style={{ textAlign: 'right' }}>Lead Time</span>
                    <span style={{ textAlign: 'right' }}>Price</span>
                  </div>
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="table-row">
                      <div style={{ flex: '2', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="item-icon" style={{ background: '#eef1ff', color: '#5267dc' }}>
                          <Package size={20} />
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          {p.description && <small style={{ color: '#a0a6b0', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 200 }}>{p.description}</small>}
                        </div>
                      </div>
                      <span>{p.sku ?? '—'}</span>
                      <span style={{ fontWeight: 500, color: '#313947' }}>{p.vendorName}</span>
                      <span>{p.category ?? '—'}</span>
                      <span style={{ textAlign: 'right' }}>{p.minOrderQty} {p.unit}</span>
                      <span style={{ textAlign: 'right' }}>{p.leadTimeDays} days</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: '#202635' }} suppressHydrationWarning>
                        €{p.unitPrice.toLocaleString()}/{p.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* RFQs Tab Content */}
          {activeTab === 'rfqs' && (
            filteredRFQs.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <ClipboardList width="64" height="64" style={{ color: '#c4c9d3', marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No RFQs found</h2>
                <p className="subhead" style={{ margin: 0 }}>Create a Request For Quote (RFQ) to gather material pricing.</p>
              </div>
            ) : (
              <div className="panel">
                <div className="inventory-table">
                  <div className="table-header">
                    <span>RFQ #</span>
                    <span style={{ flex: '2' }}>Title</span>
                    <span>Project</span>
                    <span>Due Date</span>
                    <span style={{ textAlign: 'right' }}>Quotes</span>
                    <span>Status</span>
                  </div>
                  {filteredRFQs.map((r) => (
                    <div key={r.id} className="table-row">
                      <strong style={{ color: '#4e64da' }}>{r.rfqNumber}</strong>
                      <div style={{ flex: '2' }}>
                        <strong>{r.title}</strong>
                        {r.description && <small style={{ color: '#a0a6b0', display: 'block' }}>{r.description}</small>}
                      </div>
                      <span>{r.projectName ?? 'Global / Stock'}</span>
                      <span suppressHydrationWarning>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600 }}>{r.quotesCount}</span>
                      <span className="status-badge" style={{
                        background: r.status === 'draft' ? '#f0f2f5' : r.status === 'sent' ? '#eef1ff' : '#eaf7f0',
                        color: r.status === 'draft' ? '#68707d' : r.status === 'sent' ? '#4e64da' : '#43a47d'
                      }}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Purchase Orders Tab Content */}
          {activeTab === 'pos' && (
            filteredPOs.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Truck width="64" height="64" style={{ color: '#c4c9d3', marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No Purchase Orders found</h2>
                <p className="subhead" style={{ margin: 0 }}>Purchase orders are created upon awarding winning quotes.</p>
              </div>
            ) : (
              <div className="panel">
                <div className="inventory-table">
                  <div className="table-header">
                    <span>PO #</span>
                    <span>Vendor</span>
                    <span style={{ flex: '2' }}>Project</span>
                    <span>Expected Date</span>
                    <span style={{ textAlign: 'right' }}>Total Amount</span>
                    <span>Status</span>
                  </div>
                  {filteredPOs.map((p) => (
                    <div key={p.id} className="table-row">
                      <strong style={{ color: '#4e64da' }}>{p.poNumber}</strong>
                      <span style={{ fontWeight: 500 }}>{p.vendorName}</span>
                      <div style={{ flex: '2' }}>{p.projectName ?? 'Global / Stock'}</div>
                      <span suppressHydrationWarning>{p.expectedDate ? new Date(p.expectedDate).toLocaleDateString() : '—'}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600 }} suppressHydrationWarning>€{p.totalAmount.toLocaleString()}</span>
                      <span className="status-badge" style={{
                        background: p.status === 'received' ? '#eaf7f0' : p.status === 'cancelled' ? '#fff0ef' : '#fff4e6',
                        color: p.status === 'received' ? '#43a47d' : p.status === 'cancelled' ? '#df7f73' : '#d99a42'
                      }}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Add Vendor Modal */}
        {showAddVendor && (
          <div className="modal-backdrop" onClick={() => setShowAddVendor(false)}>
            <form className="modal" onSubmit={handleAddVendor} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Marketplace</p>
                  <h2>Add vendor</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAddVendor(false)} disabled={busy || isPending}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  Company name <span style={{ color: '#ef4444' }}>*</span>
                  <input autoFocus name="name" required placeholder="e.g. Acme Materials Ltd." disabled={busy || isPending} />
                </label>
                <label>
                  Category
                  <select name="category" disabled={busy || isPending} style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}>
                    {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  Email address
                  <input type="email" name="email" placeholder="e.g. sales@acme.com" disabled={busy || isPending} />
                </label>
                <label>
                  Phone number
                  <input name="phone" placeholder="e.g. +31 123 456 789" disabled={busy || isPending} />
                </label>
                <label>
                  Business address
                  <input name="address" placeholder="e.g. 12 High Street, Amsterdam" disabled={busy || isPending} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowAddVendor(false)} disabled={busy || isPending}>Cancel</button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {busy || isPending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Save Vendor
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddProduct && (
          <div className="modal-backdrop" onClick={() => setShowAddProduct(false)}>
            <form className="modal" onSubmit={handleAddProduct} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Marketplace</p>
                  <h2>Add product to catalog</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAddProduct(false)} disabled={busy || isPending}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ gridColumn: 'span 2' }}>
                  Vendor <span style={{ color: '#ef4444' }}>*</span>
                  <select name="vendorId" required disabled={busy || isPending} style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}>
                    <option value="">Select a vendor...</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Product name <span style={{ color: '#ef4444' }}>*</span>
                  <input autoFocus name="name" required placeholder="e.g. Portland Cement CEM I 52.5 R" disabled={busy || isPending} />
                </label>
                <label>
                  SKU
                  <input name="sku" placeholder="e.g. CEM-PORT-I" disabled={busy || isPending} />
                </label>
                <label>
                  Category
                  <select name="category" disabled={busy || isPending} style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}>
                    {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  Unit <span style={{ color: '#ef4444' }}>*</span>
                  <select name="unit" required disabled={busy || isPending} style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}>
                    {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label>
                  Unit price (€) <span style={{ color: '#ef4444' }}>*</span>
                  <input type="number" step="0.01" name="unitPrice" required placeholder="0.00" disabled={busy || isPending} />
                </label>
                <label>
                  Min order quantity
                  <input type="number" name="minOrderQty" defaultValue="1" min="1" disabled={busy || isPending} />
                </label>
                <label>
                  Lead time (days)
                  <input type="number" name="leadTimeDays" defaultValue="3" min="0" disabled={busy || isPending} />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Description
                  <input name="description" placeholder="e.g. Premium quality cement bags..." disabled={busy || isPending} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowAddProduct(false)} disabled={busy || isPending}>Cancel</button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {busy || isPending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Save Product
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create RFQ Modal */}
        {showCreateRFQ && (
          <div className="modal-backdrop" onClick={() => setShowCreateRFQ(false)}>
            <form className="modal" onSubmit={handleCreateRFQ} onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 650px)' }}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Marketplace</p>
                  <h2>Request For Quote (RFQ)</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowCreateRFQ(false)} disabled={busy || isPending}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ gridColumn: 'span 2' }}>
                  RFQ Title <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    value={rfqTitle}
                    onChange={(e) => setRfqTitle(e.target.value)}
                    required
                    placeholder="e.g. Concrete Materials for Sector 4 Foundation"
                    disabled={busy || isPending}
                  />
                </label>
                <label>
                  Project (optional)
                  <select
                    value={rfqProjectId}
                    onChange={(e) => setRfqProjectId(e.target.value)}
                    disabled={busy || isPending}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="">No project (Global/Stock)</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label>
                  Quotes due date
                  <input
                    type="date"
                    value={rfqDueDate}
                    onChange={(e) => setRfqDueDate(e.target.value)}
                    disabled={busy || isPending}
                  />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Description / Instructions
                  <input
                    value={rfqDescription}
                    onChange={(e) => setRfqDescription(e.target.value)}
                    placeholder="Please include delivery options to the site location..."
                    disabled={busy || isPending}
                  />
                </label>
              </div>

              {/* Dynamic Items list */}
              <div style={{ marginTop: 20, borderTop: '1px solid #edf0f4', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 13, color: '#313947' }}>Requested Materials</strong>
                  <button type="button" className="text-btn" onClick={addRfqItem} disabled={busy || isPending}>
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 12, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                  {rfqItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f7f8fa', padding: 10, borderRadius: 6 }}>
                      <div style={{ flex: 3 }}>
                        <input
                          required
                          value={item.productName}
                          onChange={(e) => updateRfqItem(idx, 'productName', e.target.value)}
                          placeholder="Material name"
                          style={{ height: 32, marginTop: 0 }}
                          disabled={busy || isPending}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateRfqItem(idx, 'quantity', Number(e.target.value) || 1)}
                          placeholder="Qty"
                          style={{ height: 32, marginTop: 0 }}
                          disabled={busy || isPending}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <select
                          value={item.unit}
                          onChange={(e) => updateRfqItem(idx, 'unit', e.target.value)}
                          style={{ height: 32, marginTop: 0, padding: '0 4px', font: '11px DM Sans', background: '#fff', border: '1px solid #e0e3e9', borderRadius: 4 }}
                          disabled={busy || isPending}
                        >
                          {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      {rfqItems.length > 1 && (
                        <button type="button" onClick={() => removeRfqItem(idx)} style={{ border: 0, background: 'none', color: '#df7f73', cursor: 'pointer', marginTop: 8 }} disabled={busy || isPending}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowCreateRFQ(false)} disabled={busy || isPending}>Cancel</button>
                <button className="primary" type="submit" disabled={busy || isPending}>
                  {busy || isPending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Send RFQ
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
