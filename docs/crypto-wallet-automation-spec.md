# Crypto Wallet Payment Automation — Technical Specification

_Last updated: 2026-06-10_

**Status:** Draft / Ready for review  
**Scope:** Replace manual crypto top-up instructions with automated EVM wallet payments (MetaMask, WalletConnect, Brave Wallet, and all EIP-1193 compliant providers).

---

## 1. Goal

Enable users to pay for top-ups directly from their browser/mobile wallet by:
1. Connecting a wallet (MetaMask, WalletConnect, Brave, Coinbase, Trust, Rainbow, etc.)
2. Selecting a network (BEP20 / BSC, Base)
3. Approving and sending a USDT transfer to the server wallet
4. Automatic on-chain confirmation → coin award without admin intervention

---

## 2. Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Browser  │────▶│  Next.js App    │────▶│   SQL Server    │
│  (wagmi + viem) │◄────│  (API Routes)   │◄────│  (Game + Web) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │
        │   EIP-1193 / WCv2      │   BSC/Base RPC
        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│  Wallet Provider│     │  Blockchain RPC │
│ (MetaMask etc.) │     │  (Public Node)  │
└─────────────────┘     └─────────────────┘
```

### Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Wallet SDK | `wagmi` v2 + `viem` | Industry standard for React + EVM. Supports all EIP-1193 providers + WalletConnect v2 out of the box. |
| WalletConnect | `@walletconnect/ethereum-provider` | Required for mobile wallets (Trust, Rainbow, etc.) |
| Blockchain RPC | `viem` `createPublicClient` | Reads chain state, verifies transactions. Fallback RPCs for resilience. |
| Token Standard | ERC-20 (USDT) | Both BSC and Base use standard ERC-20 USDT. |

---

## 3. Supported Wallets

### Tier 1 (Primary)
| Wallet | Type | How It Works |
|--------|------|--------------|
| **MetaMask** | Browser extension / Mobile | Native `window.ethereum` (EIP-1193). Detected automatically. |
| **WalletConnect v2** | QR + Deep links | Universal protocol. Supports 300+ wallets (Trust, Rainbow, Argent, etc.). |
| **Brave Wallet** | Browser built-in | Native `window.ethereum` (EIP-1193). Same as MetaMask from API perspective. |

### Tier 2 (Compatible via same infra)
| Wallet | Notes |
|--------|-------|
| **Coinbase Wallet** | EIP-1193 + WCv2 fallback |
| **Trust Wallet** | WCv2 (mobile) or injected (desktop) |
| **Rabby Wallet** | EIP-1193 injected |
| **Rainbow** | WCv2 |
| **OKX Wallet** | EIP-1193 injected |
| **Phantom (EVM mode)** | EIP-1193 injected |

> **Design principle:** We do not maintain per-wallet code. We use `wagmi` connectors (`injected`, `walletConnect`) which abstract all EIP-1193 providers. Any wallet that speaks EIP-1193 or WalletConnect will work.

---

## 4. User Flow

### Phase A — Wallet Connection (Frontend)

```
1. User selects "Crypto" payment method
2. UI shows "Connect Wallet" button (if not connected)
3. Click opens wallet selection modal:
   ├─ MetaMask (detected if installed)
   ├─ WalletConnect (QR code for mobile)
   ├─ Brave Wallet (detected if installed)
   └─ Other wallets (generic EIP-1193 list)
4. User approves connection in wallet
5. UI displays connected address + network
```

### Phase B — Network & Token Validation (Frontend)

```
6. UI checks wallet's current chain:
   ├─ If BSC (chainId 56) → proceed
   ├─ If Base (chainId 8453) → proceed
   └─ Else → prompt "Switch Network" button
