# Tale of Conquest Web – Production Next.js Operations Guide

This runbook documents how to operate the production Next.js service that powers `taleofconquest.com` behind IIS/Cloudflare.

## Overview

- **Origin VPS:** Windows Server (92.42.47.104)
- **Reverse proxy:** IIS Site `taleofconquest.com` (`C:\inetpub\next-proxy`)
- **Next.js app:** `C:\taleofconquest-web`
- **Windows service:** `TaleOfConquestWeb` (managed via NSSM)
- **Logs:** `C:\taleofconquest-web\logs\next-out.log` and `next-err.log`

## Daily Operations

### Check Service Status
```powershell
Get-Service TaleOfConquestWeb
```
Status should be `Running`. If not, see “Restarting” or “Troubleshooting”.

### Check Application Health
- Browser: `https://taleofconquest.com/api/health`
- Curl (from server):
  ```powershell
  Invoke-WebRequest https://taleofconquest.com/api/health | Select-Object -ExpandProperty Content
  ```
Expect `{ "ok": true, ... }` response.

## Starting / Stopping / Restarting

### Start
```powershell
& "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" start TaleOfConquestWeb
```

### Stop
```powershell
& "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" stop TaleOfConquestWeb
```

### Restart (preferred method after config changes)
```powershell
& "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" restart TaleOfConquestWeb
```
> If you see `SERVICE_START_PENDING`, wait a few seconds and re-check status.

## Logs

- **Stdout (info):** `C:\taleofconquest-web\logs\next-out.log`
- **Stderr (errors):** `C:\taleofconquest-web\logs\next-err.log`

Tail the last lines:
```powershell
Get-Content C:\taleofconquest-web\logs\next-err.log -Tail 50
Get-Content C:\taleofconquest-web\logs\next-out.log -Tail 50
```

Common errors and fixes:
- `UntrustedHost`: Ensure `.env.production` has `NEXTAUTH_URL=https://taleofconquest.com` and `AUTH_TRUST_HOST=true`, then restart service.
- Database connection errors: verify SQL Server is reachable and credentials in `.env.production` are correct.

## Environment Configuration

- Primary env file: `C:\taleofconquest-web\.env.production`
- After editing, restart the service (`nssm restart TaleOfConquestWeb`).
- **Never** commit this file to git; secrets live only on the server.

### Required keys
```
NEXTAUTH_URL=https://taleofconquest.com
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET=<64-char hex>
DB_SERVER=92.42.47.104
DB_USER=web
DB_PASSWORD=<secret>
SMTP_HOST=mail.taleofconquest.com
SMTP_USER=noreply@taleofconquest.com
SMTP_PASS=<secret>
```

## IIS Configuration Notes

- Site path: `C:\inetpub\next-proxy`
- `web.config` contains:
  1. Redirect rule `www -> taleofconquest.com`
  2. Proxy rewrite to `http://localhost:3000/{R:1}`
- If changes are made, recycle the IIS site or run `iisreset`.

## Deployment Workflow

1. Pull latest repo changes (if required).
2. Update `.env.production` if needed.
3. Build:
   ```powershell
   cd C:\taleofconquest-web
   npm ci
   npm run build
   ```
4. Restart service:
   ```powershell
   & "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" restart TaleOfConquestWeb
   ```
5. Verify site + health endpoint.

## Troubleshooting Checklist

| Symptom | Possible Cause | Resolution |
| ------- | -------------- | ---------- |
| `502` / `503` from IIS | Service not running | `nssm start TaleOfConquestWeb` and check logs |
| Login fails with `UntrustedHost` | Missing `AUTH_TRUST_HOST` | Add to `.env.production`, restart |
| SQL errors (`Connection is closed`) | SQL server unreachable | Confirm DB service, firewall, credentials |
| Emails fail to send | SMTP credentials invalid | Update `.env.production` with correct SMTP settings |
| `/api/health` shows `error` | One of the DBs down | Investigate SQL Server status |

## Updating NSSM Settings

If you need to adjust service parameters:
```powershell
# View config
y "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" get TaleOfConquestWeb AppDirectory

# Change log location
& "C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe" set TaleOfConquestWeb AppStdout C:\new\path\next-out.log
```
> After changing logging paths, ensure directories exist to prevent startup failures.

## PayPal Operations

See `docs/paypal-runbook.md` for full details on webhook setup, credential rotation, sandbox vs. live, and troubleshooting.

### Quick Commands

```powershell
# Check PayPal backlog metrics (admin only)
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/paypal/backlog"

# List recent PayPal webhook payloads (admin only)
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/webhooks?provider=PayPal&limit=10"
```

### After Credential Rotation

```powershell
# 1. Update WebsiteConfigs (via /admin/website-config):
#    paypal_client_id, paypal_secret, paypal_webhook_id
# 2. Restart service:
nssm restart TaleOfConquestWeb
# 3. Send a test webhook from PayPal Developer Dashboard
# 4. Verify in WebAuditLogs that the test was received
```

### Common PayPal Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "PayPal webhook not configured" alert | Missing credentials in WebsiteConfigs | Add paypal_client_id, paypal_secret, paypal_webhook_id |
| "Invalid webhook signature" alert | Wrong paypal_webhook_id for sandbox/live | Verify webhook ID matches active environment |
| Webhooks not arriving | Cloudflare/IIS blocking | Check IIS logs; whitelist PayPal IPs in Cloudflare |
| Stuck pending orders | User abandoned checkout | paypal-reconcile cron auto-recovers; paypal-cancel cron auto-voids |
| Coins not awarded | awardCoins failed (user not in game DB) | Check WebAuditLogs; verify AccountName exists |

## Backup & Restore

1. Backup `.env.production` and `production.env.example` (contains template only).
2. Backup `C:\inetpub\next-proxy\web.config` for proxy rules.
3. Application code is in git (`main` branch).

## Contact / Escalation

- **Game server DBA:** Verify SQL health (login credentials `web` user).
- **Web devs:** Review repo `taleofconquest-web` for code issues.
- **Infra:** Check Cloudflare bindings, IIS site status, NSSM service.

Keep this runbook up to date when workflows or infrastructure change.
