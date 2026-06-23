'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { RefreshCw, X } from 'lucide-react';

interface OnlineUser {
  AccountName: string;
  CharacterName: string;
  IP: string;
  CharacterClass: number;
  CharacterLevel: number;
  Ticket: string;
  LoginTime: string;
}

const classMap: Record<number, string> = {
  1: 'Fighter',
  2: 'Mechanician',
  3: 'Archer',
  4: 'Pikeman',
  5: 'Atalanta',
  6: 'Knight',
  7: 'Magician',
  8: 'Priestess',
  9: 'Assassin',
  10: 'Shaman',
};

function parseSqlDateTime(raw: string): Date | null {
  const s = raw.trim();
  // ISO / SQL: YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
  const isoRe = /^(\d{4})[-\/](\d{2})[-\/](\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\s*(?:AM|PM))?(?:\s*(?:GMT\+8|Z|UTC))?(?:\+\d{2}:\d{2})?$/i;
  const m = s.match(isoRe);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  // SQL Server default: "Jun  5 2025  1:35PM"
  const sqlRe = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
  const s2 = s.match(sqlRe);
  if (s2) {
    const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[s2[1].toLowerCase()];
    if (month === undefined) return null;
    let hour = Number(s2[4]);
    const minute = Number(s2[5]);
    const second = Number(s2[6] || 0);
    const ampm = s2[7].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(Number(s2[3]), month, Number(s2[2]), hour, minute, second);
  }
  // Fallback: try native parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatElapsedTime(ms: number) {
  if (ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);
  const days = totalDays % 30;
  const months = Math.floor(totalDays / 30);

  const timePart = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  let result = '';
  if (months > 0) result += `${months}M `;
  if (days > 0) result += `${days}D `;
  return result + timePart;
}

function formatDateDisplay(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const isoRe = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\sGMT\+8|Z)?$/i;
  const ymdRe = /^(\d{4})[\/-](\d{2})[\/-](\d{2})\s(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\sGMT\+8)?$/i;
  const shortRe = /^(\d{2})\/(\d{2})\/(\d{2})\s(\d{2}):(\d{2}):(\d{2})(?:\sGMT\+8)?$/i;
  let m = s.match(isoRe);
  if (m) {
    const yy = String(Number(m[1]) % 100).padStart(2, '0');
    return `${m[2]}/${m[3]}/${yy} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
  }
  m = s.match(ymdRe);
  if (m) {
    const yy = String(Number(m[1]) % 100).padStart(2, '0');
    return `${m[2]}/${m[3]}/${yy} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
  }
  m = s.match(shortRe);
  if (m) {
    return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
  }
  if (/GMT\+8$/i.test(s)) return s;
  if (/Z$/i.test(s)) return s.replace(/Z$/i, ' GMT+8');
  return `${s} GMT+8`;
}

