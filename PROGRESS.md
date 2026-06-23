# Tale of Asia Web — Active Tasks

> Last updated: 2026-06-04
> Update this file at the end of every session so the next session picks up where we left off.

---

## Completed (This Session)

- [x] **`/admin/online-users` page**
  - API route with admin auth + rate limiting
  - Table: AccountName, CharacterName, IP, Class, Level, Ticket, LoginTime, ElapsedTime
  - Country flags via ipinfo.io with caching
  - IP detail modal (country, ASN, ISP)
  - Auto-refresh every 60s with tab visibility awareness
  - Standardized LoginTime date format (`MM/DD/YY HH:mm:ss GMT+8`)
  - Uniform "Back to Admin Dashboard" button (same style as other `/admin` subpages)

- [x] **Admin dashboard clickable stat cards**
  - Total Users → `/admin/users`
  - Online Users → `/admin/online-users` (renamed from Active Sessions)
  - Pending Payments → `/admin/payments`
  - Hover effects + "Click to view details →" hint text

- [x] **Fixed `npm ci` failure**
  - Root cause: `nodemailer@^8.0.10` conflicted with `next-auth` peerOptional `^7.0.7`
  - Downgraded `nodemailer` → `^7.0.13`, `@types/nodemailer` → `^7.0.11`
  - Regenerated `package-lock.json`; verified `npm ci` passes

- [x] **Fixed Event Management emoji icon**
  - Was displaying as `?` due to file encoding corruption; restored to `🎉`

---

## Next Up

1. [x] **`/admin/game-logs`: PvPHonorLog HonorType filter UI** ✅ (Already implemented)
   - Gold / Silver / Bronze dropdown present in search card for `PvPHonorLog`
   - Backend filters `HonorType` (`1→Gold`, `2→Silver`, `3→Bronze`)
   - Also works for `BellatraHonorLog` (`51→Gold`, `52→Silver`, `53→Bronze`)

2. [x] **`/admin/game-logs`: Quick column visibility toggles** ✅
   - Added "☰ Columns (X/Y)" dropdown above the table
   - Checkboxes for each column to quickly show/hide without opening Customize panel
   - Session-only (not persisted to DB); works for all admins
   - Click outside overlay to close dropdown

3. [x] **`/admin/game-logs`: Verify layout customization persistence** ✅
   - `botro`-only edit: Backend POST rejects non-botro with 403; frontend hides Customize/Save/Reset for non-botro
   - `hiddenTables`: Non-botro auto-redirected away from hidden tables; botro unaffected (early return in effect)
   - Layout persisted to `WebDB.AdminLayouts` with `Slug='admin-game-logs'`, `OwnerAccount='botro'`

---

## Backlog / Ideas

- [x] **DB connection pool error**: `"Connection is closed"` in `lib/db/index.ts` ✅
  - Root cause: `idleTimeoutMillis: 30000` matched SQL Server's ~30s remote timeout → race condition where SQL Server closed connection first, pool gave out dead connection
  - Fix:
    - Lowered `idleTimeoutMillis` 30000 → 15000 (pool closes before SQL Server)
    - Added `acquireTimeoutMillis: 5000` (fail fast on exhausted pool)
    - Added pool `error` event handler to auto-clear dead pools
    - Added retry logic in `query()`: detects "Connection is closed", destroys pool, retries up to 2x
    - Fixed `getPool` to check `pool.connected` instead of non-existent `pool.closed`
- [ ] **System Status card**: Make it useful (e.g. link to server config or show uptime)
- [ ] **Admin page consistency audit**: Review all `/admin/*` pages for uniform button ordering and Back-to-Admin placement
- [ ] **Performance audit**: Check if any other packages drifted during the nodemailer downgrade

---

## Session Notes

- Dev server runs on `localhost:3000` (restart after `npm ci` if needed)
- Database connection pools defined in `lib/db/index.ts`
- Game-logs layout owner locked to `botro` (case-insensitive)
