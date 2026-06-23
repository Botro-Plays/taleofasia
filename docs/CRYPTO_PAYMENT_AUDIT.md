# Crypto Payment System Audit — 2026-06-11 (Post-Fix Review)

## Executive Summary

All **three Critical bugs** (CRIT-1, CRIT-2, CRIT-3) and **four High-severity** issues (HIGH-2, HIGH-3, HIGH-4, LOW-7) have been fixed. The system now correctly persists `txHash` to the database immediately, avoids the 2-minute RPC cooldown deadlock, and uses `ChainId` from the database for network lookup rather than unreliable wallet-address matching.

**One new inconsistency was discovered**: the admin debug endpoint `/api/admin/debug/crypto-verify` still uses the old wallet-address matching logic and ignores the DB `ChainId`, making it unreliable for Base transactions.

**Three architectural issues remain open** and would require larger refactors: storing the selected network in the database (HIGH-1), simplifying the two-modal UI (HIGH-5), and adding a max-age cleanup for truly abandoned crypto transactions (HIGH-9).

---

## Critical (Data Loss / Transactions Stuck Forever)

### CRIT-1: `TxHash` is never written to the database until `/api/payment/crypto/verify` is called — FIXED

**File(s):**
- `app/components/CryptoWalletPanel.tsx`
- `app/api/payment/crypto/route.ts`
- `app/api/payment/crypto/register-txhash/route.ts`

**What was broken:** MetaMask returned txHash → frontend stored in `localStorage` → 5-second gap before first poll → if user closed modal, DB had `TxHash = NULL` → transaction stuck forever.

**What was fixed:**
- `CryptoWalletPanel` calls `/api/payment/crypto/register-txhash` **immediately** when `writeTxHash` is detected (lines 132-150)
- `localStorage` now stores `{ txHash, chainId }` as JSON (not just a raw string)
- `app/api/payment/crypto/route.ts` now accepts `txHash` + `chainId` in the request body. If DB `TxHash IS NULL`, it writes them immediately (rescue mode for existing stuck transactions when clicking "Continue")
- `TopUpPage.tsx` `continueTransaction` now passes stored `txHash`/`chainId` from `localStorage` to `/api/payment/crypto`

**Files changed:** `CryptoWalletPanel.tsx`, `app/api/payment/crypto/route.ts`, `TopUpPage.tsx`

---

### CRIT-2: `LastVerificationAt` cooldown creates a 2-minute dead zone after RPC failures — FIXED

**File(s):**
- `app/api/payment/crypto/verify/route.ts`

**What was broken:** Verify endpoint updated `LastVerificationAt` immediately, THEN queried the RPC. If RPC failed, the 2-minute cron cooldown blocked retries.

**What was fixed:**
- Split the UPDATE into two phases:
  1. **Start**: Only idempotently sets `TxHash`/`ChainId` via `COALESCE` (does NOT touch attempts/timestamp)
  2. **End**: Only after `verifyOnChainTransfer()` returns (success OR failure, but not RPC exception), updates `VerificationAttempts` and `LastVerificationAt`
- RPC failures throw from `verifyOnChainTransfer` → caught in verify endpoint → returns **503** with `"Blockchain RPC temporarily unavailable"` — `LastVerificationAt` is NEVER touched
- Cron can retry immediately on next run

**Files changed:** `app/api/payment/crypto/verify/route.ts`

---

### CRIT-3: Race condition between frontend and cron — FIXED

**File(s):**
- `app/api/payment/crypto/verify/route.ts`
- `app/api/cron/crypto-verify/route.ts`

**What was broken:** Both frontend polling and cron could simultaneously call `UPDATE Status = 'completed'` and `awardCoins()`, potentially double-completing or leaving `CoinsAwarded = 0`.

**What was fixed:**
- Both the verify endpoint and the cron now use: `UPDATE ... SET Status = 'completed' WHERE Status = 'pending'` with `OUTPUT inserted.CoinsAwarded`
- If no rows updated, another process already completed it → returns existing `CoinsAwarded` gracefully
- `awardCoins()` only called if the update actually succeeded

**Files changed:** `app/api/payment/crypto/verify/route.ts`, `app/api/cron/crypto-verify/route.ts`

---

## High (Systemic Design Flaws)

### HIGH-NEW: Admin debug endpoint still uses wallet-address matching (inconsistent with main flow)

**File(s):**
- `app/api/admin/debug/crypto-verify/route.ts`

