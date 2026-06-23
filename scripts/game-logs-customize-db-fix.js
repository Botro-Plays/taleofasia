// Fixes for DB-backed Customize mode integration in /admin/game-logs
// - Fix H1 title interpolation
// - Add Reset button in header customize controls
// - Apply labelOverride in header labels
// - Use meta columns for customize panel baseCols

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'app', 'admin', 'game-logs', 'page.tsx');

function read() { return fs.readFileSync(file, 'utf8'); }
function write(s) { fs.writeFileSync(file, s, 'utf8'); }
function eol(s) { return s.includes('\r\n') ? '\r\n' : '\n'; }

let s = read();
const nl = eol(s);

// 1) Fix H1 title interpolation
{
  const start = '<h1 className="text-5xl font-bold text-[var(--color-royal-gold)]">';
  const end = '</h1>';
  const startIdx = s.indexOf(start);
  if (startIdx !== -1) {
    const endIdx = s.indexOf(end, startIdx);
    if (endIdx !== -1) {
      const original = s.slice(startIdx, endIdx + end.length);
      const replacement = `${start}{layout?.tables?.[String(table || '')]?.title || 'Game Logs (LogDB)'}${end}`;
      if (original !== replacement) {
        s = s.replace(original, replacement);
      }
    }
  }
}

// 2) Add Reset button after Cancel in header customize controls (if not present)
{
  if (!s.includes('>Reset</button>')) {
    const cancelFragment = 'className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-dark-steel)] text-slate-200 hover:bg-[var(--color-dark-steel)]/40">Cancel</button>';
    const resetBtn = `${cancelFragment}${nl}            <button onClick={() => { try { const key = String(table || ''); const base = (columns || []).map((c:any) => c.name); const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = base.map((k:string) => ({ key: k, visible: true })); setLayout(next); } catch {} }} className=\"inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/10\">Reset</button>`;
    if (s.includes(cancelFragment)) {
      s = s.replace(cancelFragment, resetBtn);
    }
  }
}

// 3) Apply labelOverride in header labels (insert if missing)
{
  const probe = 'labelOverride.get(c)!';
  if (!s.includes(probe)) {
    const anchor = "else if (isAgingRecovery) label = c.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');";
    const insert = `${nl}                      if (labelOverride.has(c)) label = labelOverride.get(c)!;`;
    const idx = s.indexOf(anchor);
    if (idx !== -1) {
      const lineEnd = s.indexOf(nl, idx);
      const pos = lineEnd === -1 ? idx + anchor.length : lineEnd + nl.length;
      s = s.slice(0, pos) + insert + s.slice(pos);
    }
  }
}

// 4) Use meta columns for customize panel baseCols
{
  const before = 'const baseCols = Object.keys(rows[0] || {});';
  const after = 'const baseCols = (columns || []).map(c => c.name);';
  if (s.includes(before)) {
    s = s.replace(before, after);
  }
}

write(s);
console.log('Applied fixes to DB-backed Customize mode in page.tsx');
