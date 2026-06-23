'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Search, RotateCcw, Trash2, Eye, EyeOff, Download } from 'lucide-react';

interface AuditLog {
  LogID: number;
  AccountName: string | null;
  Action: string;
  Details: string | null;
  IPAddress: string | null;
  Timestamp: string;
}

export default function AdminLogsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [q, setQ] = useState('');
  const [ip, setIP] = useState('');
  const [who, setWho] = useState('');
  const [action, setAction] = useState('');
  const [details, setDetails] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [purgeDays, setPurgeDays] = useState<number>(0);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [hasIsHidden, setHasIsHidden] = useState<boolean>(false);
  const [minIpCount, setMinIpCount] = useState<number>(0);
  const [minActorCount, setMinActorCount] = useState<number>(0);
  const [rowError, setRowError] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void, dangerous = false) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmDangerous(dangerous);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setConfirmAction(null);
  }, []);

  const executeConfirm = useCallback(() => {
    if (confirmAction) confirmAction();
    closeConfirm();
  }, [confirmAction, closeConfirm]);

  const fetchLogs = useCallback(async (p: number, ps: number, s: 'newest' | 'oldest') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(ps), sort: s });
      if (q) params.set('q', q);
      if (ip) params.set('ip', ip);
      if (who) params.set('user', who);
      const act = action || (filterAction.startsWith('ADMIN_') || ['LOGIN','REGISTER','PASSWORD_RESET_REQUEST','PASSWORD_CHANGE'].includes(filterAction) ? filterAction : '');
      if (act && act !== 'all' && act !== '__admin__' && act !== '__user__') params.set('action', act);
      if (details) params.set('details', details);
      if (isSuperAdmin && showHidden) params.set('showHidden', '1');
      if (minIpCount > 0) params.set('minIpCount', String(minIpCount));
      if (minActorCount > 0) params.set('minActorCount', String(minActorCount));
      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await response.json();
      const items: AuditLog[] = data.items || [];
      const totalCount: number = data.total || 0;
      setHasIsHidden(Boolean((data && data.hasIsHidden) || (Array.isArray(items) && items.some((it: any) => it && typeof it === 'object' && 'IsHidden' in it))));
      const scoped = filterAction === '__admin__' ? items.filter(l => l.Action?.startsWith('ADMIN_')) : filterAction === '__user__' ? items.filter(l => !l.Action?.startsWith('ADMIN_')) : items;
      setLogs(scoped);
      setTotal(totalCount);
      setPage(p);
      setPageSize(ps);
      setSort(s);
      setSelected({});
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [q, ip, who, action, filterAction, details, isSuperAdmin, showHidden, minIpCount, minActorCount]);

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

  const filteredLogs = (() => {
    if (filterAction === 'all') return logs;
    if (filterAction === '__admin__') return logs.filter(log => log.Action?.startsWith('ADMIN_'));
    if (filterAction === '__user__') return logs.filter(log => !log.Action?.startsWith('ADMIN_'));
    return logs.filter(log => log.Action === filterAction);
  })();

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Audit Logs" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Audit Logs" backHref="/admin" backLabel="Admin">
      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Unified Filters Card */}
        <div className="toa-panel" style={{ padding: '1rem' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div>
              <label className="toa-label-field">Search (any field)</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="toa-input" placeholder="keyword" />
            </div>
            <div>
              <label className="toa-label-field">IP</label>
              <input value={ip} onChange={(e) => setIP(e.target.value)} className="toa-input" placeholder="e.g. 203.0.113.10" />
            </div>
            <div>
              <label className="toa-label-field">User</label>
              <input value={who} onChange={(e) => setWho(e.target.value)} className="toa-input" placeholder="AccountName" />
            </div>
            <div>
              <label className="toa-label-field">Action</label>
              <input value={action} onChange={(e) => setAction(e.target.value)} className="toa-input" placeholder="ADMIN_* or user action" />
            </div>
            <div>
              <label className="toa-label-field">Details contains</label>
              <input value={details} onChange={(e) => setDetails(e.target.value)} className="toa-input" placeholder="text" />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="sm:flex-row sm:items-end sm:justify-between">
            <div style={{ flex: 1 }}>
              <label className="toa-label-field">Quick patterns</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <input type="number" min={0} value={minIpCount || ''} onChange={(e) => setMinIpCount(Number(e.target.value))} placeholder="IP repeats ≥ N" className="toa-input" style={{ maxWidth: '10rem' }} />
                <input type="number" min={0} value={minActorCount || ''} onChange={(e) => setMinActorCount(Number(e.target.value))} placeholder="Actor repeats ≥ N" className="toa-input" style={{ maxWidth: '12rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {isSuperAdmin && hasIsHidden && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--toa-bone)', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showHidden} onChange={(e) => { setShowHidden(e.target.checked); fetchLogs(1, pageSize, sort); }} />
                  <span>Show hidden logs</span>
                </label>
              )}
              <button onClick={() => fetchLogs(1, pageSize, sort)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Search size={13} />&nbsp;Search</button>
              <button onClick={() => { setQ(''); setIP(''); setWho(''); setAction(''); setDetails(''); setMinIpCount(0); setMinActorCount(0); setFilterAction('all'); setShowHidden(false); fetchLogs(1, pageSize, sort); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><RotateCcw size={13} />&nbsp;Reset</button>
            </div>
          </div>
        </div>

        {/* Purge Controls (Super Admin) */}
        {isSuperAdmin && (
          <div className="toa-panel" style={{ padding: '1rem', borderColor: 'rgba(220,38,38,0.3)' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-danger)', marginBottom: '0.75rem' }}>Logs Management</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="sm:flex-row sm:items-center">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="number" min={1} value={purgeDays || ''} onChange={(e) => setPurgeDays(Number(e.target.value))} placeholder="Days" className="toa-input" style={{ maxWidth: '7rem' }} />
                <button onClick={() => { if (!purgeDays) return; openConfirm('Purge Older Logs', `Permanently purge logs older than ${purgeDays} days? This cannot be undone.`, async () => { await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge', days: purgeDays }) }); fetchLogs(1, pageSize, sort); }, true); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Purge Older</button>
              </div>
              <button onClick={() => openConfirm('Purge All Logs', 'Permanently purge ALL logs? This cannot be undone.', async () => { await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge' }) }); fetchLogs(1, pageSize, sort); }, true)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Purge All</button>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={async () => {
                  const params = new URLSearchParams({ page: '1', pageSize: String(pageSize), sort });
                  if (q) params.set('q', q); if (ip) params.set('ip', ip); if (who) params.set('user', who);
                  const act = action || (filterAction.startsWith('ADMIN_') || ['LOGIN','REGISTER','PASSWORD_RESET_REQUEST','PASSWORD_CHANGE'].includes(filterAction) ? filterAction : '');
                  if (act && act !== 'all' && act !== '__admin__' && act !== '__user__') params.set('action', act);
                  if (details) params.set('details', details);
                  if (isSuperAdmin && showHidden) params.set('showHidden', '1');
                  if (minIpCount > 0) params.set('minIpCount', String(minIpCount));
                  if (minActorCount > 0) params.set('minActorCount', String(minActorCount));
                  params.set('csv', '1');
                  window.location.href = `/api/admin/logs?${params.toString()}`;
                }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Download size={13} />&nbsp;Export CSV</button>
              </div>
            </div>
          </div>
        )}

        {/* Top toolbar: filters on first row; bulk + pagination on second row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }} className="hidden sm:inline">Sort by:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Scope</span>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); fetchLogs(1, pageSize, sort); }}
                className="toa-select"
              >
                <option value="all">All</option>
                <option value="__admin__">Admin Actions</option>
                <option value="__user__">User Actions</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Specific Action</span>
              <select
                value={filterAction.startsWith('ADMIN_') || ['LOGIN','REGISTER','PASSWORD_RESET_REQUEST','PASSWORD_CHANGE'].includes(filterAction) ? filterAction : 'all'}
                onChange={(e) => { setFilterAction(e.target.value); fetchLogs(1, pageSize, sort); }}
                className="toa-select"
              >
                <option value="all">All</option>
                <option value="LOGIN">Login</option>
                <option value="REGISTER">Register</option>
                <option value="PASSWORD_RESET_REQUEST">Password Reset</option>
                <option value="PASSWORD_CHANGE">Password Change</option>
                <option value="ADMIN_CREDIT">ADMIN_CREDIT</option>
                <option value="ADMIN_BAN">ADMIN_BAN</option>
                <option value="ADMIN_VERIFY">ADMIN_VERIFY</option>
                <option value="ADMIN_PURGE_UNVERIFIED">ADMIN_PURGE_UNVERIFIED</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Order</span>
              <select value={sort} onChange={(e) => { const v = e.target.value as 'newest'|'oldest'; setSort(v); fetchLogs(1, pageSize, v); }} className="toa-select">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => {
                      const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
                      if (!ids.length) return;
                      openConfirm('Delete Selected Logs', `Permanently delete ${ids.length} selected log(s)? This cannot be undone.`, async () => { await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids }) }); fetchLogs(page, pageSize, sort); }, true);
                    }}
                    className="toa-btn toa-btn-ghost toa-btn-sm"
                    style={{ color: 'var(--toa-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  ><Trash2 size={13} />&nbsp;Delete Selected</button>
                  {hasIsHidden && (
                    <>
                      <button onClick={async () => { const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)); if (!ids.length) return; await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hide', ids }) }); fetchLogs(page, pageSize, sort); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><EyeOff size={13} />&nbsp;Hide Selected</button>
                      <button onClick={async () => { const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)); if (!ids.length) return; await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unhide', ids }) }); fetchLogs(page, pageSize, sort); }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Eye size={13} />&nbsp;Unhide Selected</button>
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }} className="hidden sm:inline">Per page:</span>
              <select value={String(pageSize)} onChange={(e) => { const ps = Number(e.target.value); fetchLogs(1, ps, sort); }} className="toa-select" style={{ maxWidth: '5rem' }}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                return (
                  <>
                    <button disabled={page <= 1} onClick={() => fetchLogs(Math.max(1, page - 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                    <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</div>
                    <button disabled={page >= totalPages} onClick={() => fetchLogs(Math.min(totalPages, page + 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="toa-seal-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="w-full overflow-x-auto">
          <table className="toa-table">
            <thead>
              <tr>
                {isSuperAdmin && <th><input type="checkbox" onChange={(e) => {
                  const checked = e.target.checked; const map: Record<number, boolean> = {}; filteredLogs.forEach(l => { map[l.LogID] = checked; }); setSelected(map);
                }} /></th>}
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
                {isSuperAdmin && hasIsHidden && <th>Hidden</th>}
                {isSuperAdmin && <th>Manage</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.LogID}>
                    {isSuperAdmin && (
                      <td><input type="checkbox" checked={!!selected[log.LogID]} onChange={(e) => setSelected((s) => ({ ...s, [log.LogID]: e.target.checked }))} /></td>
                    )}
                    <td style={{ color: 'var(--toa-bone)' }}>{new Date(log.Timestamp).toLocaleString()}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>{log.AccountName || 'N/A'}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>
                      <span>{log.Action}</span>
                      {log.Action?.startsWith('ADMIN_') && (
                        <span className="toa-badge toa-badge-info" style={{ marginLeft: '0.5rem' }}>Admin</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--toa-bone)' }}>{log.Details || 'N/A'}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>{log.IPAddress || 'N/A'}</td>
                    {isSuperAdmin && hasIsHidden && (
                      <td style={{ color: 'var(--toa-bone)' }}>{(((log as any).IsHidden === 1) || ((log as any).IsHidden === true)) ? 'Yes' : 'No'}</td>
                    )}
                    {isSuperAdmin && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {hasIsHidden && (
                          <button
                            onClick={async () => {
                              const currentlyHidden = !!(log as any).IsHidden;
                              const act = currentlyHidden ? 'unhide' : 'hide';
                              const res = await fetch('/api/admin/logs', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: act, ids: [log.LogID] })
                              });
                              if (res.ok) {
                                setLogs((prev: any[]) => prev.map((l: any) => l.LogID === log.LogID ? { ...l, IsHidden: act === 'hide' ? 1 : 0 } : l));
                              } else {
                                const msg = await res.json().catch(() => null);
                                setRowError(msg?.error || 'Failed to update hidden state');
                                setTimeout(() => setRowError(''), 3000);
                              }
                            }}
                            className="toa-btn toa-btn-ghost toa-btn-xs"
                          >
                            {(((log as any).IsHidden === 1) || ((log as any).IsHidden === true)) ? 'Unhide' : 'Hide'}
                          </button>
                          )}
                          <button onClick={() => openConfirm('Delete Log', 'Permanently delete this log?', async () => { await fetch('/api/admin/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids: [log.LogID] }) }); fetchLogs(page, pageSize, sort); }, true)} className="toa-btn toa-btn-ghost toa-btn-xs" style={{ color: 'var(--toa-danger)' }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-bone)' }}>
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }} className="hidden sm:inline">Per page:</span>
            <select value={String(pageSize)} onChange={(e) => { const ps = Number(e.target.value); fetchLogs(1, ps, sort); }} className="toa-select" style={{ maxWidth: '5rem' }}>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
            </select>
            {(() => {
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              return (
                <>
                  <button disabled={page <= 1} onClick={() => fetchLogs(Math.max(1, page - 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                  <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</div>
                  <button disabled={page >= totalPages} onClick={() => fetchLogs(Math.min(totalPages, page + 1), pageSize, sort)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
                </>
              );
            })()}
          </div>

        {rowError && (
          <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 50 }}>
            <div className="toa-msg toa-msg-error" style={{ fontSize: '0.8rem', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>{rowError}</div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={closeConfirm}>
            <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)' }}>{confirmTitle}</div>
              <div style={{ color: 'var(--toa-bone)', fontSize: '0.85rem' }}>{confirmMessage}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button onClick={closeConfirm} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
                <button onClick={executeConfirm} className={`toa-btn toa-btn-sm ${confirmDangerous ? 'toa-btn-ghost' : 'toa-btn-solid'}`} style={confirmDangerous ? { color: 'var(--toa-danger)' } : {}}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </PageShell>
  );
}
