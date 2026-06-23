'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Plus, Pencil, Trash2, Save, Search, RefreshCw, Archive, RefreshCcw, X, Copy, Check } from 'lucide-react';

interface Package {
  PackageID: number;
  UsdAmount: number;
  Label: string;
  SortOrder: number;
  IsActive: boolean;
}

interface BonusTier {
  tierId: number;
  tierNumber: number;
  threshold: number;
  rate: number;
  isActive: boolean;
}

interface PricingConfig {
  coinBaseRate: number;
  bonusTiers: BonusTier[];
  bonusTier1Threshold: number;
  bonusTier1Rate: number;
  bonusTier2Threshold: number;
  bonusTier2Rate: number;
  bonusTier3Threshold: number;
  bonusTier3Rate: number;
  paymentMinUsd: number;
  paymongoMinPhp: number;
  paypalMinUsd: number;
  cryptoMinUsd: number;
  coinRatePaymongo: number;
  coinRatePaypal: number;
  coinRateCrypto: number;
  coinRateGcash: number;
  gcashEnabled: boolean;
  paymongoEnabled: boolean;
  paypalEnabled: boolean;
  cryptoEnabled: boolean;
}

interface Stats {
  totalTransactions: number;
  completed: number;
  pending: number;
  cancelled: number;
  refunded: number;
  totalRevenue: number;
  netRevenue: number;
  totalRevenuePhp: number;
  totalCoinsAwarded: number;
  adminActions: number;
}

interface PaymongoHealthEvent {
  action: string;
  details: string;
  timestamp: string;
}

interface PaymongoHealthMetrics {
  updatedAt: string;
  pending: {
    total: number;
    stale10Minutes: number;
    stale30Minutes: number;
  };
  last24h: {
    completed: number;
    failed: number;
    cancelled: number;
  };
  reconcile: {
    completed: number;
    errors: number;
  };
  webhook: {
    total: number;
    failed: number;
    signatureErrors: number;
  };
  recentEvents: PaymongoHealthEvent[];
}

type ConfirmModalConfig = {
  title: string;
  message: string;
  onConfirm: (() => Promise<void | boolean> | boolean | void) | null;
  dangerous?: boolean;
};