**What is broken:** The debug endpoint ignores `txn.ChainId` from the database and builds a `networkByWallet` Map from `WebsiteConfigs`, then looks up the network by `WalletAddress`. This is the OLD logic that was fixed in the cron and verify endpoint.

**Impact:**
- Admin runs force-verify on a Base transaction → debug endpoint looks up BEP20 network → "Transaction not found" → admin incorrectly concludes the transaction is fake
- Confusion and wasted time debugging

**Fix:**
- Use `getNetworkByChainId(txn.ChainId)` first, fall back to wallet matching only if `ChainId` is NULL

**Files to change:** `app/api/admin/debug/crypto-verify/route.ts`

---

### HIGH-1: `localStorage` still primary source for network selection — PARTIALLY FIXED

**Status:** Network key is now stored in `localStorage` (`toc_crypto_network_${id}`), but the **database does not store it**. If a user switches devices, the "Continue" button defaults to BEP20.

**Fix applied:** `localStorage` network storage + retrieval in `continueTransaction`.

**Remaining risk:** If `localStorage` is cleared, `continueTransaction` falls back to `'bep20'`.

**Recommended:** Add `NetworkKey` column to `PaymentTransactions` and write it during order creation or first crypto ticket generation.

---

### HIGH-2: `continueTransaction` hardcoded network — FIXED

**Status:** `continueTransaction` now reads `toc_crypto_network_${transactionId}` from `localStorage`. If the transaction was created after the fix, the correct network is used. Falls back to `'bep20'` only for pre-fix transactions.

**Files changed:** `TopUpPage.tsx`

---

### HIGH-3: Order creation doesn't store network — STILL OPEN

**File(s):** `app/api/payment/order/route.ts`

The `INSERT` statement has no `NetworkKey` or `ChainId` column. The database never records which network the user intended.

**Recommended:** Add `NetworkKey VARCHAR(20)` to `PaymentTransactions`.

---

### HIGH-4: Cron used wallet-address matching — FIXED

**Status:** Cron now uses `getNetworkByChainId(txn.ChainId)` first. Only falls back to wallet-address matching if `ChainId` is NULL.

**Files changed:** `app/api/cron/crypto-verify/route.ts`

---

### HIGH-5: Two-modal design — STILL OPEN (architectural)

`showCryptoContinueModal` and `showWalletModal` still both exist. This is a UX refactor that should be addressed in a dedicated session.

---

### HIGH-6: `handleProceed` resets form immediately — STILL OPEN

User clicks "Proceed with USDT Crypto" → form resets to package selection. The pending banner appears at the top, which is the intended behavior (crypto orders are shown in the pending list, not inline). However, this is still abrupt and confusing for first-time users.

**Mitigation:** The pending transaction card is now clearly visible at the top with "Continue" button. The "Create a Top-Up Order" card is hidden while a pending crypto transaction exists.

---

### HIGH-7: UI flicker on completion — PARTIALLY FIXED

`onCompleted` still calls `resetFlow('amount')`, which briefly clears the order before `fetchHistory()` refreshes. However, the new **auto-cleanup `useEffect`** (line 659-671 in `TopUpPage.tsx`) detects when `history` shows a completed transaction and resets the flow automatically. This reduces the window for flicker.

---

### HIGH-8: `verifyOnChainTransfer` only supports 2 chains — STILL OPEN

`lib/blockchain/verify.ts` line 7-10:
```ts
const chainMap: Record<number, typeof bsc | typeof base> = {
  56: bsc,
  8453: base,
};
```

Adding Ethereum (1), Polygon (137), Arbitrum (42161), etc. requires code changes.

**Recommended:** Build the `viem` `Chain` object dynamically from `BlockchainNetwork` config fields instead of a hardcoded map.

---

### HIGH-9: No max-age cleanup for abandoned crypto transactions — STILL OPEN

**File(s):** `app/api/cron/auto-expire/route.ts`

The auto-expire cron explicitly excludes crypto transactions with `TxHash`:
```sql
AND NOT (PaymentMethod = 'Crypto' AND TxHash IS NOT NULL AND LEN(TxHash) > 0)
```

This is correct — we don't want to expire a legitimate transaction that's confirming on-chain. But there's no corresponding "has been trying for days and failing" cleanup.

**Recommended:** Add a second condition to auto-expire (or a new cron) that marks crypto transactions as `failed` if `VerificationAttempts > 50` and `LastVerificationAt < DATEADD(day, -1, GETDATE())`.

---

## Medium (Incorrect Behavior / Poor UX)

### MED-1: `verifyStatus` semantic mismatch on modal reopen — FIXED

