# Post-Audit To-Do List

> Generated from full project audit on 2026-06-03.

---

## 1. Fix Password Reset Email

- **Location**: `app/api/auth/forgot-password/route.ts` (`// TODO: Send password reset email` was resolved)
- **Issue**: Endpoint accepts email and now sends an actual reset message via `sendPasswordResetEmail()`.
- **Status**: ✅ DONE — Uses `lib/mail.ts` with SMTP/Resend/Zoho provider support. Creates `WebPasswordResets` token with 1-hour expiry.

## 2. Fix Registration Verification Email

- **Location**: `app/api/auth/register/route.ts` (`// TODO: Send verification email` was resolved)
- **Issue**: New accounts are created and verification email is now dispatched.
- **Status**: ✅ DONE — Uses `sendVerificationEmail()` from `lib/mail.ts`. Creates `WebVerificationTokens` with 24-hour expiry.

## 3. Implement Payment Verification

- **Location**: `app/api/payment/verify/route.ts` — **FILE DOES NOT EXIST**
- **Issue**: No backend payment verification endpoint exists for GCash/manual flows.
- **Status**: ❌ NOT DONE — The referenced file was never created. The admin `/admin/payments` page has approve/reject/ refund actions, but there is no automated GCash reference-number verification endpoint.

## 4. Address PostCSS XSS Vulnerability

- **Severity**: Moderate
- **Advisory**: GHSA-qx2v-qp2m-jg93 — PostCSS < 8.5.10 has XSS via unescaped `</style>` in CSS stringify output
- **Impact**: Affects `next` and `next-auth` dependency chain
- **Action**: Bump `postcss` to >= 8.5.10. Do **not** use `npm audit fix --force` (it would downgrade Next.js to 9.3.3). Pin the fixed version manually and verify build still passes.

## 5. Update API Documentation

- **File**: `docs/apis.md`
- **Missing endpoints**:
  - `POST /api/admin/game-logs/search` — filtered log search
  - `GET /api/admin/game-logs/meta` — table metadata
  - `GET /api/admin/game-logs/layout` — layout retrieval
  - `POST /api/admin/game-logs/layout` — layout save
- **Action**: Add these to the Admin section with request/response examples.

## 6. Clean Up Untracked Scripts

- **Folder**: `scripts/`
- **Files present**:
  - `add-reset-button.js`
  - `game-logs-customize-db-2.js`
  - `game-logs-customize-db-fix.js`
  - `game-logs-customize-db.js`
  - `game-logs-customize-dnd-and-search.js`
  - `game-logs-customize-search-panel.js`
- **Status**: ◐ PARTIALLY DONE — `scripts/README.md` exists and documents 6 scripts. However, all one-off scripts remain in `scripts/` root instead of being moved to `scripts/archive/` or deleted. The README itself says "Decide whether these scripts should be committed or deleted." No decision has been made.

---

## SMTP Reference (from old site `wwwrootSSL/global/email_settings.php`)

| Setting | Value |
|---------|-------|
| **Host** | `taleofconquest.com` |
| **Port** | `465` |
| **Encryption** | `SMTPS` (SSL) |
| **Username** | `noreply@taleofconquest.com` |
| **Password** | `p4uL!n3Fa1tH01242017` |
| **Recipients** (notification list) | `cryptocon.quest.alt@gmail.com`, `aquariusbotro@gmail.com`, `x19.loner@gmail.com` |

Use this configuration when wiring up the new Next.js mailer (e.g. via `nodemailer` or a mail service wrapper). Store credentials securely in environment variables, never commit them.

---

## Bonus (non-blocking)

- Run `npm run lint -- --fix` to auto-fix 8 fixable warnings.
- Update `docs/admin-game-logs-standards.md` to mark completed standards as done.
- Update `docs/architecture.md` Next.js version mention (currently says "13" but project uses 16.2.6).
- Update `docs/admin-game-logs-standards.md` to reflect that the "Active Work" items are now implemented.
