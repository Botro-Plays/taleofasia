# Pre-Launch Plan & Checklist

- Functional Verification
  - [ ] Verify all UI-referenced APIs respond and match contracts (user, admin, rankings, voting)
  - [ ] Confirm `/api/voting/reward` cooldowns and logs
  - [ ] Test clan image upload constraints and error flows

- Content Readiness
  - [ ] Seed/verify WebsiteConfigs (discord/facebook)
  - [ ] Seed WebPages (about, server-rules, getting-started)
  - [ ] Populate downloads mirrors via Admin CMS

- Theming & UX
  - [ ] Spot-check pages for consistent header/back-button standards
  - [ ] Validate mobile responsiveness and accessibility on key flows

- Performance & Caching
  - [ ] Ensure `/api/public/config` cache working (10m)
  - [ ] Add caching to heavy rankings endpoints (TTL + pagination if needed)

- Redirects & SEO
  - [ ] Add IIS web.config rewrites for legacy PHP URLs → new routes
  - [ ] Validate meta/OG tags; ensure sitemap/robots present

- Security
  - [ ] Harden file uploads (size/type/MIME checks)
  - [ ] Add basic rate limiting to sensitive POST endpoints

- Monitoring & Logs
  - [ ] Centralize API error logging and admin action logs
  - [ ] Set up uptime/health checks

- Deployment
  - [ ] Configure environment variables for production
  - [ ] Database backups and rollback plan
  - [ ] Final smoke tests post-deploy
