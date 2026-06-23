'use client';

import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">
          Chain: {chainId}
        </span>
        <span className="text-sm font-mono text-slate-300">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs px-3 py-1 rounded bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            disabled={status === 'pending'}
            className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {connector.name}
            {status === 'pending' && ' (connecting…)'}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-400">{error.message}</p>
      )}
    </div>
  );
}
