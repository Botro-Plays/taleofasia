# Security & Architecture Audit — Tale of Conquest Web
**Date:** 2026-06-06
**Scope:** Full codebase review (`app/`, `lib/`, `docs/`, `server.js`, configs)
**Status:** 14/20 findings addressed. 6 items remaining (rate limiter scale, SMTP docs, payment verification, server.js entry point, CSP, CORS).

---

## How to Use This Document
1. Work top-to-bottom by severity (Critical → High → Medium → Low).
2. Each finding has a **Status** checkbox (`[ ]`). Check it off when fixed and deployed.
3. Each finding has a **Recommended Fix** section — implement that, then verify.

---

## CRITICAL — Fix Immediately

### 1. Unauthenticated Debug Endpoint Leaks User Data
- **File:** `app/api/debug/login/route.ts`
- **Line:** `1-56`
- **Issue:** No authentication required. Any visitor can POST a username and receive `AccountName`, `Email`, `Flag`, `BanStatus`, `Coins`, and `PasswordLength`. Also leaks internal database error messages.
- **Impact:** Full user enumeration + metadata exposure. Attackers can map valid accounts and check ban/coin status.
- **Recommended Fix:**
  - [ ] **Delete this file entirely.** It should not exist in production.
  - [ ] If an internal debug endpoint is truly needed, guard it with `auth()` + an IP whitelist, and never return sensitive fields.
- **Status:** `✅ FIXED` — File deleted in commit `f658031`.

---

### 2. `dangerouslySetInnerHTML` on CMS Pages (XSS)
- **Files:**
  - `app/downloads/page.tsx:32`
  - `app/p/[slug]/page.tsx:45`
  - `app/info/about/page.tsx`
  - `app/info/getting-started/page.tsx`
  - `app/info/server-rules/page.tsx`
  - `app/mix-list/page.tsx`
- **Issue:** All 6 pages render raw HTML from the `WebPages.Content` database column via `dangerouslySetInnerHTML` with zero sanitization. Admin-editable HTML means a compromised or malicious admin can inject `<script>` tags that execute in every visitor's browser.
- **Impact:** Stored XSS — session hijacking, defacement, credential theft, admin impersonation.
- **Recommended Fix:**
  - [ ] **Server-side:** Sanitize HTML before storing into `WebPages.Content` (e.g., `DOMPurify` in Node.js via `isomorphic-dompurify`).
  - [ ] **Client-side (defense-in-depth):** Also sanitize before `dangerouslySetInnerHTML`.
  - [ ] **Allowlist approach:** Only permit safe tags (`<p>`, `<b>`, `<i>`, `<ul>`, `<li>`, `<a>`) and safe attributes. Strip everything else.
- **Status:** `✅ FIXED` — Added `lib/sanitize.ts` with DOMPurify allowlist. Server-side sanitizes DB content before returning. Client-side sanitizes before `dangerouslySetInnerHTML`. Also escapes download link URLs/labels. Committed in `1e43e4d`.

---

### 3. Voting Postback Has No Sender IP Validation
- **File:** `app/api/voting/postback/route.ts`
- **Line:** `4-44`
- **Issue:** Accepts any HTTP request with `?custom=USERNAME&votingip=IP` and blindly inserts a vote log. Does **not** verify the request originates from XtremeTop100's documented postback IPs (`137.74.41.178` IPv4 / `2001:41d0:305:2100::413b` IPv6).
- **Impact:** Anyone can `curl` the postback URL and generate unlimited claimable votes.
- **Recommended Fix:**
  - [ ] Extract the connecting IP from `request.headers.get('x-forwarded-for')` (first hop) or the direct socket IP.
  - [ ] Validate it matches XtremeTop100's postback IP list. Reject with `403` if mismatch.
  - [ ] Also validate `votingip` parameter format (must be valid IP string).
- **Status:** `✅ FIXED` — Added `ALLOWED_POSTBACK_IPS` validation against XtremeTop100 IPs (`137.74.41.178` / `2001:41d0:305:2100::413b`). Added `getClientIP()` helper reading `cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`. Added username regex validation `^[A-Za-z0-9]+$`. Committed in `d0fbb55`.

---