7. User selects BEP20 or Base tab
8. UI validates wallet is on correct chain
9. Display: "You will send X USDT to [server wallet]"
```

### Phase C — Payment Execution (Frontend → On-Chain)

```
10. User clicks "Pay Now"
11. Frontend calls wagmi `writeContract` for USDT transfer:
    ├─ to: server wallet address
    ├─ amount: calculated in token decimals (6 for USDT)
    ├─ token: USDT contract address (chain-specific)
12. Wallet pops up transaction approval
13. User signs and submits
14. Frontend receives transaction hash (txHash)
15. Frontend polls backend: POST /api/payment/crypto/verify { txHash, transactionId }
```

### Phase D — On-Chain Verification (Backend)

```
16. Backend receives txHash + transactionId
17. Backend queries blockchain RPC:
    ├─ Is txHash confirmed? (≥ 1 block confirmation)
    ├─ Is recipient = server wallet?
    ├─ Is token = USDT contract?
    ├─ Is amount ≥ expected amount?
    └─ Is txHash already used? (anti-replay)
18. If valid → mark PaymentTransactions.completed, call awardCoins()
19. If invalid → return specific error (insufficient, wrong recipient, pending, etc.)
20. Frontend shows success / retry UI
```

---

## 5. New API Endpoints

### `POST /api/payment/crypto/verify`
Verifies an on-chain USDT transfer and completes the order.

**Request:**
```json
{
  "transactionId": "<uuid>",
  "txHash": "0xabc...",
  "chainId": 56
}
```

**Response (success):**
```json
{
  "status": "completed",
  "txHash": "0xabc...",
  "coinsAwarded": 14400,
  "confirmations": 3
}
```

**Response (pending):**
```json
{
  "status": "pending",
  "txHash": "0xabc...",
  "confirmations": 0,
  "message": "Waiting for block confirmation"
}
```

**Response (error):**
```json
{
  "status": "failed",
  "reason": "INSUFFICIENT_AMOUNT",
  "expected": "10.00",
  "actual": "5.00"
}
```

### `POST /api/payment/crypto/poll`
Lightweight endpoint for frontend polling without full RPC load.

**Request:**
```json
{
  "transactionId": "<uuid>",
  "txHash": "0xabc..."
}
```

**Response:**
```json
{
  "found": true,
  "confirmations": 2,
  "status": "pending"
}
```

### `GET /api/payment/crypto/config`
Returns chain config for the frontend (contract addresses, RPC URLs, chain IDs).

**Response:**
```json
{
  "networks": {
    "bep20": {
      "chainId": 56,
      "name": "BSC",
      "rpcUrl": "https://bsc-dataseed.binance.org",
      "usdtContract": "0x55d398326f99059fF...",
      "decimals": 6,
      "blockTimeSec": 3
    },
    "base": {
      "chainId": 8453,
      "name": "Base",
      "rpcUrl": "https://mainnet.base.org",
      "usdtContract": "0x...",
      "decimals": 6,
      "blockTimeSec": 2
    }
  }
}
```

---

## 6. Database Changes

### `PaymentTransactions` — add columns
```sql
ALTER TABLE PaymentTransactions ADD (
  ChainId INT NULL,                    -- 56 for BSC, 8453 for Base
  TxHash NVARCHAR(66) NULL,           -- 0x + 64 hex chars
  WalletAddress NVARCHAR(42) NULL,    -- User's connected wallet
  VerificationAttempts INT DEFAULT 0,  -- How many times we polled
  LastVerificationAt DATETIME NULL    -- Last blockchain check
);
CREATE INDEX IX_PaymentTransactions_TxHash ON PaymentTransactions(TxHash);
```

### New table: `CryptoBlockchainConfig`
```sql
CREATE TABLE CryptoBlockchainConfig (
  NetworkKey NVARCHAR(20) PRIMARY KEY,  -- 'bep20', 'base'
  ChainId INT NOT NULL,
  ChainName NVARCHAR(50) NOT NULL,
  RpcUrl NVARCHAR(200) NOT NULL,
  FallbackRpcUrl NVARCHAR(200) NULL,
  UsdtContract NVARCHAR(42) NOT NULL,
  UsdtDecimals INT DEFAULT 6,
  BlockTimeSeconds INT NOT NULL,
  RequiredConfirmations INT DEFAULT 1,
  IsEnabled BIT DEFAULT 1,
  UpdatedAt DATETIME DEFAULT GETDATE()
);
```

---

## 7. Frontend Components Needed

### `CryptoWalletProvider` (wrapper)
- Wraps dashboard with `WagmiProvider` + `QueryClient`
- Configures connectors: `injected` (MetaMask, Brave, etc.), `walletConnect`

### `ConnectWalletButton`
- Detects installed wallets (`window.ethereum?.isMetaMask`, etc.)
- Opens `wagmi` connector selection modal
- Shows connected address (truncated) + network badge

### `NetworkSwitcher`
- Reads current chain from wallet
- If wrong chain → shows "Switch to BSC" or "Switch to Base" button
- Calls `switchChain` from wagmi

### `CryptoPaymentPanel`
- Shows: order amount in USDT, recipient address (copyable), user's USDT balance
- "Pay Now" button → triggers `writeContract` for USDT `transfer`
- Post-submit: shows txHash with block explorer link, polls `/api/payment/crypto/verify`

### `TransactionStatus`
- States: `awaiting_signature` → `submitted` → `confirming` → `verified` → `completed`
- Progress bar with block confirmations
- Error states with retry action

---

## 8. Backend Implementation

### `lib/blockchain/client.ts`
```typescript
import { createPublicClient, http } from 'viem';
import { bsc, base } from 'viem/chains';

