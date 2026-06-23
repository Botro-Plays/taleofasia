# Security & Compliance

- Authentication & Sessions
  - next-auth for session handling; protect dashboard/admin pages
  - `/api/admin/check` for role gating (admins/super admins)

- Authorization Rules
  - Writes on `/api/admin/website-config`, `/api/admin/pages/*` restricted to super admins
  - User-only endpoints validate session and ownership

- Input Validation
  - Sanitize/validate POST bodies (lengths, formats)
  - File Uploads: enforce size/type (BMP 32x32 for clan image), virus scanning where applicable

- Rate Limiting & Abuse Prevention
  - Voting reward: 12h cooldown enforcement
  - Consider per-IP rate limits for sensitive endpoints

- Data Exposure
  - Public API `/api/public/config` returns only public-safe links
  - Do not expose secrets/API keys in WebsiteConfigs

- Logging & Auditing
  - Admin actions logged (see admin logs module)
  - Error handling with non-sensitive messages client-side

- Compliance & Privacy
  - Privacy Policy and ToS pages mapped; verify data retention policies
  - Provide contact/support channel in footer
