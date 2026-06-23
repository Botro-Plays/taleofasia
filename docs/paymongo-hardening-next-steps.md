# Suggested Next Steps for PayMongo Hardening

## 1. Add Alerting & Monitoring
**Target:** Visibility into webhook failures, delayed settlements, and abnormal transaction trends.  
**Why it matters:** Silent failures (missed webhooks, database errors, stuck pendings) erode trust and delay customer support response.  
**How to address it:**
- **Alert hooks:** Emit structured events whenever signature verification fails, database updates affect zero rows, or a transaction stays `pending` beyond a defined threshold. Integrate with existing notification channels (Slack, Teams, OpsGenie).
- **Dashboards:** Track transaction volume, success/failure/error counts, average pending duration, and webhook latency. Highlight anomalies (e.g., pending queue spikes or sudden failure clusters).
- **Action:** Instrument webhook and `/check` endpoints with logging plus alerting, pipe metrics to centralized monitoring (or send SMTP alerts directly—see below), and define alert thresholds with an on-call escalation path.
- **Status (2026-06-09):** Implemented. Webhook, dashboard polling, and reconciliation cron now emit `PAYMONGO_ALERT` audit entries and send deduplicated SMTP emails (via `/admin/website-config` settings) for signature failures, missing secrets, reconciliation errors, and growing backlogs. Configure recipient list in `WebsiteConfigs.paymongo_alert_recipients` (fallback: `PAYMONGO_ALERT_EMAILS` env). Aggregate summaries (e.g., hourly) can still be routed to third-party dashboards if desired.

## 2. Automated Reconciliation
**Target:** Transactions stuck in `pending` because of missed or delayed PayMongo events.  
**Why it matters:** Manual recovery is slow and error-prone, leading to customer churn and increased support workload.  
**How to address it:**
- **Scheduled job:** Use the cron framework to re-run `/api/payment/paymongo/check` for any `pending` transactions older than 10 minutes.
- **Admin UI signals:** Surface “stale” pending transactions with age, last check result, and manual retry actions.
- **Action:** Implement a recurrent task (e.g., every 5 minutes) that pulls pending rows, retries status checks, and logs outcomes. Augment the admin dashboard with flags and manual reconciliation tools.
- **Status (2026-06-09):** Implemented. Windows scheduled task `TaleOfConquest\\PaymongoReconcile` now runs every 5 minutes via `invoke-cron.ps1`, `/admin/finances` exposes stale pending highlights plus a "Run reconcile" control, and `/admin/cron` lists the job with manual execution support.

## 3. Rate Limiting & Abuse Prevention
**Target:** Automated or malicious attempts to spam payment link creation or brute-force order endpoints.  
**Why it matters:** Spikes can exhaust PayMongo quotas, generate fraudulent links, or DOS the backend.  
**How to address it:**
- **Middleware limits:** Apply per-IP/session quotas (for example, X requests per minute) on `/api/payment/order` and `/api/payment/paymongo`.
- **Security logging:** Record throttled attempts and suspicious patterns in `WebAuditLogs` for investigation.
- **Action:** Integrate a rate-limiting middleware (e.g., Redis-backed) with exponential backoff. Set alerts for repeated violations and consider temporary IP bans after threshold breaches.
- **Status (2026-06-09):** Implemented. `/api/payment/order`, `/api/payment/paymongo`, and `/api/payment/paymongo/check` now apply per-IP/user limits (10/6/30 req per minute respectively), emit 429 responses with retry hints, and persist throttle events to `WebAuditLogs` for auditing. Future hardening: add adaptive back-off and on-call alerts for repeated offenders.

## 4. Comprehensive Testing (❌)
**Target:** Confidence that the integration handles real-world scenarios and prevents regressions.  
**Why it matters:** Payment flows are high-risk; untested edge cases lead to revenue loss and reputational damage.  
**How to address it:**
- **Automated tests:** Create integration tests that mock PayMongo responses to validate signature checks, duplicate events, API failures, and fallback awarding logic.
- **Manual validation:** Run PayMongo test cards covering success, failure, cancellation, delayed webhook, and duplicate event scenarios.
- **Action:** Extend the test suite to cover API routes (`order`, `paymongo`, `webhook`, `check`) with recorded fixtures. Document a manual test playbook and incorporate it into CI to block regressions.

## 5. Documentation & Runbooks (✅)
**Target:** Operational readiness and rapid incident resolution.  
**Why it matters:** Clear references reduce downtime, onboarding time, and human error during incidents.  
**How to address it:**
- **Runbook content:** Document steps for secret rotation, reprocessing failed awards, analyzing audit logs, and using admin tools.
- **Training:** Conduct walkthroughs for support/admin staff on interpreting `WebAuditLogs`, recognizing alert patterns, and escalating issues.
- **Action:** Produce a dedicated "PayMongo Operations Guide" in the docs repository. Update onboarding materials and ensure all rotations have practiced the procedures.
- **Status (2026-06-10):** Created `docs/paymongo-runbook.md` covering webhook URL (`/api/payment/paymongo/webhook`), required event subscriptions (6 types), test vs. live switching, safe credential rotation steps, troubleshooting 6 common issues (missing secret, signature mismatch, webhooks not arriving, coins not awarded, stuck pending, cross-project webhooks), manual webhook replay, manual status check retry, and cron trigger procedures.@docs/paymongo-runbook.md

## 6. Secret Rotation Policy (❌)
**Target:** Long-lived PayMongo keys and webhook secrets that become attack vectors if compromised.  
**Why it matters:** Regular rotation minimizes blast radius and aligns with PCI/security best practices.  
**How to address it:**
- **Rotation cadence:** Establish a quarterly (or per-incident) rotation schedule for API keys and webhook secrets.
- **Automated workflow:** Script a safe sequence: generate new secret in PayMongo → update environment/config → redeploy → verify → revoke old secret.
- **Action:** Document and automate the rotation pipeline, adding checklist items (e.g., update PayMongo dashboard, refresh `.env`, redeploy). Track completion in change-management logs.

---
**Overall Outcome (2026-06-10):** PayMongo now has operational maturity comparable to a production payment gateway (alerts, reconciliation, rate limiting, archive cron, runbooks). Items 4 and 6 (testing, secret rotation automation) still need attention. PayPal has now caught up with parity (rate limiting, reconciliation, cancel cron, webhook payload persistence, backlog metrics, runbooks).
