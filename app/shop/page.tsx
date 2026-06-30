'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Gem, ShoppingCart, AlertCircle, CheckCircle, ExternalLink, Gift, Clock } from 'lucide-react';

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

interface VoteLog {
  LogID: number;
  VoteTime: string;
  IP: string;
  RewardClaimed: boolean;
}

interface Purchase {
  PurchaseID: number;
  szItemName: string;
  PriceVP: number;
  Delivered: boolean;
  PurchasedAt: string;
}

export default function ShopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votePoints, setVotePoints] = useState(0);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [voteConfig, setVoteConfig] = useState<{ siteId: string; rewardVP: number; cooldownHours: number; testingMode: boolean }>({ siteId: '1132379076', rewardVP: 5, cooldownHours: 12, testingMode: false });
  const [votingLogs, setVotingLogs] = useState<VoteLog[]>([]);
  const [claimingReward, setClaimingReward] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [simulatingVote, setSimulatingVote] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [inCooldown, setInCooldown] = useState(false);

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
        if (data.voting) {
          setVoteConfig({
            siteId: data.voting.siteId || '1132379076',
            rewardVP: data.voting.rewardVP || 5,
            cooldownHours: data.voting.cooldownHours || 12,
            testingMode: !!data.voting.testingMode,
          });
        }
      }
    } catch { /* keep default */ }
  }, []);

  const fetchVotingLogs = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/user/voting-logs', { cache: 'no-store' });
      if (res.ok) setVotingLogs(await res.json());
    } catch { /* ignore */ }
  }, [status]);

  const fetchPurchases = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/user/purchases', { cache: 'no-store' });
      if (res.ok) setPurchases(await res.json());
    } catch { /* ignore */ }
  }, [status]);

  const checkAdmin = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/admin/check', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setIsAdmin(!!d.isAdmin); }
    } catch { /* ignore */ }
  }, [status]);

  useEffect(() => {
    const lastVote = votingLogs.length > 0 ? new Date(votingLogs[0].VoteTime).getTime() : null;
    if (!lastVote) { setInCooldown(false); setCountdown(''); return; }
    const nextAt = lastVote + voteConfig.cooldownHours * 3600 * 1000;
    const tick = () => {
      const remaining = nextAt - Date.now();
      if (remaining <= 0) { setInCooldown(false); setCountdown(''); return; }
      setInCooldown(true);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [votingLogs, voteConfig.cooldownHours]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchItems();
      fetchConfig();
      if (status === 'authenticated') {
        fetchVP();
        fetchVotingLogs();
        fetchPurchases();
        checkAdmin();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [fetchItems, fetchVP, fetchConfig, fetchVotingLogs, fetchPurchases, checkAdmin, status]);

  // Real-time updates: poll every 30s and refresh on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      fetchItems();
      if (status === 'authenticated') {
        fetchVP();
        fetchVotingLogs();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchItems, fetchVP, fetchVotingLogs, status]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchItems();
        if (status === 'authenticated') {
          fetchVP();
          fetchVotingLogs();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchItems, fetchVP, fetchVotingLogs, status]);

  const handleSimulateVote = async () => {
    setSimulatingVote(true);
    try {
      const username = session?.user?.name || '';
      const res = await fetch(`/api/voting/postback?votingip=TEST_SIMULATED&custom=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (res.ok) {
        showToast('Test vote recorded — click Claim Reward to earn your VP!', 'success');
        void fetchVotingLogs();
      } else {
        showToast(data.error || 'Simulation failed', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setSimulatingVote(false);
    }
  };

  const handleClaimReward = async () => {
    setClaimingReward(true);
    try {
      const res = await fetch('/api/voting/reward', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setVotingLogs(prev => prev.map(log => ({ ...log, RewardClaimed: true })));
        if (typeof data.votePoints === 'number') setVotePoints(data.votePoints);
        void fetchVotingLogs();
        void fetchVP();
      } else {
        showToast(data.error || 'Claim failed', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setClaimingReward(false);
    }
  };

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
        void fetchPurchases();
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
  const unclaimedCount = votingLogs.filter(log => !log.RewardClaimed).length;
  const unclaimedVP = unclaimedCount * voteConfig.rewardVP;

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
    <PageShell label="Market" title="Vote Shop" backHref="/dashboard" backLabel="Dashboard">
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

      {/* VP Balance + Vote */}
      {status === 'authenticated' && (
        <div className="toa-seal-card" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 44, height: 44, background: 'rgba(184,155,94,0.08)', border: '1px solid rgba(184,155,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Gem size={22} style={{ color: 'var(--toa-gold)' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--toa-gold-bright)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {votePoints} <span style={{ fontSize: '0.9rem', color: 'var(--toa-muted)' }}>Vote Points</span>
                  {unclaimedCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-success)', background: 'rgba(34,197,94,0.12)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.25)', textTransform: 'none', letterSpacing: 0 }}>
                      <Gift size={11} /> {unclaimedVP} VP ready{unclaimedCount > 1 ? ` (${unclaimedCount} votes)` : ''}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
                  Vote every {voteConfig.cooldownHours}h — earn <span style={{ color: 'var(--toa-gold-bright)' }}>{voteConfig.rewardVP} VP</span> per vote
                  {!inCooldown && votingLogs.length > 0 && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--toa-success)', fontSize: '0.7rem' }}>✓ Ready!</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {inCooldown ? (
                <span className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', opacity: 0.6, cursor: 'not-allowed', fontFamily: 'monospace' }}>
                  <Clock size={13} /> {countdown}
                </span>
              ) : (
                <a
                  href={`https://www.xtremetop100.com/in.php?site=${voteConfig.siteId}&postback=${encodeURIComponent(session?.user?.name || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="toa-btn toa-btn-solid toa-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => { document.cookie = 'toa_vote_return=1; max-age=3600; path=/; SameSite=Lax'; }}
                >
                  <ExternalLink size={13} />
                  Vote Now
                </a>
              )}
              <button
                onClick={handleClaimReward}
                disabled={claimingReward || unclaimedCount === 0}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={unclaimedCount > 0 ? { borderColor: 'var(--toa-success)', color: 'var(--toa-success)' } : {}}
              >
                {claimingReward ? 'Claiming…' : 'Claim Reward'}
              </button>
              {isAdmin && voteConfig.testingMode && (
                <button
                  onClick={handleSimulateVote}
                  disabled={simulatingVote}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ borderColor: 'var(--toa-warning)', color: 'var(--toa-warning)' }}
                >
                  {simulatingVote ? 'Simulating…' : '⚡ Simulate Vote'}
                </button>
              )}
            </div>
          </div>
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

      {/* Purchase History */}
      {status === 'authenticated' && purchases.length > 0 && (
        <>
          <div className="toa-label" style={{ margin: '2.5rem 0 1rem' }}>Purchase History</div>
          <div style={{ background: 'var(--toa-smoke)', border: '1px solid rgba(184,155,94,0.1)', marginBottom: '2.5rem' }}>
            {purchases.map((p, i) => (
              <div
                key={p.PurchaseID}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem', fontSize: '0.82rem',
                  borderBottom: i < purchases.length - 1 ? '1px solid rgba(184,155,94,0.07)' : 'none',
                  gap: '1rem', flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{p.szItemName}</span>
                  <span style={{ color: 'var(--toa-gold)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.PriceVP} VP</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--toa-muted)', fontSize: '0.78rem' }}>
                    {new Date(p.PurchasedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span style={{ marginLeft: '0.5rem' }}>{new Date(p.PurchasedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  {p.Delivered ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--toa-muted)', background: 'rgba(107,101,119,0.15)', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                      <CheckCircle size={10} /> Delivered
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-warning)', background: 'rgba(234,179,8,0.1)', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid rgba(234,179,8,0.2)' }}>
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Vote History */}
      {status === 'authenticated' && votingLogs.length > 0 && (
        <>
          <div className="toa-label" style={{ marginBottom: '1rem' }}>Vote History</div>
          <div style={{ background: 'var(--toa-smoke)', border: '1px solid rgba(184,155,94,0.1)', marginBottom: '3rem' }}>
            {votingLogs.map((log, i) => (
              <div
                key={log.LogID}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem', fontSize: '0.82rem',
                  borderBottom: i < votingLogs.length - 1 ? '1px solid rgba(184,155,94,0.07)' : 'none',
                }}
              >
                <span style={{ color: 'var(--toa-bone)' }}>
                  {new Date(log.VoteTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  <span style={{ color: 'var(--toa-muted)', marginLeft: '0.75rem' }}>
                    {new Date(log.VoteTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                {log.RewardClaimed ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--toa-muted)', background: 'rgba(107,101,119,0.15)', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                    <CheckCircle size={10} /> Claimed
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-success)', background: 'rgba(34,197,94,0.12)', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <Gift size={10} /> Claimable
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
