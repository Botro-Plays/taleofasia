# Admin Game Logs Standards

- Scope
  - Applies to `/admin/game-logs` UI and `/api/admin/game-logs/*` backend (LogDB)

- Table Listing
  - Default 24h date range applied on first load (From = now-24h, To = now)
  - Excluded tables (server-side and UI):
    - battleroyaleusersrangelog, gamemasterlog, gamemasterlogs
    - itemcreatelog, inventoryitemlog, characterquest, chatlog, disconnects
    - mixturelog, mixtruelog, bancoresposta/banco_resposta (normalized), characteractionfieldinstance
    - userinfotimershop

- Text Search
  - CharacterLog/CheatLog: dropdown to target column (AccountName, IP, Description, or All)
  - Backend respects `textColumn` when provided; otherwise uses smart multi-column search
  - Avoid resolving Code1/Code2 for item-related logs (raw numbers only)

- Pagination
  - Uses OFFSET/FETCH with `page` and `pageSize`
  - COUNT(*) applies all active filters (date, text, etc.)

- Column Rendering
  - CheatLog-only:
    - Description: `max-w-sm whitespace-pre-wrap break-words align-top`
    - IP: `w-28 text-sm`
    - Date: `w-32 text-sm whitespace-nowrap`
  - Date/Server headers/cells use `whitespace-nowrap` to avoid wrapping

- UX Notes
  - "*" in text box is treated literally; leave empty to search all
  - Consider adding quick presets: Last 24h, Last 7d, All time

- Standards (completed)
  1. ~~Remove default 24h lookup~~
     - When nothing is input in keywords (or no keywords at all), run `SELECT * FROM X` with no date filter. ✅
  2. ~~Search label~~
     - Replace 'Text contains' with 'Search (X, Y, or Z)' where X,Y,Z are the available text columns for the selected table. ✅
  3. ~~Search column selector~~
     - Replace 'Text columns + checkboxes' with a single dropdown menu showing available text columns (X, Y, Z). ✅
  4. ~~Column order (results)~~
     - Always use this sequence where the column exists in the raw schema:
       1. # (rn)
       2. IP (or IPAddress)
       3. AccountName (Account Name)
       4. CharacterName (Character Name)
       5. LogID (Log Type) — resolve to friendly names where applicable
       6. Action
       7. Description
       8. Code1
       9. Code2
       10. Dates (Date, DateReceived, DateDiscarded, DateRecovered, etc.) ✅
  5. ~~Code1 / Code2 formatting~~
     - Render raw values without thousands separators (no `toLocaleString()`). ✅
  6. ~~ItemCode resolution~~
     - Always resolve ItemCode from `GameDB.dbo.ItemList` where `szItemName = ItemCode` when applicable. ✅
     - UserTimeCoinLog Description resolves bought item codes to names via ItemList.

- Future Enhancements (optional)
  - Toggle for Description wrap vs. compact mode
  - Copy-to-clipboard for Description
  - Quick date presets: Last 24h, Last 7d, All time
