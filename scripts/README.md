# Scripts

This folder contains one-off setup and migration scripts used during development.
They are **not** part of the application runtime.

| Script | Purpose |
|--------|---------|
| `add-reset-button.js` | Adds a password reset button UI helper (legacy) |
| `game-logs-customize-db.js` | Initial DB customization script for Admin Game Logs |
| `game-logs-customize-db-2.js` | Second iteration of DB customization for Game Logs |
| `game-logs-customize-db-fix.js` | Fixes applied after initial customization |
| `game-logs-customize-dnd-and-search.js` | Drag-and-drop + search panel customization script |
| `game-logs-customize-search-panel.js` | Standalone search panel customization script |

## Action needed

Decide whether these scripts should be:
- **Committed** to the repo for historical reference, or
- **Deleted** if they are no longer needed.

If kept, consider moving them to a `scripts/archive/` subfolder to keep the root clean.
