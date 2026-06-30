'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Gem, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';

interface ShopItem {
  shopItemId: number;
  sItemID: number;
  szItemName: string;
  szLastCategory: string;
  szItemPath: string;
  priceVP: number;
  sortOrder: number;
  iLevel: number;
  imageUrl: string;
}

export default function ShopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votePoints, setVotePoints] = useState(0);
  const [voteSiteId, setVoteSiteId] = useState('1132379076');
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/items', { cache: 'no-store' });
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error('Failed to fetch shop items:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVP = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/user/vote-points', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setVotePoints(data.votePoints || 0);
      }
    } catch (e) {
      console.error('Failed to fetch VP:', e);
    }
  }, [status]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/public/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.voting?.siteId) setVoteSiteId(data.voting.siteId);
      }
    } catch { /* keep default */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchItems();
      fetchVP();
      fetchConfig();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchItems, fetchVP, fetchConfig]);

  // Real-time updates: poll every 30s and refresh on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      fetchItems();
      if (status === 'authenticated') fetchVP();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchItems, fetchVP, status]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchItems();
        if (status === 'authenticated') fetchVP();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchItems, fetchVP, status]);

  const handlePurchase = async (item: ShopItem) => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    setPurchasing(item.shopItemId);
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopItemId: item.shopItemId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setVotePoints(data.votePoints);
      } else {
        showToast(data.error || 'Purchase failed', 'error');
      }
    } catch {
      showToast('An error occurred during purchase', 'error');
    } finally {
      setPurchasing(null);
    }
  };

  const eventItems = items.filter(i => i.szItemPath === 'Event');
  const premiumItems = items.filter(i => i.szItemPath === 'Premium');

  const renderItemCard = (item: ShopItem) => (
    <div
      key={item.shopItemId}
      className="toa-seal-card"
      style={{ padding: '1rem', transition: 'transform 0.2s, filter 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
    >
      <div style={{
        fontSize: '0.9rem',
        fontWeight: 700,
        color: 'var(--toa-gold-bright)',
        marginBottom: '0.75rem',
        borderBottom: '1px solid var(--toa-border)',
        paddingBottom: '0.5rem',
        minHeight: '2.5rem',
        display: 'flex',
        alignItems: 'center',
      }}>
        {item.szItemName}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
          minWidth: '52px',
          minHeight: '52px',
        }}>
          <img
            src={item.imageUrl}
            alt={item.szItemName}
            style={{ maxWidth: '48px', maxHeight: '48px', objectFit: 'contain', imageRendering: 'auto' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Gem size={14} style={{ color: 'var(--toa-gold)' }} />
            <span style={{ fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.95rem' }}>{item.priceVP} VP</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {item.szItemPath}
          </span>
        </div>
      </div>

      <button
        onClick={() => handlePurchase(item)}
        disabled={purchasing === item.shopItemId || (status === 'authenticated' && votePoints < item.priceVP)}
        className="toa-btn toa-btn-solid toa-btn-sm"
        style={{
          width: '100%',
          marginTop: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          opacity: (status === 'authenticated' && votePoints < item.priceVP) ? 0.5 : 1,
        }}
      >
        {purchasing === item.shopItemId ? (
          'Processing…'
        ) : status !== 'authenticated' ? (
          <>
            <ShoppingCart size={13} /> Login to Buy
          </>
        ) : votePoints < item.priceVP ? (
          `Need ${item.priceVP - votePoints} more VP`
        ) : (
          <>
            <ShoppingCart size={13} /> Buy for {item.priceVP} VP
          </>
        )}
      </button>
    </div>
  );

  return (
    <PageShell label="Market" title="Vote Shop" backHref="/" backLabel="Home">
      {toast && (
        <div
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 60,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            background: 'var(--toa-smoke)',
            border: `1px solid ${toast.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
            clipPath: 'var(--toa-clip-btn-sm)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontSize: '0.875rem', color: 'var(--toa-bone)',
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={16} color="var(--toa-success)" /> : <AlertCircle size={16} color="var(--toa-danger)" />}
          {toast.message}
        </div>
      )}

      {/* VP Balance Banner */}
      {status === 'authenticated' && (
        <div className="toa-seal-card" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, background: 'rgba(184,155,94,0.08)', border: '1px solid rgba(184,155,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gem size={22} style={{ color: 'var(--toa-gold)' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--toa-gold-bright)' }}>
                {votePoints} <span style={{ fontSize: '0.9rem', color: 'var(--toa-muted)' }}>Vote Points</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>Earn VP by voting for our server on XtremeTop100</div>
            </div>
          </div>
          <a
            href={`https://www.xtremetop100.com/in.php?site=${voteSiteId}&postback=${encodeURIComponent(session?.user?.name || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="toa-btn toa-btn-solid toa-btn-sm"
          >
            Vote to Earn VP
          </a>
        </div>
      )}

      {loading ? (
        <div className="toa-loading">Loading shop…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--toa-muted)' }}>
          No items available in the shop yet. Check back soon!
        </div>
      ) : (
        <>
          {premiumItems.length > 0 && (
            <>
              <div className="toa-label" style={{ marginBottom: '1rem' }}>Premium Items</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {premiumItems.map(renderItemCard)}
              </div>
            </>
          )}

          {eventItems.length > 0 && (
            <>
              <div className="toa-label" style={{ marginBottom: '1rem' }}>Event Items</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {eventItems.map(renderItemCard)}
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
