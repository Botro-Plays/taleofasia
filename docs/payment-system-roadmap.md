# Payment System Roadmap & Audit

Last updated: 2026-06-10

## Current Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Automatic coin addition after PayMongo/PayPal completion | ✅ | Webhooks update `PaymentTransactions`, call `awardCoins`, and log audits for both gateways. **Fixed 2026-06-07**: PayMongo now only processes `link.payment.paid`/`payment.paid` events; PayPal only completes on `PAYMENT.CAPTURE.COMPLETED` (removed premature `CHECKOUT.ORDER.APPROVED` completion). Both now guard `Status = 'pending'` before overwriting.@app/api/payment/paymongo/webhook/route.ts#46-92 @app/api/payment/paypal/webhook/route.ts#82-120 |
| Hard minimum amounts for all payment methods | ✅ | Order creation enforces USD/PHP thresholds per gateway, with PayMongo and PayPal APIs rechecking before checkout. **Fixed 2026-06-07**: Added `PaymentMethod` validation to PayMongo, PayPal, and Crypto APIs so users cannot cross-call endpoints with the wrong method.@app/api/payment/order/route.ts#37-67 @app/api/payment/paymongo/route.ts#43-52 @app/api/payment/paypal/create/route.ts#43-50 @app/api/payment/crypto/route.ts#40-47 |
| Tiered bonus pricing (base 120 coins/$1) | ✅ | Pricing config exposed publicly and applied server-side during order creation and frontend previews. **Fixed 2026-06-07**: Crypto API now uses the same `calculateCoins()` tiered pricing as other methods instead of a flat crypto-only rate.@app/api/public/config/route.ts#48-68 @app/api/payment/order/route.ts#37-95 @lib/pricing.ts#35-54 @app/api/payment/crypto/route.ts#56-59 |
| Pre-configured top-up cards & order flow | ✅ | `PaymentPackages` table stores preset amounts. Admin `/admin/finances` Packages tab manages packages (CRUD). Dashboard `/dashboard/topup` displays preset cards in a grid with coin estimates, local currency conversion, and bonus labels.@app/dashboard/topup/page.tsx#759-874 @app/admin/finances/page.tsx#1-400 |
| Live currency conversion with IP detection | ✅ | Currency utilities fetch cached exchange rates and detect currency/country to convert amounts during order creation.@lib/currency.ts#1-70 @app/api/payment/order/route.ts#28-94 |
| 30-minute transaction timeout with auto-cancel | ✅ | Frontend expires orders after 30 min. **PayMongo**: Archive cron (`/api/cron/paymongo-archive`) runs hourly to archive expired/completed links. **PayPal**: Auto-cancel cron (`/api/cron/paypal-cancel`) runs hourly to void expired PayPal orders older than 30 min. Reconcile cron (`/api/cron/paypal-reconcile`) runs every 5 minutes to recover completed orders.@app/api/payment/order/route.ts#50-128 @app/api/cron/paypal-cancel/route.ts @app/api/cron/paypal-reconcile/route.ts |
| Admin payment audit dashboard with full control | ✅ | **Completed 2026-06-07**: `/admin/payments` page rebuilt with full `data.payments` parsing, status/method filters, account search, and Approve/Reject/Refund action buttons with inline notes. Admin API has state-machine guards (reject only pending, refund only completed, balance check before coin deduction).@app/admin/payments/page.tsx#1-338 @app/api/admin/payments/route.ts#87-154 |
| User transaction history | ✅ | `/api/user/payments` endpoint and dashboard table show recent transactions.@app/api/user/payments/route.ts#1-40 @app/dashboard/topup/page.tsx#691-738 |
| Security hardening (validation, rate limits, anti-tampering) | ◐ | Order creation and admin actions use rate limiting and server-side validation. **Improved 2026-06-07**: Added `PaymentMethod` endpoint cross-validation, status guards on webhook updates, and balance checks before admin refunds. Broader review (CSRF, SSRF through webhooks, replay protection, additional audit tooling) still pending.@app/api/payment/order/route.ts#9-128 @app/api/admin/payments/route.ts#19-154 |
| Automatic crypto payments via MetaMask/EVM wallet | ❌ | Current crypto flow only generates manual instructions; no wallet integration exists yet.@app/api/payment/crypto/route.ts#20-80 @app/dashboard/topup/page.tsx#599-656 |
| Editable packages / pricing in admin dashboard | ✅ | `/admin/finances` has two tabs: (1) **Packages** — CRUD for preset top-up cards with amount, label, and sort order; (2) **Pricing** — edit base coin rate, method-specific rates (PayMongo, PayPal, GCash, Crypto), bonus tiers, and gateway minimums. Updates invalidate `public_config_v1` cache so the dashboard sees changes immediately.@app/admin/finances/page.tsx#1-700 @app/api/admin/finances/route.ts#1-346 |
| Super admin controls for top-up configs | ✅ | `/admin/finances` requires `isSuperAdmin` (`GameMasterLevel >= 4`). Only super admins can modify packages, pricing, and gateway settings. All changes are logged to `WebAuditLogs`.@app/admin/finances/page.tsx#1-50 @app/api/admin/finances/route.ts#19-40 |
| CI lint/test/build & deployment automation | ❌ | No automated CI pipeline. **Manual build verified 2026-06-07** (`npm run build` passed cleanly). |

