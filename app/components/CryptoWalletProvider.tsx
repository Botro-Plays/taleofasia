'use client';

import { type ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bsc, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// WalletConnect project ID — should be set via env or WebsiteConfigs
const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';

const config = createConfig({
  chains: [bsc, base],
  connectors: [
    injected(),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            metadata: {
              name: 'Tale of Asia',
              description: 'Top up coins for Tale of Asia',
              url: 'https://taleofasia.com',
              icons: ['https://taleofasia.com/images/taleofasia-logo.png'],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [bsc.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

export function CryptoWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
