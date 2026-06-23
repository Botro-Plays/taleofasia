# Content Model

- WebsiteConfigs (key-value)
  - Stores global config (e.g., social links)
  - Keys detected case-insensitively; social detection matches substrings 'discord' or 'facebook'

- WebPages (CMS)
  - Fields: Slug, Title, Content (HTML), UpdatedAt
  - Used for Info pages: getting-started, server-rules, about
  - Special Slug: `downloads-links` JSON structure
    - `{ "links": [{ "label": string, "url": string }] }`
    - Admin UI manages add/remove mirrors and uploads; public API merges into Downloads page HTML

- Downloads Page Composition
  - Intro paragraph
  - Mirrors grid from `downloads-links` (if any)
  - System Requirements Table (defaults)
  - How to Install (defaults)
