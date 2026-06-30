'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/app/components/PageShell';
import { Search, X, Trash2, Plus, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Package, BarChart2, AlertTriangle } from 'lucide-react';

interface ShopItem {
  ShopItemID: number;
  sItemID: number;
  szItemName: string;
  szLastCategory: string;
  szItemPath: string;
  PriceVP: number;
  IsActive: boolean;
  SortOrder: number;
}

interface SearchItem {
  sItemID: number;
  szItemName: string;
  szLastCategory: string;
  szItemPath: string;
  iLevel: number;
  imageUrl: string;
  inShop: boolean;
}

interface PurchaseStats {
  summary: { totalPurchases: number; totalVPSpent: number; undelivered: number };
  vpStats: { holders: number; totalVP: number; totalEarned: number; totalSpent: number };
  topBuyers: { AccountName: string; purchases: number; totalSpent: number }[];
  purchases: { PurchaseID: number; AccountName: string; szItemName: string; szItemPath: string; PriceVP: number; PurchasedAt: string; Delivered: boolean; DeliveredAt: string | null }[];
  total: number;
  page: number;
  pageSize: number;
}

const PATH_FILTERS = ['All', 'Event', 'Premium'] as const;
type PathFilter = typeof PATH_FILTERS[number];

const TABS = ['Item Catalog', 'Purchase Log'] as const;
type Tab = typeof TABS[number];

const TH_STYLE: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--toa-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const TD_STYLE: React.CSSProperties = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--toa-border)' };

