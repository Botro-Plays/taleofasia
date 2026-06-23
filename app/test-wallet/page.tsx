import { ConnectWalletButton } from '@/app/components/ConnectWalletButton';
import { CryptoWalletProvider } from '@/app/components/CryptoWalletProvider';

export default function TestWalletPage() {
  return (
    <CryptoWalletProvider>
      <main className="min-h-screen flex flex-col items-center justify-center p-8 space-y-8">
        <h1 className="text-3xl font-bold text-[var(--color-royal-gold)]">Wallet Connection Test</h1>
        <p className="text-slate-400 text-center max-w-md">
          This page tests the wagmi + viem wallet connection infrastructure.
          Try connecting with MetaMask, Brave Wallet, or WalletConnect.
        </p>
        <div className="p-6 border border-[var(--color-dark-steel)] rounded-lg bg-[var(--color-charcoal)]">
          <ConnectWalletButton />
        </div>
      </main>
    </CryptoWalletProvider>
  );
}
