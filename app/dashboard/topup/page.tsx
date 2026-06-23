'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { PageShell } from '@/app/components/PageShell';
import { CryptoWalletPanel } from '@/app/components/CryptoWalletPanel';
import { CryptoWalletProvider } from '@/app/components/CryptoWalletProvider';
import { Globe, X } from 'lucide-react';

type PaymentMethodKey = 'PayMongo' | 'PayPal' | 'Crypto' | 'GCash';

interface Package {
  packageId: number;
  usdAmount: number;
  label: string;
  sortOrder: number;
}

interface PaymentConfig {
  gcashEnabled: boolean;
  paymongoEnabled: boolean;
  paypalEnabled: boolean;
  cryptoEnabled: boolean;
  paymongoPublicKey: string;
  paypalClientId: string;
  paypalSandbox: boolean;
  cryptoWalletBep20: string;
  cryptoWalletBase: string;
  cryptoMinUsd: number;
  coinBaseRate: number;
  bonusTier1Threshold: number;
  bonusTier1Rate: number;
  bonusTier2Threshold: number;
  bonusTier2Rate: number;
  bonusTier3Threshold: number;
  bonusTier3Rate: number;
  paymentMinUsd: number;
  paymongoMinPhp: number;
  paypalMinUsd: number;
  coinRatePaymongo: number;
  coinRatePaypal: number;
  coinRateCrypto: number;
  coinRateGcash: number;
  bonusTiers: { tierNumber: number; threshold: number; rate: number }[];
  packages: Package[];
}

interface Order {
  transactionId: string;
  usdAmount: number;
  localAmount: number;
  localCurrency: string;
  currency: string;
  totalCoins: number;
  bonusCoins: number;
  rate: number;
  expiresAt: string;
  txHash?: string;
  chainId?: string;
}

interface HistoryItem {
  TransactionID: string;
  Amount: number;
  Currency: string;
  UsdAmount: number;
  LocalCurrency?: string;
  LocalAmount?: number;
  PaymentMethod: string;
  Status: string;
  CoinsAwarded: number;
  GatewayTransactionID?: string;
  BonusRate?: number;
  CreatedAt: string;
  CreatedAtLocal?: string;
  ExpiresAt?: string;
  Notes?: string;
  CompletedAtLocal?: string;
}

interface CryptoTicket {
  reference: string;
  wallet: string;
  credits: number;
  network: 'bep20' | 'base';
}

interface LocationInfo {
  countryCode: string;
  currency: string;
  usdToLocalRate: number;
  oneUsdInLocal: number;
  detectedIp?: string;
  timezone?: string | null;
  timezoneHint?: string | null;
}

const methodDefinitions: Record<PaymentMethodKey, { label: string; description: string; gradient: string; border: string }> = {
  PayMongo: {
    label: 'PayMongo',
    description: 'Credit/Debit & GCash e-wallet',
    gradient: 'from-indigo-600 to-indigo-700',
    border: 'border-indigo-500',
  },
  PayPal: {
    label: 'PayPal',
    description: 'Global PayPal checkout',
    gradient: 'from-blue-700 to-blue-800',
    border: 'border-blue-600',
  },
  Crypto: {
    label: 'USDT Crypto',
    description: 'BEP20 & Base networks',
    gradient: 'from-emerald-600 to-emerald-700',
    border: 'border-emerald-500',
  },
  GCash: {
    label: 'GCash QR',
    description: 'Manual QR verification',
    gradient: 'from-sky-600 to-sky-700',
    border: 'border-sky-500',
  },
}; // end methodDefinitions