export default function AdminShopPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Item Catalog');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Catalog state ──
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<PathFilter>('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState<PathFilter>('All');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [defaultPrice, setDefaultPrice] = useState('10');
  // Track edited prices separately to avoid stale-closure bug
  const editingPricesRef = useRef<Record<number, number>>({});

  // ── Purchases state ──
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseFilter, setPurchaseFilter] = useState<'all' | 'undelivered'>('all');

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchShopItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop', { cache: 'no-store' });
      const data = await res.json();
      setShopItems(data.items || []);
      editingPricesRef.current = {};
    } catch (e) {
      console.error('Failed to fetch shop items:', e);
    }
  }, []);

  const fetchStats = useCallback(async (page = 1, filter: 'all' | 'undelivered' = 'all') => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50', filter });
      const res = await fetch(`/api/admin/shop/stats?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setStats(data); else setStats(null);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const doSearch = useCallback(async (term: string, pathFilter: PathFilter, page: number) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (term) params.set('search', term);
      if (pathFilter !== 'All') params.set('pathFilter', pathFilter);
      const res = await fetch(`/api/admin/shop/search?${params}`);
      const data = await res.json();
      setSearchResults(data.items || []);
      setSearchTotal(data.total || 0);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (!data.isAdmin) { router.push('/dashboard'); return; }
        setIsAdmin(true);
        setLoading(false);
      } catch { router.push('/dashboard'); }
    })();
  }, [status, router]);

  // Initial data load once admin confirmed
  useEffect(() => {
    if (!isAdmin) return;
    const id = setTimeout(() => {
      fetchShopItems();
      doSearch('', 'All', 1);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Load stats when switching to Purchase Log tab
  useEffect(() => {
    if (!isAdmin || activeTab !== 'Purchase Log') return;
    const id = setTimeout(() => { fetchStats(purchasePage, purchaseFilter); }, 0);
    return () => clearTimeout(id);
  }, [isAdmin, activeTab, purchasePage, purchaseFilter, fetchStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    setSearchPage(1);
    doSearch(searchInput, searchFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setSearchPage(1);
    doSearch('', searchFilter, 1);
  };

  const handleSearchFilterChange = (f: PathFilter) => {
    setSearchFilter(f);
    setSearchPage(1);
    doSearch(activeSearch, f, 1);
  };

  const addItem = async (item: SearchItem) => {
    setAdding(item.sItemID);
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sItemID: item.sItemID,
          szItemName: item.szItemName,
          szLastCategory: item.szLastCategory,
          szItemPath: item.szItemPath,
          priceVP: parseInt(defaultPrice, 10) || 10,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`"${item.szItemName}" added to shop`);
        await fetchShopItems();
        doSearch(activeSearch, searchFilter, searchPage);
      } else {
        showToast(data.error || 'Failed to add item', 'error');
      }
    } catch {
      showToast('Failed to add item', 'error');
    } finally {
      setAdding(null);
    }
  };

  const updateItem = async (item: ShopItem, updates: { priceVP?: number; isActive?: boolean }) => {
    setUpdating(item.ShopItemID);
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopItemId: item.ShopItemID, ...updates }),
      });
      if (res.ok) {
        await fetchShopItems();
        if (updates.priceVP !== undefined) showToast(`Price updated to ${updates.priceVP} VP`);
      }
    } catch {
      showToast('Update failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (item: ShopItem) => {
    setConfirmDeleteId(null);
    setUpdating(item.ShopItemID);
    try {
      const res = await fetch(`/api/admin/shop?shopItemId=${item.ShopItemID}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`"${item.szItemName}" removed`);
        await fetchShopItems();
        doSearch(activeSearch, searchFilter, searchPage);
      }
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  if (status === 'loading' || (loading && !isAdmin)) {
    return (
      <PageShell label="Management" title="Web Shop" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  if (!isAdmin) return null;

  const catalogItems = catalogFilter === 'All'
    ? shopItems
    : shopItems.filter(i => i.szItemPath === catalogFilter);

  const searchTotalPages = Math.ceil(searchTotal / 50);
  const purchaseTotalPages = stats ? Math.ceil(stats.total / 50) : 1;

  return (
    <PageShell
      label="Management"
      title="Web Shop"
      backHref="/admin"
      backLabel="Admin"
      actions={
        <Link
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="toa-btn toa-btn-ghost toa-btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ExternalLink size={13} /> View Shop
        </Link>
      }
    >
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          background: 'var(--toa-smoke)',
          border: `1px solid ${toast.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
          clipPath: 'var(--toa-clip-btn-sm)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontSize: '0.875rem', color: 'var(--toa-bone)',
        }}>
          {toast.type === 'success' ? <CheckCircle size={15} color="var(--toa-success)" /> : <AlertCircle size={15} color="var(--toa-danger)" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--toa-border)', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="toa-btn toa-btn-sm"
            style={{
              borderRadius: '0.375rem 0.375rem 0 0',
              color: activeTab === tab ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--toa-gold)' : '2px solid transparent',
              background: activeTab === tab ? 'rgba(0,0,0,0.2)' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              marginBottom: '-2px',
            }}
          >
            {tab === 'Item Catalog' ? <Package size={14} /> : <BarChart2 size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ══ ITEM CATALOG TAB ══ */}
      {activeTab === 'Item Catalog' && (
        <>
          {/* ── Current Shop Items ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="toa-label">Shop Items ({shopItems.length})</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {PATH_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setCatalogFilter(f)}
                  className="toa-btn toa-btn-sm"
                  style={{
                    padding: '0.2rem 0.65rem', fontSize: '0.75rem',
                    background: catalogFilter === f ? 'rgba(184,155,94,0.15)' : 'transparent',
                    color: catalogFilter === f ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
                    border: `1px solid ${catalogFilter === f ? 'rgba(184,155,94,0.4)' : 'transparent'}`,
                  }}
                >{f}</button>
              ))}
            </div>
          </div>

          {catalogItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)', marginBottom: '2rem' }}>
              {shopItems.length === 0 ? 'No items in the shop yet. Add items from the search below.' : `No ${catalogFilter} items in the shop.`}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                    {['Item', 'Type', 'Item Code', 'Price (VP)', 'Active', 'Actions'].map(h => (
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalogItems.map((item) => (
                    <tr key={item.ShopItemID} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{item.szItemName}</td>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-muted)' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 3, background: item.szItemPath === 'Premium' ? 'rgba(184,155,94,0.12)' : 'rgba(74,111,165,0.12)', color: item.szItemPath === 'Premium' ? 'var(--toa-gold)' : 'var(--toa-info)' }}>
                          {item.szItemPath}
                        </span>
                      </td>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.szLastCategory}</td>
                      <td style={{ ...TD_STYLE }}>
                        <input
                          type="number"
                          defaultValue={item.PriceVP}
                          key={`price-${item.ShopItemID}-${item.PriceVP}`}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const original = item.PriceVP;
                            if (Number.isFinite(val) && val > 0 && val !== original) {
                              updateItem(item, { priceVP: val });
                            }
                          }}
                          style={{ width: '65px', background: 'var(--toa-bg)', border: '1px solid var(--toa-border)', color: 'var(--toa-text)', padding: '0.25rem 0.5rem', fontSize: '0.85rem', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ ...TD_STYLE }}>
                        <button
                          onClick={() => updateItem(item, { isActive: !item.IsActive })}
                          disabled={updating === item.ShopItemID}
                          title={item.IsActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                        >
                          {item.IsActive ? <Eye size={16} color="var(--toa-success)" /> : <EyeOff size={16} color="var(--toa-danger)" />}
                        </button>
                      </td>
                      <td style={{ ...TD_STYLE }}>
                        {confirmDeleteId === item.ShopItemID ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--toa-muted)' }}>Remove?</span>
                            <button onClick={() => removeItem(item)} className="toa-btn toa-btn-sm" style={{ color: 'var(--toa-danger)', padding: '0.15rem 0.4rem', fontSize: '0.72rem', border: '1px solid var(--toa-danger)' }}>Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.15rem 0.4rem', fontSize: '0.72rem' }}>No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.ShopItemID)}
                            disabled={updating === item.ShopItemID}
                            title="Remove from shop"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <Trash2 size={16} color="var(--toa-danger)" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Add Items ── */}
          <div className="toa-label" style={{ marginBottom: '0.75rem' }}>Add Items from GameDB (Event &amp; Premium only)</div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search item name…"
                  className="toa-input"
                  style={{ paddingLeft: '2.25rem', width: '220px' }}
                />
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--toa-muted)', pointerEvents: 'none' }} />
              </div>
              <button type="submit" className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Search size={13} /> Search
              </button>
              {(searchInput || activeSearch) && (
                <button type="button" onClick={handleClearSearch} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.5rem' }}>
                  <X size={15} />
                </button>
              )}
            </form>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {PATH_FILTERS.map(f => (
                <button key={f} onClick={() => handleSearchFilterChange(f)} className="toa-btn toa-btn-sm" style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', background: searchFilter === f ? 'rgba(184,155,94,0.15)' : 'transparent', color: searchFilter === f ? 'var(--toa-gold-bright)' : 'var(--toa-muted)', border: `1px solid ${searchFilter === f ? 'rgba(184,155,94,0.4)' : 'transparent'}` }}>{f}</button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--toa-muted)', marginLeft: 'auto' }}>
              Default price:
              <input type="number" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} min={1}
                style={{ width: '65px', background: 'var(--toa-bg)', border: '1px solid var(--toa-border)', color: 'var(--toa-text)', padding: '0.25rem 0.5rem', fontSize: '0.85rem', textAlign: 'center' }}
              />
              VP
            </label>
          </div>

          {searchLoading ? (
            <div className="toa-loading" style={{ padding: '2rem' }}>Searching…</div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)' }}>No items found.</div>
          ) : (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>
                {searchTotal.toLocaleString()} item{searchTotal !== 1 ? 's' : ''}{activeSearch ? ` matching "${activeSearch}"` : ''}{searchFilter !== 'All' ? ` · ${searchFilter}` : ''}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                      {['Item', 'Type', 'Item Code', 'Status', 'Action'].map(h => (
                        <th key={h} style={TH_STYLE}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item) => (
                      <tr key={`${item.sItemID}-${item.szLastCategory}`} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                        <td style={{ ...TD_STYLE, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--toa-border)', borderRadius: '4px', padding: '2px', minWidth: '34px', minHeight: '34px' }}>
                            <img src={item.imageUrl} alt={item.szItemName} style={{ maxWidth: '30px', maxHeight: '30px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{item.szItemName}</span>
                        </td>
                        <td style={TD_STYLE}>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 3, background: item.szItemPath === 'Premium' ? 'rgba(184,155,94,0.12)' : 'rgba(74,111,165,0.12)', color: item.szItemPath === 'Premium' ? 'var(--toa-gold)' : 'var(--toa-info)' }}>
                            {item.szItemPath}
                          </span>
                        </td>
                        <td style={{ ...TD_STYLE, color: 'var(--toa-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.szLastCategory}</td>
                        <td style={TD_STYLE}>
                          {item.inShop
                            ? <span style={{ fontSize: '0.7rem', color: 'var(--toa-success)', background: 'rgba(34,197,94,0.1)', padding: '0.15rem 0.45rem', borderRadius: 3 }}>In Shop</span>
                            : <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>—</span>}
                        </td>
                        <td style={TD_STYLE}>
                          <button
                            onClick={() => addItem(item)}
                            disabled={item.inShop || adding === item.sItemID}
                            className="toa-btn toa-btn-ghost toa-btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', fontSize: '0.75rem', opacity: item.inShop ? 0.4 : 1 }}
                          >
                            <Plus size={12} /> {adding === item.sItemID ? 'Adding…' : item.inShop ? 'Added' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {searchTotalPages > 1 && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => { const p = Math.max(1, searchPage - 1); setSearchPage(p); doSearch(activeSearch, searchFilter, p); }} disabled={searchPage === 1} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: searchPage === 1 ? 0.4 : 1 }}>Prev</button>
                  <span style={{ color: 'var(--toa-muted)', fontSize: '0.85rem' }}>Page {searchPage} of {searchTotalPages}</span>
                  <button onClick={() => { const p = Math.min(searchTotalPages, searchPage + 1); setSearchPage(p); doSearch(activeSearch, searchFilter, p); }} disabled={searchPage === searchTotalPages} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: searchPage === searchTotalPages ? 0.4 : 1 }}>Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══ PURCHASE LOG TAB ══ */}
      {activeTab === 'Purchase Log' && (
        statsLoading && !stats ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--toa-muted)' }}>Loading stats…</div>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Total Purchases', value: (stats?.summary.totalPurchases || 0).toLocaleString() },
                { label: 'Total VP Spent', value: (stats?.summary.totalVPSpent || 0).toLocaleString() },
                { label: 'VP in Circulation', value: (stats?.vpStats.totalVP || 0).toLocaleString() },
                { label: 'VP Holders', value: (stats?.vpStats.holders || 0).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="toa-seal-card" style={{ padding: '1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
                  <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-br" />
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-muted)', marginBottom: '0.4rem' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Undelivered alert */}
            {(stats?.summary.undelivered ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--toa-danger)' }}>
                <AlertTriangle size={16} />
                <strong>{stats!.summary.undelivered} undelivered purchase{stats!.summary.undelivered > 1 ? 's' : ''}</strong>
                <span style={{ color: 'var(--toa-muted)' }}>— ItemBox delivery failed for these. Check server logs.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {/* Top buyers */}
              {stats?.topBuyers && stats.topBuyers.length > 0 && (
                <div>
                  <div className="toa-label" style={{ marginBottom: '0.5rem' }}>Top Buyers</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead><tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                      {['Account', 'Purchases', 'VP Spent'].map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {stats.topBuyers.map((b) => (
                        <tr key={b.AccountName} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                          <td style={{ ...TD_STYLE, color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{b.AccountName}</td>
                          <td style={{ ...TD_STYLE, color: 'var(--toa-muted)' }}>{b.purchases}</td>
                          <td style={{ ...TD_STYLE, color: 'var(--toa-gold)' }}>{b.totalSpent} VP</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Purchase history */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="toa-label">Purchase History ({(stats?.total || 0).toLocaleString()})</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['all', 'undelivered'] as const).map(f => (
                  <button key={f} onClick={() => { setPurchaseFilter(f); setPurchasePage(1); fetchStats(1, f); }} className="toa-btn toa-btn-sm" style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', background: purchaseFilter === f ? 'rgba(184,155,94,0.15)' : 'transparent', color: purchaseFilter === f ? 'var(--toa-gold-bright)' : 'var(--toa-muted)', border: `1px solid ${purchaseFilter === f ? 'rgba(184,155,94,0.4)' : 'transparent'}` }}>
                    {f === 'all' ? 'All' : 'Undelivered'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead><tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                  {['#', 'Account', 'Item', 'Type', 'VP', 'Purchased', 'Delivered'].map(h => <th key={h} style={TH_STYLE}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(stats?.purchases || []).map(p => (
                    <tr key={p.PurchaseID} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-muted)', fontSize: '0.75rem' }}>{p.PurchaseID}</td>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{p.AccountName}</td>
                      <td style={{ ...TD_STYLE }}>{p.szItemName}</td>
                      <td style={TD_STYLE}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 3, background: p.szItemPath === 'Premium' ? 'rgba(184,155,94,0.12)' : 'rgba(74,111,165,0.12)', color: p.szItemPath === 'Premium' ? 'var(--toa-gold)' : 'var(--toa-info)' }}>
                          {p.szItemPath || '—'}
                        </span>
                      </td>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-gold)' }}>{p.PriceVP}</td>
                      <td style={{ ...TD_STYLE, color: 'var(--toa-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{p.PurchasedAt ? new Date(p.PurchasedAt).toLocaleString() : '—'}</td>
                      <td style={TD_STYLE}>
                        {p.Delivered
                          ? <CheckCircle size={14} color="var(--toa-success)" />
                          : <AlertTriangle size={14} color="var(--toa-danger)" />}
                      </td>
                    </tr>
                  ))}
                  {(stats?.purchases || []).length === 0 && (
                    <tr><td colSpan={7} style={{ ...TD_STYLE, textAlign: 'center', color: 'var(--toa-muted)', padding: '2rem' }}>No purchases yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {purchaseTotalPages > 1 && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => { const p = Math.max(1, purchasePage - 1); setPurchasePage(p); fetchStats(p, purchaseFilter); }} disabled={purchasePage === 1} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: purchasePage === 1 ? 0.4 : 1 }}>Prev</button>
                <span style={{ color: 'var(--toa-muted)', fontSize: '0.85rem' }}>Page {purchasePage} of {purchaseTotalPages}</span>
                <button onClick={() => { const p = Math.min(purchaseTotalPages, purchasePage + 1); setPurchasePage(p); fetchStats(p, purchaseFilter); }} disabled={purchasePage === purchaseTotalPages} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: purchasePage === purchaseTotalPages ? 0.4 : 1 }}>Next</button>
              </div>
            )}
          </>
        )
      )}
    </PageShell>
  );
}
