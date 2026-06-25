'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { Gem, Clock, Users, Sword, CreditCard, KeyRound, Shield, ExternalLink, ChevronRight, CheckCircle, XCircle, User, Gift } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [characterData, setCharacterData] = useState<any>(null);
  const [votingLogs, setVotingLogs] = useState<any[]>([]);
  const [claimingReward, setClaimingReward] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timePoints, setTimePoints] = useState<number>(0);
  const [coins, setCoins] = useState<number | null>(null);
  const [voteConfig, setVoteConfig] = useState<{ siteId: string; rewardCoins: number; cooldownHours: number; testingMode: boolean }>({ siteId: '1132379076', rewardCoins: 5, cooldownHours: 12, testingMode: false });
  const [simulatingVote, setSimulatingVote] = useState(false);
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
            rewardCoins: data.voting.rewardCoins || 5,
            cooldownHours: data.voting.cooldownHours || 12,
            testingMode: !!data.voting.testingMode,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vote config:', error);
    }
  }, []);

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
  }, [status, router, fetchUserData, fetchVotingLogs, checkAdminStatus, fetchTimePoints, fetchVoteConfig]);

  const handleClaimReward = async () => {
    setClaimingReward(true);
    try {
      const response = await fetch('/api/voting/reward', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        showToast(data.message, 'success');
        // Immediately mark all votes as claimed locally for instant UI feedback
        setVotingLogs(prev => prev.map(log => ({ ...log, RewardClaimed: true })));
        // Update coins locally
        if (typeof data.reward === 'number') {
          setCoins(prev => (prev !== null ? prev + data.reward : prev));
        }
        // Re-fetch to confirm from server
        fetchUserData();
        fetchVotingLogs();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setClaimingReward(false);
    }
  };

  const handleSimulateVote = async () => {
    setSimulatingVote(true);
    try {
      const username = session?.user?.name || session?.user?.id || '';
      const response = await fetch(`/api/voting/postback?votingip=TEST_SIMULATED&custom=${encodeURIComponent(username)}`);
      const data = await response.json();
      if (response.ok) {
        showToast('Test vote simulated — claim your reward!', 'success');
        await fetchVotingLogs();
      } else {
        showToast(data.error || 'Simulation failed', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setSimulatingVote(false);
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

        {/* ── VOTING ── */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Vote for Rewards</div>
        {isAdmin && voteConfig.testingMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem 0.875rem', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--toa-warning)' }}>
            <span style={{ fontWeight: 700 }}>⚠ Testing Mode Active</span>
            <span style={{ color: 'var(--toa-muted)' }}>— Use Simulate Vote to test the full flow without going through XtremeTop100.</span>
          </div>
        )}
        <div className="toa-seal-card" style={{ padding: '2rem', marginBottom: '0.75rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Server Vote
                {votingLogs.filter(log => !log.RewardClaimed).length > 0 && (() => {
                  const unclaimed = votingLogs.filter(log => !log.RewardClaimed).length;
                  const totalCoins = unclaimed * voteConfig.rewardCoins;
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-success)', background: 'rgba(34,197,94,0.12)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.25)', textTransform: 'none', letterSpacing: 0 }}>
                      <Gift size={11} /> {totalCoins} Coins ready{unclaimed > 1 ? ` (${unclaimed} votes)` : ''}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--toa-muted)', margin: 0 }}>
                Vote every {voteConfig.cooldownHours} hours — earn <span style={{ color: 'var(--toa-gold-bright)' }}>{voteConfig.rewardCoins} Coins</span> per vote.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={`https://www.xtremetop100.com/in.php?site=${voteConfig.siteId}&custom=${encodeURIComponent(session?.user?.name || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="toa-btn toa-btn-solid toa-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ExternalLink size={13} />
                Vote Now
              </a>
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
              <button
                onClick={handleClaimReward}
                disabled={claimingReward || !votingLogs.some(log => !log.RewardClaimed)}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={votingLogs.some(log => !log.RewardClaimed) ? { borderColor: 'var(--toa-success)', color: 'var(--toa-success)' } : {}}
              >
                {claimingReward ? 'Claiming…' : 'Claim Reward'}
              </button>
            </div>
          </div>
        </div>

        {/* ── VOTING HISTORY ── */}
        {votingLogs.length > 0 && (
          <div style={{ background: 'var(--toa-smoke)', border: '1px solid rgba(184,155,94,0.1)', marginBottom: '3rem' }}>
            {votingLogs.slice(0, 5).map((log, i) => (
              <div
                key={log.LogID}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem', fontSize: '0.82rem',
                  borderBottom: i < Math.min(votingLogs.length, 5) - 1 ? '1px solid rgba(184,155,94,0.07)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                <span style={{ color: 'var(--toa-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.IP}</span>
              </div>
            ))}
          </div>
        )}
        {votingLogs.length === 0 && (
          <div style={{ marginBottom: '3rem', padding: '2rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.85rem', background: 'var(--toa-smoke)', border: '1px solid rgba(184,155,94,0.08)' }}>
            No votes recorded yet
          </div>
        )}

      </div>
    </GlobalTheme>
  );
}
