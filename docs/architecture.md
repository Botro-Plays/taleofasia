# Architecture Overview

- Stack
  - Next.js 16 App Router (TypeScript, React)
  - Styling: TailwindCSS + MMORPG theme CSS
  - Auth: next-auth (session-aware UI, role checks via API)
  - Databases: MSSQL via lib/db exports (webDB, serverDB, clanDB, logDB, userDB, gameDB)
  - Caching: In-memory helper lib/cache.cached (TTL + in-flight de-dupe)

- App Structure
  - Public pages under `app/` (e.g., `/`, `/downloads`, `/info/*`, `/rankings`)
  - User dashboard pages under `app/dashboard/*`
  - Admin pages under `app/admin/*`
  - API routes under `app/api/**/route.ts`
  - Global layout/theme via `app/components/GlobalTheme.tsx`

- Content System
  - WebPages table (slug, title, content HTML)
  - Special slug `downloads-links` stores JSON with mirrors
  - WebsiteConfigs table stores site-wide config (e.g., social links)

- Data Flow Highlights
  - Public content: `/api/public/pages?slug=...` reads WebPages or defaults
  - Social links: `/api/public/config` aggregates WebsiteConfigs (robust key match) with 10-min cache
  - Rankings: `/api/rankings/*` pull live data
  - Dashboard: user, voting logs, time points via `/api/user/*`
  - Admin: config/stats/pages/events/logs via `/api/admin/*`

- Theming & Layout
  - GlobalTheme wraps all pages for consistent nav/footer
  - Medieval fonts, metallic cards, glow effects
  - Standard header pattern with right-aligned back button on sub-pages

- RBAC
  - `GET /api/admin/check` used client-side to gate Admin
  - Super Admin gates on sensitive endpoints (e.g., website-config write, pages management)

- Uploads
  - Admin uploads (downloads links helper) and Clan image upload endpoints accept files
  - Server-side validation required (size/type), see Security doc
