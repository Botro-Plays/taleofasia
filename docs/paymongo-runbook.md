# PayMongo Operations Runbook

_Last updated: 2026-06-10_

This runbook covers PayMongo webhook setup, credential rotation, environment switching, troubleshooting, and common operational procedures.

---

## Table of Contents

1. [Webhook Setup](#webhook-setup)
2. [Required Event Subscriptions](#required-event-subscriptions)
3. [Test vs. Live Mode](#test-vs-live-mode)
4. [Credential Rotation](#credential-rotation)
5. [Troubleshooting](#troubleshooting)
6. [Replaying Webhooks](#replaying-webhooks)
7. [Manual Operations](#manual-operations)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## Webhook Setup

### Webhook URL

```
https://taleofconquest.com/api/payment/paymongo/webhook
```

> PayMongo webhooks **must** return HTTP 200 for every request. Returning 4xx/5xx will cause PayMongo to disable the webhook automatically. Our handler always returns 200, even on signature failure or internal errors.

### Registering the Webhook (PayMongo Dashboard)

1. Go to [https://dashboard.paymongo.com](https://dashboard.paymongo.com)
2. Navigate to **Developers** → **Webhooks**.
3. Click **Add webhook**.
4. Paste the webhook URL above.
5. Select the event types listed in the next section.
6. Save and note the **Webhook Secret** (required for `WebsiteConfigs`).

### WebsiteConfigs Keys

After creating the webhook, store these in `WebsiteConfigs` (via `/admin/website-config`):

| ConfigKey | Value | Description |
|-----------|-------|-------------|
| `paymongo_secret_key` | Your PayMongo Secret Key | From PayMongo dashboard (sk_test_… or sk_live_…) |
| `paymongo_webhook_secret` | Webhook Secret | From PayMongo webhook settings (whsec_…) |
| `paymongo_public_key` | Your PayMongo Public Key | From PayMongo dashboard (pk_test_… or pk_live_…) |

Restart the Next.js service after updating any of these values:

```powershell
nssm restart TaleOfConquestWeb
```

---

## Required Event Subscriptions

Subscribe to **all** of the following events in the PayMongo Dashboard:

| Event Type | Why We Need It |
|------------|----------------|
| `link.payment.paid` | User completed payment via PayMongo Link — mark completed and award coins |
| `payment.paid` | Direct payment succeeded — mark completed and award coins |
| `source.chargeable` | Payment source is ready to be charged |
| `link.payment.failed` | PayMongo Link payment failed — mark transaction failed |
| `payment.failed` | Direct payment failed — mark transaction failed |
| `payment.cancelled` | Payment was cancelled — mark transaction failed |

> **Missing events** will cause the system to miss lifecycle changes. PayMongo does not automatically retry events that were rejected (even though we return 200, the event type matters).

---

## Test vs. Live Mode

### Switching Modes

PayMongo uses different API keys for test and live environments:

1. Update `WebsiteConfigs`:
   - Replace `paymongo_secret_key`, `paymongo_public_key`, and `paymongo_webhook_secret` with the test or live values.
2. Restart service: `nssm restart TaleOfConquestWeb`

### Test Credentials

- Test keys are obtained from the PayMongo Dashboard under **Developers** → **API Keys** (toggle "Test Mode").
- Test webhooks have a **different webhook secret** from live webhooks.
- Test transactions do **not** award real coins — the system still processes them the same way, but you can safely reject/refund them.

### Verifying Active Mode

Check `WebAuditLogs` after a webhook arrives. The `Details` field will reference the PayMongo gateway ID, and `PAYMONGO_ALERT` entries will include the event type.

---

## Credential Rotation

### When to Rotate

- Secret compromised or suspected leak
- Employee/offshore access revoked
- Quarterly security hygiene
- PayMongo account migrated or recreated

### Rotation Steps

1. **Generate new API keys** in PayMongo Dashboard (Developers → API Keys).
2. **Create a new webhook** with the same URL and event subscriptions (this generates a new webhook secret).
3. **Update `WebsiteConfigs`** with the new `paymongo_secret_key`, `paymongo_public_key`, and `paymongo_webhook_secret`.
4. **Restart service**: `nssm restart TaleOfConquestWeb`.
5. **Send a test webhook** from PayMongo dashboard (Developers → Webhooks → Send test event).
6. **Verify** in `WebAuditLogs` that the test event was received and processed.
7. **Delete old credentials** from PayMongo after confirming the new ones work.

### Rollback

If the new credentials fail, revert `WebsiteConfigs` to the old values and restart the service immediately.

---

## Troubleshooting

### "PayMongo webhook secret missing" alert

- **Cause**: `paymongo_webhook_secret` is missing from `WebsiteConfigs`.
- **Fix**: Add the webhook secret in `/admin/website-config` and restart service.

### "PayMongo webhook signature mismatch" alert

- **Cause**: HMAC-SHA256 signature verification failed. Common causes:
  - Wrong `paymongo_webhook_secret` (test secret used in live mode or vice versa)
  - Credentials rotated but webhook secret not updated
  - PayMongo sent an event from a different project (cross-project webhook)
- **Fix**: Verify `paymongo_webhook_secret` matches the active environment. Check `WebhookPayloads` table (if adopted) for the raw payload to inspect headers.

### Webhooks not arriving

- **Cause**: Cloudflare/IIS blocking PayMongo IP ranges, or URL is wrong.
- **Fix**:
  - Verify webhook URL is correct in PayMongo dashboard.
  - Check IIS logs for `POST /api/payment/paymongo/webhook` entries.
  - Check Cloudflare firewall rules — whitelist PayMongo IP ranges.
  - Use PayMongo dashboard "Send test event" to verify delivery.

### Coins not awarded after successful payment

- **Cause**: `awardCoins` failed (e.g., user not found in game DB), or the transaction was already marked completed.
- **Fix**:
  - Check `WebAuditLogs` for `COINS_AWARDED` or `award-failed` entries.
  - Verify the user's `AccountName` exists in the game database.
  - Check if the transaction `Status` is already `completed` (idempotent — duplicate webhooks are safe).
  - The `paymongo-reconcile` cron (every 5 min) will retry status checks for pending transactions.

### Stuck pending orders

- **Cause**: User abandoned checkout, webhook delayed/missed, or payment failed but webhook not received.
- **Fix**:
  - The `paymongo-reconcile` cron (every 5 min) automatically rechecks pending transactions older than 10 minutes.
  - The `paymongo-archive` cron (hourly) archives expired/completed PayMongo links.
  - Admin can manually reject a transaction in `/admin/payments`.

### Cross-project webhook ignored

- **Cause**: Multiple projects share the same PayMongo account and webhooks are broadcast to all endpoints.
- **Fix**: This is handled automatically — our webhook checks if the gateway ID exists in `PaymentTransactions`. If not, it logs silently and does not alert. No action needed.

---

## Replaying Webhooks

If a webhook was missed or you need to reprocess an event:

### From WebhookPayloads table (if adopted)

```sql
-- Find the payload
SELECT LogID, Provider, EventType, Payload, Status
FROM WebhookPayloads
WHERE Provider = 'PayMongo'
  AND GatewayTransactionID = '<gateway-id>'
ORDER BY Timestamp DESC;
```

### Manual Re-execution (Developer only)

1. Extract the `Payload` column value.
2. POST it to the webhook endpoint with the original `paymongo-signature` header:
   ```bash
   curl -X POST https://taleofconquest.com/api/payment/paymongo/webhook \
     -H "Content-Type: application/json" \
     -H "paymongo-signature: <signature-header>" \
     -d '<payload-json>'
   ```
3. Check `WebAuditLogs` for the outcome.

> **Note**: Replaying a `link.payment.paid` event on an already-completed transaction is safe — the handler is idempotent (only updates rows where `Status = 'pending'`).

---

## Manual Operations

### Cancel a single PayMongo transaction manually

1. Go to `/admin/payments`.
2. Find the pending PayMongo transaction.
3. Click **Reject**. This marks the local transaction as `rejected`.
> **Note**: Unlike PayPal, PayMongo does not have an upstream "void" API for links. Once a link is created, it expires automatically after 30 minutes.

### Retry a status check manually

1. Find the `TransactionID` in `PaymentTransactions`.
2. POST to `/api/payment/paymongo/check` with `{ transactionId }`.
   ```bash
   curl -X POST https://taleofconquest.com/api/payment/paymongo/check \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=<token>" \
     -d '{"transactionId": "<uuid>"}'
   ```
3. Check `WebAuditLogs` for the result.

### Trigger reconciliation manually

```powershell
# Via PowerShell (admin cron run)
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/cron/run" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"taskId": "paymongo-reconcile"}' `
  -Headers @{ "Cookie" = "next-auth.session-token=<token>" }
```

Or use the **Cron Monitor** page in `/admin/cron` and click **Run now** on the PayMongo Reconcile card.

---

## Monitoring & Alerts

### Where to look

| What | Where |
|------|-------|
| Service health | `/api/health` |
| PayMongo backlog | `/admin` (check Payment Management) |
| Raw payloads | `WebhookPayloads` table (if adopted) |
| Audit trail | `WebAuditLogs` table or `/admin/logs` |
| Alert emails | `noreply@taleofconquest.com` (SMTP) |

### Alert Severity Guide

| Severity | When it fires | Action needed |
|----------|---------------|---------------|
| **Critical** | Missing webhook secret, handler crashed | Immediate — check `WebsiteConfigs` and logs |
| **Warning** | Signature mismatch, missing transaction, coin award skipped | Same-day — verify webhook setup and transaction state |
| **Info** | Cross-project webhook ignored, non-outcome event | Log review only |

### 5-Minute Alert Dedupe

All PayMongo alerts use a 5-minute deduplication window. Repeated alerts with the same `dedupeKey` are suppressed to prevent email spam.

---

## Quick Reference

```powershell
# Check service status
nssm status TaleOfConquestWeb

# Restart service (after config changes)
nssm restart TaleOfConquestWeb

# Tail logs
Get-Content C:\taleofconquest-web\logs\next-err.log -Tail 50

# Check PayMongo reconcile status via cron page
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/cron/status"

# List recent webhook payloads (if using generic WebhookPayloads table)
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/webhooks?provider=PayMongo&limit=10"
```