const clients = {
  56: createPublicClient({ chain: bsc, transport: http(RPC_URL) }),
  8453: createPublicClient({ chain: base, transport: http(RPC_URL) }),
};

export async function verifyTransfer(
  txHash: string,
  chainId: number,
  expectedRecipient: string,
  expectedAmount: bigint,
  tokenContract: string
): Promise<VerificationResult> { ... }
```

### Verification Logic
1. Fetch transaction receipt by `txHash`
2. Check `status === 'success'` (not reverted)
3. Decode ERC-20 `Transfer` event logs:
   - `from` = user's wallet
   - `to` = expected server wallet
   - `value` ≥ expected amount
4. Check `blockNumber` for confirmations
5. Verify `txHash` not already used in another `PaymentTransactions` row

### Rate Limiting
- `/api/payment/crypto/verify` — 10 req/min per user
- `/api/payment/crypto/poll` — 30 req/min per user

---

## 9. Security Considerations

| Threat | Mitigation |
|--------|------------|
| **Fake txHash** | Backend queries live RPC, does not trust frontend. |
| **Replay attack** (same txHash for multiple orders) | Check `TxHash` uniqueness in `PaymentTransactions`. |
| **Wrong recipient** | Verify `Transfer.to` == configured server wallet. |
| **Wrong token** | Verify contract address matches USDT for the chain. |
| **Insufficient amount** | Verify `Transfer.value` ≥ expected amount (in wei). |
| **Front-running / MEV** | Not applicable; user is sending, not receiving. |
| **Network spoofing** | Backend verifies `chainId` against configured chains only. |
| **Balance manipulation** | Backend reads on-chain state, does not trust client. |
| **Double-spend (same order, two wallets)** | One `PaymentTransactions` row per order; first valid txHash wins. |
| **Phishing / fake wallet** | User education + HTTPS only. We can't prevent users installing fake extensions. |
| **USDT approve + transferFrom** | Simpler to use direct `transfer` from connected wallet. No approval needed. |

### Important Decision: `transfer` vs `approve` + `transferFrom`

| Approach | UX | Security | Implementation |
|----------|----|----------|----------------|
| `transfer` (recommended) | User signs one tx | Standard, simple | User sends directly to server wallet |
| `approve` + `transferFrom` | Two signatures | More complex | Frontend requests allowance, backend pulls funds |

**Recommendation:** Use `transfer`. One signature, no approval management, simpler flow.

---

## 10. Fallback & Error Handling

| Scenario | Behavior |
|----------|----------|
| User submits tx but closes browser | txHash is recorded in `PaymentTransactions`. A cron or next page load can resume polling. |
| RPC is down | Use fallback RPC URL. If both fail, return "verification unavailable, retry later". |
| Transaction reverted | Show error: "Transaction failed on-chain. Please retry." |
| Transaction pending >5 min | Show "Stuck? Check block explorer" with link. |
| User sends wrong token | Verification fails: "Expected USDT, received different token." |
| User sends to wrong address | Funds lost (irreversible). Show clear warnings before signing. |
| User has no wallet installed | Show "Install MetaMask" or "Use WalletConnect" with links. |

---

## 11. Implementation Phases

### Phase 1: Infrastructure (Session 1)
- Install deps: `wagmi`, `viem`, `@walletconnect/ethereum-provider`
- Create `WagmiProvider` wrapper in app layout
- Add `CryptoBlockchainConfig` table + seed data
- Create `/api/payment/crypto/config` endpoint

### Phase 2: Wallet Connection (Session 2)
- Build `ConnectWalletButton` component
- Detect installed wallets
- Handle connection/disconnection
- Display connected address + network

### Phase 3: Network Switching + Payment UI (Session 3)
- Build `NetworkSwitcher` (BSC ↔ Base)
- Build `CryptoPaymentPanel` with USDT amount display
- Integrate `writeContract` for USDT `transfer`
- Handle transaction submission and txHash capture

### Phase 4: Backend Verification (Session 4)
- Create `lib/blockchain/client.ts`
- Implement `verifyTransfer()` logic
- Build `/api/payment/crypto/verify` endpoint
- Add `TxHash` uniqueness + replay protection
- Add database columns

### Phase 5: Polling + Completion (Session 5)
- Frontend polling loop (`/api/payment/crypto/poll`)
- Transaction status UI (submitted → confirming → completed)
- Success state: show coins awarded
- Error state: retry / manual instructions fallback

### Phase 6: Hardening (Session 6)
- Rate limiting on verify/poll
- Fallback RPCs
- Admin dashboard: crypto backlog metrics (pending verifications)
- Cron: retry unverified transactions older than X minutes
- Write runbook + update docs

---

## 12. Dependencies to Add

```json
{
  "dependencies": {
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@walletconnect/ethereum-provider": "^2.11.0"
  }
}
```

> **wagmi v2** requires React 18+ and Next.js app router compatibility. Verify current React version before installing.

---

## 13. Open Questions

1. **Native USDT on Base?** Base uses bridged USDT. Confirm the canonical contract address for Base mainnet.
2. **RPC provider preference?** Public RPCs (Binance, Base) have rate limits. Consider [Alchemy](https://alchemy.com) or [Infura](https://infura.io) for production.
3. **Mobile UX?** WalletConnect deep links can be flaky on iOS Safari. Test thoroughly.
4. **Should we support other tokens?** USDC, BUSD? Start with USDT only.
5. **Gas fees?** Who pays? User pays gas (standard for `transfer`). Display estimated gas cost.
6. **KYC/AML?** Crypto payments may trigger compliance requirements depending on jurisdiction.

---

## 14. Estimated Effort

| Phase | Sessions | Complexity |
|-------|----------|------------|
| 1. Infrastructure | 1 | Low |
| 2. Wallet Connection | 1 | Medium |
| 3. Payment UI | 1 | Medium |
| 4. Backend Verification | 1 | High |
| 5. Polling + Completion | 1 | Medium |
| 6. Hardening | 1 | Medium |
| **Total** | **~6 sessions** | **High** |

---

Ready to proceed? Recommend starting with **Phase 1 (Infrastructure)** if approved.
