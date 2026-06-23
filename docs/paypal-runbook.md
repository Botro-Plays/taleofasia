# PayPal Operations Runbook

_Last updated: 2026-06-10_

This runbook covers PayPal webhook setup, credential rotation, environment switching, troubleshooting, and common operational procedures.

---

## Table of Contents

1. [Webhook Setup](#webhook-setup)
2. [Required Event Subscriptions](#required-event-subscriptions)
3. [Sandbox vs. Live](#sandbox-vs-live)
4. [Credential Rotation](#credential-rotation)
5. [Troubleshooting](#troubleshooting)
6. [Replaying Webhooks](#replaying-webhooks)
7. [Manual Operations](#manual-operations)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## Webhook Setup

### Webhook URL

```
https://taleofconquest.com/api/payment/paypal/webhook
```

> If testing locally or on a staging domain, PayPal webhooks **must** reach a public HTTPS endpoint. Use Cloudflare tunnel or similar for local dev.

### Registering the Webhook (PayPal Developer Dashboard)

1. Go to [https://developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
2. Select your app (or create one).
3. Navigate to **Webhooks** → **Add webhook**.
4. Paste the webhook URL above.
5. Select the event types listed in the next section.
6. Save and note the **Webhook ID** (required for `WebsiteConfigs`).

### WebsiteConfigs Keys

After creating the webhook, store these in `WebsiteConfigs` (via `/admin/website-config`):

| ConfigKey | Value | Description |
|-----------|-------|-------------|
| `paypal_client_id` | Your PayPal Client ID | From PayPal app dashboard |
| `paypal_secret` | Your PayPal Secret | From PayPal app dashboard |
| `paypal_webhook_id` | Webhook ID | From PayPal webhook settings |
| `paypal_sandbox` | `true` or `false` | Sandbox mode toggle |

Restart the Next.js service after updating any of these values:

```powershell
nssm restart TaleOfConquestWeb
```

---

## Required Event Subscriptions

Subscribe to **all** of the following events in the PayPal Developer Dashboard:

| Event Type | Why We Need It |
|------------|----------------|
| `CHECKOUT.ORDER.APPROVED` | Trigger auto-capture after user approves payment |
| `CHECKOUT.ORDER.VOIDED` | Order cancelled upstream (e.g., expired) |
| `CHECKOUT.ORDER.DENIED` | Order denied by PayPal |
| `PAYMENT.CAPTURE.COMPLETED` | Payment fully captured — award coins |
| `PAYMENT.CAPTURE.PENDING` | Capture pending — confirm status proactively |
| `PAYMENT.CAPTURE.DENIED` | Capture denied — mark transaction failed |
| `PAYMENT.CAPTURE.REFUNDED` | Refund issued — mark transaction refunded |
| `PAYMENT.CAPTURE.REVERSED` | Chargeback/reversal — critical alert |

> **Missing events** will cause the system to miss lifecycle changes. Always verify all events are subscribed after rotating credentials or creating a new PayPal app.

---

## Sandbox vs. Live

### Switching Modes

1. Update `WebsiteConfigs` → set `paypal_sandbox` to `true` (sandbox) or `false` (live).
2. Update `WebsiteConfigs` → set `paypal_client_id` and `paypal_secret` to the sandbox or live credentials.
3. Update `WebsiteConfigs` → set `paypal_webhook_id` to the sandbox or live webhook ID.
4. Restart service: `nssm restart TaleOfConquestWeb`

### Sandbox Credentials

- Sandbox credentials are obtained from the PayPal Developer Dashboard under **Sandbox** tab.
- Sandbox webhooks have a **different webhook ID** from live webhooks.
- Sandbox transactions do **not** award real coins — the system still processes them the same way, but you can safely reject/refund them.

### Verifying Active Mode

Check `WebAuditLogs` after a webhook arrives. The `Details` field will reference the PayPal order ID, and the source `paypal-webhook` alert will include the sandbox/live context.

---

## Credential Rotation

### When to Rotate

- Secret compromised or suspected leak
- Employee/offshore access revoked
- Quarterly security hygiene
- PayPal app recreated or migrated

### Rotation Steps

1. **Create new credentials** in PayPal Developer Dashboard (new app or new secret).
2. **Register a new webhook** with the same URL and event subscriptions (this generates a new webhook ID).
3. **Update `WebsiteConfigs`** with the new `paypal_client_id`, `paypal_secret`, and `paypal_webhook_id`.
4. **Restart service**: `nssm restart TaleOfConquestWeb`.
5. **Send a test webhook** from PayPal dashboard (Sandbox → Webhooks → Send test event).
6. **Verify** in `WebAuditLogs` that the test event was received and processed.
7. **Delete old credentials** from PayPal after confirming the new ones work.

### Rollback

If the new credentials fail, revert `WebsiteConfigs` to the old values and restart the service immediately.

---

## Troubleshooting

### "PayPal webhook not configured" alert

- **Cause**: `paypal_client_id`, `paypal_secret`, or `paypal_webhook_id` is missing from `WebsiteConfigs`.
- **Fix**: Add all three values in `/admin/website-config` and restart service.

### "Invalid webhook signature" alert

- **Cause**: PayPal signature verification failed. Common causes:
  - Wrong `paypal_webhook_id` (sandbox ID used in live mode or vice versa)
  - Credentials rotated but webhook ID not updated
  - PayPal API outage
- **Fix**: Verify `paypal_webhook_id` matches the active environment. Check `WebhookPayloads` table for the raw payload to inspect headers.

### Webhooks not arriving

- **Cause**: Cloudflare/IIS blocking PayPal IP ranges, or URL is wrong.
- **Fix**:
  - Verify webhook URL is correct in PayPal dashboard.
  - Check IIS logs for `POST /api/payment/paypal/webhook` entries.
  - Check Cloudflare firewall rules — whitelist PayPal IP ranges.
  - Use PayPal dashboard "Send test event" to verify delivery.

### Auto-capture failing repeatedly

- **Cause**: Insufficient funds, buyer account issues, or PayPal merchant account restrictions.
- **Fix**:
  - Check `WebAuditLogs` for `PAYPAL_ALERT` entries with `auto-capture-failed`.
  - Check `PaymentTransactions` Notes for capture error details.
  - Verify the PayPal merchant account has sufficient permissions.
  - The cron `paypal-reconcile` will retry automatically every 5 minutes.

### Coins not awarded after completed capture

- **Cause**: `awardCoins` failed (e.g., user not found in game DB).
- **Fix**:
  - Check `WebAuditLogs` for `COINS_AWARDED` or `award-failed` entries.
  - Verify the user's `AccountName` exists in the game database.
  - Admin can manually trigger a capture retry via `/api/payment/paypal/capture` (rate limited).

### Stuck pending orders

- **Cause**: User abandoned checkout, webhook delayed/missed, or capture failed silently.
- **Fix**:
  - Check `/admin` PayPal Operations dashboard for "Stuck >10m" / "Expired" counts.
  - The `paypal-reconcile` cron (every 5 min) automatically recovers completed orders.
  - The `paypal-cancel` cron (hourly) automatically voids expired orders older than 30 minutes.
  - Admin can manually reject a transaction in `/admin/payments` — this will void it upstream.

---

## Replaying Webhooks

If a webhook was missed or you need to reprocess an event:

### From WebhookPayloads table

```sql
-- Find the payload
SELECT LogID, EventType, Payload, Status
FROM WebhookPayloads
WHERE Provider = 'PayPal'
  AND GatewayTransactionID = '<order-id>'
ORDER BY Timestamp DESC;
```

### Manual Re-execution (Developer only)

1. Extract the `Payload` column value.
2. POST it to the webhook endpoint with the original PayPal headers:
   ```bash
   curl -X POST https://taleofconquest.com/api/payment/paypal/webhook \
     -H "Content-Type: application/json" \
     -H "paypal-transmission-id: <value>" \
     -H "paypal-cert-url: <value>" \
     -H "paypal-auth-algo: <value>" \
     -H "paypal-transmission-time: <value>" \
     -H "paypal-transmission-sig: <value>" \
     -d '<payload-json>'
   ```
3. A new `WebhookPayloads` row will be created. Check `WebAuditLogs` for the outcome.

> **Note**: Replaying a `PAYMENT.CAPTURE.COMPLETED` event on an already-completed transaction is safe — the handler is idempotent.

---

## Manual Operations

### Cancel a single PayPal order manually

1. Go to `/admin/payments`.
2. Find the pending PayPal transaction.
3. Click **Reject**. This will:
   - Call PayPal API to void the order upstream.
   - Mark the local transaction as `rejected`.
   - Log the void result to `WebAuditLogs`.

### Retry a capture manually

1. Find the `TransactionID` and `GatewayTransactionID` in `PaymentTransactions`.
2. POST to `/api/payment/paypal/capture` with `{ transactionId }`.
   ```bash
   curl -X POST https://taleofconquest.com/api/payment/paypal/capture \
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
  -Body '{"taskId": "paypal-reconcile"}' `
  -Headers @{ "Cookie" = "next-auth.session-token=<token>" }
```

Or use the **Cron Monitor** page in `/admin/cron` and click **Run now** on the PayPal Reconcile card.

---

## Monitoring & Alerts

### Where to look

| What | Where |
|------|-------|
| Service health | `/api/health` |
| PayPal backlog | `/admin` (PayPal Operations card) |
| Raw payloads | `WebhookPayloads` table or `/api/admin/webhooks` |
| Audit trail | `WebAuditLogs` table or `/admin/logs` |
| Alert emails | `noreply@taleofconquest.com` (SMTP) |

### Alert Severity Guide

| Severity | When it fires | Action needed |
|----------|---------------|---------------|
| **Critical** | Missing credentials, auto-award failed, auto-capture failed | Immediate — check `WebsiteConfigs` and logs |
| **Warning** | Signature failure, order mismatch, state mismatch, denied capture | Same-day — verify webhook setup and transaction state |
| **Info** | Unhandled events, auto-capture completed, order voided | Log review only |

### 5-Minute Alert Dedupe

All PayPal alerts use a 5-minute deduplication window. Repeated alerts with the same `dedupeKey` are suppressed to prevent email spam.

---

## Quick Reference

```powershell
# Check service status
nssm status TaleOfConquestWeb

# Restart service (after config changes)
nssm restart TaleOfConquestWeb

# Tail logs
Get-Content C:\taleofconquest-web\logs\next-err.log -Tail 50

# Check PayPal backlog via API
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/paypal/backlog"

# List recent webhook payloads
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/webhooks?provider=PayPal&limit=10"
```