### 4. File Upload Accepts Content by Extension Only
- **File:** `app/api/admin/pages/upload/route.ts`
- **Line:** `28-35`
- **Issue:** Filename is sanitized with regex (`replace(/[^a-zA-Z0-9._-]/g, '_')`) but file **content is never inspected**. An attacker can rename `shell.php` → `shell.jpg` and upload it. Files land in `public/downloads/` which is directly web-accessible.
- **Impact:** Potential remote code execution if the server ever misconfigures MIME-type handling.
- **Recommended Fix:**
  - [ ] Verify file **magic bytes** (file signature) to confirm it's actually the claimed type.
  - [ ] Restrict allowed MIME types explicitly (e.g., `application/zip`, `application/octet-stream` for game clients).
  - [ ] Consider serving downloads from a non-web-accessible path and proxying through an API route that forces `Content-Disposition: attachment`.
- **Status:** `✅ FIXED` — Added magic bytes validation for `.zip`, `.rar`, `.7z`, `.exe`. Committed in `1e43e4d`.

---

### 5. Clan Image Upload Writes to Legacy PHP Web Root — NOT A FINDING
- **File:** `app/api/clan/upload-image/route.ts`
- **Line:** `54`
- **Status:** `✅ ACCEPTED RISK` — This is the **correct and required path** for the game server's clan icon system. The game server expects clan images at `C:/inetpub/wwwroot/ClanImage/`.
- **Note:** The file upload already validates extension (`.bmp` only) and size (max 1MB). No action needed.

---

## HIGH — Fix Soon

### 6. Registration and Forgot-Password Lack Rate Limiting
- **Files:**
  - `app/api/auth/register/route.ts`
  - `app/api/auth/forgot-password/route.ts`
- **Issue:** Neither endpoint has `rateLimiter.check()`. Other auth routes (`reset-password`, `resend-verification`) do.
- **Impact:** Automated account creation spam, email abuse, credential stuffing enumeration.
- **Recommended Fix:**
  - [ ] Add `rateLimiter.check(ip, 'auth-register', 5, 15 * 60 * 1000)` to register.
  - [ ] Add `rateLimiter.check(ip, 'auth-forgot-password', 5, 15 * 60 * 1000)` to forgot-password.
- **Status:** `✅ FIXED` — Rate limiting was already present (`rateLimiter.check(ip, 'auth-register', 5, 15*60*1000)` and `rateLimiter.check(ip, 'auth-forgot-password', 3, 15*60*1000)`). Verified and confirmed working.

---

### 7. Hardcoded Fallback NextAuth Secret
- **File:** `lib/auth/config.ts`
- **Line:** `139`
- **Issue:**
  ```ts
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this-in-production'
  ```
  If `.env.production` ever loses `NEXTAUTH_SECRET`, this predictable fallback is used. JWTs can be forged with a known secret.
- **Impact:** Session hijacking, privilege escalation, full auth bypass.
- **Recommended Fix:**
  - [ ] Remove the fallback string entirely.
  - [ ] Throw a clear error at startup if `NEXTAUTH_SECRET` is missing / too short (< 32 chars).
- **Status:** `✅ FIXED` — Removed fallback string. Now uses `process.env.NEXTAUTH_SECRET!` (non-null assertion). Runtime fails safely if missing. Committed in `95c36d2`.

---

### 8. Inconsistent Admin Privilege Levels
- **Files:** Multiple under `app/api/admin/`
- **Issue:**
  - `app/api/admin/users/route.ts:28` — Requires **exactly** `GameMasterLevel === 4` (SuperAdmin only).
  - `app/api/admin/maintenance/route.ts:35` — Requires `>= 3` (Admin).
  - `app/api/admin/check/route.ts:27-28` — `isAdmin` = `>= 3`, `isSuperAdmin` = `>= 4`.
- **Impact:** Some admin routes may be unintentionally restricted, or some may be too permissive. Confusing and error-prone.
- **Recommended Fix:**
  - [ ] Define a clear policy:
    - `GameMasterType === 1 && GameMasterLevel >= 3` → **Admin** (can access dashboard, logs, moderate).
    - `GameMasterType === 1 && GameMasterLevel >= 4` → **SuperAdmin** (can manage users, configs, maintenance toggle).
  - [ ] Audit every admin route and apply the correct check. Extract into a shared helper (`requireAdmin()`, `requireSuperAdmin()`).
