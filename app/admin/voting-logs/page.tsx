'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Search, RotateCcw, Trash2 } from 'lucide-react';

interface VoteLog {
  LogID: number;
  AccountName: string;
  VoteTime: string;
  IPAddress: string;
  RewardClaimed: boolean;
}

export default function AdminVotingLogsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<VoteLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [q, setQ] = useState('');
  const [ip, setIP] = useState('');
  const [account, setAccount] = useState('');
  const [claimed, setClaimed] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [purgeDays, setPurgeDays] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmAction(null);
  };

  const executeConfirm = () => {
    if (confirmAction) confirmAction();
    closeConfirm();
  };

  const fetchLogs = useCallback(async (p: number, ps: number, s: 'newest' | 'oldest') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(ps), sort: s });
      if (q) params.set('q', q);
      if (ip) params.set('ip', ip);
      if (account) params.set('account', account);
      if (claimed) params.set('claimed', claimed);
      const response = await fetch(`/api/admin/voting-logs?${params.toString()}`);
      const data = await response.json();
      setLogs(data.items || []);
      setTotal(data.total || 0);
      setPage(p);
      setPageSize(ps);
      setSort(s);
      setSelected({});
    } catch (error) {
      console.error('Error fetching voting logs:', error);
    } finally {
      setLoading(false);
    }
  }, [q, ip, account, claimed]);

  const checkAdminAndFetchLogs = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      setIsSuperAdmin(!!adminData.isSuperAdmin);
      await fetchLogs(1, pageSize, sort);
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [router, fetchLogs, pageSize, sort]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetchLogs(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetchLogs]);

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Voting Logs" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell label="Admin" title="Voting Logs" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Filters */}
        <div className="toa-panel" style={{ padding: '1rem' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="toa-label-field">Search (account or IP)</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="toa-input" placeholder="keyword" />
            </div>
            <div>
              <label className="toa-label-field">Account</label>
              <input value={account} onChange={(e) => setAccount(e.target.value)} className="toa-input" placeholder="AccountName" />
            </div>
            <div>
              <label className="toa-label-field">IP Address</label>
              <input value={ip} onChange={(e) => setIP(e.target.value)} className="toa-input" placeholder="e.g. 203.0.113.10" />
            </div>
            <div>
              <label className="toa-label-field">Claim Status</label>
              <select value={claimed} onChange={(e) => setClaimed(e.target.value)} className="toa-select">
                <option value="">All</option>
                <option value="0">Unclaimed</option>
                <option value="1">Claimed</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={() => fetchLogs(1, pageSize, sort)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Search size={13} />&nbsp;Search
            </button>
            <button onClick={() => { setQ(''); setIP(''); setAccount(''); setClaimed(''); fetchLogs(1, pageSize, sort); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <RotateCcw size={13} />&nbsp;Reset
            </button>
          </div>
        </div>

        {/* Purge Controls */}
        {isSuperAdmin && (
          <div className="toa-panel" style={{ padding: '1rem', borderColor: 'rgba(220,38,38,0.3)' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-danger)', marginBottom: '0.75rem' }}>Voting Logs Management</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="sm:flex-row sm:items-center">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="number" min={1} value={purgeDays || ''} onChange={(e) => setPurgeDays(Number(e.target.value))} placeholder="Days" className="toa-input" style={{ maxWidth: '7rem' }} />
                <button onClick={() => { if (!purgeDays) return; openConfirm('Purge Older Logs', `Permanently purge voting logs older than ${purgeDays} days? This cannot be undone.`, async () => { await fetch('/api/admin/voting-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge', days: purgeDays }) }); fetchLogs(1, pageSize, sort); }); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Purge Older</button>
              </div>
              <button onClick={() => openConfirm('Purge All Voting Logs', 'Permanently purge ALL voting logs? This cannot be undone.', async () => { await fetch('/api/admin/voting-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge' }) }); fetchLogs(1, pageSize, sort); })} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Purge All</button>
            </div>
          </div>
        )}

        {/* Bulk actions + pagination */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
                  if (!ids.length) return;
                  openConfirm('Delete Selected Logs', `Permanently delete ${ids.length} selected voting log(s)?`, async () => { await fetch('/api/admin/voting-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids }) }); fetchLogs(page, pageSize, sort); });
                }}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={{ color: 'var(--toa-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              ><Trash2 size={13} />&nbsp;Delete Selected</button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Per page:</span>
            <select value={String(pageSize)} onChange={(e) => { const ps = Number(e.target.value); fetchLogs(1, ps, sort); }} className="toa-select" style={{ maxWidth: '5rem' }}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <button disabled={page <= 1} onClick={() => fetchLogs(Math.max(1, page - 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
            <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => fetchLogs(Math.min(totalPages, page + 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="toa-seal-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="w-full overflow-x-auto">
            <table className="toa-table">
              <thead>
                <tr>
                  {isSuperAdmin && <th><input type="checkbox" onChange={(e) => {
                    const checked = e.target.checked; const map: Record<number, boolean> = {};
                    logs.forEach(l => { map[l.LogID] = checked; }); setSelected(map);
                  }} /></th>}
                  <th>Time</th>
                  <th>Account</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  {isSuperAdmin && <th>Manage</th>}
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.LogID}>
                      {isSuperAdmin && (
                        <td><input type="checkbox" checked={!!selected[log.LogID]} onChange={(e) => setSelected((s) => ({ ...s, [log.LogID]: e.target.checked }))} /></td>
                      )}
                      <td style={{ color: 'var(--toa-bone)' }}>{new Date(log.VoteTime).toLocaleString()}</td>
                      <td style={{ color: 'var(--toa-bone)' }}>{log.AccountName}</td>
                      <td style={{ color: 'var(--toa-bone)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.IPAddress}</td>
                      <td>
                        {log.RewardClaimed ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--toa-muted)', background: 'rgba(107,101,119,0.15)', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>Claimed</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--toa-success)', background: 'rgba(34,197,94,0.12)', padding: '0.1rem 0.4rem', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.2)' }}>Unclaimed</span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <button onClick={() => openConfirm('Delete Log', 'Permanently delete this voting log?', async () => { await fetch('/api/admin/voting-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids: [log.LogID] }) }); fetchLogs(page, pageSize, sort); })} className="toa-btn toa-btn-ghost toa-btn-xs" style={{ color: 'var(--toa-danger)' }}>Delete</button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-bone)' }}>
                      No voting logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirm Modal */}
        {confirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={closeConfirm}>
            <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)' }}>{confirmTitle}</div>
              <div style={{ color: 'var(--toa-bone)', fontSize: '0.85rem' }}>{confirmMessage}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button onClick={closeConfirm} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
                <button onClick={executeConfirm} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
