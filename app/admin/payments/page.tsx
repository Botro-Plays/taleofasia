'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Search } from 'lucide-react';

interface Payment {
  TransactionID: string;
  AccountName: string;
  Amount: number;
  Currency: string;
  UsdAmount: number;
  LocalCurrency: string;
  LocalAmount: number;
  PaymentMethod: string;
  Status: string;
  GatewayTransactionID: string;
  CoinsAwarded: number;
  BonusRate: number;
  ExpiresAt: string;
  Notes: string;
  IPAddress: string;
  CountryCode: string;
  CreatedAt: string;
  CompletedAt: string;
}

export default function AdminPaymentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [accountSearch, setAccountSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (methodFilter && methodFilter !== 'all') params.set('method', methodFilter);
      if (accountSearch) params.set('account', accountSearch);
      const response = await fetch(`/api/admin/payments?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || 'Failed to fetch payments');
        setPayments([]);
        setTotal(0);
      } else {
        setPayments(data.payments || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Network error fetching payments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, accountSearch]);

  const checkAdminAndFetchPayments = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      await fetchPayments();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [router, fetchPayments]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetchPayments(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetchPayments]);

  const handleAction = async (action: 'approve' | 'reject' | 'refund', transactionId: string) => {
    setActionLoading(transactionId);
    setError('');
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, transactionId, notes: action === 'reject' || action === 'refund' ? notes : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Action failed');
      } else {
        setShowNotesFor(null);
        setNotes('');
        await fetchPayments();
      }
    } catch {
      setError('Network error performing action');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed': return 'toa-badge toa-badge-success';
      case 'pending':   return 'toa-badge toa-badge-pending';
      case 'cancelled': return 'toa-badge toa-badge-muted';
      case 'failed':
      case 'rejected':  return 'toa-badge toa-badge-danger';
      case 'refunded':  return 'toa-badge toa-badge-warn';
      default:          return 'toa-badge toa-badge-muted';
    }
  };

  const canAct = (p: Payment) => {
    if (actionLoading) return false;
    if (p.Status === 'completed') return false;
    if (p.Status === 'refunded') return false;
    if (p.Status === 'rejected') return false;
    if (p.Status === 'cancelled') return false;
    return true;
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Payment Management" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Payment Management" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error && <div className="toa-msg toa-msg-error">{error}</div>}

        <div className="toa-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', alignItems: 'flex-end' }}>
            <div>
              <label className="toa-filter-label">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toa-select">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="toa-filter-label">Method</label>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="toa-select">
                <option value="all">All</option>
                <option value="PayMongo">PayMongo</option>
                <option value="PayPal">PayPal</option>
                <option value="Crypto">Crypto</option>
                <option value="GCash">GCash</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '12rem' }}>
              <label className="toa-filter-label">Account</label>
              <input type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search username..." className="toa-input" style={{ width: '100%' }} />
            </div>
            <button onClick={() => void fetchPayments()} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Search size={12} /> Search</button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.75rem' }}>Total: {total} transactions</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="toa-table">
            <thead>
              <tr><th>Transaction ID</th><th>Username</th><th>USD</th><th>Local</th><th>Coins</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <tr key={payment.TransactionID}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={payment.TransactionID}>{payment.TransactionID}</td>
                    <td>{payment.AccountName}</td>
                    <td>${payment.UsdAmount?.toFixed(2) ?? '-'}</td>
                    <td>{payment.LocalAmount?.toFixed(2) ?? payment.Amount} {payment.LocalCurrency || payment.Currency}</td>
                    <td style={{ color: 'var(--toa-success)', fontWeight: 600 }}>{payment.CoinsAwarded?.toLocaleString() ?? '-'}</td>
                    <td>{payment.PaymentMethod}</td>
                    <td><span className={statusBadge(payment.Status)}>{payment.Status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(payment.CreatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                    <td>
                      {canAct(payment) ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                          <button onClick={() => void handleAction('approve', payment.TransactionID)} disabled={actionLoading === payment.TransactionID} className="toa-btn-xs toa-btn-xs-success" style={{ opacity: actionLoading === payment.TransactionID ? 0.5 : 1 }}>Approve</button>
                          <button onClick={() => setShowNotesFor(showNotesFor === payment.TransactionID ? null : payment.TransactionID)} className="toa-btn-xs toa-btn-xs-danger">Reject</button>
                          <button onClick={() => setShowNotesFor(showNotesFor === payment.TransactionID ? null : payment.TransactionID)} className="toa-btn-xs toa-btn-xs-warn">Refund</button>
                        </div>
                      ) : <span style={{ fontSize: '0.68rem', color: 'var(--toa-muted)' }}>No actions</span>}
                      {showNotesFor === payment.TransactionID && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / notes..." className="toa-input" style={{ fontSize: '0.72rem' }} />
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button onClick={() => void handleAction('reject', payment.TransactionID)} disabled={actionLoading === payment.TransactionID} className="toa-btn-xs toa-btn-xs-danger" style={{ opacity: actionLoading === payment.TransactionID ? 0.5 : 1 }}>Confirm Reject</button>
                            <button onClick={() => void handleAction('refund', payment.TransactionID)} disabled={actionLoading === payment.TransactionID} className="toa-btn-xs toa-btn-xs-warn" style={{ opacity: actionLoading === payment.TransactionID ? 0.5 : 1 }}>Confirm Refund</button>
                            <button onClick={() => { setShowNotesFor(null); setNotes(''); }} className="toa-btn-xs toa-btn-xs-muted">Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--toa-muted)' }}>No payment transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
