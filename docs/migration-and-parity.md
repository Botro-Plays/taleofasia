# Migration & Parity Map

Legacy (wwwrootSSL) → New (Next.js)

- `/index.php` → `/` (App Router homepage)
  - Crown holders: `getCrownHolders.php` → `/api/crown-holders`
  - Social links: hardcoded → dynamic via `/api/public/config`

- `/download.php` → `/downloads`
  - System requirements and how-to retained as defaults
  - Mirrors now managed via Admin CMS (slug `downloads-links`)

- `/dashboard.php` → `/dashboard`
  - Profile/credits/time points/characters, voting, quick actions
  - GCash modal replaced with themed modal at `/dashboard/topup`

- `/characterDetails.php` → `/dashboard/characters`
- `/changePassword.php` → `/dashboard/change-password`
- Auth (`login.php`, `register.php`, `forgotPassword.php`) → `/login`, `/register`, `/forgot-password`
- `/privacy.php`, ToS → `/privacy-policy`, `/terms`

- Rankings endpoints (PHP) → `/api/rankings/*`
  - Level/PvP/Bellatra/Battle Royale

Redirects (IIS web.config suggested)
- `/download.php` → `/downloads`
- `/dashboard.php` → `/dashboard`
- `/characterDetails.php` → `/dashboard/characters`
- `/changePassword.php` → `/dashboard/change-password`
- `/privacy.php` → `/privacy-policy`
- `/index.php` → `/`

Notes
- Keep legacy hostnames/images reachable (e.g., Class icons, Clan images) or migrate assets with mapping.
- Voting `postback.php` mapped to `/api/voting/postback`; confirm external integration contract.
