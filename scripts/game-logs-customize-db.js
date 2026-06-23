// Codemod to enable DB-backed Customize mode for /admin/game-logs
// - Adds state (canEdit, customize, layout)
// - Loads/saves layout via /api/admin/game-logs/layout
// - Applies column visibility + label overrides to the table
// - Adds header controls and simple customization panel (enable/disable + rename)

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'admin', 'game-logs', 'page.tsx');

function read() { return fs.readFileSync(file, 'utf8'); }
function write(s) { fs.writeFileSync(file, s, 'utf8'); }

function insertAfter(haystack, needle, insert) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  const pos = idx + needle.length;
  return haystack.slice(0, pos) + insert + haystack.slice(pos);
}

function replaceOnce(haystack, needle, replacement) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

let s = read();

// 1) Add state vars after searching state
{
  const anchor = '  const [searching, setSearching] = useState(false);\n';
  const inject = '  const [canEdit, setCanEdit] = useState(false);\n  const [customize, setCustomize] = useState(false);\n  const [layout, setLayout] = useState<any>(null);\n  const [dragItem, setDragItem] = useState<{ scope: \"search\" | \"table\"; index: number } | null>(null);\n\n';
  if (!s.includes('setCanEdit') && s.includes(anchor)) s = insertAfter(s, anchor, inject);
}

// 2) Load layout via API per table
{
  const anchor = '  }, [table]);\n\n'; // after meta effect closes
  const effect = `  useEffect(() => {\n    if (!table) return;\n    (async () => {\n      try {\n        const r = await fetch('/api/admin/game-logs/layout');\n        const j = await r.json();\n        if (r.ok && j && j.layout) {\n          setCanEdit(!!j.canEdit);\n          const lay = j.layout || {};\n          if (!lay.tables) lay.tables = {};\n          const key = String(table);\n          if (!lay.tables[key]) {\n            lay.tables[key] = { title: '', search: [], table: [] };\n          }\n          setLayout(lay);\n        }\n      } catch {}\n    })();\n  }, [table]);\n\n`;
  if (!s.includes('game-logs/layout') && s.includes(anchor)) s = insertAfter(s, anchor, effect);
}

// 3) Compute displayCols + labelOverride just before dateColumnSet comment
{
  const anchor = '\n  // Identify date-type columns from meta to render timezone suffix consistently\n';
  const block = `\n  // Apply DB layout to table columns (visibility + label overrides)\n  const currentTableKey = String(table || '');\n  const baseCols = cols;\n  let displayCols = cols;\n  let labelOverride = new Map<string, string>();\n  try {\n    const existing = layout?.tables?.[currentTableKey]?.table;\n    if (Array.isArray(existing)) {\n      const keys = existing.map((e: any) => e.key).filter((k: string) => baseCols.includes(k));\n      const missing = baseCols.filter((k) => !keys.includes(k)).map((k) => ({ key: k, visible: true }));\n      const merged = [...existing, ...missing];\n      displayCols = merged.filter((e: any) => e.visible !== false).map((e: any) => e.key).filter((k: string) => baseCols.includes(k));\n      labelOverride = new Map(merged.filter((e: any) => e.label).map((e: any) => [e.key, String(e.label)] as [string, string]));\n    }\n  } catch {}\n`;
  if (!s.includes('Apply DB layout to table columns') && s.includes(anchor)) s = replaceOnce(s, anchor, block + anchor);
}

// 4) Swap cols.map to displayCols.map in thead and tbody
{
  s = replaceOnce(s, 'cols.map((c) => {', 'displayCols.map((c) => {');
  s = replaceOnce(s, '  {cols.map((c) => {', '  {displayCols.map((c) => {');
}

// 5) Add labelOverride application in header map
{
  const hdrAnchor = "else if (isAgingRecovery) label = c.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');\n";
  const add = '                      if (labelOverride.has(c)) label = labelOverride.get(c)!;\n';
  if (!s.includes('labelOverride.has') && s.includes(hdrAnchor)) s = insertAfter(s, hdrAnchor, add);
}

// 6) Update the empty-row colSpan to use displayCols length when available
{
  s = replaceOnce(s, 'colSpan={cols.length || 1}', 'colSpan={displayCols.length || cols.length || 1}');
}