## Gaps & Next Steps

### High Priority
1. **PayPal operational parity with PayMongo**
   - ✅ Add rate limiting to `/api/payment/paypal/create` and `/api/payment/paypal/capture`.
   - ✅ Build PayPal reconciliation cron (`/api/cron/paypal-reconcile`) to recheck pending PayPal orders older than 10 minutes.
   - ✅ Build PayPal auto-cancel/void cron to call `POST /v2/checkout/orders/{id}/cancel` for expired pending orders.
   - ✅ Raw webhook payload persistence for replay debugging (generic `WebhookPayloads` table; PayPal webhook uses it; PayMongo can adopt the same table).
2. **30-minute auto-cancel job**
   - PayMongo archive cron already exists (hourly). Still needed: scheduled sweep to mark `PaymentTransactions.Status = 'expired'` for orders past 30 minutes.
   - PayPal auto-cancel cron (see item 1 above).

### Medium Priority
3. **Crypto automation**
   - Plan integration with MetaMask or WalletConnect for EVM transactions, including on-chain confirmation to auto-award coins.
4. **Security hardening**
   - Perform penetration review (CSRF, SSRF through webhooks, replay protection, IP logging accuracy).
   - Expand audit logging to include more admin action context.
5. **Testing & CI**
   - Add automated tests for pricing calculations, order lifecycle, webhook awarding, and admin actions.
   - Wire `npm run lint` / `npm run build` into pre-commit or GitHub Actions.

### Done (2026-06-07)
- `fix:` PayMongo webhook event filtering and correct link ID extraction
- `fix:` PayPal webhook — only complete on `PAYMENT.CAPTURE.COMPLETED` (removed premature `CHECKOUT.ORDER.APPROVED` completion)
- `fix:` Admin payments page — parse `data.payments`, add filters, search, Approve/Reject/Refund buttons
- `fix:` Top-up coin preview — convert local amount to USD for non-USD currencies
- `fix:` Add `PaymentMethod` validation to PayMongo, PayPal, and Crypto creation APIs
- `fix:` Crypto credit calculation — use tiered `calculateCoins()` pricing instead of flat crypto rate
- `fix:` Admin reject/refund state guards + balance check before deducting coins on refund
- `chore:` Build verified (`npm run build` passed), committed with `fix:` prefix, pushed, and Next.js service restarted

### Done (2026-06-10)
- `feat:` Payment method-specific coin rates (`coin_rate_paymongo`, `coin_rate_paypal`, `coin_rate_crypto`, `coin_rate_gcash`) override base rate per gateway.
- `feat:` Admin `/admin/finances` Packages tab — full CRUD for `PaymentPackages` table.
- `feat:` Admin `/admin/finances` Pricing tab — edit base rate, method-specific rates, bonus tiers, gateway minimums, with cache invalidation on save.
- `feat:` Dashboard top-up preset cards with method-specific coin preview and local currency display.
- `feat:` Net revenue tracking and PHP equivalent in admin finances stats tab.
- `fix:` Cache invalidation (`public_config_v1`) after pricing updates so dashboard sees new rates immediately.
- `fix:` `awardCoins()` receives `paymentMethod` in all webhook, check, cron, and admin routes.
- `docs:` Created `docs/paymongo-runbook.md` covering webhook setup, event subscriptions, credential rotation, troubleshooting, and manual operations.

## Newly Added Requirements to Track

- Wallet extension support (MetaMask/WalletConnect) for crypto payments with automatic confirmation.
- ~~Admin-manageable coin packages and pricing variables restricted to super_admin/botro roles.~~ ✅ DONE 2026-06-10
- Comprehensive audit tooling for payment operations, including dashboards and granular permissions.
- Continuous integration pipeline to guard against regressions and enforce coding standards.

Keep this document updated as features progress. Pending items should move to "Current Coverage" with ✅ once complete.
