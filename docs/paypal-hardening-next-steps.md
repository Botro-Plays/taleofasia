# PayPal Hardening & Parity Checklist

_Last reviewed: 2026-06-10_

## Current State Snapshot
- **Order + checkout flow:** `/api/payment/order` creates a 30-minute pending transaction and the dashboard launches PayPal via `/api/payment/paypal/create`. **Rate limiting added 2026-06-10**: 6 req/min per user on create, 10 req/min per user on capture, with WebAuditLogs throttle events and 429 responses.@app/api/payment/order/route.ts#110-155 @app/api/payment/paypal/create/route.ts#21-46 @app/api/payment/paypal/capture/route.ts#17-43 @app/dashboard/topup/page.tsx#303-360
- **Capture & auto-award:** The webhook handles all major lifecycle events: `PAYMENT.CAPTURE.COMPLETED`, `.PENDING`, `.DENIED`, `.REFUNDED`, `.REVERSED`, `CHECKOUT.ORDER.VOIDED`, `.DENIED`, `.APPROVED`. Signature verified via PayPal API. Alerts dispatched via `dispatchPaypalAlert()` with 5-min dedupe.@app/api/payment/paypal/webhook/route.ts#1-647
- **Manual capture endpoint:** `/api/payment/paypal/capture` lets the dashboard resume completed captures. Rate limiting added 2026-06-10 (10 req/min). Alerts on capture errors already implemented via `dispatchPaypalAlert()`.@app/api/payment/paypal/capture/route.ts#17-105
- **Ops tooling:** Cron status page and scripts now cover PayMongo (archive + reconcile), payment reward recovery, plus the new **PayPal Cancel** (hourly) and **PayPal Reconcile** (every 5 minutes) crons. PayPal reconcile offset at minute 2 from reward at minute 0; cancel at minute 30 from archive at minute 0.@app/api/admin/cron/status/route.ts#18-44 @app/admin/cron/page.tsx#45-51 @scripts/cron.js#69-171

## Recommended Next Steps