// 7) Add header controls (Customize/Save/Cancel/Reset)
{
  const headerBlock = `<div className="mb-8 flex items-center justify-between gap-3 flex-wrap">\n          <h1 className="text-5xl font-bold text-[var(--color-royal-gold)]">Game Logs (LogDB)</h1>\n          <Link href="/admin" className="inline-block bg-gradient-to-r from-[var(--color-royal-gold)] to-[var(--color-ancient-bronze)] hover:from-[var(--color-royal-gold)]/80 hover:to-[var(--color-ancient-bronze)]/80 text-white py-2.5 px-5 rounded-lg border-2 border-[var(--color-royal-gold)] font-semibold transition-all">← Back to Admin Dashboard</Link>\n        </div>`;
  if (s.includes(headerBlock)) {
    const replacement = `<div className="mb-8 flex items-center justify-between gap-3 flex-wrap">\n          <h1 className="text-5xl font-bold text-[var(--color-royal-gold)]">Game Logs (LogDB)</h1>\n          <div className="flex items-center gap-2">\n            <Link href="/admin" className="inline-block bg-gradient-to-r from-[var(--color-royal-gold)] to-[var(--color-ancient-bronze)] hover:from-[var(--color-royal-gold)]/80 hover:to-[var(--color-ancient-bronze)]/80 text-white py-2.5 px-5 rounded-lg border-2 border-[var(--color-royal-gold)] font-semibold transition-all">← Back to Admin Dashboard</Link>\n            {canEdit && !customize && (<button onClick={() => setCustomize(true)} className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-dark-steel)] text-slate-200 hover:bg-[var(--color-dark-steel)]/40">Customize</button>)}\n            {canEdit && customize && (<><button onClick={async () => { try { await fetch('/api/admin/game-logs/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) }); setCustomize(false); } catch {} }} className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-royal-gold)] text-[var(--color-royal-gold)] hover:bg-[var(--color-royal-gold)]/10">Save</button>\n            <button onClick={async () => { try { const r = await fetch('/api/admin/game-logs/layout'); const j = await r.json(); if (j && j.layout) setLayout(j.layout); } catch {} setCustomize(false); }} className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-dark-steel)] text-slate-200 hover:bg-[var(--color-dark-steel)]/40">Cancel</button>\n            <button onClick={() => { try { const key = String(table); const base = Object.keys(rows[0] || {}); const lay = layout || { version: 1, owner: 'botro', tables: {} }; if (!lay.tables) lay.tables = {}; lay.tables[key] = { ...(lay.tables[key] || {}), table: base.map(k => ({ key: k, visible: true })) }; setLayout({ ...lay }); } catch {} }} className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/10">Reset</button></>)}\n          </div>\n        </div>`;
    s = replaceOnce(s, headerBlock, replacement);
  }
}

// 8) Insert a simple customize panel for columns before the search card comment
{
  const searchComment = '          {/* Unified search card for all tables */}\n';
  if (s.includes(searchComment) && !s.includes('Customize Columns')) {
    const panel = `          {canEdit && customize && layout && (() => {\n            const key = String(table || '');\n            const baseCols = Object.keys(rows[0] || {});\n            const existing = layout?.tables?.[key]?.table || baseCols.map(k => ({ key: k, visible: true }));\n            const ensure = (arr) => {\n              const keys = arr.map(e => e.key);\n              baseCols.forEach((k) => { if (!keys.includes(k)) arr.push({ key: k, visible: true }); });\n              return arr;\n            };\n            const arr = ensure(existing.slice());\n            return (\n              <div className=\"p-3 rounded border-2 border-[var(--color-dark-steel)] bg-[var(--color-obsidian)]/50 space-y-3 mb-4\">\n                <div className=\"text-[var(--color-royal-gold)] font-bold\">Customize Columns</div>\n                <div className=\"space-y-2\">\n                  {arr.map((tc, idx) => (\n                    <div key={tc.key} className=\"flex items-center gap-2\">\n                      <input type=\"checkbox\" checked={tc.visible !== false} onChange={(e)=> { const copy = arr.slice(); copy[idx] = { ...tc, visible: e.target.checked }; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = copy; setLayout(next); }} />\n                      <span className=\"text-slate-300 w-48 truncate\">{tc.key}</span>\n                      <input value={tc.label || ''} onChange={(e)=> { const copy = arr.slice(); copy[idx] = { ...tc, label: e.target.value || undefined }; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = copy; setLayout(next); }} placeholder=\"Header label\" className=\"flex-1 px-2 py-1 bg-[var(--color-charcoal)] border-2 border-[var(--color-dark-steel)] rounded text-slate-200 text-sm\" />\n                    </div>\n                  ))}\n                </div>\n              </div>\n            );\n          })()}\n`;
    s = insertAfter(s, searchComment, panel + searchComment);
  }
}

write(s);
console.log('Applied customize DB layout codemod to app/admin/game-logs/page.tsx');
