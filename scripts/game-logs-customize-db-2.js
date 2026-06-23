// Robust codemod to finish DB-backed Customize mode wiring for /admin/game-logs
// Handles CRLF vs LF by searching substrings and inserting at line boundaries.

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'admin', 'game-logs', 'page.tsx');
function read() { return fs.readFileSync(file, 'utf8'); }
function write(s) { fs.writeFileSync(file, s, 'utf8'); }

function eol(s) { return s.includes('\r\n') ? '\r\n' : '\n'; }
function insertAfterLineContaining(src, needle, insertBlock) {
  const idx = src.indexOf(needle);
  if (idx === -1) return src;
  const nl = eol(src);
  let lineEnd = src.indexOf(nl, idx);
  if (lineEnd === -1) lineEnd = src.length; else lineEnd += nl.length;
  return src.slice(0, lineEnd) + insertBlock + src.slice(lineEnd);
}
function insertBeforeLineContaining(src, needle, insertBlock) {
  const idx = src.indexOf(needle);
  if (idx === -1) return src;
  // move to the start of the line
  let lineStart = src.lastIndexOf('\n', idx);
  if (lineStart === -1) lineStart = 0; else lineStart += 1;
  return src.slice(0, lineStart) + insertBlock + src.slice(lineStart);
}
function replaceOnce(src, from, to) {
  const idx = src.indexOf(from);
  if (idx === -1) return src;
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

let s = read();
const nl = eol(s);

// 1) Add state vars after searching state if missing
if (!s.includes('setCanEdit(')) {
  s = insertAfterLineContaining(
    s,
    'const [searching, setSearching] = useState(false);',
    `${nl}  const [canEdit, setCanEdit] = useState(false);${nl}  const [customize, setCustomize] = useState(false);${nl}  const [layout, setLayout] = useState<any>(null);${nl}  const [dragItem, setDragItem] = useState<{ scope: 'search' | 'table'; index: number } | null>(null);${nl}`
  );
}

// 2) Load layout via API per table (add after the meta effect closes)
if (!s.includes('/api/admin/game-logs/layout') ) {
  s = insertAfterLineContaining(
    s,
    '}, [table]);',
    `${nl}  // Load shared layout (DB-backed) and editing capability per table${nl}  useEffect(() => {${nl}    if (!table) return;${nl}    (async () => {${nl}      try {${nl}        const r = await fetch('/api/admin/game-logs/layout');${nl}        const j = await r.json();${nl}        if (r.ok && j && j.layout) {${nl}          setCanEdit(!!j.canEdit);${nl}          const lay = j.layout || {};${nl}          if (!lay.tables) lay.tables = {};${nl}          const key = String(table);${nl}          if (!lay.tables[key]) {${nl}            lay.tables[key] = { title: '', search: [], table: [] };${nl}          }${nl}          setLayout(lay);${nl}        }${nl}      } catch {}${nl}    })();${nl}  }, [table]);${nl}`
  );
}

// 3) Compute displayCols + labelOverride just before dateColumnSet comment if not already
if (!s.includes('const currentTableKey = String(table')) {
  s = insertBeforeLineContaining(
    s,
    '// Identify date-type columns from meta to render timezone suffix consistently',
    `${nl}  // Apply DB layout to table columns (visibility + label overrides)${nl}  const currentTableKey = String(table || '');${nl}  const baseCols = cols;${nl}  let displayCols = cols;${nl}  let labelOverride = new Map<string, string>();${nl}  try {${nl}    const existing = (layout && layout.tables && layout.tables[currentTableKey] && layout.tables[currentTableKey].table);${nl}    if (Array.isArray(existing)) {${nl}      const keys = existing.map((e: any) => e.key).filter((k: string) => baseCols.includes(k));${nl}      const missing = baseCols.filter((k) => !keys.includes(k)).map((k) => ({ key: k, visible: true }));${nl}      const merged = [...existing, ...missing];${nl}      displayCols = merged.filter((e: any) => e.visible !== false).map((e: any) => e.key).filter((k: string) => baseCols.includes(k));${nl}      labelOverride = new Map(merged.filter((e: any) => e.label).map((e: any) => [e.key, String(e.label)] as [string, string]));${nl}    }${nl}  } catch {}${nl}`
  );
}

// 4) Change header block to include Customize/Save/Cancel buttons and title from layout
if (!s.includes('setCustomize(true)')) {
  const headerStart = '<div className="mb-8 flex items-center justify-between gap-3 flex-wrap">';
  if (s.includes(headerStart)) {
    // Replace the whole header block content between start and the closing </div> line that ends this header.
    const startIdx = s.indexOf(headerStart);
    // Find closing </div> for this block by searching next occurrence of '\n        </div>' after start
    const closeStr = `${nl}        </div>`;
    const endIdx = s.indexOf(closeStr, startIdx);
    if (endIdx !== -1) {
      const original = s.slice(startIdx, endIdx + closeStr.length);
      const replacement = `${headerStart}${nl}          <h1 className=\"text-5xl font-bold text-[var(--color-royal-gold)]\">${'${'}(layout?.tables?.[String(table || '')]?.title || 'Game Logs (LogDB)'){'}'}</h1>${nl}          <div className=\"flex items-center gap-2\">${nl}            <Link href=\"/admin\" className=\"inline-block bg-gradient-to-r from-[var(--color-royal-gold)] to-[var(--color-ancient-bronze)] hover:from-[var(--color-royal-gold)]/80 hover:to-[var(--color-ancient-bronze)]/80 text-white py-2.5 px-5 rounded-lg border-2 border-[var(--color-royal-gold)] font-semibold transition-all\">← Back to Admin Dashboard</Link>${nl}            {canEdit && !customize && (<button onClick={() => setCustomize(true)} className=\"inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-dark-steel)] text-slate-200 hover:bg-[var(--color-dark-steel)]/40\">Customize</button>)}${nl}            {canEdit && customize && (<><button onClick={async () => { try { await fetch('/api/admin/game-logs/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) }); setCustomize(false); } catch {} }} className=\"inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-royal-gold)] text-[var(--color-royal-gold)] hover:bg-[var(--color-royal-gold)]/10\">Save</button>${nl}            <button onClick={async () => { try { const r = await fetch('/api/admin/game-logs/layout'); const j = await r.json(); if (j && j.layout) setLayout(j.layout); } catch {} setCustomize(false); }} className=\"inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-dark-steel)] text-slate-200 hover:bg-[var(--color-dark-steel)]/40\">Cancel</button></>)}${nl}          </div>${nl}        </div>`;
      s = replaceOnce(s, original, replacement);
    }
  }
}

// 5) Inject title editor into customize panel if present
if (s.includes('Customize Columns') && !s.includes('Customize Title')) {
  s = replaceOnce(
    s,
    '                <div className="text-[var(--color-royal-gold)] font-bold">Customize Columns</div>',
    '                <div className="text-[var(--color-royal-gold)] font-bold">Customize Title</div>\n                {(() => { const key = String(table || \'\'); const val = (layout?.tables?.[key]?.title) || \'\'; return (<div className="flex items-center gap-2 mb-3"><input value={val} onChange={(e)=> { const next = { ...(layout || { version: 1, owner: \'botro\', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: \'\', search: [], table: [] }; next.tables[key].title = e.target.value; setLayout(next); }} placeholder="Table title" className="flex-1 px-2 py-1 bg-[var(--color-charcoal)] border-2 border-[var(--color-dark-steel)] rounded text-slate-200" /></div>); })()}\n                <div className="text-[var(--color-royal-gold)] font-bold">Customize Columns</div>'
  );
}

// 6) Ensure header/body maps use displayCols (if not already)
if (s.includes('cols.map((c) => {') && !s.includes('displayCols.map((c) => {')) {
  s = replaceOnce(s, 'cols.map((c) => {', 'displayCols.map((c) => {');
}
if (s.includes('{cols.map((c) => {') && !s.includes('{displayCols.map((c) => {')) {
  s = replaceOnce(s, '{cols.map((c) => {', '{displayCols.map((c) => {');
}

// 7) Apply labelOverride in header if not present
if (!s.includes('labelOverride.get(c)!')) {
  s = insertAfterLineContaining(
    s,
    "else if (isAgingRecovery) label = c.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');",
    `${nl}                      if (labelOverride.has(c)) label = labelOverride.get(c)!;${nl}`
  );
}

// 8) Update empty-row colspan to use displayCols length
if (s.includes('colSpan={cols.length || 1}') && !s.includes('displayCols.length || cols.length')) {
  s = replaceOnce(s, 'colSpan={cols.length || 1}', 'colSpan={displayCols.length || cols.length || 1}');
}

write(s);
console.log('Finished wiring DB-backed customize mode');
