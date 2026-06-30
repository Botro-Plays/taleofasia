'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { ChevronLeft, RefreshCw, Trash2, ShieldOff, Shield } from 'lucide-react';

interface RateEntry {
  key: string;
  count: number;
  resetTime: number;
  remaining: number;
}

interface BlockEvent {
  timestamp: number;
  ip: string;
  key: string;
  retryAfter: number;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString('en-PH', { hour12: true, timeZone: 'Asia/Manila' });
}

function fmtRemaining(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function RateLimitsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<RateEntry[]>([]);
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rate-limit');
      if (!res.ok) { router.push('/admin'); return; }
      const data = await res.json();
      setEntries(data.entries || []);
      setEvents(data.recentBlocks || []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') void load();
  }, [status, router, load]);

  const flush = async (filter?: string) => {
    setFlushing(true);
    setMessage('');
    try {
      const url = filter ? `/api/admin/rate-limit?filter=${encodeURIComponent(filter)}` : '/api/admin/rate-limit';
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      setMessage(`Flushed ${data.flushed} entr${data.flushed === 1 ? 'y' : 'ies'}.`);
      await load();
    } finally {
      setFlushing(false);
    }
  };

  const blockedRegister = entries.filter(e => e.key.includes('auth-register'));
  const blockedOther = entries.filter(e => !e.key.includes('auth-register'));
  const registerEvents = events.filter(e => e.key === 'auth-register');

  if (status === 'loading' || loading) {
    return (
      <GlobalTheme>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ color: 'var(--toa-gold)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.2em', fontSize: '0.85rem' }}>Loading…</div>
        </div>
      </GlobalTheme>
    );
  }

  return (
    <GlobalTheme>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3.5rem 1.5rem 10rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="toa-label">Security</div>
            <h1 style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', color: 'var(--toa-gold-bright)', marginBottom: '0.3rem' }}>
              Rate Limits
            </h1>
            <p style={{ color: 'var(--toa-muted)', fontSize: '0.82rem', margin: 0 }}>
              Monitor and flush in-memory rate limit blocks. Resets automatically on PM2 restart.
            </p>
          </div>
          <Link href="/admin" className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChevronLeft size={14} /> Admin
          </Link>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Blocked IPs (Register)', value: blockedRegister.length, color: blockedRegister.length > 0 ? 'var(--toa-warning)' : 'var(--toa-success)' },
            { label: 'Blocked IPs (Other)', value: blockedOther.length, color: blockedOther.length > 0 ? 'var(--toa-ember)' : 'var(--toa-success)' },
            { label: 'Total Active Limits', value: entries.length, color: 'var(--toa-info)' },
            { label: 'Recent Block Events', value: registerEvents.length, color: 'var(--toa-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="toa-seal-card" style={{ padding: '1.25rem' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>{label}</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
          <button
            className="toa-btn toa-btn-solid toa-btn-sm"
            onClick={() => void flush('auth-register')}
            disabled={flushing || blockedRegister.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ShieldOff size={14} />
            Flush Registration Blocks ({blockedRegister.length})
          </button>
          <button
            className="toa-btn toa-btn-ghost toa-btn-sm"
            onClick={() => void flush()}
            disabled={flushing || entries.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--toa-ember)', color: 'var(--toa-ember)' }}
          >
            <Trash2 size={14} />
            Flush All ({entries.length})
          </button>
          <button
            className="toa-btn toa-btn-ghost toa-btn-sm"
            onClick={() => void load()}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          {message && <span style={{ fontSize: '0.8rem', color: 'var(--toa-success)' }}>{message}</span>}
        </div>

        {/* Currently blocked — Registration */}
        <div className="toa-label" style={{ marginBottom: '0.75rem' }}>Currently Blocked — Registration</div>
        <div className="toa-seal-card" style={{ padding: 0, marginBottom: '2rem', overflow: 'hidden' }}>
          {blockedRegister.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Shield size={14} /> No IPs currently blocked for registration
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(184,155,94,0.15)' }}>
                  {['IP Address', 'Attempts', 'Resets In'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blockedRegister.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(184,155,94,0.07)' }}>
                    <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: 'var(--toa-bone)' }}>{e.key.split(':')[0]}</td>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-warning)' }}>{e.count}</td>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-muted)' }}>{fmtRemaining(e.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Currently blocked — Other */}
        {blockedOther.length > 0 && (
          <>
            <div className="toa-label" style={{ marginBottom: '0.75rem' }}>Currently Blocked — Other Endpoints</div>
            <div className="toa-seal-card" style={{ padding: 0, marginBottom: '2rem', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(184,155,94,0.15)' }}>
                    {['IP : Endpoint', 'Attempts', 'Resets In'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blockedOther.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(184,155,94,0.07)' }}>
                      <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: 'var(--toa-bone)', fontSize: '0.78rem' }}>{e.key}</td>
                      <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-ember)' }}>{e.count}</td>
                      <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-muted)' }}>{fmtRemaining(e.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Recent block events */}
        <div className="toa-label" style={{ marginBottom: '0.75rem' }}>Recent Registration Block Events (last {registerEvents.length})</div>
        <div className="toa-seal-card" style={{ padding: 0, overflow: 'hidden' }}>
          {registerEvents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.82rem' }}>
              No block events recorded since last restart
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(184,155,94,0.15)' }}>
                  {['Time (PHT)', 'IP Address', 'Retry After'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registerEvents.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(184,155,94,0.07)' }}>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-muted)', fontSize: '0.78rem' }}>{fmt(e.timestamp)}</td>
                    <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: 'var(--toa-bone)' }}>{e.ip}</td>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--toa-warning)' }}>{fmtRemaining(e.retryAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </GlobalTheme>
  );
}