export default function TopUpPage() {
  const { status } = useSession();
  const router = useRouter();
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [step, setStep] = useState<'amount' | 'method' | 'confirm'>('amount');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey | null>(null);
  const [selectedUsd, setSelectedUsd] = useState<number | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cryptoNetwork, setCryptoNetwork] = useState<'bep20' | 'base'>('bep20');
  const [cryptoTicket, setCryptoTicket] = useState<CryptoTicket | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCryptoContinueModal, setShowCryptoContinueModal] = useState(false);
  const [cryptoContinueOrder, setCryptoContinueOrder] = useState<Order | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const timezoneRef = useRef<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [pendingTimers, setPendingTimers] = useState<Record<string, number>>({});
  const [paymentBanner, setPaymentBanner] = useState<{ type: 'success' | 'failed'; method?: string } | null>(null);
  const fetchHistoryRef = useRef<() => Promise<void>>(async () => {});

  // Keep timezoneRef in sync with location API result without triggering re-renders
  useEffect(() => {
    if (location?.timezone) {
      timezoneRef.current = location.timezone;
    }
  }, [location]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/public/config');
      const data = await res.json();
      setPayConfig(data.payments || null);
    } catch {
      setPayConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/user/location?timezone=' + encodeURIComponent(tz));
      const data = await res.json();
      setLocation(data);
    } catch {
      setLocation(null);
    }
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const tz = timezoneRef.current;
      const res = await fetch('/api/user/payments?timezone=' + encodeURIComponent(tz));
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      setHistory(list);

      // Initialize pending timers from the fresh list
      const now = Date.now();
      const timers: Record<string, number> = {};
      for (const tx of list) {
        if (tx.Status === 'pending') {
          const expiresAt = tx.ExpiresAt ? new Date(tx.ExpiresAt).getTime() : new Date(tx.CreatedAt).getTime() + 30 * 60 * 1000;
          const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
          timers[tx.TransactionID] = diff;
        }
      }
      setPendingTimers(timers);
    } catch {
      setHistory([]);
      setPendingTimers({});
    } finally {
      setLoadingHistory(false);
    }
  };
  fetchHistoryRef.current = fetchHistory;

  // Detect ?payment=success or ?payment=failed from redirect back (PayMongo/PayPal)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success' || payment === 'failed') {
      const method = params.get('method') || undefined;
      queueMicrotask(() => {
        setPaymentBanner({ type: payment as 'success' | 'failed', method });
        router.replace('/dashboard/topup', { scroll: false });
        setOrder(null);
        setSelectedMethod(null);
        setSelectedUsd(null);
        setProcessing(false);
        setError('');
        setStep('amount');
        void fetchHistoryRef.current();
      });

      if (payment === 'success') {
        let pollCount = 0;
        const maxPolls = 10;
        const pollInterval = setInterval(async () => {
          pollCount += 1;
          await fetchHistoryRef.current();
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            return;
          }
          setHistory((prev) => {
            const recent = prev.find(
              (tx) => tx.Status === 'pending' && (tx.PaymentMethod === 'PayPal' || tx.PaymentMethod === 'PayMongo')
            );
            if (!recent) {
              clearInterval(pollInterval);
              setPaymentBanner(null);
            }
            return prev;
          });
        }, 3000);
        const t = setTimeout(() => setPaymentBanner(null), 8000);
        return () => { clearTimeout(t); clearInterval(pollInterval); };
      } else {
        const t = setTimeout(() => setPaymentBanner(null), 5000);
        return () => clearTimeout(t);
      }
    }
  }, []);


  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => {
        void fetchConfig();
        void fetchLocation();
        void fetchHistory();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, fetchConfig, fetchLocation]);

  useEffect(() => {
    if (!order) return;
    const expireAt = new Date(order.expiresAt).getTime();
    const tick = () => {
      const diff = expireAt - Date.now();
      if (diff <= 0) {
        setTimeLeft(0);
        // Don't auto-reset crypto orders — user may have submitted a blockchain tx
        // that is still confirming. Backend cron handles actual expiry.
        if (selectedMethod !== 'Crypto') {
          setError('Order expired. Please create a new one.');
          setOrder(null);
          setSelectedMethod(null);
          setCryptoTicket(null);
          setStep('amount');
        }
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order, selectedMethod]);

  // Update countdown timers for all pending transactions every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timers: Record<string, number> = {};
      for (const tx of history) {
        if (tx.Status === 'pending') {
          const expiresAt = tx.ExpiresAt ? new Date(tx.ExpiresAt).getTime() : new Date(tx.CreatedAt).getTime() + 30 * 60 * 1000;
          const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
          timers[tx.TransactionID] = diff;
        }
      }
      setPendingTimers(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, [history]);

  // Update countdown timer for crypto continuation modal
  const [cryptoContinueTimer, setCryptoContinueTimer] = useState(0);
  useEffect(() => {
    if (!showCryptoContinueModal || !cryptoContinueOrder) {
      return;
    }
    const expireAt = new Date(cryptoContinueOrder.expiresAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((expireAt - Date.now()) / 1000));
      setCryptoContinueTimer(diff);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setCryptoContinueTimer(0);
    };
  }, [showCryptoContinueModal, cryptoContinueOrder]);

  // Poll PayMongo payment status every 10 seconds for pending transactions
  const historyRef = useRef(history);

  useEffect(() => { historyRef.current = history; });

  useEffect(() => {
    const interval = setInterval(async () => {
      const pendingPaymongo = historyRef.current.filter((tx) => tx.Status === 'pending' && tx.PaymentMethod === 'PayMongo');
      if (pendingPaymongo.length === 0) return;
      for (const tx of pendingPaymongo) {
        try {
          const res = await fetch('/api/payment/paymongo/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: tx.TransactionID }),
          });
          const data = await res.json();
          if (data.status === 'completed') {
            void fetchHistory();
            return;
          }
          if (data.status !== 'pending') {
            void fetchHistory();
            return;
          }
        } catch {
          // ignore polling errors
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const calcCoins = useCallback(
    (usdAmount: number, paymentMethod?: PaymentMethodKey) => {
      if (!payConfig || usdAmount <= 0) {
        return { total: 0, bonus: 0, rate: payConfig?.coinBaseRate ?? 120 };
      }
      const methodRateKey = paymentMethod
        ? ({ PayMongo: 'coinRatePaymongo', PayPal: 'coinRatePaypal', Crypto: 'coinRateCrypto', GCash: 'coinRateGcash' } as const)[paymentMethod]
        : null;
      const baseRate = (methodRateKey && payConfig[methodRateKey]) || payConfig.coinBaseRate;
      let rate = baseRate;

      // Use dynamic bonusTiers array if available, otherwise fallback to flat fields
      const tiers = (payConfig.bonusTiers && payConfig.bonusTiers.length > 0)
        ? [...payConfig.bonusTiers].sort((a, b) => b.threshold - a.threshold)
        : [
            { tierNumber: 3, threshold: payConfig.bonusTier3Threshold, rate: payConfig.bonusTier3Rate },
            { tierNumber: 2, threshold: payConfig.bonusTier2Threshold, rate: payConfig.bonusTier2Rate },
            { tierNumber: 1, threshold: payConfig.bonusTier1Threshold, rate: payConfig.bonusTier1Rate },
          ];

      for (const tier of tiers) {
        if (usdAmount >= tier.threshold) {
          rate = tier.rate;
          break;
        }
      }

      const total = Math.floor(usdAmount * rate);
      const base = Math.floor(usdAmount * baseRate);
      return { total, bonus: Math.max(0, total - base), rate };
    },
    [payConfig]
  );

  const localDisplay = useCallback((usd: number) => {
    if (!location || location.currency === 'USD') return null;
    const local = Math.round(usd * location.usdToLocalRate * 100) / 100;
    return '≈ ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(local) + ' ' + location.currency;
  }, [location]);

  const handleSelectPackage = (usdAmount: number) => {
    setSelectedUsd(usdAmount);
    setError('');
    setStep('method');
  };

  const handleSelectMethod = async (method: PaymentMethodKey) => {
    if (!payConfig || !selectedUsd) return;
    setProcessing(true);
    setError('');
    setCryptoTicket(null);
    setSelectedMethod(method);
    setStep('confirm');
    setProcessing(false);
  };

  const handleProceed = async () => {
    if (!selectedMethod || !selectedUsd) return;
    setProcessing(true);
    setError('');

    // Step 1: Create the order
    let createdOrder: Order | null = null;
    try {
      const orderRes = await fetch('/api/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usdAmount: selectedUsd,
          paymentMethod: selectedMethod,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData?.error || orderData?.message || 'Failed to create order.');
        setProcessing(false);
        return;
      }
      createdOrder = orderData;
      setOrder(createdOrder);
    } catch {
      setError('Network error creating order.');
      setProcessing(false);
      return;
    }

    // Step 2: Generate gateway link
    try {
      if (selectedMethod === 'PayMongo') {
        const res = await fetch('/api/payment/paymongo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: createdOrder!.transactionId }),
        });
        const data = await res.json();
        if (res.ok && data.checkoutUrl) {
          window.location.assign(data.checkoutUrl);
          return;
        } else {
          setError(data?.message || 'Failed to create PayMongo payment.');
          setOrder(null);
          setProcessing(false);
          return;
        }
      }
      if (selectedMethod === 'PayPal') {
        const res = await fetch('/api/payment/paypal/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: createdOrder!.transactionId }),
        });
        const data = await res.json();
        if (res.ok && data.approvalUrl) {
          window.location.assign(data.approvalUrl);
          return;
        } else {
          setError(data?.message || 'Failed to create PayPal order.');
          setOrder(null);
          setProcessing(false);
          return;
        }
      }
      if (selectedMethod === 'Crypto') {
        const res = await fetch('/api/payment/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: createdOrder!.transactionId, network: cryptoNetwork }),
        });
        const data = await res.json();
        if (res.ok && data.reference) {
          setCryptoTicket({ reference: data.reference, wallet: data.wallet, credits: data.credits, network: data.network });
          try {
            localStorage.setItem('toc_crypto_network_' + createdOrder!.transactionId, cryptoNetwork);
          } catch {
            /* ignore */
          }
          // Immediately open the crypto continuation modal (like non-crypto opens a new tab)
          const orderObj = {
            transactionId: createdOrder!.transactionId,
            usdAmount: createdOrder!.usdAmount,
            localAmount: createdOrder!.localAmount || createdOrder!.usdAmount,
            localCurrency: createdOrder!.localCurrency || 'USD',
            currency: createdOrder!.currency || 'USD',
            totalCoins: createdOrder!.totalCoins,
            bonusCoins: createdOrder!.bonusCoins || 0,
            rate: createdOrder!.rate,
            expiresAt: createdOrder!.expiresAt || '',
          };
          setCryptoContinueOrder(orderObj);
          setShowCryptoContinueModal(true);
        } else {
          setError(data?.message || 'Failed to generate crypto instructions.');
          setOrder(null);
          setProcessing(false);
          return;
        }
      }
      if (selectedMethod === 'GCash') {
        // GCash has no gateway link, just show QR
        setCryptoTicket(null);
      }
    } catch {
      setError('Network error processing payment.');
      setOrder(null);
      setProcessing(false);
      return;
    }

    // Step 3: Refresh history
    await fetchHistory();

    // Step 4: Reset create flow (only for non-redirect methods)
    if (selectedMethod !== 'Crypto') {
      setCryptoTicket(null);
      setCryptoContinueOrder(null);
    }
    setSelectedUsd(null);
    setSelectedMethod(null);
    setStep('amount');
    setOrder(null);
    setTimeLeft(0);
    setProcessing(false);
  };

  const continueTransaction = async (tx: HistoryItem) => {
    setError('');
    try {
      if (tx.PaymentMethod === 'PayMongo') {
        // Try to reuse stored checkout URL from Notes first
        const checkoutMatch = tx.Notes?.match(/checkoutUrl:([^|]+)/);
        if (checkoutMatch && checkoutMatch[1].trim()) {
          window.location.assign(checkoutMatch[1].trim());
          return;
        }
        // Fallback: generate new link
        const res = await fetch('/api/payment/paymongo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: tx.TransactionID }),
        });
        const data = await res.json();
        if (res.ok && data.checkoutUrl) {
          window.location.assign(data.checkoutUrl);
        } else {
          setError(data?.message || 'Failed to get PayMongo link.');
        }
      } else if (tx.PaymentMethod === 'PayPal') {
        // Try to reuse stored approval URL from Notes first
        const approvalMatch = tx.Notes?.match(/approvalUrl:([^|]+)/);
        if (approvalMatch && approvalMatch[1].trim()) {
          window.location.assign(approvalMatch[1].trim());
          return;
        }
        // Fallback: generate new link
        const res = await fetch('/api/payment/paypal/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: tx.TransactionID }),
        });
        const data = await res.json();
        if (res.ok && data.approvalUrl) {
          window.location.assign(data.approvalUrl);
        } else {
          setError(data?.message || 'Failed to get PayPal link.');
        }
      } else if (tx.PaymentMethod === 'Crypto') {
        // Read any stored txHash/chainId from localStorage (backward compat with plain string)
        let storedTxHash: string | null = null;
        let storedChainId: number | null = null;
        try {
          const raw = localStorage.getItem('toc_crypto_txhash_' + tx.TransactionID);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed.txHash) {
              storedTxHash = parsed.txHash;
              storedChainId = parsed.chainId ?? null;
            } else {
              storedTxHash = raw;
            }
          }
        } catch {
          /* ignore */
        }

        // Determine which network this transaction was created with
        let storedNetwork: 'bep20' | 'base' = 'bep20';
        try {
          const net = localStorage.getItem('toc_crypto_network_' + tx.TransactionID);
          if (net === 'base' || net === 'bep20') storedNetwork = net;
        } catch {
          /* ignore */
        }

        // Open crypto continuation modal instead of inline
        const res = await fetch('/api/payment/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: tx.TransactionID,
            network: storedNetwork,
            ...(storedTxHash ? { txHash: storedTxHash, chainId: storedChainId ?? 56 } : {}),
          }),
        });
        const data = await res.json();
        if (res.ok && data.reference) {
          setCryptoTicket({ reference: data.reference, wallet: data.wallet, credits: data.credits, network: data.network });
          setCryptoNetwork(data.network || 'bep20');
          // Sync the stored network in localStorage so future Continue clicks are correct
          try {
            localStorage.setItem('toc_crypto_network_' + tx.TransactionID, data.network || 'bep20');
          } catch {
            /* ignore */
          }
          // Build a temporary order for modal display
          const usd = tx.UsdAmount || tx.Amount;
          const orderObj = {
            transactionId: tx.TransactionID,
            usdAmount: usd,
            localAmount: tx.LocalAmount || tx.Amount,
            localCurrency: tx.LocalCurrency || tx.Currency,
            currency: tx.Currency,
            totalCoins: data.credits || 0,
            bonusCoins: 0,
            rate: data.credits ? Math.floor(data.credits / (usd || 1)) : 120,
            expiresAt: tx.ExpiresAt || '',
          };
          setCryptoContinueOrder(orderObj);
          setOrder(orderObj);
          setSelectedMethod('Crypto');
          setSelectedUsd(usd);
          setStep('confirm');

          // If user already submitted a txHash for this transaction, skip to wallet modal
          if (storedTxHash) {
            setShowWalletModal(true);
          } else {
            setShowCryptoContinueModal(true);
          }
        } else if (data?.error?.toLowerCase().includes('not pending')) {
          // Order was already completed/cancelled by another process — just refresh
          void fetchHistory();
        } else {
          setError(data?.error || data?.message || 'Failed to get crypto instructions.');
        }
      } else if (tx.PaymentMethod === 'GCash') {
        // Just show the GCash QR inline
        const usd = tx.UsdAmount || tx.Amount;
        setSelectedUsd(usd);
        setOrder({
          transactionId: tx.TransactionID,
          usdAmount: usd,
          localAmount: tx.LocalAmount || tx.Amount,
          localCurrency: tx.LocalCurrency || tx.Currency,
          currency: tx.Currency,
          totalCoins: tx.CoinsAwarded || 0,
          bonusCoins: 0,
          rate: 120,
          expiresAt: tx.ExpiresAt || '',
        });
        setSelectedMethod('GCash');
        setStep('confirm');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setError('Network error continuing transaction.');
    }
  };

  const resetFlow = (backTo: 'amount' | 'method') => {
    setOrder((prevOrder) => {
      if (prevOrder?.transactionId) {
        try {
          localStorage.removeItem('toc_crypto_txhash_' + prevOrder.transactionId);
          localStorage.removeItem('toc_crypto_network_' + prevOrder.transactionId);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    setSelectedMethod(null);
    setCryptoTicket(null);
    setShowWalletModal(false);
    setShowCryptoContinueModal(false);
    setCryptoContinueOrder(null);
    setProcessing(false);
    setError('');
    setStep(backTo);
    if (backTo === 'amount') {
      setSelectedUsd(null);
    }
    setTimeLeft(0);
  };

  // Memoized crypto wallet callbacks — prevents polling effect restart on every render
  const cryptoTxId = cryptoContinueOrder?.transactionId;
  const handleCryptoTxHash = useCallback((hash: string, chainId: number) => {
    if (!cryptoTxId) return;
    try {
      localStorage.setItem(
        'toc_crypto_txhash_' + cryptoTxId,
        JSON.stringify({ txHash: hash, chainId })
      );
    } catch {
      /* ignore */
    }
  }, [cryptoTxId]);

  const handleCryptoCompleted = useCallback(() => {
    if (cryptoTxId) {
      try {
        localStorage.removeItem('toc_crypto_txhash_' + cryptoTxId);
      } catch {
        /* ignore */
      }
    }
    setShowWalletModal(false);
    setShowCryptoContinueModal(false);
    void fetchHistory();
    resetFlow('amount');
    setError('');
  }, [cryptoTxId]);

  const cryptoInitialTxHash = useMemo(() => {
    if (!cryptoTxId) return undefined;
    try {
      const raw = localStorage.getItem('toc_crypto_txhash_' + cryptoTxId);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' ? parsed.txHash : raw;
    } catch {
      return undefined;
    }
  }, [cryptoTxId]);

  // Lock body scroll when any crypto modal is open
  useEffect(() => {
    const modalOpen = showWalletModal || showCryptoContinueModal;
    if (modalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showWalletModal, showCryptoContinueModal]);

  // Refresh history when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchHistory();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const refreshHistory = () => {
    void fetchHistory();
  };

  // Auto-clean-up: if the currently active order was completed (or cancelled/expired)
  // in the background (e.g. by cron), reset the flow so the user doesn't see stale UI
  useEffect(() => {
    if (!order?.transactionId || step !== 'confirm') return;
    const matchingTx = history.find((tx) => tx.TransactionID === order.transactionId);
    if (!matchingTx || matchingTx.Status === 'pending') return;
    queueMicrotask(() => resetFlow('amount'));
  }, [history, order?.transactionId, step]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + s.toString().padStart(2, '0');
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed': return 'toa-badge toa-badge-success';
      case 'pending':   return 'toa-badge toa-badge-pending';
      case 'expired':   return 'toa-badge toa-badge-muted';
      case 'failed':
      case 'rejected':  return 'toa-badge toa-badge-danger';
      case 'refunded':  return 'toa-badge toa-badge-warn';
      default:          return 'toa-badge toa-badge-muted';
    }
  };

  if (status === 'loading' || loadingConfig) {
    return (
      <PageShell label="Account" title="Top-Up Credits" backHref="/dashboard" backLabel="Dashboard">
        <div className="toa-loading">Loading&hellip;</div>
      </PageShell>
    );
  }

  const methodMinUsd = (key: PaymentMethodKey): { min: number; label: string } => {
    if (!payConfig) return { min: 0, label: '' };
    const general = payConfig.paymentMinUsd;
    switch (key) {
      case 'PayMongo': {
        // PayMongo min is in PHP; convert to USD using location rate
        let phpMinUsd: number;
        if (location?.currency === 'PHP' && location.usdToLocalRate > 0) {
          phpMinUsd = payConfig.paymongoMinPhp / location.usdToLocalRate;
        } else {
          phpMinUsd = payConfig.paymongoMinPhp / 58;
        }
        return { min: phpMinUsd, label: `Min ₱${payConfig.paymongoMinPhp.toFixed(2)} PHP` };
      }
      case 'PayPal': {
        return { min: payConfig.paypalMinUsd, label: `Min $${payConfig.paypalMinUsd.toFixed(2)} USD` };
      }
      case 'Crypto': {
        return { min: payConfig.cryptoMinUsd, label: `Min $${payConfig.cryptoMinUsd.toFixed(2)} USD` };
      }
      case 'GCash':
      default:
        return { min: general, label: `Min $${general.toFixed(2)} USD (GCash)` };
    }
  };

  const methodAvailability: { key: PaymentMethodKey; enabled: boolean; meetsMinimum: boolean; minLabel: string }[] = payConfig
    ? ([
        { key: 'PayMongo' as PaymentMethodKey, enabled: payConfig.paymongoEnabled, ...methodMinUsd('PayMongo') },
        { key: 'PayPal' as PaymentMethodKey, enabled: payConfig.paypalEnabled, ...methodMinUsd('PayPal') },
        { key: 'Crypto' as PaymentMethodKey, enabled: payConfig.cryptoEnabled, ...methodMinUsd('Crypto') },
        { key: 'GCash' as PaymentMethodKey, enabled: payConfig.gcashEnabled, ...methodMinUsd('GCash') },
      ]).map((m) => ({
        key: m.key,
        enabled: m.enabled,
        meetsMinimum: selectedUsd != null && selectedUsd + 1e-6 >= m.min,
        minLabel: m.label,
      })).filter((m) => m.enabled)
    : [];

  const bannerText = location && location.currency !== 'USD'
    ? 'Prices shown in USD. Your local currency: ' + location.currency + ' (1 USD ≈ ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(location.oneUsdInLocal) + ' ' + location.currency + '). PayMongo payments are automatically converted to PHP.'
    : 'Prices shown in USD. PayMongo payments are automatically converted to PHP.';

  return (
    <CryptoWalletProvider>
      <PageShell label="Account" title="Top-Up Credits" backHref="/dashboard" backLabel="Dashboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="toa-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <Globe size={16} style={{ color: 'var(--toa-gold)', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-gold-bright)', marginBottom: '0.25rem' }}>
              {location ? 'Detected Region: ' + location.countryCode : 'Global Payments'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>{bannerText}</div>
          </div>
        </div>

        {history.some((tx) => tx.Status === 'pending' && (pendingTimers[tx.TransactionID] ?? 0) > 0) && (
          <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
            <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Pending Transactions</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', marginBottom: '1.25rem' }}>These orders are still active. You can continue payment.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
              {history.filter((tx) => tx.Status === 'pending' && (pendingTimers[tx.TransactionID] ?? 0) > 0).map((tx) => {
                const timer = pendingTimers[tx.TransactionID] ?? 0;
                const isExpired = timer <= 0;
                return (
                  <div key={tx.TransactionID} className="toa-panel" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', fontFamily: 'monospace' }}>ID: {tx.TransactionID.slice(0, 8).toUpperCase()}</span>
                      <span className={`toa-badge ${isExpired ? 'toa-badge-danger' : 'toa-badge-pending'}`}>
                        {isExpired ? 'Expired' : formatTime(timer)}
                      </span>
                    </div>
                    {[['Method', tx.PaymentMethod], ['Amount', '$' + (tx.UsdAmount || tx.Amount).toFixed(2) + ' USD']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--toa-muted)' }}>{k}</span>
                        <span style={{ color: 'var(--toa-bone)' }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--toa-muted)' }}>Coins</span>
                      <span style={{ color: 'var(--toa-success)', fontWeight: 600 }}>
                        {tx.CoinsAwarded ? tx.CoinsAwarded.toLocaleString() : tx.UsdAmount && tx.BonusRate ? Math.floor(tx.UsdAmount * tx.BonusRate).toLocaleString() : '-'}
                      </span>
                    </div>
                    {!isExpired && (
                      <button onClick={() => void continueTransaction(tx)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}>
                        Continue
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {paymentBanner && (
          <div
            className="toa-panel"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              border: `1px solid ${paymentBanner.type === 'success' ? 'rgba(58,125,68,0.3)' : 'rgba(196,69,69,0.3)'}`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: `2px solid ${paymentBanner.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: paymentBanner.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)',
                fontSize: '0.9rem',
                flexShrink: 0,
              }}
            >
              {paymentBanner.type === 'success'
                ? (history.some((tx) => tx.Status === 'pending' && (tx.PaymentMethod === 'PayPal' || tx.PaymentMethod === 'PayMongo'))
                  ? <span className="animate-spin" style={{ display: 'inline-block', width: '0.8rem', height: '0.8rem', border: '2px solid var(--toa-success)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  : '✓')
                : '✕'}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--toa-font-display)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: paymentBanner.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {paymentBanner.type === 'success'
                  ? (history.some((tx) => tx.Status === 'pending' && (tx.PaymentMethod === 'PayPal' || tx.PaymentMethod === 'PayMongo'))
                    ? 'Verifying Payment'
                    : 'Payment Received')
                  : 'Payment Failed or Cancelled'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.15rem' }}>
                {paymentBanner.type === 'success'
                  ? (history.some((tx) => tx.Status === 'pending' && (tx.PaymentMethod === 'PayPal' || tx.PaymentMethod === 'PayMongo'))
                    ? 'Confirming your payment with PayPal. This usually takes a few seconds.'
                    : paymentBanner.method
                      ? `Your ${paymentBanner.method} payment was confirmed. Coins have been awarded.`
                      : 'Your payment was confirmed. Coins have been awarded.')
                  : 'No charge was made. You can try again.'}
              </div>
            </div>
            <button onClick={() => setPaymentBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem', flexShrink: 0 }}><X size={14} /></button>
          </div>
        )}

        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create a Top-Up Order</div>
            {order && selectedMethod && (
              <span className={`toa-badge ${timeLeft < 300 ? 'toa-badge-danger' : 'toa-badge-pending'}`} style={{ fontFamily: 'monospace' }}>
                {selectedMethod === 'Crypto' && timeLeft === 0 ? 'Expired \u2014 verifying on-chain' : 'Expires in ' + formatTime(timeLeft)}
              </span>
            )}
          </div>

          {error && <div className="toa-msg toa-msg-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

          {step === 'amount' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {history.some((tx) => tx.Status === 'pending' && (pendingTimers[tx.TransactionID] ?? 0) > 0) ? (
                <div className="toa-msg toa-msg-warn">
                  You have pending transactions. Please complete them before creating a new order.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>
                    Select a preset package below. All amounts are in USD. Higher tiers unlock bonus coins!
                  </div>

                  <div className="toa-pkg-grid" style={{ '--pkg-cols': Math.min(Math.ceil((payConfig?.packages?.length || 4) / 2), 4) } as React.CSSProperties}>
                    {(payConfig?.packages || []).map((pkg) => {
                      const coins = calcCoins(pkg.usdAmount);
                      const isSelected = selectedUsd === pkg.usdAmount;
                      const localText = localDisplay(pkg.usdAmount);
                      const isPopular = pkg.usdAmount === 10;
                      return (
                        <button
                          key={pkg.packageId}
                          onClick={() => handleSelectPackage(pkg.usdAmount)}
                          style={{
                            position: 'relative', textAlign: 'left', padding: '1rem',
                            background: isSelected ? 'rgba(184,155,94,0.08)' : 'var(--toa-smoke)',
                            border: `1px solid ${isSelected ? 'var(--toa-gold)' : 'rgba(184,155,94,0.15)'}`,
                            cursor: 'pointer', transition: 'border-color 0.2s ease',
                          }}
                        >
                          {isPopular && (
                            <span className="toa-badge toa-badge-success" style={{ position: 'absolute', top: '-0.5rem', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Popular</span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--toa-gold-bright)', fontFamily: 'var(--toa-font-display)' }}>${pkg.usdAmount}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>USD</span>
                          </div>
                          {pkg.label && <div style={{ fontSize: '0.75rem', color: 'var(--toa-bone)', marginBottom: '0.15rem' }}>{pkg.label}</div>}
                          {localText && <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)' }}>{localText}</div>}
                          <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(184,155,94,0.1)' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--toa-success)' }}>{coins.total.toLocaleString()} coins</div>
                            {coins.bonus > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--toa-success)' }}>+{coins.bonus.toLocaleString()} bonus</div>}
                            <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.15rem' }}>{coins.rate} / $1</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <div style={{ width: '2rem', height: '1px', background: 'rgba(184,155,94,0.3)' }} />
                      <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--toa-gold)', whiteSpace: 'nowrap' }}>Bonus Tier Rates</div>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(184,155,94,0.15)' }} />
                      <span style={{ fontSize: '0.6rem', color: 'var(--toa-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>for reference</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                      {(() => {
                        const tiers = (payConfig?.bonusTiers && payConfig.bonusTiers.length > 0)
                          ? [...payConfig.bonusTiers].sort((a, b) => a.tierNumber - b.tierNumber)
                          : [
                              { tierNumber: 1, threshold: payConfig?.bonusTier1Threshold ?? 10, rate: payConfig?.bonusTier1Rate ?? 130 },
                              { tierNumber: 2, threshold: payConfig?.bonusTier2Threshold ?? 25, rate: payConfig?.bonusTier2Rate ?? 140 },
                              { tierNumber: 3, threshold: payConfig?.bonusTier3Threshold ?? 50, rate: payConfig?.bonusTier3Rate ?? 150 },
                            ];
                        const highestTier = tiers.length > 0 ? tiers[tiers.length - 1].tierNumber : 0;
                        return tiers.map((tier) => {
                          const isHighest = tier.tierNumber === highestTier;
                          return (
                            <div key={tier.tierNumber} style={{
                              padding: '0.875rem 1rem', textAlign: 'center', position: 'relative',
                              background: isHighest ? 'rgba(184,155,94,0.06)' : 'rgba(8,8,12,0.4)',
                              border: `1px ${isHighest ? 'solid' : 'dashed'} ${isHighest ? 'rgba(184,155,94,0.35)' : 'rgba(184,155,94,0.15)'}`,
                              borderRadius: '4px', cursor: 'default', userSelect: 'none',
                            }}>
                              {isHighest && (
                                <span style={{ position: 'absolute', top: '-0.5rem', left: '50%', transform: 'translateX(-50%)', fontSize: '0.58rem', color: 'var(--toa-gold-bright)', background: 'var(--toa-void)', padding: '0 0.4rem', whiteSpace: 'nowrap', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Best Value</span>
                              )}
                              <div style={{ fontSize: '0.6rem', color: 'var(--toa-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Tier {tier.tierNumber}</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--toa-bone)', fontWeight: 600 }}>${tier.threshold}+ USD</div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--toa-gold-bright)', marginTop: '0.3rem', fontFamily: 'var(--toa-font-display)' }}>{tier.rate}<span style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', fontWeight: 400 }}> coins/$1</span></div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'method' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.3rem' }}>Step 2</div>
                <div style={{ fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Select payment method</div>
                {selectedUsd && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>
                    Package: <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>${selectedUsd}</span> USD
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
                {methodAvailability.map(({ key, enabled, meetsMinimum, minLabel }) => {
                  const meta = methodDefinitions[key];
                  const methodCoins = selectedUsd ? calcCoins(selectedUsd, key) : { total: 0, bonus: 0, rate: 0 };
                  const clickable = enabled && meetsMinimum && !processing;
                  return (
                    <button
                      key={key}
                      onClick={() => clickable && void handleSelectMethod(key)}
                      disabled={!clickable}
                      style={{
                        textAlign: 'left', padding: '1.1rem',
                        background: clickable ? 'var(--toa-smoke)' : 'rgba(8,8,12,0.5)',
                        border: '1px solid rgba(184,155,94,0.18)',
                        opacity: clickable ? 1 : 0.4, cursor: clickable ? 'pointer' : 'not-allowed',
                        transition: 'border-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(184,155,94,0.5)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(184,155,94,0.18)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.95rem' }}>{meta.label}</div>
                        {selectedUsd && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--toa-success)', fontSize: '0.95rem' }}>{methodCoins.total.toLocaleString()}</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--toa-muted)' }}>coins</div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>{meta.description}</div>
                      {selectedUsd && methodCoins.bonus > 0 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--toa-success)' }}>+{methodCoins.bonus.toLocaleString()} bonus</div>
                      )}
                      {payConfig && key === 'PayMongo' && <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.3rem' }}>Min &#8369;{payConfig.paymongoMinPhp.toFixed(2)} (auto-converted)</div>}
                      {payConfig && key === 'PayPal'   && <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.3rem' }}>Min ${payConfig.paypalMinUsd.toFixed(2)} USD</div>}
                      {payConfig && key === 'Crypto'   && <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.3rem' }}>Min ${payConfig.cryptoMinUsd.toFixed(2)} USD</div>}
                      {!enabled && <div style={{ fontSize: '0.68rem', color: 'var(--toa-danger)', marginTop: '0.3rem' }}>Disabled by administrators</div>}
                      {enabled && !meetsMinimum && <div style={{ fontSize: '0.68rem', color: 'var(--toa-warning)', marginTop: '0.3rem' }}>Below minimum ({minLabel})</div>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => void resetFlow('amount')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--toa-muted)', textDecoration: 'underline', textAlign: 'left', padding: 0 }}>
                &larr; Back to packages
              </button>
            </div>
          )}

          {step === 'confirm' && selectedMethod && selectedUsd && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {selectedMethod === 'Crypto' && (
                (showWalletModal || showCryptoContinueModal) ||
                history.some((tx) => tx.Status === 'pending' && tx.PaymentMethod === 'Crypto')
              ) ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '1px solid var(--toa-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--toa-success)', fontSize: '1.25rem' }}>&#128274;</div>
                  <div>
                    <div style={{ color: 'var(--toa-success)', fontWeight: 700, marginBottom: '0.4rem' }}>Crypto payment in progress</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', maxWidth: '24rem' }}>Use the wallet modal to complete your transaction.</div>
                  </div>
                  <button onClick={() => resetFlow('amount')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--toa-muted)', textDecoration: 'underline', padding: 0 }}>
                    Cancel and go back
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Review order</div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--toa-muted)' }}>Not yet submitted</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
                    <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[['Amount', '$' + selectedUsd.toFixed(2) + ' USD']].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                          <span style={{ color: 'var(--toa-muted)' }}>{k}</span>
                          <span style={{ color: 'var(--toa-bone)' }}>{v}</span>
                        </div>
                      ))}
                      {selectedMethod === 'PayMongo' && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>Will be converted to PHP at checkout</div>
                      )}
                      {(() => {
                        const preview = calcCoins(selectedUsd, selectedMethod);
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '0.83rem', color: 'var(--toa-muted)' }}>Coins</span>
                              <span style={{ fontWeight: 700, color: 'var(--toa-success)', fontSize: '1rem' }}>
                                {preview.total.toLocaleString()}{preview.bonus > 0 ? ' (+' + preview.bonus.toLocaleString() + ')' : ''}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', textAlign: 'right' }}>{preview.rate} coins / $1 ({selectedMethod})</div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-muted)' }}>Payment method</div>
                      <div style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.95rem' }}>{methodDefinitions[selectedMethod].label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)' }}>{methodDefinitions[selectedMethod].description}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>Orders expire after 30 minutes.</div>
                    </div>

                    {selectedUsd && selectedMethod && (
                      <div className="toa-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid rgba(58,125,68,0.25)' }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-success)' }}>You will receive</div>
                        {(() => {
                          const coins = calcCoins(selectedUsd, selectedMethod);
                          return (
                            <>
                              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--toa-success)', fontFamily: 'var(--toa-font-display)' }}>{coins.total.toLocaleString()}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--toa-success)' }}>coins{coins.bonus > 0 ? ` (+${coins.bonus.toLocaleString()} bonus)` : ''}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)' }}>Rate: {coins.rate} / $1 ({selectedMethod})</div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {selectedMethod === 'GCash' && (
                    <div className="toa-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', textAlign: 'center' }}>Scan this QR code and include your order ID in the note if possible.</div>
                      <Image src="https://taleofasia.com/images/gcash_updated.png" alt="GCash QR Code" width={200} height={200} style={{ border: '1px solid rgba(184,155,94,0.15)' }} />
                      <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', textAlign: 'center' }}>Staff will verify and award your coins once the transaction is confirmed.</div>
                    </div>
                  )}

                  {selectedMethod === 'Crypto' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <div style={{ display: 'flex', gap: '0.625rem' }}>
                        {(['bep20', 'base'] as const).map((net) => (
                          <button key={net} onClick={() => setCryptoNetwork(net)}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                              background: cryptoNetwork === net ? 'rgba(58,125,68,0.15)' : 'transparent',
                              borderColor: cryptoNetwork === net ? 'var(--toa-success)' : 'rgba(184,155,94,0.18)',
                              color: cryptoNetwork === net ? 'var(--toa-success)' : 'var(--toa-muted)',
                            }}>
                            {net === 'bep20' ? 'BEP20 (BSC)' : 'Base'}
                          </button>
                        ))}
                      </div>
                      {cryptoTicket ? (
                        <button onClick={() => setShowWalletModal(true)} className="toa-btn toa-btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                          Connect Wallet &amp; Pay
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Connect your wallet after verifying your order details.</div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    {selectedMethod !== 'GCash' && (
                      <button onClick={() => void handleProceed()} disabled={processing || (selectedMethod === 'Crypto' && !!cryptoTicket)}
                        className="toa-btn toa-btn-solid" style={{ opacity: processing || (selectedMethod === 'Crypto' && !!cryptoTicket) ? 0.5 : 1 }}>
                        {processing ? 'Processing\u2026' : 'Proceed with ' + methodDefinitions[selectedMethod].label}
                      </button>
                    )}
                    <button onClick={() => resetFlow('method')} className="toa-btn toa-btn-ghost toa-btn-sm">Choose another method</button>
                    <button onClick={() => resetFlow('amount')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--toa-muted)', textDecoration: 'underline', padding: 0 }}>Start over</button>
                  </div>

                  {selectedMethod === 'GCash' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>After paying, keep your receipt. Coins are awarded once staff approves the transaction.</div>
                  )}
                </>
              )}

            </div>
          )}

          {showWalletModal && cryptoTicket && cryptoContinueOrder && createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.75)' }}>
              <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', position: 'relative', animation: 'none', transition: 'none', transform: 'none' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pay with Wallet</div>
                  <button onClick={() => setShowWalletModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem' }}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[cryptoNetwork.toUpperCase(), cryptoContinueOrder.usdAmount.toFixed(2) + ' USDT', cryptoContinueOrder.totalCoins.toLocaleString() + ' coins'].map((t) => (
                    <span key={t} className="toa-badge toa-badge-muted">{t}</span>
                  ))}
                </div>
                <CryptoWalletPanel
                  transactionId={cryptoContinueOrder.transactionId}
                  usdAmount={cryptoContinueOrder.usdAmount}
                  coins={cryptoContinueOrder.totalCoins}
                  network={cryptoNetwork}
                  serverWallet={cryptoTicket.wallet}
                  initialTxHash={cryptoInitialTxHash}
                  onTxHash={handleCryptoTxHash}
                  onCompleted={handleCryptoCompleted}
                />
              </div>
            </div>,
            document.body
          )}

          {showCryptoContinueModal && cryptoContinueOrder && cryptoTicket && createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.75)' }}>
              <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', position: 'relative', animation: 'none', transition: 'none', transform: 'none' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pay with USDT Crypto</div>
                  <button onClick={() => resetFlow('amount')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem' }}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <span className={`toa-badge ${cryptoContinueTimer < 300 ? 'toa-badge-danger' : 'toa-badge-pending'}`} style={{ fontFamily: 'monospace', alignSelf: 'flex-start' }}>
                    {cryptoContinueTimer === 0 ? 'Expired \u2014 verifying on-chain' : 'Expires in ' + formatTime(cryptoContinueTimer)}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                    <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {[['Amount', '$' + cryptoContinueOrder.usdAmount.toFixed(2) + ' USD'], ['Rate', cryptoContinueOrder.rate + ' / $1']].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--toa-muted)' }}>{k}</span><span style={{ color: 'var(--toa-bone)' }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--toa-muted)' }}>Coins</span><span style={{ color: 'var(--toa-success)' }}>{cryptoContinueOrder.totalCoins.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-muted)' }}>Method</div>
                      <div style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.9rem' }}>USDT Crypto</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>BEP20 &amp; Base</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['bep20', 'base'] as const).map((net) => (
                      <button key={net} onClick={() => setCryptoNetwork(net)}
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, border: '1px solid', cursor: 'pointer',
                          background: cryptoNetwork === net ? 'rgba(58,125,68,0.15)' : 'transparent',
                          borderColor: cryptoNetwork === net ? 'var(--toa-success)' : 'rgba(184,155,94,0.18)',
                          color: cryptoNetwork === net ? 'var(--toa-success)' : 'var(--toa-muted)',
                        }}>{net === 'bep20' ? 'BEP20 (BSC)' : 'Base'}</button>
                    ))}
                  </div>
                  <button onClick={() => { setShowCryptoContinueModal(false); setShowWalletModal(true); }} className="toa-btn toa-btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                    Connect Wallet &amp; Pay
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transaction History</div>
            <button onClick={refreshHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--toa-muted)', textDecoration: 'underline', padding: 0 }}>Refresh</button>
          </div>

          {loadingHistory ? (
            <div style={{ color: 'var(--toa-muted)', fontSize: '0.82rem' }}>Loading&hellip;</div>
          ) : history.length === 0 ? (
            <div style={{ color: 'var(--toa-muted)', fontSize: '0.82rem' }}>No transactions yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="toa-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Method</th><th>Amount</th><th>Coins</th><th>Status</th><th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => (
                    <tr key={tx.TransactionID}>
                      <td style={{ whiteSpace: 'nowrap' }}>{tx.CreatedAtLocal || new Date(tx.CreatedAt).toLocaleString()}</td>
                      <td>{tx.PaymentMethod}</td>
                      <td>
                        {tx.UsdAmount ? '$' + tx.UsdAmount.toFixed(2) + ' USD' : tx.Amount + ' ' + tx.Currency}
                        {tx.LocalAmount && tx.LocalCurrency && tx.LocalCurrency !== 'USD' && (
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--toa-muted)' }}>({tx.LocalAmount.toFixed(2)} {tx.LocalCurrency})</span>
                        )}
                      </td>
                      <td style={{ color: (tx.Status === 'cancelled' || tx.Status === 'expired') ? 'var(--toa-danger)' : 'var(--toa-success)', fontWeight: 600 }}>
                        {(() => {
                          if (tx.CoinsAwarded) return tx.CoinsAwarded.toLocaleString() + (tx.CoinsAwarded === 1 ? ' Coin' : ' Coins');
                          if (tx.UsdAmount && tx.BonusRate) { const e = Math.floor(tx.UsdAmount * tx.BonusRate); return e.toLocaleString() + (e === 1 ? ' Coin' : ' Coins'); }
                          return '-';
                        })()}
                      </td>
                      <td><span className={statusBadge(tx.Status)}>{tx.Status}</span></td>
                      <td style={{ fontSize: '0.72rem' }}>
                        <div>ID: <code style={{ color: 'var(--toa-bone)' }}>{tx.TransactionID}</code></div>
                        {tx.GatewayTransactionID && <div>Gateway: <code style={{ color: 'var(--toa-bone)' }}>{tx.GatewayTransactionID}</code></div>}
                        {tx.UsdAmount && tx.BonusRate && <div style={{ color: 'var(--toa-muted)' }}>Rate: {tx.BonusRate}/$</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
    </CryptoWalletProvider>
  );
}