export default function FinancesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paymongoHealth, setPaymongoHealth] = useState<PaymongoHealthMetrics | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'packages' | 'pricing' | 'credentials' | 'stats' | 'transactions'>('packages');
  const [credConfigs, setCredConfigs] = useState<{ ConfigKey: string; ConfigValue: string; Description?: string }[]>([]);
  const [credSaving, setCredSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [newUsd, setNewUsd] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSort, setNewSort] = useState('0');
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [newTierThreshold, setNewTierThreshold] = useState('');
  const [newTierRate, setNewTierRate] = useState('');
  const [tierSaving, setTierSaving] = useState(false);

  // Transactions state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnFilterStatus, setTxnFilterStatus] = useState('all');
  const [txnSearch, setTxnSearch] = useState('');
  const [txnOffset, setTxnOffset] = useState(0);
  const txnLimit = 50;
  const [archiveRunning, setArchiveRunning] = useState(false);
  const [reconcileRunning, setReconcileRunning] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmModalConfig>({
    title: '',
    message: '',
    onConfirm: null,
    dangerous: false,
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirm = useCallback((config: ConfirmModalConfig) => {
    setConfirmLoading(false);
    setConfirmConfig(() => config);
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setConfirmLoading(false);
    setConfirmConfig(() => ({ title: '', message: '', onConfirm: null, dangerous: false }));
  }, []);

  const executeConfirm = useCallback(async () => {
    const action = confirmConfig.onConfirm;
    if (!action) {
      closeConfirm();
      return;
    }
    try {
      setConfirmLoading(true);
      const result = await Promise.resolve(action());
      if (result === false) {
        setConfirmLoading(false);
        return;
      }
      closeConfirm();
    } catch (err) {
      console.error('Confirm action failed', err);
      setConfirmLoading(false);
    }
  }, [confirmConfig, closeConfirm]);

  const fetchPaymongoHealth = useCallback(async () => {
    setHealthError('');
    try {
      setHealthLoading(true);
      const res = await fetch('/api/admin/paymongo/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPaymongoHealth(data);
      } else {
        let errorMessage = 'Failed to load PayMongo health metrics';
        try {
          const body = await res.json();
          if (body?.error) errorMessage = body.error;
        } catch {
          // ignore parse errors
        }
        setHealthError(errorMessage);
      }
    } catch (err) {
      console.error('Failed to fetch PayMongo health', err);
      setHealthError('Failed to fetch PayMongo health');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pkgRes, priceRes, statsRes] = await Promise.all([
        fetch('/api/admin/finances?type=packages'),
        fetch('/api/admin/finances?type=pricing'),
        fetch('/api/admin/finances?type=stats', { cache: 'no-store' }),
      ]);
      if (pkgRes.ok) {
        const d = await pkgRes.json();
        setPackages(d.packages || []);
      }
      if (priceRes.ok) {
        const d = await priceRes.json();
        setPricing(d);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d);
      }
      await fetchPaymongoHealth();
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchPaymongoHealth]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/finances?type=stats', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setStats(d);
      }
      await fetchPaymongoHealth();
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, [fetchPaymongoHealth]);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('type', 'transactions');
      params.set('limit', String(txnLimit));
      params.set('offset', String(txnOffset));
      if (txnFilterStatus !== 'all') params.set('status', txnFilterStatus);
      if (txnSearch.trim()) params.set('account', txnSearch.trim());
      const res = await fetch('/api/admin/finances?' + params.toString());
      if (res.ok) {
        const d = await res.json();
        setTransactions(d.payments || []);
        setTxnTotal(d.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  }, [txnOffset, txnFilterStatus, txnSearch]);

  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      setIsSuperAdmin(data.isSuperAdmin || false);
      if (!data.isAdmin) {
        router.push('/dashboard');
        return;
      }
      await fetchData();
    } catch {
      router.push('/dashboard');
    }
  }, [router, fetchData]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdmin(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdmin]);

  // Poll for pending PayMongo transactions every 10 seconds when on the transactions tab
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    transactionsRef.current = transactions;
  });

  useEffect(() => {
    if (activeTab !== 'transactions') return;

    const interval = setInterval(() => {
      const hasPending = transactionsRef.current.some((tx) => tx.Status === 'pending' && tx.PaymentMethod === 'PayMongo');
      if (hasPending) {
        void fetchTransactions();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTransactions]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchPaymongoHealth();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchPaymongoHealth]);

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/website-config');
      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data) ? data : (data.configs || []);
        const credKeys = [
          'payment_gcash_enabled', 'payment_paymongo_enabled', 'payment_paypal_enabled', 'payment_crypto_enabled',
          'paymongo_public_key', 'paymongo_secret_key', 'paymongo_webhook_secret',
          'paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'paypal_webhook_id',
          'crypto_wallet_bep20', 'crypto_wallet_base',
          'crypto_custom_rpc_bep20', 'crypto_custom_api_key_bep20',
          'crypto_custom_rpc_base', 'crypto_custom_api_key_base',
          'paymongo_alert_recipients',
        ];
        setCredConfigs(all.filter((c: any) => credKeys.includes(c.ConfigKey)));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveCredentials = async () => {
    setCredSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/website-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: credConfigs }),
      });
      if (res.ok) {
        showMessage('Credentials saved');
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save credentials');
      }
    } catch {
      setError('Network error');
    }
    setCredSaving(false);
  };

  const updateCred = (key: string, value: string) => {
    setCredConfigs(prev => {
      const idx = prev.findIndex(c => c.ConfigKey === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ConfigValue: value };
        return next;
      }
      return [...prev, { ConfigKey: key, ConfigValue: value }];
    });
  };

  const getCred = (key: string): string => {
    return credConfigs.find(c => c.ConfigKey === key)?.ConfigValue || '';
  };

  // Trigger poll immediately when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeTab === 'transactions') {
        void fetchTransactions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeTab, fetchTransactions]);

  const editModalRef = useRef<HTMLInputElement | null>(null);
  const confirmModalRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (editingPkg || confirmOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
    return undefined;
  }, [editingPkg, confirmOpen]);

  useEffect(() => {
    if (editingPkg && editModalRef.current) {
      editModalRef.current.focus();
    }
  }, [editingPkg]);

  useEffect(() => {
    if (confirmOpen && confirmModalRef.current) {
      confirmModalRef.current.focus();
    }
  }, [confirmOpen]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCreatePackage = async () => {
    const usd = parseFloat(newUsd);
    if (!usd || usd <= 0) {
      setError('Enter a valid USD amount');
      return;
    }
    setError('');
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-package',
          usdAmount: usd,
          label: newLabel,
          sortOrder: parseInt(newSort, 10) || 0,
        }),
      });
      if (res.ok) {
        showMessage('Package created');
        setNewUsd('');
        setNewLabel('');
        setNewSort('0');
        await Promise.all([fetchData(), fetchStats()]);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleUpdatePackage = async () => {
    if (!editingPkg) return;
    const usd = parseFloat(String(editingPkg.UsdAmount));
    if (!usd || usd <= 0) {
      setError('Valid USD amount required');
      return;
    }
    setError('');
    setModalError('');
    setModalSaving(true);
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-package',
          packageId: editingPkg.PackageID,
          usdAmount: usd,
          label: editingPkg.Label,
          sortOrder: editingPkg.SortOrder,
          isActive: editingPkg.IsActive,
        }),
      });
      if (res.ok) {
        showMessage('Package updated');
        closeEditingModal();
        await Promise.all([fetchData(), fetchStats()]);
      } else {
        const d = await res.json();
        setModalError(d.error || 'Failed to update package');
      }
    } catch {
      setModalError('Network error while saving');
    } finally {
      setModalSaving(false);
    }
  };

  const handleCancelTransaction = async (transactionId: string) => {
    setError('');
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-transaction', transactionId }),
      });
      if (res.ok) {
        showMessage('Transaction cancelled');
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to cancel');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    setError('');
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-transaction', transactionId }),
      });
      if (res.ok) {
        showMessage('Transaction deleted');
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to delete');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleDeleteAllCancelled = async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-all-cancelled' }),
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(`Deleted ${data.deleted || 0} cancelled transactions`);
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to delete');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleManualArchive = async () => {
    setArchiveRunning(true);
    setError('');
    try {
      const res = await fetch('/api/cron/paymongo-archive', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const failedDetails = (data.details || []).filter((d: any) => !d.success).map((d: any) => d.error).join('; ');
        const msg = `Archive job — processed ${data.processed || 0}, succeeded ${data.succeeded || 0}, failed ${data.failed || 0}` + (failedDetails ? ` | Errors: ${failedDetails}` : '');
        showMessage(msg);
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        setError(data.error || 'Archive job failed');
      }
    } catch {
      setError('Archive job network error');
    } finally {
      setArchiveRunning(false);
    }
  };

  const handleManualReconcile = async () => {
    setReconcileRunning(true);
    setError('');
    try {
      const res = await fetch('/api/cron/paymongo-reconcile', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const errors = (data.details || []).filter((d: any) => d.error).length;
        const msg = `Reconcile job — processed ${data.processed || 0}, completed ${data.completed || 0}, pending ${data.stillPending || 0}` + (errors ? ` | Errors: ${errors}` : '');
        showMessage(msg);
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        setError(data.error || 'Reconcile job failed');
      }
    } catch {
      setError('Reconcile job network error');
    } finally {
      setReconcileRunning(false);
    }
  };

  const handleArchiveTransaction = async (transactionId: string) => {
    setError('');
    try {
      const res = await fetch('/api/cron/paymongo-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const detail = data.details?.[0];
        if (detail?.success) {
          showMessage(`Archived successfully — link ${detail.linkId}`);
          await Promise.all([fetchTransactions(), fetchStats()]);
        } else {
          setError(`Archive failed: ${detail?.error || 'Unknown error'}`);
        }
      } else {
        setError(data.error || 'Archive failed');
      }
    } catch {
      setError('Archive network error');
    }
  };

  const handleDeletePackage = async (packageId: number) => {
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-package', packageId }),
      });
      if (res.ok) {
        showMessage('Package deleted');
        await Promise.all([fetchData(), fetchStats()]);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to delete');
      }
    } catch {
      setError('Network error');
    }
  };

  const confirmDeletePackage = (packageId: number, label: string) => {
    openConfirm({
      title: 'Delete Package',
      message: `Delete the "${label || 'Unnamed'}" package? This action cannot be undone.`,
      dangerous: true,
      onConfirm: () => handleDeletePackage(packageId),
    });
  };

  const confirmCancelTransaction = (transactionId: string) => {
    openConfirm({
      title: 'Cancel Pending Transaction',
      message: 'Cancel this pending transaction? The customer will need to start a new top-up.',
      dangerous: true,
      onConfirm: () => handleCancelTransaction(transactionId),
    });
  };

  const confirmDeleteTransaction = (transactionId: string) => {
    openConfirm({
      title: 'Delete Transaction',
      message: 'Permanently delete this transaction record? This should only be used to clean up test data.',
      dangerous: true,
      onConfirm: () => handleDeleteTransaction(transactionId),
    });
  };

  const confirmDeleteAllCancelled = () => {
    openConfirm({
      title: 'Delete All Cancelled',
      message: 'Permanently delete ALL cancelled transactions? This cannot be undone.',
      dangerous: true,
      onConfirm: () => handleDeleteAllCancelled(),
    });
  };

  const confirmArchiveTransaction = (transactionId: string) => {
    openConfirm({
      title: 'Archive PayMongo Link',
      message: 'Archive this PayMongo link? This will call the PayMongo API and cannot be undone.',
      dangerous: false,
      onConfirm: () => handleArchiveTransaction(transactionId),
    });
  };

  const handleUpdatePricing = async () => {
    if (!pricing) return;
    setError('');
    try {
      const updates: Record<string, string | number> = {
        coin_base_rate: pricing.coinBaseRate,
        payment_min_usd: pricing.paymentMinUsd,
        paymongo_min_php: pricing.paymongoMinPhp,
        paypal_min_usd: pricing.paypalMinUsd,
        crypto_min_usd: pricing.cryptoMinUsd,
        coin_rate_paymongo: pricing.coinRatePaymongo,
        coin_rate_paypal: pricing.coinRatePaypal,
        coin_rate_crypto: pricing.coinRateCrypto,
        coin_rate_gcash: pricing.coinRateGcash,
      };
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-pricing', updates }),
      });
      if (res.ok) {
        showMessage('Pricing updated');
        await fetchData();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to update pricing');
      }
    } catch {
      setError('Network error');
    }
  };

  const updatePricingField = (field: keyof PricingConfig, value: string) => {
    setPricing((prev) => prev ? { ...prev, [field]: parseFloat(value) || 0 } : null);
  };

  const handleCreateTier = async () => {
    const threshold = parseFloat(newTierThreshold);
    const rate = parseInt(newTierRate, 10);
    if (!threshold || threshold <= 0) { setError('Enter a valid threshold'); return; }
    if (!rate || rate < 1) { setError('Enter a valid rate'); return; }
    setTierSaving(true); setError('');
    try {
      const tierNumber = (pricing?.bonusTiers?.length || 0) + 1;
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-tier', tierNumber, threshold, rate }),
      });
      if (res.ok) {
        showMessage('Bonus tier created');
        setNewTierThreshold(''); setNewTierRate('');
        await fetchData();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create tier');
      }
    } catch { setError('Network error'); }
    finally { setTierSaving(false); }
  };

  const handleUpdateTier = async (tierId: number, tierNumber: number, threshold: number, rate: number, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-tier', tierId, tierNumber, threshold, rate, isActive }),
      });
      if (res.ok) { showMessage('Bonus tier updated'); await fetchData(); }
      else { const d = await res.json(); setError(d.error || 'Failed to update tier'); }
    } catch { setError('Network error'); }
  };

  const handleDeleteTier = async (tierId: number) => {
    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-tier', tierId }),
      });
      if (res.ok) { showMessage('Bonus tier deleted'); await fetchData(); }
      else { const d = await res.json(); setError(d.error || 'Failed to delete tier'); }
    } catch { setError('Network error'); }
  };

  const confirmDeleteTier = (tierId: number, tierNumber: number) => {
    openConfirm({
      title: 'Delete Bonus Tier',
      message: `Delete Tier ${tierNumber}? This action cannot be undone.`,
      dangerous: true,
      onConfirm: () => handleDeleteTier(tierId),
    });
  };

  const updateTierField = (tierId: number, field: 'threshold' | 'rate', value: string) => {
    setPricing((prev) => prev ? {
      ...prev,
      bonusTiers: prev.bonusTiers.map(t => t.tierId === tierId ? { ...t, [field]: parseFloat(value) || 0 } : t),
    } : null);
  };

  const closeEditingModal = () => {
    setEditingPkg(null);
    setModalError('');
    setModalSaving(false);
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Finances & Payments" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Finances & Payments" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {message && (
            <div className="toa-msg toa-msg-success">{message}</div>
          )}
          {error && (
            <div className="toa-msg toa-msg-error">{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(184,155,94,0.12)', paddingBottom: '0.5rem' }}>
          {(['packages', 'pricing', 'credentials', 'stats', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'transactions') {
                  void fetchTransactions();
                }
                if (tab === 'stats') {
                  void fetchStats();
                }
                if (tab === 'credentials') {
                  void fetchCredentials();
                }
              }}
              className="toa-btn toa-btn-sm"
              style={{
                borderRadius: '0.375rem 0.375rem 0 0',
                color: activeTab === tab ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--toa-gold)' : '2px solid transparent',
                background: activeTab === tab ? 'rgba(0,0,0,0.2)' : 'transparent',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'packages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>Payment Packages</div>
                <div style={{ color: 'var(--toa-bone)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Create and manage preset top-up packages. Only active packages are shown to users.</div>
              </div>

              <div className="grid gap-4 md:grid-cols-4 items-end">
                <div>
                  <label className="toa-label-field">USD Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newUsd}
                    onChange={(e) => setNewUsd(e.target.value)}
                    placeholder="10.00"
                    className="toa-input"
                  />
                </div>
                <div>
                  <label className="toa-label-field">Label</label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Starter Pack"
                    className="toa-input"
                  />
                </div>
                <div>
                  <label className="toa-label-field">Sort Order</label>
                  <input
                    type="number"
                    value={newSort}
                    onChange={(e) => setNewSort(e.target.value)}
                    className="toa-input"
                  />
                </div>
                <button
                    onClick={handleCreatePackage}
                    className="toa-btn toa-btn-solid toa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus size={13} />&nbsp;Add Package
                  </button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="toa-table">
                  <thead>
                    <tr>
                      <th>Sort</th>
                      <th>USD</th>
                      <th>Label</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.PackageID}>
                        <td style={{ color: 'var(--toa-bone)' }}>{pkg.SortOrder}</td>
                        <td style={{ color: 'var(--toa-bone)' }}>${pkg.UsdAmount}</td>
                        <td style={{ color: 'var(--toa-bone)' }}>{pkg.Label}</td>
                        <td>
                          <span className={`toa-badge ${pkg.IsActive ? 'toa-badge-success' : 'toa-badge-muted'}`}>
                            {pkg.IsActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setModalError('');
                                setModalSaving(false);
                                setEditingPkg({ ...pkg });
                              }}
                              className="toa-btn toa-btn-ghost toa-btn-xs"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Pencil size={11} />&nbsp;Edit
                            </button>
                            <button
                              onClick={() => confirmDeletePackage(pkg.PackageID, pkg.Label)}
                              className="toa-btn toa-btn-ghost toa-btn-xs"
                              style={{ color: 'var(--toa-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Trash2 size={11} />&nbsp;Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'pricing' && pricing && (
          <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>Pricing Configuration</div>
              <div style={{ color: 'var(--toa-bone)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Edit coin rates, bonus tiers, and minimum payment amounts.</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Coin Base Rate (coins / $1)', field: 'coinBaseRate' as const, step: 1 },
                { label: 'GCash (Manual) Minimum Payment (USD)', field: 'paymentMinUsd' as const, step: 0.01 },
                { label: 'PayMongo Minimum (PHP)', field: 'paymongoMinPhp' as const, step: 0.01 },
                { label: 'PayPal Minimum (USD)', field: 'paypalMinUsd' as const, step: 0.01 },
                { label: 'Crypto Minimum (USD)', field: 'cryptoMinUsd' as const, step: 0.01 },
              ].map((item) => (
                <div key={item.field}>
                  <label className="toa-label-field">{item.label}</label>
                  <input
                    type="number"
                    min={0}
                    step={item.step}
                    value={pricing[item.field]}
                    onChange={(e) => updatePricingField(item.field, e.target.value)}
                    className="toa-input"
                  />
                </div>
              ))}
            </div>

            {/* Bonus Tiers Dynamic Editor */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)' }}>Bonus Tiers</div>
                  <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Higher top-up amounts unlock better coin rates. Add, edit, or remove tiers.</div>
                </div>
              </div>

              {/* Existing tiers */}
              {(pricing.bonusTiers || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {(pricing.bonusTiers || []).map((tier) => (
                    <div key={tier.tierId} className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label className="toa-label-field" style={{ fontSize: '0.7rem' }}>Tier #</label>
                        <div style={{ fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '1.1rem', fontFamily: 'var(--toa-font-display)', padding: '0.4rem 0.6rem', background: 'rgba(184,155,94,0.08)', borderRadius: '4px', minWidth: '2.5rem', textAlign: 'center' }}>{tier.tierNumber}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label className="toa-label-field" style={{ fontSize: '0.7rem' }}>Threshold ($)</label>
                        <input type="number" min={0} step={1} value={tier.threshold} onChange={(e) => updateTierField(tier.tierId, 'threshold', e.target.value)} className="toa-input" style={{ width: '7rem' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label className="toa-label-field" style={{ fontSize: '0.7rem' }}>Rate (coins/$1)</label>
                        <input type="number" min={0} step={1} value={tier.rate} onChange={(e) => updateTierField(tier.tierId, 'rate', e.target.value)} className="toa-input" style={{ width: '7rem' }} />
                      </div>
                      <button onClick={() => handleUpdateTier(tier.tierId, tier.tierNumber, tier.threshold, tier.rate, tier.isActive)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Save size={12} />&nbsp;Save
                      </button>
                      <button onClick={() => confirmDeleteTier(tier.tierId, tier.tierNumber)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Trash2 size={12} />&nbsp;Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new tier */}
              <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', border: '1px dashed rgba(184,155,94,0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label className="toa-label-field" style={{ fontSize: '0.7rem' }}>New Tier Threshold ($)</label>
                  <input type="number" min={0} step={1} value={newTierThreshold} onChange={(e) => setNewTierThreshold(e.target.value)} placeholder="e.g. 100" className="toa-input" style={{ width: '7rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label className="toa-label-field" style={{ fontSize: '0.7rem' }}>New Tier Rate (coins/$1)</label>
                  <input type="number" min={0} step={1} value={newTierRate} onChange={(e) => setNewTierRate(e.target.value)} placeholder="e.g. 160" className="toa-input" style={{ width: '7rem' }} />
                </div>
                <button onClick={handleCreateTier} disabled={tierSaving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: tierSaving ? 0.5 : 1 }}>
                  <Plus size={12} />&nbsp;Add Tier
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)', marginBottom: '0.75rem' }}>Payment-Method Coin Rates</div>
              <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Override the base coin rate per payment method. Leave as base rate if no special rate is needed.</div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'PayMongo Rate (coins / $1)', field: 'coinRatePaymongo' as const },
                  { label: 'PayPal Rate (coins / $1)', field: 'coinRatePaypal' as const },
                  { label: 'Crypto Rate (coins / $1)', field: 'coinRateCrypto' as const },
                  { label: 'GCash Rate (coins / $1)', field: 'coinRateGcash' as const },
                ].map((item) => (
                  <div key={item.field}>
                    <label className="toa-label-field">{item.label}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={pricing[item.field]}
                      onChange={(e) => updatePricingField(item.field, e.target.value)}
                      className="toa-input"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleUpdatePricing}
              className="toa-btn toa-btn-solid toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', alignSelf: 'flex-start' }}
            >
              <Save size={13} />&nbsp;Save Pricing
            </button>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
            <div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>Payment Gateway Credentials</div>
              <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Enable or disable payment methods, then configure their API keys and wallet addresses below. Disabled methods are hidden from the topup page.</div>
            </div>

            {/* Payment Method Toggles */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Payment Methods</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'payment_gcash_enabled', label: 'GCash QR Code', desc: 'Manual GCash scan-to-pay' },
                  { key: 'payment_paymongo_enabled', label: 'PayMongo', desc: 'Credit card / GCash e-wallet' },
                  { key: 'payment_paypal_enabled', label: 'PayPal', desc: 'PayPal checkout' },
                  { key: 'payment_crypto_enabled', label: 'USDT Crypto', desc: 'BEP20 & Base network' },
                ].map((method) => {
                  const enabled = getCred(method.key) === 'true';
                  return (
                    <div key={method.key} className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>{method.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.125rem' }}>{method.desc}</div>
                      </div>
                      <button type="button" onClick={() => updateCred(method.key, enabled ? 'false' : 'true')} style={{ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', background: enabled ? 'var(--toa-success)' : 'rgba(107,101,119,0.4)', flexShrink: 0 }}>
                        <span style={{ display: 'inline-block', height: '1.125rem', width: '1.125rem', borderRadius: '9999px', background: 'white', transition: 'transform 0.2s', transform: enabled ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PayMongo */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>PayMongo Configuration</div>
              <div className="space-y-4">
                <div>
                  <label className="toa-label-field">Public Key</label>
                  <input type="text" value={getCred('paymongo_public_key')} onChange={(e) => updateCred('paymongo_public_key', e.target.value)} placeholder="pk_test_..." className="toa-input" />
                </div>
                <div>
                  <label className="toa-label-field">Secret Key</label>
                  <input type="password" value={getCred('paymongo_secret_key')} onChange={(e) => updateCred('paymongo_secret_key', e.target.value)} placeholder="sk_test_..." className="toa-input" />
                </div>
                <div>
                  <label className="toa-label-field">Webhook Secret</label>
                  <input type="password" value={getCred('paymongo_webhook_secret')} onChange={(e) => updateCred('paymongo_webhook_secret', e.target.value)} placeholder="whsk_..." className="toa-input" />
                  <p className="text-xs text-slate-500 mt-1">Shown in PayMongo dashboard when creating a webhook endpoint.</p>
                </div>
                <div>
                  <label className="toa-label-field">Alert Recipients</label>
                  <textarea value={getCred('paymongo_alert_recipients')} onChange={(e) => updateCred('paymongo_alert_recipients', e.target.value)} placeholder="alerts@taleofasia.com; ops@taleofasia.com" className="toa-textarea" />
                  <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas, semicolons, or new lines.</p>
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>PayPal Configuration</div>
              <div className="space-y-4">
                <div>
                  <label className="toa-label-field">Client ID</label>
                  <input type="text" value={getCred('paypal_client_id')} onChange={(e) => updateCred('paypal_client_id', e.target.value)} placeholder="Abc..." className="toa-input" />
                </div>
                <div>
                  <label className="toa-label-field">Secret</label>
                  <input type="password" value={getCred('paypal_secret')} onChange={(e) => updateCred('paypal_secret', e.target.value)} placeholder="••••••••" className="toa-input" />
                </div>
                <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>Sandbox Mode</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.125rem' }}>Use PayPal sandbox for testing</div>
                  </div>
                  <button type="button" onClick={() => updateCred('paypal_sandbox', getCred('paypal_sandbox') === 'true' ? 'false' : 'true')} style={{ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', background: getCred('paypal_sandbox') === 'true' ? 'var(--toa-success)' : 'rgba(107,101,119,0.4)', flexShrink: 0 }}>
                    <span style={{ display: 'inline-block', height: '1.125rem', width: '1.125rem', borderRadius: '9999px', background: 'white', transition: 'transform 0.2s', transform: getCred('paypal_sandbox') === 'true' ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
                  </button>
                </div>
                <div>
                  <label className="toa-label-field">Webhook ID</label>
                  <input type="text" value={getCred('paypal_webhook_id')} onChange={(e) => updateCred('paypal_webhook_id', e.target.value)} placeholder="1A2B3C..." className="toa-input" />
                  <p className="text-xs text-slate-500 mt-1">Found in PayPal Developer dashboard under webhook details.</p>
                </div>
              </div>
            </div>

            {/* Crypto */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Crypto (USDT) Configuration</div>
              <div className="space-y-4">
                <div>
                  <label className="toa-label-field">BEP20 Wallet Address</label>
                  <input type="text" value={getCred('crypto_wallet_bep20')} onChange={(e) => updateCred('crypto_wallet_bep20', e.target.value)} placeholder="0x..." className="toa-input" />
                  <p className="text-xs text-slate-500 mt-1">Binance Smart Chain (BSC) USDT address</p>
                </div>
                <div>
                  <label className="toa-label-field">Base Wallet Address</label>
                  <input type="text" value={getCred('crypto_wallet_base')} onChange={(e) => updateCred('crypto_wallet_base', e.target.value)} placeholder="0x..." className="toa-input" />
                  <p className="text-xs text-slate-500 mt-1">Coinbase Base network USDT address</p>
                </div>
                <div style={{ borderTop: '1px solid rgba(107,101,119,0.2)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--toa-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>BSC (BEP20) RPC Settings</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="toa-label-field">Custom BSC RPC URL</label>
                      <input type="text" value={getCred('crypto_custom_rpc_bep20')} onChange={(e) => updateCred('crypto_custom_rpc_bep20', e.target.value)} placeholder="https://bsc-dataseed.binance.org (default)" className="toa-input" />
                      <p className="text-xs text-slate-500 mt-1">Leave empty to use free public RPC</p>
                    </div>
                    <div>
                      <label className="toa-label-field">BSC API Key</label>
                      <input type="password" value={getCred('crypto_custom_api_key_bep20')} onChange={(e) => updateCred('crypto_custom_api_key_bep20', e.target.value)} placeholder="Optional — appended to custom RPC URL" className="toa-input" />
                      <p className="text-xs text-slate-500 mt-1">e.g. QuickNode, Alchemy, Infura key</p>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(107,101,119,0.2)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--toa-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Base RPC Settings</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="toa-label-field">Custom Base RPC URL</label>
                      <input type="text" value={getCred('crypto_custom_rpc_base')} onChange={(e) => updateCred('crypto_custom_rpc_base', e.target.value)} placeholder="https://mainnet.base.org (default)" className="toa-input" />
                      <p className="text-xs text-slate-500 mt-1">Leave empty to use free public RPC</p>
                    </div>
                    <div>
                      <label className="toa-label-field">Base API Key</label>
                      <input type="password" value={getCred('crypto_custom_api_key_base')} onChange={(e) => updateCred('crypto_custom_api_key_base', e.target.value)} placeholder="Optional — appended to custom RPC URL" className="toa-input" />
                      <p className="text-xs text-slate-500 mt-1">e.g. QuickNode, Alchemy, Infura key</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook Endpoints */}
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Webhook Endpoints</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '1rem' }}>Register these URLs in your payment provider dashboards.</div>
              <div className="space-y-4">
                {[
                  { label: 'PayMongo Webhook URL', path: '/api/payment/paymongo/webhook', note: 'Add in PayMongo Dashboard → Developers → Webhooks' },
                  { label: 'PayPal Webhook URL', path: '/api/payment/paypal/webhook', note: 'Add in PayPal Developer Dashboard → My Apps → Webhooks' },
                ].map(({ label, path, note }) => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
                  const copied = copiedKey === path;
                  return (
                    <div key={path}>
                      <label className="toa-label-field">{label}</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                        <input
                          readOnly
                          value={url}
                          className="toa-input"
                          style={{ cursor: 'default', opacity: 0.85, flex: 1 }}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(url); setCopiedKey(path); setTimeout(() => setCopiedKey(null), 2000); }}
                          className="toa-btn toa-btn-ghost toa-btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}
                          title="Copy to clipboard"
                        >
                          {copied ? <Check size={13} style={{ color: 'var(--toa-success)' }} /> : <Copy size={13} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', marginTop: '0.3rem' }}>{note}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={handleSaveCredentials} disabled={credSaving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', alignSelf: 'flex-start', opacity: credSaving ? 0.5 : 1 }}>
              <Save size={13} />&nbsp;{credSaving ? 'Saving…' : 'Save Credentials'}
            </button>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)' }}>PayMongo Health</div>
                  <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Real-time snapshot of webhook reliability, reconciliation attempts, and outstanding pending payments.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <button
                    onClick={() => void fetchPaymongoHealth()}
                    className="toa-btn toa-btn-ghost toa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: healthLoading ? 0.6 : 1 }}
                    disabled={healthLoading}
                  >
                    {healthLoading ? 'Refreshing…' : <><RefreshCw size={13} />&nbsp;Refresh Health</>}
                  </button>
                  {paymongoHealth?.updatedAt && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
                      Updated {new Date(paymongoHealth.updatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                    </span>
                  )}
                </div>
              </div>

              {healthError && (
                <div className="toa-msg toa-msg-error" style={{ fontSize: '0.8rem' }}>{healthError}</div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(() => {
                  if (!paymongoHealth) {
                    return (
                      <div className="toa-panel" style={{ padding: '1rem', color: 'var(--toa-muted)', fontSize: '0.8rem', gridColumn: '1 / -1' }}>
                        {healthLoading ? 'Loading PayMongo metrics…' : 'No PayMongo telemetry available yet.'}
                      </div>
                    );
                  }

                  const { pending, reconcile, webhook, last24h } = paymongoHealth;
                  const hasCritical = pending.stale30Minutes > 0 || reconcile.errors > 0 || webhook.signatureErrors > 0;
                  const hasWarning = !hasCritical && (pending.stale10Minutes > 0 || webhook.failed > 0);
                  const statusLabel = hasCritical ? 'Action Required' : hasWarning ? 'Warning' : 'Healthy';
                  const statusColor = hasCritical
                    ? 'var(--toa-danger)'
                    : hasWarning
                      ? 'var(--toa-warning)'
                      : 'var(--toa-success)';

                  return (
                    <>
                      <div className="toa-panel" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Overall Status</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: statusColor }}>{statusLabel}</div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
                          {hasCritical && 'Investigate stale transactions or reconciliation errors immediately.'}
                          {hasWarning && !hasCritical && 'Monitor pending queue and webhook reliability closely.'}
                          {!hasCritical && !hasWarning && 'All signals nominal across the last 24 hours.'}
                        </div>
                      </div>

                      <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Pending Queue</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--toa-gold-bright)' }}>{pending.total.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
                          {pending.stale10Minutes} over 10 min • {pending.stale30Minutes} over 30 min
                        </div>
                      </div>

                      <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Reconciliation (24h)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--toa-success)' }}>{reconcile.completed.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: reconcile.errors ? 'var(--toa-danger)' : 'var(--toa-muted)' }}>
                          {reconcile.errors ? `${reconcile.errors} retries reported errors` : 'No reconciliation errors'}
                        </div>
                      </div>

                      <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Webhooks (24h)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--toa-info)' }}>{webhook.total.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: webhook.failed || webhook.signatureErrors ? 'var(--toa-warning)' : 'var(--toa-muted)' }}>
                          {webhook.failed} failures • {webhook.signatureErrors} signature issues
                        </div>
                      </div>

                      <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Last 24h Throughput</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>Completed / Failed / Cancelled</div>
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
                          <span style={{ color: 'var(--toa-success)' }}>{last24h.completed.toLocaleString()}</span>
                          <span style={{ color: 'var(--toa-danger)' }}>{last24h.failed.toLocaleString()}</span>
                          <span style={{ color: 'var(--toa-bone)' }}>{last24h.cancelled.toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {paymongoHealth?.recentEvents?.length ? (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>Recent Events</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '14rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {paymongoHealth.recentEvents.map((event) => (
                      <div key={`${event.timestamp}-${event.action}`} className="toa-panel" style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--toa-muted)' }}>
                          <span>{event.action}</span>
                          <span>{new Date(event.timestamp).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                        </div>
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--toa-bone)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{event.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>
                  {healthLoading ? 'Loading event history…' : 'No recent PayMongo events recorded.'}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Transactions', value: stats.totalTransactions.toLocaleString(), color: 'var(--toa-gold-bright)' },
                { label: 'Completed', value: stats.completed.toLocaleString(), color: 'var(--toa-success)' },
                { label: 'Pending', value: stats.pending.toLocaleString(), color: 'var(--toa-warning)' },
                { label: 'Cancelled', value: stats.cancelled.toLocaleString(), color: 'var(--toa-bone)' },
                { label: 'Refunded', value: stats.refunded.toLocaleString(), color: 'var(--toa-danger)' },
                { label: 'Total Revenue (USD)', value: `$${stats.totalRevenue.toFixed(2)}`, color: 'var(--toa-gold-bright)' },
                { label: 'Net Revenue (USD)', value: `$${stats.netRevenue.toFixed(2)}`, color: 'var(--toa-success)', sub: 'After gateway fees (PayPal fee tracking pending)' },
                { label: 'Total Revenue (PHP est.)', value: `₱${stats.totalRevenuePhp.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: 'var(--toa-info)', sub: 'Estimated via live exchange rate' },
                { label: 'Coins Awarded', value: stats.totalCoinsAwarded.toLocaleString(), color: 'var(--toa-success)' },
                { label: 'Admin Payment Actions', value: stats.adminActions.toLocaleString(), color: 'var(--toa-gold-bright)' },
              ].map((card) => (
                <div key={card.label} className="toa-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>{card.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                  {card.sub && <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>{card.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>All Transactions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={txnFilterStatus}
                onChange={(e) => { setTxnFilterStatus(e.target.value); setTxnOffset(0); void fetchTransactions(); }}
                className="toa-select"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              <input
                type="text"
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setTxnOffset(0); void fetchTransactions(); }}}
                placeholder="Search by username..."
                className="toa-input"
              />
              <button
                onClick={() => { setTxnOffset(0); void fetchTransactions(); }}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Search size={13} />&nbsp;Search
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => void handleManualArchive()}
                  disabled={archiveRunning}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: archiveRunning ? 0.6 : 1 }}
                >
                  <Archive size={13} />&nbsp;{archiveRunning ? 'Archiving...' : 'Run PayMongo Archive Job'}
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => void handleManualReconcile()}
                  disabled={reconcileRunning}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: reconcileRunning ? 0.6 : 1 }}
                >
                  <RefreshCcw size={13} />&nbsp;{reconcileRunning ? 'Reconciling...' : 'Run PayMongo Reconcile Job'}
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => confirmDeleteAllCancelled()}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ color: 'var(--toa-danger)' }}
                >
                  Delete All Cancelled
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="toa-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Archive</th>
                    <th>Actions</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.TransactionID}>
                    <td style={{ color: 'var(--toa-bone)' }}>{new Date(tx.CreatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>{tx.AccountName}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>{tx.PaymentMethod}</td>
                    <td style={{ color: 'var(--toa-bone)' }}>
                      ${tx.UsdAmount?.toFixed(2)} USD
                      {tx.LocalCurrency && tx.LocalCurrency !== 'USD' && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--toa-muted)' }}>({tx.LocalAmount?.toFixed(2)} {tx.LocalCurrency})</span>
                      )}
                    </td>
                    <td>
                      <span className={`toa-badge ${
                        tx.Status === 'completed' ? 'toa-badge-success' :
                        tx.Status === 'pending' ? 'toa-badge-warning' :
                        tx.Status === 'cancelled' ? 'toa-badge-muted' :
                        'toa-badge-danger'
                      }`}>
                        {tx.Status}
                      </span>
                    </td>
                    <td>
                      {tx.PaymentMethod === 'PayMongo' && tx.Status === 'cancelled' ? (
                        <span className={`toa-badge ${tx.Notes && String(tx.Notes).includes('archived=true') ? 'toa-badge-success' : 'toa-badge-warning'}`}>
                          {tx.Notes && String(tx.Notes).includes('archived=true') ? 'Archived' : 'Un-Archived'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--toa-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {tx.Status === 'pending' && (
                          <button
                            onClick={() => confirmCancelTransaction(tx.TransactionID)}
                            className="toa-btn toa-btn-ghost toa-btn-xs"
                            style={{ color: 'var(--toa-danger)' }}
                          >
                            Cancel
                          </button>
                        )}
                        {isSuperAdmin && tx.PaymentMethod === 'PayMongo' && tx.Status === 'cancelled' && !(tx.Notes && String(tx.Notes).includes('archived=true')) && (
                          <button
                            onClick={() => confirmArchiveTransaction(tx.TransactionID)}
                            className="toa-btn toa-btn-ghost toa-btn-xs"
                          >
                            Archive
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => confirmDeleteTransaction(tx.TransactionID)}
                            className="toa-btn toa-btn-ghost toa-btn-xs"
                            style={{ color: 'var(--toa-danger)' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div>ID: <code style={{ color: 'var(--toa-bone)' }}>{tx.TransactionID}</code></div>
                        <div>Gateway: <code style={{ color: 'var(--toa-bone)' }}>{tx.GatewayTransactionID || '—'}</code></div>
                        {(() => {
                          const coins = tx.CoinsAwarded || 0;
                          if (coins > 0) {
                            return <div>Coin Amount: <span style={{ color: 'var(--toa-success)', fontWeight: 600 }}>{coins.toLocaleString()} {coins === 1 ? 'Coin' : 'Coins'}</span></div>;
                          }
                          if (!tx.UsdAmount) return null;
                          const rate = tx.BonusRate || pricing?.coinBaseRate || 120;
                          const expected = Math.floor(tx.UsdAmount * rate);
                          const hasBonus = !!(pricing && tx.BonusRate && tx.BonusRate > pricing.coinBaseRate);
                          return (
                            <div>
                              Coin Amount: <span style={{ color: 'var(--toa-warning)' }}>{expected.toLocaleString()} {expected === 1 ? 'Coin' : 'Coins'}</span>
                              <span style={{ color: 'var(--toa-muted)' }}> ({rate}/$)</span>
                              {hasBonus && <span style={{ color: 'var(--toa-gold)', fontWeight: 700, marginLeft: '0.25rem' }}>+bonus!</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--toa-muted)' }}>
              <div>Showing {transactions.length} of {txnTotal}</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => { setTxnOffset(Math.max(0, txnOffset - txnLimit)); void fetchTransactions(); }}
                  disabled={txnOffset === 0}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ opacity: txnOffset === 0 ? 0.4 : 1 }}
                >
                  Prev
                </button>
                <button
                  onClick={() => { setTxnOffset(txnOffset + txnLimit); void fetchTransactions(); }}
                  disabled={txnOffset + txnLimit >= txnTotal}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ opacity: txnOffset + txnLimit >= txnTotal ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {editingPkg && (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: '1rem' }}
            data-testid="edit-package-modal"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !modalSaving) {
                e.stopPropagation();
                closeEditingModal();
              }
            }}
            tabIndex={-1}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !modalSaving) {
                closeEditingModal();
              }
            }}
          >
            <div
              className="toa-seal-card"
              style={{ maxWidth: '48rem', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>Edit Package</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-bone)', marginTop: '0.25rem' }}>Adjust pricing, label, and availability. Changes apply immediately after saving.</div>
                </div>
                <button
                  onClick={closeEditingModal}
                  className="toa-btn toa-btn-ghost toa-btn-xs"
                  style={{ opacity: modalSaving ? 0.4 : 1, padding: '0.25rem' }}
                  aria-label="Close edit package modal"
                  disabled={modalSaving}
                >
                  <X size={16} />
                </button>
              </div>

              {modalError && (
                <div className="toa-msg toa-msg-error" style={{ fontSize: '0.8rem' }}>{modalError}</div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="toa-label-field">USD Amount</label>
                  <input
                    ref={editModalRef}
                    type="number"
                    min={0}
                    step="0.01"
                    value={editingPkg.UsdAmount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setEditingPkg((prev) => (prev ? { ...prev, UsdAmount: value } : prev));
                    }}
                    className="toa-input"
                  />
                </div>
                <div>
                  <label className="toa-label-field">Label</label>
                  <input
                    type="text"
                    value={editingPkg.Label}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingPkg((prev) => (prev ? { ...prev, Label: value } : prev));
                    }}
                    className="toa-input"
                  />
                </div>
                <div>
                  <label className="toa-label-field">Sort Order</label>
                  <input
                    type="number"
                    value={editingPkg.SortOrder}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10) || 0;
                      setEditingPkg((prev) => (prev ? { ...prev, SortOrder: value } : prev));
                    }}
                    className="toa-input"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--toa-bone)', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingPkg.IsActive}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditingPkg((prev) => (prev ? { ...prev, IsActive: checked } : prev));
                      }}
                      style={{ width: '1rem', height: '1rem' }}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="sm:flex-row sm:justify-end">
                <button
                  onClick={closeEditingModal}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  disabled={modalSaving}
                  aria-label="Cancel editing package"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePackage}
                  disabled={modalSaving}
                  className="toa-btn toa-btn-solid toa-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: modalSaving ? 0.6 : 1 }}
                  aria-label="Save package changes"
                >
                  {modalSaving ? 'Saving...' : <><Save size={13} />&nbsp;Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: '1rem' }}
            data-testid="confirm-action-modal"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !confirmLoading) {
                e.stopPropagation();
                closeConfirm();
              }
            }}
            tabIndex={-1}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !confirmLoading) {
                closeConfirm();
              }
            }}
          >
            <div
              className="toa-seal-card"
              style={{ maxWidth: '36rem', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--toa-gold-bright)' }}>{confirmConfig.title || 'Confirm Action'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-bone)', marginTop: '0.25rem' }}>{confirmConfig.message}</div>
                </div>
                <button
                  onClick={closeConfirm}
                  className="toa-btn toa-btn-ghost toa-btn-xs"
                  style={{ padding: '0.25rem' }}
                  aria-label="Close confirmation dialog"
                  disabled={confirmLoading}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="sm:flex-row sm:justify-end">
                <button
                  ref={confirmModalRef}
                  onClick={closeConfirm}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  disabled={confirmLoading}
                  aria-label="Cancel confirm dialog"
                >
                  Cancel
                </button>
                <button
                  onClick={executeConfirm}
                  disabled={confirmLoading}
                  className={`toa-btn toa-btn-sm ${confirmConfig.dangerous ? 'toa-btn-ghost' : 'toa-btn-solid'}`}
                  style={{ color: confirmConfig.dangerous ? 'var(--toa-danger)' : undefined, opacity: confirmLoading ? 0.6 : 1 }}
                  aria-label="Confirm action"
                >
                  {confirmLoading ? 'Working...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
