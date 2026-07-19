'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import {
  ChevronLeft, Server, Activity, Pause, Play, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Monitor, Power, Square, Lock,
} from 'lucide-react';

type ServerInfo = {
  key: string;
  label: string;
  port: number;
  running: boolean;
  pid: number | null;
  startTime: string | null;
  uptimeSeconds: number | null;
};

type MonitorData = {
  servers: ServerInfo[];
  allRunning: boolean;
  monitoringPaused: boolean;
  pausedAt: string | null;
  recentLogs: string[];
  debugLogs: Record<string, string[]>;
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ${m}m`;
}

export default function ServerMonitorPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<MonitorData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rapidRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);

  // PIN modal state
  const [pinModal, setPinModal] = useState<{
    open: boolean;
    action: string;
    label: string;
    serverKey?: string;
    confirmText?: string;
  } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/server-monitor', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (err) {
      console.error('Error fetching server monitor:', err);
    }
  }, []);

  const checkAdminAndFetch = useCallback(async () => {
    try {
      const adminRes = await fetch('/api/admin/check');
      const adminData = await adminRes.json();
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      setIsAdmin(true);
      await fetchData();
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [router, fetchData]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetch(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetch]);

  // Pause polling when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
      if (document.hidden) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      } else if (autoRefresh && isAdmin && !intervalRef.current) {
        void fetchData();
        intervalRef.current = setInterval(() => { void fetchData(); }, 10000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoRefresh, isAdmin, fetchData]);

  useEffect(() => {
    if (autoRefresh && isAdmin && !document.hidden) {
      intervalRef.current = setInterval(() => { void fetchData(); }, 10000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [autoRefresh, isAdmin, fetchData]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAction = async (action: string, pin?: string, serverKey?: string) => {
    setActionLoading(action);
    try {
      const payload: Record<string, unknown> = { action };
      if (pin) payload.pin = pin;
      if (serverKey) payload.serverKey = serverKey;

      const res = await fetch('/api/admin/server-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(d.message || 'Action completed', 'success');
        await fetchData();

        // After restart actions, poll aggressively for 2 minutes
        if (action === 'restart-all' || action === 'restart-games') {
          if (rapidRefreshRef.current) clearTimeout(rapidRefreshRef.current);
          const rapidInterval = setInterval(() => { void fetchData(); }, 3000);
          rapidRefreshRef.current = setTimeout(() => {
            clearInterval(rapidInterval);
            rapidRefreshRef.current = null;
          }, 120000);
        }
      } else {
        showToast(d.error || 'Action failed', 'error');
        if (d.pinRequired) {
          setPinError(true);
        }
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Request PIN for an action — opens the PIN modal
  const requestPin = (action: string, label: string, serverKey?: string) => {
    setPinInput('');
    setPinError(false);
    setPinModal({ open: true, action, label, serverKey });
  };

  // Submit PIN and execute the pending action
  const submitPin = () => {
    if (!pinModal || !pinInput) return;
    const { action, serverKey } = pinModal;
    setPinModal(null);
    void handleAction(action, pinInput, serverKey);
  };

  // Cancel PIN modal
  const cancelPin = () => {
    setPinModal(null);
    setPinInput('');
    setPinError(false);
  };

  if (status === 'loading' || loading) {
    return (
      <GlobalTheme>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ color: 'var(--toa-gold)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.2em', fontSize: '0.85rem', textTransform: 'uppercase' }}>Loading…</div>
        </div>
      </GlobalTheme>
    );
  }

  if (!isAdmin || !data) return null;

  const { servers, allRunning, monitoringPaused, recentLogs, debugLogs } = data;

  return (
    <GlobalTheme>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3.5rem 1.5rem 10rem' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div className="toa-label">Control Center</div>
            <h1 style={{
              fontFamily: 'var(--font-asian, "ZCOOL XiaoWei"), serif',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'var(--toa-gold-bright)',
              letterSpacing: '0.12em', marginBottom: '0.4rem',
              textShadow: '0 0 40px rgba(184,155,94,0.15)',
            }}>
              Server Monitor
            </h1>
            <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: 0 }}>
              Game server status, auto-restart monitoring, and manual controls.
            </p>
          </div>
          <Link href="/admin" className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            <ChevronLeft size={14} />
            Admin Panel
          </Link>
        </div>

        {/* TOAST */}
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100,
            background: 'var(--toa-smoke)', border: `1px solid ${toast.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
            padding: '0.75rem 1.25rem', borderRadius: '4px',
            color: toast.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)',
            fontSize: '0.85rem', fontFamily: 'var(--toa-font-display)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {toast.msg}
          </div>
        )}

        {/* STATUS OVERVIEW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Overall Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: allRunning ? 'var(--toa-success)' : 'var(--toa-danger)', boxShadow: allRunning ? '0 0 10px rgba(58,125,68,0.6)' : '0 0 10px rgba(180,60,60,0.6)' }} />
              <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: allRunning ? 'var(--toa-success)' : 'var(--toa-danger)' }}>
                {allRunning ? 'ALL ONLINE' : 'SERVERS DOWN'}
              </span>
            </div>
          </div>

          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Auto-Monitor</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} style={{ color: monitoringPaused ? 'var(--toa-warning)' : 'var(--toa-success)' }} />
              <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: monitoringPaused ? 'var(--toa-warning)' : 'var(--toa-success)' }}>
                {monitoringPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.4rem' }}>
              Checks every 1 minute
            </div>
          </div>

          <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setAutoRefresh(!autoRefresh)}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Page Refresh</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={16} style={{ color: autoRefresh ? 'var(--toa-success)' : 'var(--toa-muted)', animation: autoRefresh ? 'spin 2s linear infinite' : 'none' }} />
              <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: autoRefresh ? 'var(--toa-success)' : 'var(--toa-muted)' }}>
                {autoRefresh ? '10s' : 'OFF'}
              </span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.4rem' }}>
              Click to toggle
            </div>
          </div>
        </div>

        {/* SERVER CARDS */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Game Servers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {servers.map((srv) => (
            <div key={srv.key} className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', border: `1px solid ${srv.running ? 'rgba(58,125,68,0.2)' : 'rgba(180,60,60,0.3)'}` }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Server size={18} style={{ color: srv.running ? 'var(--toa-success)' : 'var(--toa-danger)' }} />
                  <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--toa-gold-bright)' }}>
                    {srv.label}
                  </span>
                </div>
                {srv.running ? (
                  <CheckCircle size={18} style={{ color: 'var(--toa-success)' }} />
                ) : (
                  <XCircle size={18} style={{ color: 'var(--toa-danger)' }} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--toa-muted)' }}>Status</span>
                  <span style={{ color: srv.running ? 'var(--toa-success)' : 'var(--toa-danger)', fontWeight: 600 }}>
                    {srv.running ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--toa-muted)' }}>Port</span>
                  <span style={{ color: 'var(--toa-bone)' }}>UDP {srv.port}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--toa-muted)' }}>Connection</span>
                  <span style={{ color: srv.running ? 'var(--toa-success)' : 'var(--toa-danger)' }}>
                    {srv.running ? 'Bound' : 'No response'}
                  </span>
                </div>
                {srv.running && srv.uptimeSeconds !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--toa-muted)' }}>Uptime</span>
                    <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>
                      {formatUptime(srv.uptimeSeconds)}
                    </span>
                  </div>
                )}
                {srv.running && srv.pid !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--toa-muted)' }}>PID</span>
                    <span style={{ color: 'var(--toa-bone)' }}>{srv.pid}</span>
                  </div>
                )}
              </div>

              {/* Per-server Stop / Start buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                {srv.running ? (
                  <button
                    onClick={() => requestPin('stop-server', `Stop ${srv.label}`, srv.key)}
                    disabled={actionLoading !== null}
                    className="toa-btn toa-btn-ghost"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.4rem 0.8rem', width: 'fit-content', borderColor: 'rgba(180,60,60,0.4)', color: 'var(--toa-danger)' }}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => requestPin('start-server', `Start ${srv.label}`, srv.key)}
                    disabled={actionLoading !== null}
                    className="toa-btn toa-btn-ghost"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.4rem 0.8rem', width: 'fit-content', borderColor: 'rgba(58,125,68,0.4)', color: 'var(--toa-success)' }}
                  >
                    <Power size={12} />
                    Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* MONITOR CONTROLS */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Monitor Controls</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
          {monitoringPaused ? (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading !== null}
              className="toa-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--toa-success)', borderColor: 'var(--toa-success)', color: '#fff' }}
            >
              <Play size={15} />
              {actionLoading === 'resume' ? 'Resuming…' : 'Resume Monitor'}
            </button>
          ) : (
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading !== null}
              className="toa-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--toa-warning)', borderColor: 'var(--toa-warning)', color: '#fff' }}
            >
              <Pause size={15} />
              {actionLoading === 'pause' ? 'Pausing…' : 'Pause Monitor'}
            </button>
          )}
        </div>

        {/* SERVER CONTROLS */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Server Controls</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <button
            onClick={() => requestPin('restart-games', 'Restart Game Servers')}
            disabled={actionLoading !== null}
            className="toa-btn toa-btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={15} />
            {actionLoading === 'restart-games' ? 'Restarting Games…' : 'Restart Game Servers'}
          </button>

          <button
            onClick={() => requestPin('restart-all', 'Restart All Servers')}
            disabled={actionLoading !== null}
            className="toa-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--toa-danger)', borderColor: 'var(--toa-danger)', color: '#fff' }}
          >
            <Power size={15} />
            {actionLoading === 'restart-all' ? 'Full Restart…' : 'Restart All Servers'}
          </button>
        </div>

        {/* MONITOR LOG */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>
          <Monitor size={14} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Monitor Log (last 50 entries)
        </div>
        <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', maxHeight: '400px', overflowY: 'auto', marginBottom: '2.5rem' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          {recentLogs.length === 0 ? (
            <div style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
              No monitor events logged. All servers have been stable.
            </div>
          ) : (
            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.8, color: 'var(--toa-bone)' }}>
              {recentLogs.map((line, i) => {
                const isRestart = line.includes('RESTART');
                const isDown = line.includes('DOWN') || line.includes('ERROR') || line.includes('FAILED');
                const isWarning = line.includes('WARNING') || line.includes('Duplicate');
                const color = isDown ? 'var(--toa-danger)' : isRestart ? 'var(--toa-warning)' : isWarning ? '#E5A12A' : 'var(--toa-bone)';
                return (
                  <div key={i} style={{ color, borderBottom: i < recentLogs.length - 1 ? '1px solid rgba(184,155,94,0.05)' : 'none', padding: '0.15rem 0' }}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DEBUG LOGS */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>
          <Monitor size={14} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Debug Logs (real-time, last 30 lines per server)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {servers.map((srv) => {
            const logs = debugLogs?.[srv.key] ?? [];
            return (
              <div key={srv.key} className="toa-seal-card" style={{ padding: '1.25rem', position: 'relative' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" />
                <div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: srv.running ? 'var(--toa-success)' : 'var(--toa-danger)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)' }}>
                    {srv.label}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginLeft: 'auto' }}>DEBUG.log</span>
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.7, color: 'var(--toa-bone)' }}>
                  {logs.length === 0 ? (
                    <div style={{ color: 'var(--toa-muted)', textAlign: 'center', padding: '1.5rem' }}>No debug log available</div>
                  ) : (
                    logs.map((line, i) => {
                      const isError = /error|fail|crash|exception/i.test(line);
                      const isWarning = /warn|duplicate|timeout/i.test(line);
                      const isStart = /STARTED|Init\(\) completed|Ready to accept/i.test(line);
                      const color = isError ? 'var(--toa-danger)' : isWarning ? '#E5A12A' : isStart ? 'var(--toa-success)' : 'var(--toa-bone)';
                      return (
                        <div key={i} style={{ color, borderBottom: i < logs.length - 1 ? '1px solid rgba(184,155,94,0.05)' : 'none', padding: '0.1rem 0', wordBreak: 'break-all' }}>
                          {line}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* INFO NOTE */}
        <div style={{ marginTop: '2rem', padding: '1.25rem 1.5rem', background: 'rgba(184,155,94,0.05)', border: '1px solid rgba(184,155,94,0.1)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--toa-warning)', flexShrink: 0, marginTop: '0.1rem' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--toa-bone)' }}>Restart All Servers</strong> stops all servers, starts login server, waits 45s, then starts Game Server 1, waits 25s, then starts Game Server 2.
              <br />
              <strong style={{ color: 'var(--toa-bone)' }}>Restart Game Servers</strong> restarts both game servers without touching the login server. Game Server 1 starts first, then Game Server 2 after 25s.
              <br />
              <strong style={{ color: 'var(--toa-bone)' }}>Stop / Start</strong> buttons on each server card manually control individual servers. These require the admin PIN.
              <br />
              <strong style={{ color: 'var(--toa-bone)' }}>Auto-Monitor</strong> runs via Task Scheduler every 1 minute and auto-restarts crashed servers. Login server crash triggers full restart.
              <br />
              <strong style={{ color: 'var(--toa-bone)' }}>Pause Monitor</strong> creates a pause file so the scheduled task skips checking. Remember to resume after maintenance.
              <br />
              <strong style={{ color: 'var(--toa-bone)' }}>Admin PIN</strong> is required for all server control actions (stop, start, restart). Set or change it via <code style={{ color: 'var(--toa-gold-bright)' }}>servers\set-pin.ps1</code>.
            </div>
          </div>
        </div>

        {/* PIN MODAL */}
        {pinModal?.open && (
          <div
            onClick={cancelPin}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.7)', zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toa-seal-card"
              style={{
                padding: '2rem', maxWidth: '400px', width: '90%',
                position: 'relative', textAlign: 'center',
              }}
            >
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <Lock size={28} style={{ color: 'var(--toa-gold-bright)', marginBottom: '1rem' }} />
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem' }}>
                Admin PIN Required
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--toa-muted)', marginBottom: '1.5rem' }}>
                Enter your admin PIN to: <strong style={{ color: 'var(--toa-bone)' }}>{pinModal.label}</strong>
              </div>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') submitPin(); if (e.key === 'Escape') cancelPin(); }}
                autoFocus
                placeholder="Enter PIN"
                style={{
                  width: '100%', padding: '0.75rem 1rem', marginBottom: '1rem',
                  background: 'rgba(0,0,0,0.3)', border: `1px solid ${pinError ? 'var(--toa-danger)' : 'rgba(184,155,94,0.3)'}`,
                  borderRadius: '4px', color: 'var(--toa-bone)', fontSize: '1rem',
                  fontFamily: 'var(--toa-font-display)', textAlign: 'center', letterSpacing: '0.3em',
                  outline: 'none',
                }}
              />
              {pinError && (
                <div style={{ fontSize: '0.8rem', color: 'var(--toa-danger)', marginBottom: '1rem' }}>
                  Invalid PIN. Please try again.
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={cancelPin}
                  className="toa-btn toa-btn-ghost"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitPin}
                  disabled={!pinInput}
                  className="toa-btn"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem', background: 'var(--toa-gold)', borderColor: 'var(--toa-gold)', color: '#1a1a1a' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </GlobalTheme>
  );
}