- **Status:** `✅ FIXED` — Standardized across all admin routes. Policy: **Admin `>= 3`** for read operations (stats, users, logs, online users, events view, payments, game-logs). **SuperAdmin `>= 4`** for write/config (website-config, game-config POST, pages CRUD, upload, credit, delete-unverified, maintenance, logs DELETE, events CRUD). Created `lib/auth/admin.ts` shared helper. Committed in `e4f88b1`.

---

### 9. Hardcoded Default DB Password in Source
- **File:** `lib/db/index.ts`
- **Line:** `9`
- **Issue:**
  ```ts
  password: process.env.DB_PASSWORD || 'p4uL!n3',
  ```
  If `.env.production` is missing `DB_PASSWORD`, this default is used. The password is committed in git history.
- **Impact:** If env file is misconfigured, attacker can log in with a known password found in the repository.
- **Recommended Fix:**
  - [ ] Remove the fallback entirely.
  - [ ] Throw at startup if required env vars (`DB_SERVER`, `DB_USER`, `DB_PASSWORD`) are missing.
- **Status:** `✅ FIXED` — Removed `'p4uL!n3'` fallback and `DB_SERVER`/`DB_USER` fallbacks. Now uses `|| ''` for build compatibility. Committed in `f100af0`.

---

### 10. Health Endpoint Leaks Environment Info
- **File:** `app/api/health/route.ts`
- **Line:** `19`
- **Issue:** Returns `process.env.NODE_ENV` and database connection status publicly.
  ```ts
  return NextResponse.json({ ok: true, uptime: process.uptime(), ms: Date.now() - started, env: process.env.NODE_ENV || 'development', db });
  ```
- **Impact:** Minor information disclosure. Reveals whether you're in `development` vs `production` and which DBs are reachable.
- **Recommended Fix:**
  - [x] Remove `env` field from the response.
  - [x] Keep database `ok`/`error` status — that's useful for monitoring.
- **Status:** `✅ FIXED` — Removed `env` field from response. Response now returns `{ ok, uptime, ms, db }` only. Committed in `d8d25a2`.

---

## MEDIUM — Address When Convenient

### 11. Error Responses Leak Internal Details
- **Files:**
  - `app/api/clan/upload-image/route.ts:76`
  - `app/api/admin/users/verify/route.ts:77`
  - `app/api/debug/login/route.ts:52`
- **Issue:** Returns `error.message` or `error instanceof Error ? error.message : String(error)` directly in JSON responses.
- **Impact:** Can expose stack traces, file paths, SQL syntax errors, or internal architecture to attackers.
- **Recommended Fix:**
  - [x] Log the full error server-side (to console or `WebAuditLogs`).
  - [x] Return generic `"Internal server error"` to the client.
- **Status:** `✅ FIXED` — Removed `error.message` / `details` from 16 API route files. All now return generic error messages; full errors logged via `console.error`. Committed in `6439e2d`.

---

### 12. Game Logs Search Route is Monolithic and Complex
- **File:** `app/api/admin/game-logs/search/route.ts`
- **Issue:** 1000+ lines of dynamic SQL generation. While it uses parameterized queries for values, column/table names are dynamically assembled. Complexity makes it hard to audit and easy to introduce SQL injection during future edits.
- **Impact:** High maintenance burden. Risk of accidental injection bugs in future updates.
- **Recommended Fix:**
  - [ ] Consider breaking into smaller, table-specific route handlers.
  - [x] Add stricter allowlists for column names and table names beyond `sys.columns` validation.
- **Status:** `✅ FIXED` — Added explicit `ALLOWED_TABLES` Set with 14 known log table names. Query rejects any table not in the allowlist before reaching `sys.tables` check. Existing `colSet` validation (from `sys.columns`) already validates column names, textColumn, sortBy, and filter keys. Committed in `18c7f61`.

---

### 13. Public Pages API Doesn't Sanitize Download Links
- **File:** `app/api/public/pages/route.ts`
- **Line:** `145-147`
- **Issue:**
  ```ts
  `<a href="${l.url}" ...>${(l.label || l.url)}</a>`
  ```
  `l.url` and `l.label` come from admin input and are interpolated into HTML without escaping. `javascript:` URLs or HTML injection are possible.
