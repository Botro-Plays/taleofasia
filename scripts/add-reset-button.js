const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'app', 'admin', 'game-logs', 'page.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const cancelNeedle = '>Cancel</button></>)';
if (s.includes(cancelNeedle)) {
  const resetBtn = `${cancelNeedle.slice(0, -4)}${nl}            <button onClick={() => { try { const key = String(table || ''); const base = (columns || []).map((c:any) => c.name); const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = base.map((k:string) => ({ key: k, visible: true })); setLayout(next); } catch {} }} className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/10">Reset</button></>)`;
  s = s.replace(cancelNeedle, resetBtn);
  fs.writeFileSync(file, s, 'utf8');
  console.log('Inserted Reset button after Cancel');
} else {
  console.log('Cancel fragment not found; no changes');
}
