'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/app/components/PageShell';
import { Search, X, Eye, EyeOff, Package } from 'lucide-react';

interface AdminItem {
  sItemID: number;
  szItemName: string;
  szLastCategory: string;
  szItemPath: string;
  iLevel: number;
  iClass: number;
  iWidth: number;
  iHeight: number;
  isVisible: boolean;
  imageUrl: string;
  mainCategory: string;
  subCategory: string;
}

interface MainCategory {
  key: string;
  label: string;
  subs: Array<{ key: string; label: string }>;
}

interface SubCategory {
  key: string;
  label: string;
  count: number;
}

export default function AdminItemsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [items, setItems] = useState<AdminItem[]>([]);
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeMain, setActiveMain] = useState('weapons');
  const [activeSub, setActiveSub] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeMain) params.set('category', activeMain);
      if (activeSub) params.set('sub', activeSub);
      if (search) params.set('search', search);
      if (visibleOnly) params.set('visible', '1');
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/admin/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setMainCategories(data.mainCategories || []);
      setSubCategories(data.subCategories || []);
    } catch (e) {
      console.error('Failed to fetch items:', e);
    } finally {
      setLoading(false);
    }
  }, [activeMain, activeSub, search, visibleOnly, page, pageSize]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status !== 'authenticated') return;

    (async () => {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (!data.isAdmin) {
          router.push('/dashboard');
          return;
        }
        setIsAdmin(true);
        setLoading(false);
        fetchItems();
      } catch {
        router.push('/dashboard');
      }
    })();
  }, [status, router, fetchItems]);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (isAdmin && !hasFetched.current) {
      hasFetched.current = true;
      fetchItems();
    }
  }, [isAdmin, fetchItems]);

  const toggleVisibility = async (item: AdminItem) => {
    const itemKey = `${item.sItemID}|${item.szItemName}`;
    setToggling(itemKey);
    try {
      const res = await fetch('/api/admin/items/0', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sItemID: item.sItemID, szItemName: item.szItemName, isVisible: !item.isVisible }),
      });
      if (res.ok) {
        setItems(prev =>
          prev.map(i =>
            i.sItemID === item.sItemID && i.szItemName === item.szItemName ? { ...i, isVisible: !i.isVisible } : i
          )
        );
      }
    } catch (e) {
      console.error('Failed to toggle:', e);
    } finally {
      setToggling(null);
    }
  };

  const bulkToggle = async (main: string, sub: string, isVisible: boolean) => {
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/items/0', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: main, sub, isVisible }),
      });
      if (res.ok) {
        await fetchItems();
      }
    } catch (e) {
      console.error('Failed to bulk toggle:', e);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleMainChange = (main: string) => {
    setActiveMain(main);
    setActiveSub('');
    setPage(1);
  };

  const handleSubChange = (sub: string) => {
    setActiveSub(sub);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (status === 'loading' || (loading && !isAdmin)) {
    return (
      <PageShell label="Management" title="Item Visibility" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  if (!isAdmin) return null;

  return (
    <PageShell label="Management" title="Item Visibility" backHref="/admin" backLabel="Admin" actions={
      <Link href="/items" target="_blank" className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <Package size={14} />
        View Public Page
      </Link>
    }>
        {/* Search + Filters */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
              <button type="button" onClick={clearSearch} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.5rem' }}>
                <X size={16} />
              </button>
            )}
          </form>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--toa-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={visibleOnly}
              onChange={(e) => { setVisibleOnly(e.target.checked); setPage(1); }}
              style={{ accentColor: 'var(--toa-gold)' }}
            />
            Visible only
          </label>
        </div>

        {/* Main category tabs */}
        {mainCategories.length > 0 && (
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {mainCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleMainChange(cat.key)}
                className="toa-btn toa-btn-sm"
                style={{
                  background: activeMain === cat.key ? 'var(--toa-gold)' : 'transparent',
                  color: activeMain === cat.key ? 'var(--toa-bg)' : 'var(--toa-gold)',
                  border: '1px solid var(--toa-gold)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0.5rem 1.25rem',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Sub-category tabs with bulk actions */}
        {subCategories.length > 0 && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={() => handleSubChange('')}
                className="toa-btn toa-btn-sm"
                style={{
                  background: !activeSub ? 'var(--toa-gold-dark)' : 'transparent',
                  color: !activeSub ? 'var(--toa-bg)' : 'var(--toa-gold-dark)',
                  border: '1px solid var(--toa-gold-dark)',
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.75rem',
                }}
              >
                All ({total})
              </button>
              {!activeSub && (
                <>
                  <button
                    onClick={() => bulkToggle(activeMain, '', true)}
                    disabled={bulkLoading}
                    className="toa-btn toa-btn-sm"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--toa-success)', color: 'var(--toa-success)' }}
                    title="Show all in category"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={() => bulkToggle(activeMain, '', false)}
                    disabled={bulkLoading}
                    className="toa-btn toa-btn-sm"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--toa-danger)', color: 'var(--toa-danger)' }}
                    title="Hide all in category"
                  >
                    <EyeOff size={12} />
                  </button>
                </>
              )}
            </div>
            {subCategories.map((sub) => (
              <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => handleSubChange(sub.key)}
                  className="toa-btn toa-btn-sm"
                  style={{
                    background: activeSub === sub.key ? 'var(--toa-gold-dark)' : 'transparent',
                    color: activeSub === sub.key ? 'var(--toa-bg)' : 'var(--toa-gold-dark)',
                    border: '1px solid var(--toa-gold-dark)',
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                  }}
                >
                  {sub.label} ({sub.count})
                </button>
                {activeSub === sub.key && (
                  <>
                    <button
                      onClick={() => bulkToggle(activeMain, sub.key, true)}
                      disabled={bulkLoading}
                      className="toa-btn toa-btn-sm"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--toa-success)', color: 'var(--toa-success)' }}
                      title={`Show all in ${sub.label}`}
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      onClick={() => bulkToggle(activeMain, sub.key, false)}
                      disabled={bulkLoading}
                      className="toa-btn toa-btn-sm"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--toa-danger)', color: 'var(--toa-danger)' }}
                      title={`Hide all in ${sub.label}`}
                    >
                      <EyeOff size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Items table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--toa-muted)' }}>
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--toa-muted)' }}>
            No items found.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--toa-border)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={`${item.sItemID}-${item.szLastCategory}`}
                      style={{ borderBottom: '1px solid var(--toa-border)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,155,94,0.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--toa-border)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            padding: '2px',
                            minWidth: '36px',
                            minHeight: '36px',
                          }}>
                            <img
                              src={item.imageUrl}
                              alt={item.szItemName}
                              style={{ maxWidth: '32px', maxHeight: '32px', objectFit: 'contain', imageRendering: 'auto' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                          <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>
                            {item.szItemName}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem', color: 'var(--toa-muted)' }}>{item.subCategory}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--toa-text)' }}>{item.iLevel || '-'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => toggleVisibility(item)}
                          disabled={toggling === `${item.sItemID}|${item.szItemName}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: toggling === `${item.sItemID}|${item.szItemName}` ? 'wait' : 'pointer',
                            padding: '0.25rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          title={item.isVisible ? 'Click to hide' : 'Click to show'}
                        >
                          {item.isVisible ? (
                            <Eye size={18} color="var(--toa-success)" />
                          ) : (
                            <EyeOff size={18} color="var(--toa-danger)" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ opacity: page === 1 ? 0.4 : 1 }}
                >
                  Prev
                </button>
                <span style={{ color: 'var(--toa-muted)', fontSize: '0.85rem' }}>
                  Page {page} of {totalPages} ({total} items)
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ opacity: page === totalPages ? 0.4 : 1 }}
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