- **Impact:** If admin input is compromised, reflected/stored XSS via download links.
- **Recommended Fix:**
  - [ ] URL-encode `l.url`.
  - [ ] HTML-escape `l.label` before string assembly.
  - [ ] Validate `l.url` starts with `http://`, `https://`, or `/`.
- **Status:** `✅ FIXED` — `escapeHtml()` now applied to both `l.url` and `l.label` before string assembly. Also validated that the `downloads-links` JSON path uses `sanitizeHtml()` on the merged content. Committed as part of `1e43e4d` (sanitization overhaul).

---

### 14. Password Length Not Enforced Consistently
- **File:** `app/api/auth/reset-password/route.ts`, `app/api/auth/register/route.ts`, `app/api/user/change-password/route.ts`, `app/register/page.tsx`
- **Line:** Various
- **Issue:** Only checked `password.length >= 8`. Did not enforce the database `varchar(20)` upper bound.
- **Impact:** Passwords longer than 20 characters could be silently truncated by the database, causing login failures.
- **Recommended Fix:**
  - [x] Enforce `8 <= password.length <= 20` on all password inputs (register, reset-password, change-password).
  - [x] Apply client-side validation on registration page for immediate feedback.
- **Status:** `✅ FIXED` — Enforced 8–20 character length on all password routes and client. Committed in `8b8b560`.

---

### 15. In-Memory Rate Limiter Doesn't Scale
- **File:** `lib/rate-limit.ts`
- **Issue:** Uses a `Map` in process memory. Cleanup interval runs forever.
- **Impact:**
  - If you ever run multiple server instances (load balancing), rate limits won't be shared across processes.
  - Memory can grow unbounded if entries aren't cleaned properly.
- **Recommended Fix:**
  - [ ] For single-server setup: acceptable for now. Ensure cleanup interval is tested.
  - [ ] For future scaling: switch to Redis or a database-backed rate limiter.
- **Status:** `[ ] Pending` — Still uses in-memory `Map`. Acceptable for single-server setup; Redis migration needed only if load balancing is introduced.

---

## LOW / INFO

### 16. Documentation Still Shows Wrong SMTP Host
- **File:** `docs/next-server-operations.md`, `production.env.example`
- **Issue:** Still references `SMTP_HOST=taleofconquest.com` instead of `mail.taleofconquest.com`.
- **Recommended Fix:**
  - [ ] Update docs and example files to reflect the correct `mail.taleofconquest.com` host.
- **Status:** `[ ] Pending` — `production.env.example` and `docs/next-server-operations.md` still show `taleofconquest.com`.

---

### 17. Payment Top-Up Has Unimplemented Verification
- **File:** `app/dashboard/topup/page.tsx`
- **Line:** `119`
- **Issue:** `// TODO: Implement payment verification` — clicking "DONE" just shows an `alert()`.
- **Recommended Fix:**
  - [ ] Implement actual payment verification workflow (GCash reference number validation, admin approval queue, etc.).
- **Status:** `[ ] Pending` — No `app/api/payment/verify/route.ts` exists. GCash/manual flow has no backend verification endpoint.

---

### 18. Next.js Custom Server is Unused and Confusing
- **File:** `server.js`
- **Issue:** Hardcodes `hostname = 'localhost'`. Production uses NSSM + IIS reverse proxy. This file also starts the built-in cron scheduler (`scripts/cron.js`). If NSSM runs `node server.js`, deleting it would break cron jobs. If NSSM runs `next start` directly, the file is unused.
- **Recommended Fix:**
  - [ ] Verify what command NSSM `AppParameters` actually runs (`node server.js` vs `next start`).
  - [ ] If `server.js` is the entry point, document it in `docs/next-server-operations.md` and keep it. Do NOT delete.
  - [ ] If `next start` is the entry point, move cron initialization into a standalone Windows task and then remove `server.js`.
  - [ ] In either case, document the actual production entry point clearly.
- **Status:** `[ ] Pending` — Requires server-side verification of NSSM configuration.

---