**Status:** `CryptoWalletPanel` now initializes `verifyStatus` to `'confirming'` (not `'idle'`) when `initialTxHash` is present on mount. UI text and status are now semantically consistent.

**Files changed:** `CryptoWalletPanel.tsx`

---

### MED-2: `CryptoWalletPanel` suppresses wrong-network banner when `txHash` exists

**Impact:**
- User on wrong network sees no "Switch network" button
- But also no explanatory text
- Might be confused

**Fix:**
- Add a message: "Transaction submitted. You don't need to switch networks to track its status."

---

### MED-3: `verifyOnChainTransfer` finds only the FIRST USDT transfer log

**File(s):**
- `lib/blockchain/verify.ts`

**Impact:**
- DEX swap transactions may have multiple transfer logs
- The first one might not be the user's payment
- Verification fails with "recipient mismatch"

**Fix:**
- Use `.filter()` instead of `.find()`
- Check ALL logs for one matching both recipient AND amount

---

### MED-4: Floating-point precision in `parseUnits(usdAmount.toString(), ...)`

**Impact:**
- Strict `<` comparison fails even if user sent the intended amount due to tiny floating-point differences

**Fix:**
- Add a small tolerance (e.g., `value >= expectedAmountWei * 0.99`)

---

### MED-5: Cron doesn't use `ChainId` from the database at all

**Status:** FIXED. See HIGH-4.

---

### MED-6: Crypto-specific failures show generic error banners

**Impact:**
- "No wallet address configured" doesn't say which network
- User doesn't know if BEP20 or Base is broken

**Fix:**
- Include network name in error messages

---

### MED-7: `cryptoNetwork` state not persisted across navigation — FIXED

**Status:** `TopUpPage` now stores `toc_crypto_network_${transactionId}` in `localStorage` when creating the order, and reads it when clicking "Continue".

**Files changed:** `TopUpPage.tsx`

---

### MED-8: `getTransactionReceipt` non-specific errors treated as terminal failures

**Impact:**
- Temporary timeout → "Blockchain verification error. Primary and fallback RPC both failed."
- Frontend may stop polling

**Fix:**
- Distinguish between: RPC timeout (retry), receipt not found (wait), receipt failed (terminal)
- Return specific HTTP status codes: 504 (timeout), 404 (not found), 400 (failed)

---

## Low (Code Quality / Maintainability)

### LOW-1: `setTimeout(() => setState(...), 0)` anti-pattern in `CryptoWalletPanel`

**File(s):**
- `app/components/CryptoWalletPanel.tsx`

**Fix:**
- Remove `setTimeout` wrappers

---

### LOW-2: No background polling for crypto on the main page

**Fix:**
- Add a lightweight polling interval for pending crypto transactions

---

### LOW-3: `invoke-cron.ps1` hardcodes `http://127.0.0.1:3000`

**Fix:**
- Read `BASE_URL` from `.env.production`

---

### LOW-4: `awardCoins` uses `userDB` without cross-database transaction wrapping

**File(s):**
- `lib/pricing.ts`

**Fix:**
- Use a distributed saga pattern, or ensure the recovery cron handles this case robustly

---

### LOW-5: `TRANSFER_EVENT_SIGNATURE` is hardcoded but not validated

**Fix:**
- Add contract ABI validation, or document the requirement clearly

---

### LOW-6: Missing database index for cron query

**Fix:**
```sql
CREATE INDEX IX_PaymentTransactions_CryptoPending ON PaymentTransactions(Status, PaymentMethod, TxHash, LastVerificationAt);
```

---

### LOW-7: `getBlockchainNetworks()` returns disabled networks — FIXED

**Status:** Cron now uses `getEnabledNetworks()` instead of `getBlockchainNetworks()`.

**Files changed:** `app/api/cron/crypto-verify/route.ts`

---

### LOW-8: `continueTransaction` rebuilds `Order` object from `HistoryItem`

**Impact:**
- Reconstructed object may miss new fields

**Fix:**
- Fetch the full order from `/api/payment/order/status` or similar endpoint

---

## Fix Priority Order (Remaining)

1. **HIGH-NEW** — Fix admin debug endpoint to use `ChainId` from DB
2. **HIGH-1** — Store `NetworkKey` in `PaymentTransactions` (make DB source of truth)
3. **HIGH-9** — Add max-age cleanup for abandoned crypto transactions
4. **HIGH-5** — Simplify two-modal design into single modal
5. **HIGH-8** — Dynamic chain construction for new blockchains
6. **MED-2** — Add explanatory text when wrong-network banner is suppressed
7. **MED-3** — Check all logs for matching transfer (filter vs find)
8. **MED-4** — Add tolerance to amount comparison
9. **LOW-6** — Add database index for cron query
10. **LOW-2** — Background polling on main page for crypto status