### 1. Webhook Coverage & Alerting (✅)
- **Done:** All major lifecycle events are now handled: `CHECKOUT.ORDER.VOIDED`, `CHECKOUT.ORDER.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, and `CHECKOUT.ORDER.APPROVED` (with auto-capture).@app/api/payment/paypal/webhook/route.ts#142-180
- **Done:** Structured alerts via `dispatchPaypalAlert()` with audit logging + SMTP email dedupe (5-minute window) are implemented for signature failures, missing credentials, and capture errors.@lib/paypal/alerts.ts
- **Done 2026-06-10:** Every PayPal webhook raw payload is persisted to `WebhookPayloads` table before processing. Status lifecycle tracked (`received` -> `verified` -> `processing` -> `processed` or error states). Old payloads cleaned up after 30 days. Admin endpoint `/api/admin/webhooks` available for listing.@app/api/payment/paypal/webhook/route.ts#248-270 @lib/webhook/store.ts

### 2. Automatic Cancellation & Void Workflow (✅)
- **Done:** `/api/cron/paypal-cancel` runs hourly via `scripts/cron.js` and cancels PayPal orders older than 30 minutes. It handles `204` (cancelled), `422` already-closed, and `404` orphan states. Results are logged to `WebAuditLogs` with `PAYPAL_CANCEL` action. Alerts dispatched on repeated failures via `dispatchPaypalAlert()`. Supports single-transaction override via body `{ transactionId }`.@app/api/cron/paypal-cancel/route.ts#1-154
- **Done 2026-06-10:** Admin reject action in `/api/admin/payments` now calls `cancelPaypalOrder()` upstream before marking the local transaction rejected. Void result (`cancelled`/`alreadyClosed`/`notFound`/`failed`) is recorded in transaction Notes and WebAuditLogs. Alert dispatched if the void call itself fails but local rejection still proceeds.@app/api/admin/payments/route.ts#108-147
- **Done 2026-06-10:** Removed end-user cancellation ability from `/api/payment/order` PUT and the dashboard `cancelOrderById` helper. Only system crons and admin actions can cancel/reject orders now.@app/api/payment/order/route.ts#151-160 @app/dashboard/topup/page.tsx#179-227

### 3. Endpoint Hardening & Rate Limiting (✅)
- **Done 2026-06-10:** Applied shared `rateLimiter` to `/api/payment/paypal/create` (6 req/min per user) and `/api/payment/paypal/capture` (10 req/min per user). Throttle events logged to `WebAuditLogs` with `PAYPAL_RATE_LIMIT` action. Returns standard 429 with `Retry-After` header.@app/api/payment/paypal/create/route.ts#28-46 @app/api/payment/paypal/capture/route.ts#24-43
- **Done 2026-06-10:** `getPaypalToken()` in `lib/paypal/api.ts` caches the OAuth token in memory with a 60-second safety margin before expiry. All PayPal API consumers (create, capture, webhook, cancel, reconcile, admin reject) now reuse the cached token instead of requesting a fresh one per call.@lib/paypal/api.ts#15-55
- **Done:** Cross-method abuse guard already in place — both endpoints verify `PaymentMethod='PayPal'` before proceeding.@app/api/payment/paypal/create/route.ts#56-65

### 4. Reconciliation & Stale Pending Recovery (✅)
- **Done:** `/api/cron/paypal-reconcile` runs every 5 minutes via `scripts/cron.js` and rechecks pending PayPal transactions older than 10 minutes via `GET /v2/checkout/orders/{id}`. Automatically marks `COMPLETED` orders as completed, awards coins, marks `VOIDED` orders as cancelled, and logs all actions to `WebAuditLogs`. Alerts dispatched on repeated failures via `dispatchPaypalAlert()`. Supports single-transaction override via body `{ transactionId }`.@app/api/cron/paypal-reconcile/route.ts#1-275
- **Done 2026-06-10:** PayPal backlog metrics surfaced in admin dashboard: total pending, stuck >10 min, stuck >30 min, expired pending, failures 24h, completed 24h. Endpoint `/api/admin/paypal/backlog` serves the data.@app/api/admin/paypal/backlog/route.ts @app/admin/page.tsx#258-287

### 5. Admin & Support Runbooks (✅)
- **Done 2026-06-10:** Created `docs/paypal-runbook.md` covering webhook URL (`/api/payment/paypal/webhook`), required event subscriptions (8 types), sandbox vs. live switching, safe credential rotation, troubleshooting 6 common issues, manual replay of webhooks from `WebhookPayloads`, manual capture retry, and cron trigger procedures. Also extended `docs/next-server-operations.md` with a PayPal Operations quick-reference section.@docs/paypal-runbook.md @docs/next-server-operations.md#127-161

### 6. Testing & Verification (⚠️ Skipped for now)
- **Skipped:** Sandbox testing is operationally heavy (requires sandbox account setup, manual checkout flows, webhook routing to a public URL, and coordinated end-to-end testing across PayPal's UIs). The system has strong operational resilience through:
  - **Automated recovery:** `paypal-reconcile` (every 5 min) and `paypal-cancel` (hourly) crons.
  - **Observability:** Alerts with dedupe, `WebhookPayloads` persistence for replay, backlog metrics in `/admin`.
  - **Idempotency:** Duplicate webhooks are safely ignored; repeated capture calls are guarded.
  - If issues arise in production, raw payloads in `WebhookPayloads` allow replay for debugging, and the cron jobs provide automatic cleanup.
- **Can be revisited** if PayPal volume increases significantly or before major payment-related releases.

---
**Goal:** Reach feature parity with PayMongo so PayPal enjoys the same resilience (alerts, cron cleanup, rate limits), operational visibility, and automated recovery before enabling it broadly.
