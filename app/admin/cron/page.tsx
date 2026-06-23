'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { RefreshCw, Play } from 'lucide-react';

interface CronSchedule {
  raw: string;
  iso: string | null;
  display: string;
}

interface CronResult {
  raw: string;
  code: number | null;
  success: boolean;
  message: string;
}

interface CronTask {
  id: 'payment-reward' | 'paymongo-archive' | 'paymongo-reconcile' | 'paypal-cancel' | 'paypal-reconcile' | 'auto-expire' | 'crypto-verify';
  label: string;
  scheduleType: string;
  status: string;
  nextRun: CronSchedule;
  lastRun: CronSchedule;
  lastResult: CronResult;
  taskToRun: string;
  author: string;
  error: string | null;
}

interface StatusResponse {
  tasks: CronTask[];
  fetchedAt: string;
}

interface MessageState {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function CronMonitoringPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [cronStatus, setCronStatus] = useState<CronTask[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [message, setMessage] = useState<MessageState | null>(null);
  const [runningJob, setRunningJob] = useState<CronTask['id'] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const requireAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check', { cache: 'no-store' });
      if (!res.ok) {
        router.push('/dashboard');
        return;
      }
      const data = await res.json();
      if (!data.isSuperAdmin) {
        router.push('/dashboard');
        return;
      }
      setIsSuperAdmin(true);
    } catch (err) {
      console.error('Admin check failed', err);
      router.push('/dashboard');
    } finally {
      setChecking(false);
    }
  }, [router]);

  const fetchStatus = useCallback(async () => {
    if (!isSuperAdmin) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/cron/status', { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.error || 'Failed to load cron status' });
        return;
      }
      const data = (await res.json()) as StatusResponse;
      setCronStatus(data.tasks);
      setFetchedAt(data.fetchedAt);
    } catch (err) {
      console.error('Cron status fetch error', err);
      setMessage({ type: 'error', text: 'Network error while loading cron status.' });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = window.setTimeout(() => {
        void requireAdmin();
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [status, router, requireAdmin]);

  useEffect(() => {
    if (!checking && isSuperAdmin) {
      const id = window.setTimeout(() => {
        void fetchStatus();
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [checking, isSuperAdmin, fetchStatus]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(id);
  }, [message]);

  const handleRunJob = useCallback(async (id: CronTask['id']) => {
    const jobLabel = cronStatus.find((task) => task.id === id)?.label || 'Job';
    setRunningJob(id);
    try {
      // Trigger the Windows Scheduled Task so that Last Run / Last Result update properly
      const res = await fetch('/api/admin/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setMessage({ type: 'info', text: `${jobLabel} task triggered. Refreshing status in a few seconds...` });
        // Wait for the Windows task to start and complete before refreshing status
        await new Promise((resolve) => setTimeout(resolve, 6000));
        await fetchStatus();
        setMessage({ type: 'success', text: `${jobLabel} status refreshed.` });
      } else {
        setMessage({ type: 'error', text: data.error || `${jobLabel} failed to start.` });
      }
    } catch (err) {
      console.error('Cron run error', err);
      setMessage({ type: 'error', text: 'Network error while triggering job.' });
    } finally {
      setRunningJob(null);
    }
  }, [cronStatus, fetchStatus]);

  const fetchedDisplay = useMemo(() => {
    if (!fetchedAt) return 'Never';
    const d = new Date(fetchedAt);
    if (Number.isNaN(d.getTime())) return fetchedAt;
    return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  }, [fetchedAt]);

  if (status === 'loading' || checking || loading) {
    return (
      <PageShell label="Admin" title="Cron Job Monitor" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <PageShell label="Admin" title="Cron Job Monitor" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--toa-muted)' }}>Live status of scheduled maintenance tasks.</div>
          <button
            onClick={() => void fetchStatus()}
            disabled={refreshing}
            className="toa-btn toa-btn-ghost toa-btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: refreshing ? 0.6 : 1 }}
          >
            {refreshing ? 'Refreshing…' : <><RefreshCw size={13} />&nbsp;Refresh</>}
          </button>
        </div>

        {message && (
          <div className={`toa-msg ${message.type === 'success' ? 'toa-msg-success' : message.type === 'error' ? 'toa-msg-error' : 'toa-msg-info'}`}>
            {message.text}
          </div>
        )}

        <div className="toa-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--toa-muted)' }}>Last refreshed:</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{fetchedDisplay}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {cronStatus.map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '9999px', background: task.lastResult.success ? 'var(--toa-success)' : 'var(--toa-danger)' }} />
                  <span style={{ color: 'var(--toa-bone)' }}>{task.label}: {task.lastResult.success ? 'OK' : 'Check logs'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Task Table ── */}
        <div className="toa-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="toa-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Schedule</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Next Run</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Last Run</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Result</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--toa-muted)', borderBottom: '1px solid rgba(184,155,94,0.15)', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cronStatus.map((task) => (
                <tr key={task.id} style={{ borderBottom: '1px solid rgba(184,155,94,0.08)' }}>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.85rem' }}>{task.label}</div>
                    {task.error && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--toa-danger)', marginTop: '0.25rem' }}>{task.error}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', color: 'var(--toa-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{task.scheduleType || 'Custom'}</td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                    <span className={`toa-badge ${task.status.includes('Ready') || task.status.includes('Running') ? 'toa-badge-success' : 'toa-badge-danger'}`}>{task.status || 'Unknown'}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', color: 'var(--toa-bone)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{task.nextRun.display}</td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', color: 'var(--toa-bone)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{task.lastRun.display}</td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', flexShrink: 0, background: task.lastResult.success ? 'var(--toa-success)' : 'var(--toa-danger)' }} />
                      <span style={{ color: task.lastResult.success ? 'var(--toa-success)' : 'var(--toa-danger)', fontSize: '0.75rem' }}>{task.lastResult.message || 'Unknown'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => void handleRunJob(task.id)}
                      disabled={runningJob === task.id}
                      className="toa-btn toa-btn-solid toa-btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: runningJob === task.id ? 0.6 : 1, marginRight: '0.5rem' }}
                    >
                      {runningJob === task.id ? 'Running…' : <><Play size={12} />&nbsp;Run</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Command Details (collapsible-style rows below table) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {cronStatus.map((task) => (
            <details key={task.id} style={{ background: 'var(--toa-smoke)', border: '1px solid rgba(184,155,94,0.1)' }}>
              <summary style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--toa-muted)', userSelect: 'none' }}>
                {task.label} — Command details
              </summary>
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(184,155,94,0.08)', fontSize: '0.72rem', color: 'var(--toa-muted)' }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--toa-bone)' }}>Command:</span>
                  <span style={{ display: 'block', marginTop: '0.25rem', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--toa-bone)' }}>{task.taskToRun || 'N/A'}</span>
                </div>
                {task.author && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--toa-bone)' }}>Author:</span>
                    <span style={{ marginLeft: '0.5rem', color: 'var(--toa-bone)' }}>{task.author}</span>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