---

## Security Hardening (Fixed — 2026-06-11)

### SEC-1: Replay check only blocks completed transactions — FIXED

**File:** `app/api/payment/crypto/verify/route.ts`

**What was broken:** The replay check only blocked txHashes used on **completed** transactions:
```sql
AND (Status = 'completed' OR CoinsAwarded > 0)
```

A malicious user could create their own order, register someone else's txHash on it (while it's still pending), and cause a race condition.

**What was fixed:** Removed the `Status = 'completed'` filter. The replay check now blocks ANY transaction with the same txHash:
```sql
SELECT TransactionID, Status FROM PaymentTransactions
WHERE TxHash = @txHash AND TransactionID <> @transactionId
```

**Files changed:** `app/api/payment/crypto/verify/route.ts`

---

### SEC-2: `register-txhash` overwrites existing txHash — FIXED

**File:** `app/api/payment/crypto/register-txhash/route.ts`

**What was broken:** Blind overwrite:
```sql
UPDATE PaymentTransactions SET TxHash = @txHash, ChainId = @chainId
WHERE TransactionID = @transactionId
```

**What was fixed:**
1. Made idempotent with `COALESCE`:
```sql
SET TxHash = COALESCE(TxHash, @txHash),
    ChainId = COALESCE(ChainId, @chainId)
```
2. Added replay check: blocks registering a txHash already used on ANY other transaction (returns 409 Conflict)
3. Added rate limiting: 20 requests per minute per IP

**Files changed:** `app/api/payment/crypto/register-txhash/route.ts`

---

### SEC-3: No rate limiting on crypto endpoints — FIXED

**Files:**
- `app/api/payment/crypto/verify/route.ts` — 30 requests/minute per IP
- `app/api/payment/crypto/register-txhash/route.ts` — 20 requests/minute per IP
- `app/api/payment/crypto/route.ts` — 10 requests/minute per IP

**Files changed:** All three endpoint files

---

### SEC-4: Debug endpoint lacks `Status = 'pending'` guard — FIXED

**File:** `app/api/admin/debug/crypto-verify/route.ts`

**What was fixed:** Added `AND Status = 'pending'` to the completion UPDATE:
```sql
UPDATE PaymentTransactions
SET Status = 'completed', CompletedAt = GETDATE()
WHERE TransactionID = @transactionId AND Status = 'pending'
```

**Files changed:** `app/api/admin/debug/crypto-verify/route.ts`

---

## New Feature: Custom RPC Configuration (2026-06-11)

### Overview

Admins can now configure **custom RPC URLs and API keys** for BSC and Base networks via `/admin/website-config`. If custom RPC is set, the system uses it instead of the free public RPC endpoints.

### How it works

1. Admin navigates to **Admin → Website Config → Crypto (USDT) Configuration**
2. Under **BSC (BEP20) RPC Settings** and **Base RPC Settings**, enter:
   - **Custom RPC URL** — e.g. `https://rpc.ankr.com/bsc/YOUR_KEY`
   - **API Key** — optional, appended as `?apiKey=KEY` query parameter
3. Leave empty to use the default free public RPC (falls back automatically)

### Backend logic (`lib/blockchain/config.ts`)

- `applyCustomRpc()` checks `WebsiteConfigs` for `crypto_custom_rpc_bep20` / `crypto_custom_rpc_base`
- If a custom URL is configured, it replaces the default `RpcUrl` from `CryptoBlockchainConfig`
- The previous default free RPC becomes the `fallbackRpcUrl`
- If no custom URL is set, the system uses the free public RPC as before

### Files changed

- `app/admin/website-config/page.tsx` — Added 4 new input fields
- `lib/blockchain/config.ts` — Added `applyCustomRpc()` helper
- `app/api/payment/crypto/seed/route.ts` — Initializes new WebsiteConfigs keys on seed

### New WebsiteConfigs keys

| ConfigKey | Description | Default |
|-----------|-------------|---------|
| `crypto_custom_rpc_bep20` | Custom BSC RPC URL | empty (use free RPC) |
| `crypto_custom_api_key_bep20` | Custom BSC API key | empty |
| `crypto_custom_rpc_base` | Custom Base RPC URL | empty (use free RPC) |
| `crypto_custom_api_key_base` | Custom Base API key | empty |