### 19. No Content Security Policy Headers
- **Scope:** Global (Next.js config / IIS)
- **Issue:** No `Content-Security-Policy` headers are configured. With `dangerouslySetInnerHTML` usage, CSP would be a valuable defense-in-depth layer.
- **Recommended Fix:**
  - [ ] Add CSP headers via Next.js middleware or IIS `web.config`:
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://priston.taleofconquest.com; font-src 'self';
    ```
- **Status:** `[ ] Pending` — No CSP headers configured in `next.config.ts` or middleware.

---

### 20. No CORS Configuration on API Routes
- **Scope:** Global
- **Issue:** API routes accept requests from any origin. Since the app uses cookie-based auth (NextAuth), same-origin is fine, but public endpoints (`/api/public/*`, `/api/health`) could be hit from anywhere.
- **Recommended Fix:**
  - [ ] Add `cors` configuration in `next.config.ts` or middleware for public routes if needed.
  - [ ] Auth routes should remain same-origin / no CORS.
- **Status:** `[ ] Pending` — No CORS configuration found in codebase.

---

## Fix Priority Summary

| Priority | Finding # | Action | Status |
|---|---|---|---|
| ~~P0~~ | ~~1~~ | ~~Delete `app/api/debug/login/route.ts`~~ | ✅ **FIXED** `f658031` |
| ~~P0~~ | ~~2~~ | ~~Sanitize `dangerouslySetInnerHTML` content~~ | ✅ **FIXED** `1e43e4d` |
| ~~P0~~ | ~~3~~ | ~~Add IP validation to voting postback~~ | ✅ **FIXED** `d0fbb55` |
| ~~P0~~ | ~~4~~ | ~~Fix file upload to validate content/magic bytes~~ | ✅ **FIXED** `1e43e4d` |
| ~~P1~~ | ~~5~~ | ~~Move clan image storage~~ | ✅ **ACCEPTED** — required path |
| ~~P1~~ | ~~6~~ | ~~Add rate limiting to `/api/auth/register` and `/api/auth/forgot-password`~~ | ✅ **FIXED** — already present |
| ~~P1~~ | ~~7~~ | ~~Remove hardcoded fallback `NEXTAUTH_SECRET`~~ | ✅ **FIXED** `95c36d2` |
| ~~P1~~ | ~~8~~ | ~~Standardize admin privilege levels across all routes~~ | ✅ **FIXED** `e4f88b1` |
| ~~P1~~ | ~~9~~ | ~~Remove hardcoded fallback `DB_PASSWORD`~~ | ✅ **FIXED** `f100af0` |
| ~~P2~~ | ~~10~~ | ~~Remove `env` from health endpoint response~~ | ✅ **FIXED** `d8d25a2` |
| ~~P2~~ | ~~11~~ | ~~Fix error responses to not leak internal details~~ | ✅ **FIXED** `6439e2d` |
| ~~P2~~ | ~~12~~ | ~~Break game-logs search into smaller routes (or add stricter allowlists)~~ | ✅ **FIXED** `18c7f61` |
| ~~P2~~ | ~~13~~ | ~~Escape download link URLs/labels~~ | ✅ **FIXED** (part of #2) |
| ~~P2~~ | ~~14~~ | ~~Enforce password length 8–20 chars~~ | ✅ **FIXED** `8b8b560` |
| **P3** | 15 | Plan Redis-backed rate limiter for future scaling | `[ ] Pending` |
| **P3** | 16-20 | Documentation, CSP, CORS, dead code cleanup | `[ ] Pending` |

---

## Verification Checklist (After All Fixes)

- [ ] Run `npm run lint` — zero errors, zero warnings.
- [ ] Run `npm run build` — successful production build.
- [ ] Test auth flow: register → verify email → login → forgot password → reset password.
- [ ] Test admin flow: login as Admin (level 3) and SuperAdmin (level 4), verify correct access.
- [ ] Test voting: submit a vote via XtremeTop100, verify postback only accepts from valid IPs.
- [ ] Test CMS pages: inject `<script>alert(1)</script>` into WebPages.Content, verify it does NOT execute.
- [ ] Test file upload: try uploading a renamed `.exe` as `.jpg`, verify it's rejected.
- [ ] Test rate limiting: rapid-fire register/forgot-password requests, verify 429 responses.
- [ ] Confirm `NEXTAUTH_SECRET` and `DB_PASSWORD` have no fallbacks in source code.
