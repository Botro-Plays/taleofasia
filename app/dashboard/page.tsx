'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { Gem, Clock, Users, Sword, CreditCard, KeyRound, Shield, ChevronRight, CheckCircle, XCircle, User, Gift, ShoppingBag } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [characterData, setCharacterData] = useState<any>(null);
  const [votingLogs, setVotingLogs] = useState<any[]>([]);
  const [claimingReward, setClaimingReward] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timePoints, setTimePoints] = useState<number>(0);
  const [coins, setCoins] = useState<number | null>(null);
  const [voteConfig, setVoteConfig] = useState<{ siteId: string; rewardVP: number; cooldownHours: number; testingMode: boolean }>({ siteId: '1132379076', rewardVP: 5, cooldownHours: 12, testingMode: false });
  const [votePoints, setVotePoints] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [inCooldown, setInCooldown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch('/api/user/characters', { cache: 'no-store' });
      const data = await response.json();
      setCharacterData(data);
      const updatedCoins = data?.user?.Coins;
      if (typeof updatedCoins === 'number' && !Number.isNaN(updatedCoins)) {
        setCoins(updatedCoins);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  const fetchVotingLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/user/voting-logs', { cache: 'no-store' });
      const data = await response.json();
      setVotingLogs(data);
    } catch (error) {
      console.error('Error fetching voting logs:', error);
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/check', { cache: 'no-store' });
      const data = await response.json();
      setIsAdmin(data.isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  }, []);

  const fetchTimePoints = useCallback(async () => {
    try {
      const response = await fetch('/api/user/time-points', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setTimePoints(typeof data.points === 'number' ? data.points : 0);
      }
    } catch (error) {
      console.error('Error fetching time points:', error);
    }
  }, []);

  const fetchVoteConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/public/config', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.voting) {
          setVoteConfig({
            siteId: data.voting.siteId || '1132379076',
            rewardVP: data.voting.rewardVP || 5,
            cooldownHours: data.voting.cooldownHours || 12,
            testingMode: !!data.voting.testingMode,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vote config:', error);
    }
  }, []);

  const fetchVotePoints = useCallback(async () => {
    try {
      const response = await fetch('/api/user/vote-points', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setVotePoints(typeof data.votePoints === 'number' ? data.votePoints : 0);
      }
    } catch (error) {
      console.error('Error fetching vote points:', error);
    }
  }, []);

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
    if (status === 'unauthenticated') {
      router.push('/login');
      return undefined;
    }

    if (status !== 'authenticated') {
      return undefined;
    }

    const runAll = () => {
      void fetchUserData();
      void fetchVotingLogs();
      void checkAdminStatus();
      void fetchTimePoints();
      void fetchVoteConfig();
      void fetchVotePoints();
    };

    runAll();

    const intervalId = window.setInterval(runAll, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, router, fetchUserData, fetchVotingLogs, checkAdminStatus, fetchTimePoints, fetchVoteConfig, fetchVotePoints]);

  const handleClaimReward = async () => {
    setClaimingReward(true);
    try {
      const response = await fetch('/api/voting/reward', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message, 'success');
        // Immediately mark all votes as claimed locally for instant UI feedback
        setVotingLogs(prev => prev.map(log => ({ ...log, RewardClaimed: true })));
        // Update VP locally
        if (typeof data.votePoints === 'number') {
          setVotePoints(data.votePoints);
        }
        // Re-fetch to confirm from server
        fetchVotingLogs();
        void fetchVotePoints();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setClaimingReward(false);
    }
  };

  if (status === 'loading') {
    return (
      <GlobalTheme>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ color: 'var(--toa-gold)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.2em', fontSize: '0.85rem', textTransform: 'uppercase' }}>Loading…</div>
        </div>
      </GlobalTheme>
    );
  }

  const unclaimedCount = votingLogs.filter(log => !log.RewardClaimed).length;
  const unclaimedVP = unclaimedCount * voteConfig.rewardVP;
  const displayCoins = Number((typeof coins === 'number' ? coins : session?.user?.coins || 0) ?? 0);

  return (
    <GlobalTheme>
      {/* Toast */}
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
          {toast.type === 'success'
            ? <CheckCircle size={16} style={{ color: 'var(--toa-success)', flexShrink: 0 }} />
            : <XCircle size={16} style={{ color: 'var(--toa-danger)', flexShrink: 0 }} />}
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3.5rem 1.5rem 10rem' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: '3rem' }}>
          <div className="toa-label">Account Portal</div>
          <h1 style={{
            fontFamily: 'var(--font-asian, "ZCOOL XiaoWei"), serif', fontWeight: 400,
            fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'var(--toa-gold-bright)',
            letterSpacing: '0.12em', marginBottom: '0.4rem',
            textShadow: '0 0 40px rgba(184,155,94,0.15)',
          }}>
            {session?.user?.name}
          </h1>
          <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem' }}>{session?.user?.email}</p>
        </div>

        {/* ── STAT ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {/* Coins */}
          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Coins</div>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
              {displayCoins.toLocaleString()}
            </div>
            <Gem size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
          </div>

          {/* Time Points */}
          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Time Points</div>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
              {Number(timePoints || 0).toLocaleString()}
            </div>
            <Clock size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
          </div>

          {/* Vote Points */}
          <Link href="/shop" style={{ textDecoration: 'none' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Vote Points</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
                {votePoints.toLocaleString()}
              </div>
              <ShoppingBag size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
            </div>
          </Link>

          {/* Characters */}
          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Characters</div>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
              {Number(characterData?.characters?.length || 0).toLocaleString()}
            </div>
            <Users size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
          </div>

          {/* Rank / Admin tile */}
          {isAdmin ? (
            <Link href="/admin" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', height: '100%', cursor: 'pointer' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" />
                <div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-ember)', marginBottom: '0.6rem' }}>Access</div>
                <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>Admin Panel</div>
                <Shield size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-ember)', opacity: 0.18 }} />
              </div>
            </Link>
          ) : (
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Rank</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>Adventurer</div>
              <User size={36} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
            </div>
          )}
        </div>

        {/* ── ACTIONS ── */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Navigation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '3rem' }}>
          {[
            {
              href: '/dashboard/characters',
              icon: <Sword size={20} style={{ color: 'var(--toa-gold)' }} />,
              iconBg: 'rgba(184,155,94,0.08)',
              iconBorder: 'rgba(184,155,94,0.2)',
              label: 'My Characters',
              sub: 'View stats, clan, and character details',
            },
            {
              href: '/dashboard/topup',
              icon: <CreditCard size={20} style={{ color: 'var(--toa-ember)' }} />,
              iconBg: 'rgba(179,58,58,0.08)',
              iconBorder: 'rgba(179,58,58,0.2)',
              label: 'Top-Up Coins',
              sub: 'Purchase in-game coins via payment gateways',
            },
            {
              href: '/shop',
              icon: <ShoppingBag size={20} style={{ color: 'var(--toa-gold)' }} />,
              iconBg: 'rgba(184,155,94,0.08)',
              iconBorder: 'rgba(184,155,94,0.2)',
              label: 'Vote Shop',
              sub: 'Spend Vote Points on premium and event items',
            },
            {
              href: '/dashboard/change-password',
              icon: <KeyRound size={20} style={{ color: 'var(--toa-info)' }} />,
              iconBg: 'rgba(74,111,165,0.08)',
              iconBorder: 'rgba(74,111,165,0.2)',
              label: 'Change Password',
              sub: 'Update your account credentials',
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="toa-seal-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" />
                <div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 44, height: 44, background: item.iconBg, border: `1px solid ${item.iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--toa-muted)' }}>{item.sub}</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--toa-muted)', flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </div>

        {/* ── VOTE PROMO CARD ── */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Support the Server</div>
        <div className="toa-seal-card" style={{ padding: '2rem', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          <ShoppingBag size={110} style={{ position: 'absolute', right: '-0.5rem', bottom: '-1rem', color: 'var(--toa-gold)', opacity: 0.04, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.15rem', color: 'var(--toa-gold-bright)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                Vote · Earn · Shop
                {unclaimedCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-success)', background: 'rgba(34,197,94,0.12)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.25)', textTransform: 'none', letterSpacing: 0 }}>
                    <Gift size={11} /> {unclaimedVP} VP ready
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--toa-muted)', margin: '0 0 0.75rem', lineHeight: '1.55' }}>
                Vote for the server every <strong style={{ color: 'var(--toa-bone)' }}>{voteConfig.cooldownHours}h</strong> and earn <strong style={{ color: 'var(--toa-gold-bright)' }}>{voteConfig.rewardVP} Vote Points</strong> per vote — spend them on premium &amp; event items in the Vote Shop!
              </p>
              {inCooldown ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--toa-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--toa-border)', padding: '0.3rem 0.7rem' }}>
                  <Clock size={13} /> Next vote in <span style={{ fontFamily: 'monospace', color: 'var(--toa-bone)', fontWeight: 700, marginLeft: '0.25rem' }}>{countdown}</span>
                </div>
              ) : votingLogs.length > 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--toa-success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle size={13} /> Ready to vote now!
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/shop" className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingBag size={13} /> Vote Shop
              </Link>
              {unclaimedCount > 0 && (
                <button
                  onClick={handleClaimReward}
                  disabled={claimingReward}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ borderColor: 'var(--toa-success)', color: 'var(--toa-success)' }}
                >
                  {claimingReward ? 'Claiming…' : `Claim ${unclaimedVP} VP`}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </GlobalTheme>
  );
}
