'use client';

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';

const MINIMAL_USDT_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  usdtContract: string;
  decimals: number;
  blockTimeSec: number;
  requiredConfirmations: number;
}

interface CryptoWalletPanelProps {
  transactionId: string;
  usdAmount: number;
  coins: number;
  network: 'bep20' | 'base';
  serverWallet: string;
  initialTxHash?: string;
  onTxHash?: (txHash: string, chainId: number) => void;
  onVerifyStatusChange?: (status: string) => void;
  onCompleted?: () => void;
}

export const CryptoWalletPanel = memo(function CryptoWalletPanel({
  transactionId,
  usdAmount,
  coins,
  network,
  serverWallet,
  initialTxHash,
  onTxHash,
  onVerifyStatusChange,
  onCompleted,
}: CryptoWalletPanelProps) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: writeTxHash, error: writeError, isPending: isWritePending } = useWriteContract();
  const txHash = writeTxHash || initialTxHash;
  const reportedTxHashRef = useRef<string | undefined>(undefined);

  const [config, setConfig] = useState<Record<string, NetworkConfig> | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'pending' | 'confirming' | 'completed' | 'failed'>(initialTxHash ? 'confirming' : 'idle');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyDetail, setVerifyDetail] = useState<string | null>(null);
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [forceReverify, setForceReverify] = useState(0);
  const MAX_VERIFY_ATTEMPTS = 60; // 5 minutes at 5s interval

  // Refs for callbacks — prevents polling effect restart on parent re-render
  const onCompletedRef = useRef(onCompleted);
  const onVerifyStatusChangeRef = useRef(onVerifyStatusChange);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onVerifyStatusChangeRef.current = onVerifyStatusChange;
  });

  // Fetch blockchain config once
  useEffect(() => {
    fetch('/api/payment/crypto/config')
      .then((r) => r.json())
      .then((data) => setConfig(data.networks))
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, []);

  const networkConfig = config?.[network];
  const isCorrectChain = !!(networkConfig && chainId === networkConfig.chainId);

  // Fetch USDT balance when connected, on correct chain, and no txHash yet
  useEffect(() => {
    if (!isConnected || !address || !networkConfig || !isCorrectChain || !!txHash) {
      setTimeout(() => setUsdtBalance(null), 0);
      return;
    }
    setTimeout(() => setBalanceLoading(true), 0);
    fetch('/api/payment/crypto/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: networkConfig.chainId,
        token: networkConfig.usdtContract,
        account: address,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.balance !== undefined) {
          setTimeout(() => setUsdtBalance((Number(data.balance) / 10 ** networkConfig.decimals).toFixed(2)), 0);
        }
      })
      .catch(() => setTimeout(() => setUsdtBalance(null), 0))
      .finally(() => setTimeout(() => setBalanceLoading(false), 0));
  }, [isConnected, address, networkConfig, isCorrectChain, network, txHash]);

  const handlePay = useCallback(() => {
    if (!networkConfig || !address || !isCorrectChain) return;
    const amount = parseUnits(usdAmount.toString(), networkConfig.decimals);
    writeContract({
      address: networkConfig.usdtContract as `0x${string}`,
      abi: MINIMAL_USDT_ABI,
      functionName: 'transfer',
      args: [serverWallet as `0x${string}`, amount],
      chainId: networkConfig.chainId,
    });
  }, [networkConfig, address, isCorrectChain, usdAmount, serverWallet, writeContract]);

  // Report new txHash to parent once, and immediately register it in the DB
  // so the cron can pick it up even if the user closes the modal before polling starts
  useEffect(() => {
    if (writeTxHash && writeTxHash !== reportedTxHashRef.current) {
      reportedTxHashRef.current = writeTxHash;
      if (networkConfig) {
        onTxHash?.(writeTxHash, networkConfig.chainId);
        fetch('/api/payment/crypto/register-txhash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            txHash: writeTxHash,
            chainId: networkConfig.chainId,
          }),
        }).catch(() => {
          // Silently ignore — polling will eventually store it anyway
        });
      }
    }
  }, [writeTxHash, onTxHash, transactionId, networkConfig]);

  // Start verification polling when txHash is available and config is loaded
  useEffect(() => {
    if (!txHash || !networkConfig) return;

    let attempts = 0;
    // eslint-disable-next-line prefer-const
    let interval: ReturnType<typeof setInterval>;
    let stopped = false;

    const stopPolling = () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };

    const runVerify = () => {
      if (stopped) return;
      attempts += 1;

      fetch('/api/payment/crypto/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, txHash, chainId: networkConfig?.chainId }),
      })
        .then(async (r) => {
          if (stopped) return;
          const data = await r.json();
          if (!r.ok) {
            // 5xx = temporary server/RPC error; keep retrying
            if (r.status >= 500) {
              setVerifyStatus('confirming');
              setVerifyError(data?.error || `Server error ${r.status}. Retrying…`);
              return;
            }
            setVerifyStatus('failed');
            setVerifyError(data?.error || `HTTP ${r.status}`);
            stopPolling();
            return;
          }
          if (data.status === 'completed') {
            setVerifyStatus('completed');
            setVerifyError(null);
            setVerifyDetail(data.warning || null);
            stopPolling();
            onVerifyStatusChangeRef.current?.('completed');
            onCompletedRef.current?.();
          } else if (data.status === 'failed') {
            setVerifyStatus('failed');
            setVerifyError(data?.error || 'Verification failed');
            stopPolling();
            onVerifyStatusChangeRef.current?.('failed');
          } else {
            setVerifyStatus('confirming');
            setVerifyError(data?.error || null);
            setVerifyDetail(`Confirmations: ${data.confirmations ?? 'unknown'}`);
            onVerifyStatusChangeRef.current?.('confirming');
          }
        })
        .catch((err) => {
          if (stopped) return;
          setVerifyStatus('failed');
          setVerifyError(err?.message || 'Network error contacting verification server');
          stopPolling();
          onVerifyStatusChangeRef.current?.('failed');
        })
        .finally(() => {
          if (attempts >= MAX_VERIFY_ATTEMPTS && !stopped) {
            stopPolling();
            setVerifyStatus('failed');
            setVerifyError('Timed out waiting for blockchain confirmation. You can check status manually below.');
            onVerifyStatusChangeRef.current?.('failed');
          }
        });
    };

    // Verify immediately on mount, then every 5 seconds
    runVerify();
    interval = setInterval(runVerify, 5000);

    return () => stopPolling();
  }, [txHash, transactionId, networkConfig, forceReverify]);

  if (configLoading) {
    return <div className="text-sm text-slate-400">Loading network configuration...</div>;
  }

  if (!networkConfig) {
    return <div className="text-sm text-red-400">Network configuration unavailable.</div>;
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Connect your wallet to pay with USDT</p>
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={connectStatus === 'pending'}
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {connector.name}
              {connectStatus === 'pending' && '…'}
            </button>
          ))}
        </div>
        {connectError && (
          <div className="space-y-2">
            <p className="text-xs text-red-400">{connectError.message}</p>
            <p className="text-xs text-slate-500">No wallet extension detected. Install one to continue:</p>
            <div className="flex flex-wrap gap-2">
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 transition-colors">MetaMask</a>
              <a href="https://rabby.io/" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 transition-colors">Rabby</a>
              <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 transition-colors">Coinbase Wallet</a>
            </div>
          </div>
        )}
        {!connectError && (
          <div className="text-xs text-slate-500">
            Don't have a wallet?{' '}
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">Install MetaMask</a>
          </div>
        )}
      </div>
    );
  }

  // Connected
  return (
    <div className="space-y-4">
      {/* Wallet status bar */}
      <div className="flex items-center justify-between bg-black/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400">● Connected</span>
          <span className="text-sm font-mono text-slate-300">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Disconnect
        </button>
      </div>

      {/* Balance */}
      {usdtBalance !== null && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Your USDT balance</span>
          <span className="text-emerald-300 font-semibold">{usdtBalance} USDT</span>
        </div>
      )}
      {balanceLoading && (
        <div className="text-xs text-slate-500">Checking balance…</div>
      )}

      {/* Wrong network — skip when txHash exists (already paid, just viewing status) */}
      {!isCorrectChain && !txHash && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
          <p className="text-sm text-yellow-200">
            Wallet is on the wrong network. Please switch to <strong>{networkConfig.name}</strong>.
          </p>
          <button
            onClick={() => switchChain?.({ chainId: networkConfig.chainId })}
            className="mt-2 px-3 py-1.5 rounded bg-yellow-700 text-white text-xs font-semibold hover:bg-yellow-600 transition-colors"
          >
            Switch to {networkConfig.name}
          </button>
        </div>
      )}

      {/* Payment panel */}
      {isCorrectChain && !txHash && (
        <div className="space-y-4">
          <div className="bg-black/30 border border-[var(--color-dark-steel)] rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Amount to send</span>
              <span className="text-emerald-300 font-semibold">{usdAmount} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Recipient</span>
              <span className="font-mono text-xs text-slate-300">
                {serverWallet.slice(0, 10)}…{serverWallet.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">You receive</span>
              <span className="text-[var(--color-royal-gold)] font-semibold">{coins.toLocaleString()} coins</span>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={isWritePending || !!txHash}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 transition-all"
          >
            {isWritePending
              ? 'Confirm in your wallet…'
              : `Pay ${usdAmount} USDT`}
          </button>

          {writeError && (
            <p className="text-xs text-red-400">{writeError.message}</p>
          )}
        </div>
      )}

      {/* Transaction submitted */}
      {txHash && (
        <div className={`rounded-lg p-4 space-y-2 border ${
          verifyStatus === 'completed'
            ? 'bg-emerald-900/20 border-emerald-700'
            : verifyStatus === 'failed'
              ? 'bg-red-900/20 border-red-700'
              : 'bg-emerald-900/20 border-emerald-700'
        }`}>
          {/* Status icon */}
          <div className="flex items-center gap-2">
            {verifyStatus === 'completed' && (
              <span className="text-lg">✅</span>
            )}
            {verifyStatus === 'failed' && (
              <span className="text-lg">❌</span>
            )}
            {verifyStatus !== 'completed' && verifyStatus !== 'failed' && (
              <span className="inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            )}
            <p className={`text-xs font-semibold ${
              verifyStatus === 'completed'
                ? 'text-emerald-300'
                : verifyStatus === 'failed'
                  ? 'text-red-300'
                  : 'text-emerald-300'
            }`}>
              {verifyStatus === 'completed'
                ? 'Payment verified! Coins awarded.'
                : verifyStatus === 'failed'
                  ? 'Verification failed.'
                  : verifyStatus === 'confirming'
                    ? `Verifying payment on blockchain… (attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS})`
                    : 'Payment sent! Verifying on blockchain…'}
            </p>
          </div>

          {verifyStatus === 'idle' && (
            <p className="text-xs text-emerald-200">
              Your wallet confirmed the transaction. We're now verifying it on the blockchain and awarding your coins. This usually takes a few seconds.
            </p>
          )}

          {verifyError && (
            <p className="text-xs text-red-400 break-words">{verifyError}</p>
          )}
          {verifyDetail && (
            <p className="text-xs text-slate-400">{verifyDetail}</p>
          )}
          <p className="text-xs font-mono text-slate-400 break-all">{txHash}</p>
          <a
            href={`${network === 'bep20' ? 'https://bscscan.com/tx/' : 'https://basescan.org/tx/'}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            View on explorer →
          </a>
          {verifyStatus === 'failed' && (
            <button
              onClick={() => {
                setVerifyStatus('confirming');
                setVerifyError(null);
                setVerifyAttempts(0);
                setForceReverify((n) => n + 1);
              }}
              className="mt-2 px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              Check status again
            </button>
          )}
          {verifyStatus === 'completed' && (
            <button
              onClick={() => onCompletedRef.current?.()}
              className="mt-2 px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
});