export default function AdminOnlineUsersPage() {
  const router = useRouter();
  const { status } = useSession();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [uniqueIPs, setUniqueIPs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [error, setError] = useState('');
  const [fading, setFading] = useState(false);

  // IP modal state
  const [modalIP, setModalIP] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ country?: string; country_code?: string; continent?: string; asn?: string; as_name?: string; as_domain?: string } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Flag map
  const [flagMap, setFlagMap] = useState<Record<string, string>>({});
  // Tick to force elapsed time re-render every second
  const [tick, setTick] = useState(0);
  const [fetchTime, setFetchTime] = useState(0);

  const fetchUsers = useCallback(async () => {
    setFading(true);
    try {
      const res = await fetch('/api/admin/online-users');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setFading(false);
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setUniqueIPs(data.unique_ip_count || 0);
      setFetchTime(Date.now());
      setLastUpdate(new Date().toLocaleTimeString());
      setError('');
    } catch {
      setError('Failed to fetch online users');
    } finally {
      setLoading(false);
      setTimeout(() => setFading(false), 300);
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      if (!data.isAdmin) {
        router.push('/dashboard');
        return;
      }
      await fetchUsers();
    } catch {
      router.push('/dashboard');
    }
  }, [router, fetchUsers]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminStatus(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminStatus]);

  // Auto-refresh with visibility awareness
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) clearInterval(timer);
      if (document.visibilityState === 'visible') {
        timer = setInterval(() => { void fetchUsers(); }, 60000);
      }
    }

    start();

    const handler = () => {
      if (document.visibilityState === 'visible') {
        void fetchUsers();
        start();
      } else {
        if (timer) clearInterval(timer);
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      if (timer) clearInterval(timer);
    };
  }, [fetchUsers]);

  // Live elapsed time tick every second
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const openIPModal = useCallback(async (ip: string) => {
    setModalIP(ip);
    setModalData(null);
    setModalLoading(true);
    try {
      const res = await fetch(`https://api.ipinfo.io/lite/${ip}?token=1764e268f46b5f`);
      const data = await res.json();
      setModalData(data);
    } catch {
      setModalData({});
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeIPModal = useCallback(() => {
    setModalIP(null);
    setModalData(null);
  }, []);

  // Fetch flags for IPs not yet cached
  useEffect(() => {
    const uniqueIPs = [...new Set(users.map(u => u.IP))];
    const toFetch = uniqueIPs.filter(ip => !flagMap[ip]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    const fetched: Record<string, string> = {};

    Promise.all(
      toFetch.map(async ip => {
        try {
          const res = await fetch(`https://ipinfo.io/${ip}/json?token=1764e268f46b5f`);
          const info = await res.json();
          const country = info.country || '';
          if (country) fetched[ip] = country;
        } catch {
          // ignore
        }
      })
    ).then(() => {
      if (!cancelled && Object.keys(fetched).length > 0) {
        setFlagMap(prev => ({ ...prev, ...fetched }));
      }
    });

    return () => { cancelled = true; };
  }, [users, flagMap]);

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Online Users" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      label="Admin"
      title="Online Users"
      backHref="/admin"
      backLabel="Admin"
      actions={
        <button onClick={() => { void fetchUsers(); }} disabled={fading} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: fading ? 0.5 : 1 }}>
          <RefreshCw size={12} style={{ animation: fading ? 'spin 1s linear infinite' : 'none' }} />
          {fading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
          <strong style={{ color: 'var(--toa-bone)' }}>Unique IPs:</strong> {uniqueIPs}
          {lastUpdate && <span style={{ marginLeft: '0.75rem' }}>Last updated: {lastUpdate}</span>}
        </div>

        {error && <div className="toa-msg toa-msg-error">{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table className="toa-table">
            <thead>
              <tr><th>#</th><th>Account</th><th>Character</th><th>IP</th><th>Class</th><th>Lv</th><th>Ticket</th><th>Login Time</th><th>Elapsed</th></tr>
            </thead>
            <tbody style={{ opacity: fading ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              {users.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)' }}>No users currently online.</td></tr>
              ) : (
                users.map((user, index) => {
                  const flagCountry = flagMap[user.IP] || '';
                  const loginDate = parseSqlDateTime(user.LoginTime);
                  const elapsedMs = loginDate ? (fetchTime + tick * 1000) - loginDate.getTime() : -1;
                  return (
                    <tr key={`${user.AccountName}-${user.CharacterName}-${index}`}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 600 }}>{user.AccountName}</td>
                      <td>{user.CharacterName}</td>
                      <td>
                        <button onClick={() => openIPModal(user.IP)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--toa-info)', padding: 0 }}>
                          {flagCountry && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`https://flagsapi.com/${flagCountry}/flat/64.png`} alt={flagCountry} style={{ width: '1.25rem', height: '0.875rem', border: '1px solid rgba(184,155,94,0.15)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          {user.IP}
                        </button>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/images/CharClass/${user.CharacterClass}.png`} alt="" style={{ width: '1rem', height: '1rem' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {classMap[user.CharacterClass] || 'Unknown'}
                        </span>
                      </td>
                      <td>{user.CharacterLevel}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{user.Ticket}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateDisplay(user.LoginTime)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatElapsedTime(elapsedMs)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalIP && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.65)' }} onClick={closeIPModal}>
          <div className="toa-seal-card" style={{ maxWidth: '26rem', width: '100%', padding: '1.5rem', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>IP Information</div>
              <button onClick={closeIPModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem' }}><X size={14} /></button>
            </div>
            {modalLoading ? (
              <div style={{ color: 'var(--toa-muted)', fontSize: '0.82rem' }}>Loading…</div>
            ) : modalData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                {[['IP', modalIP], ['Country', (modalData.country || 'N/A') + (modalData.country_code && modalData.country_code !== 'N/A' ? ' (' + modalData.country_code + ')' : '')], ['Continent', modalData.continent || 'N/A'], ['ASN', modalData.asn || 'N/A'], ['ISP', (modalData.as_name || 'N/A') + (modalData.as_domain ? ' (' + modalData.as_domain + ')' : '')]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--toa-muted)', minWidth: '5rem' }}>{k}</span><span style={{ color: 'var(--toa-bone)', fontWeight: 500 }}>{v}</span></div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--toa-danger)', fontSize: '0.82rem' }}>Failed to load IP information.</div>
            )}
            <button onClick={closeIPModal} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
