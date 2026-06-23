# API Reference (Current)

- Public
  - GET `/api/public/config`
    - Response: `{ social: { discord?: string, facebook?: string } }`
    - Source: WebsiteConfigs (first key containing 'discord' or 'facebook'), 10-min cached
  - GET `/api/public/pages?slug=<slug>`
    - Returns `{ title, content (HTML), updatedAt?, source }`
    - Special handling for `downloads` to merge structured mirrors JSON
  - GET `/api/crown-holders`
    - Returns Bless Castle and Bellatra crown holders from ServerDB/ClanDB

- Rankings
  - GET `/api/rankings/level?class=<all|1..10>`
  - GET `/api/rankings/pvp?type=<personal|clan>`
  - GET `/api/rankings/bellatra?type=<personal|clan>`
  - GET `/api/rankings/battle-royale`

- User
  - GET `/api/user/characters`
  - GET `/api/user/voting-logs`
  - GET `/api/user/time-points`
  - POST `/api/user/change-password` { currentPassword, newPassword }

- Voting
  - POST `/api/voting/reward` (claim flow)
  - POST `/api/voting/postback` (adapter for vote confirmations)

- Clan
  - POST `/api/clan/update`
  - POST `/api/clan/upload-image` (BMP 32x32)

- Admin
  - GET `/api/admin/check`
  - GET `/api/admin/stats`
  - GET `/api/admin/website-config`
  - POST `/api/admin/website-config` { configs: [{ ConfigKey, ConfigValue, Description }] }
  - GET `/api/admin/pages/downloads-links`
  - POST `/api/admin/pages/downloads-links` { links: [{ label, url }] }
  - POST `/api/admin/pages/upload` (file)
  - Game Logs
    - GET `/api/admin/game-logs/meta?table=<table>`
      - Returns `{ tables: string[] }` when no table provided
      - Returns `{ table, columns: [{ name, type, isText, isDate, isNumeric }], defaultDateColumn, defaultTextColumns }` when table provided
    - POST `/api/admin/game-logs/search`
      - Body: `{ table, dateFrom?, dateTo?, text?, textColumn?, textColumns?, filters?, page?, pageSize?, sortBy?, sortDir? }`
      - Response: `{ items: any[], page, pageSize, hasMore, total, dateCol }`
      - Supports 18+ LogDB tables with server-side filtering, pagination, and column-specific text search
    - GET `/api/admin/game-logs/layout`
      - Response: `{ layout: { version, owner, tables, hiddenTables? }, canEdit }`
    - POST `/api/admin/game-logs/layout`
      - Body: `{ layout: { version, tables, hiddenTables? } }`
      - Response: `{ ok: true }`
      - Only owner ('botro') can save
  - Logs, Users, Payments, Events endpoints present under `/api/admin/*`

Notes
- All POST bodies are JSON unless file upload.
- Admin writes restricted to admin/super admin; see Security doc.
