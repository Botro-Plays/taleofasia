'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Search, X, Trash2, Plus, Eye, EyeOff } from 'lucide-react';

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

export default function AdminShopPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [defaultPrice, setDefaultPrice] = useState('10');

  const fetchShopItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop', { cache: 'no-store' });
      const data = await res.json();
      setShopItems(data.items || []);
    } catch (e) {
      console.error('Failed to fetch shop items:', e);
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
        fetchShopItems();
      } catch {
        router.push('/dashboard');
      }
    })();
  }, [status, router, fetchShopItems]);

  const doSearch = useCallback(async (searchTerm: string, page: number) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      params.set('page', String(page));
      params.set('pageSize', '50');
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
    if (isAdmin) {
      const id = setTimeout(() => { doSearch('', 1); }, 0);
      return () => clearTimeout(id);
    }
  }, [isAdmin, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setSearchPage(1);
    doSearch(searchInput, 1);
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
      if (res.ok) {
        await fetchShopItems();
        doSearch(search, searchPage);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add item');
      }
    } catch (e) {
      console.error('Failed to add item:', e);
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
      }
    } catch (e) {
      console.error('Failed to update item:', e);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (item: ShopItem) => {
    if (!confirm(`Remove "${item.szItemName}" from the shop?`)) return;
    setUpdating(item.ShopItemID);
    try {
      const res = await fetch(`/api/admin/shop?shopItemId=${item.ShopItemID}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchShopItems();
        doSearch(search, searchPage);
      }
    } catch (e) {
      console.error('Failed to remove item:', e);
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

  const searchTotalPages = Math.ceil(searchTotal / 50);

  return (
    <PageShell label="Management" title="Web Shop" backHref="/admin" backLabel="Admin">
      {/* Current Shop Items */}
      <div className="toa-label" style={{ marginBottom: '1rem' }}>Shop Items ({shopItems.length})</div>
      {shopItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)', marginBottom: '2rem' }}>
          No items in the shop yet. Add items from the search below.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                {['Item', 'Type', 'Price (VP)', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shopItems.map((item) => (
                <tr key={item.ShopItemID} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                  <td style={{ padding: '0.5rem', color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{item.szItemName}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--toa-muted)' }}>{item.szItemPath}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="number"
                      value={item.PriceVP}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isFinite(val) && val > 0) {
                          setShopItems(prev => prev.map(i => i.ShopItemID === item.ShopItemID ? { ...i, PriceVP: val } : i));
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isFinite(val) && val > 0 && val !== item.PriceVP) {
                          updateItem(item, { priceVP: val });
                        }
                      }}
                      style={{ width: '60px', background: 'var(--toa-bg)', border: '1px solid var(--toa-border)', color: 'var(--toa-text)', padding: '0.25rem 0.5rem', fontSize: '0.85rem', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      onClick={() => updateItem(item, { isActive: !item.IsActive })}
                      disabled={updating === item.ShopItemID}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      {item.IsActive ? <Eye size={16} color="var(--toa-success)" /> : <EyeOff size={16} color="var(--toa-danger)" />}
                    </button>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      onClick={() => removeItem(item)}
                      disabled={updating === item.ShopItemID}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <Trash2 size={16} color="var(--toa-danger)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Search & Add Items */}
      <div className="toa-label" style={{ marginBottom: '1rem' }}>Add Items (Event & Premium only)</div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', position: 'relative', minWidth: '250px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search item name..."
              className="toa-input"
              style={{ width: '100%', paddingLeft: '2.25rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--toa-muted)' }} />
          </div>
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setSearchPage(1); doSearch('', 1); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.5rem' }}>
              <X size={16} />
            </button>
          )}
        </form>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--toa-muted)' }}>
          Default Price:
          <input
            type="number"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            min={1}
            style={{ width: '60px', background: 'var(--toa-bg)', border: '1px solid var(--toa-border)', color: 'var(--toa-text)', padding: '0.25rem 0.5rem', fontSize: '0.85rem', textAlign: 'center' }}
          />
          VP
        </label>
      </div>

      {searchLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)' }}>Searching…</div>
      ) : searchResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)' }}>No items found.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                  {['Item', 'Type', 'Category', 'Status', 'Add'].map(h => (
                    <th key={h} style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchResults.map((item) => (
                  <tr key={`${item.sItemID}-${item.szLastCategory}`} style={{ borderBottom: '1px solid var(--toa-border)' }}>
                    <td style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid var(--toa-border)', borderRadius: '4px',
                        overflow: 'hidden', padding: '2px', minWidth: '36px', minHeight: '36px',
                      }}>
                        <img
                          src={item.imageUrl}
                          alt={item.szItemName}
                          style={{ maxWidth: '32px', maxHeight: '32px', objectFit: 'contain' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{item.szItemName}</span>
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--toa-muted)' }}>{item.szItemPath}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--toa-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.szLastCategory}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {item.inShop ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--toa-success)', background: 'rgba(58,125,68,0.15)', padding: '0.2rem 0.5rem', borderRadius: 3 }}>IN SHOP</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button
                        onClick={() => addItem(item)}
                        disabled={item.inShop || adding === item.sItemID}
                        className="toa-btn toa-btn-ghost toa-btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', opacity: item.inShop ? 0.4 : 1 }}
                      >
                        <Plus size={12} /> {item.inShop ? 'Added' : 'Add'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {searchTotalPages > 1 && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => { const p = Math.max(1, searchPage - 1); setSearchPage(p); doSearch(search, p); }}
                disabled={searchPage === 1}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={{ opacity: searchPage === 1 ? 0.4 : 1 }}
              >
                Prev
              </button>
              <span style={{ color: 'var(--toa-muted)', fontSize: '0.85rem' }}>
                Page {searchPage} of {searchTotalPages} ({searchTotal} items)
              </span>
              <button
                onClick={() => { const p = Math.min(searchTotalPages, searchPage + 1); setSearchPage(p); doSearch(search, p); }}
                disabled={searchPage === searchTotalPages}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={{ opacity: searchPage === searchTotalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
