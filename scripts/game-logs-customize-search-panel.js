const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'admin', 'game-logs', 'page.tsx');

function read() { return fs.readFileSync(file, 'utf8'); }
function write(s) { fs.writeFileSync(file, s, 'utf8'); }
function eol(s) { return s.includes('\r\n') ? '\r\n' : '\n'; }

let s = read();
const nl = eol(s);

function insertAfter(src, anchor, insertBlock) {
  const idx = src.indexOf(anchor);
  if (idx === -1) return src;
  const pos = idx + anchor.length;
  return src.slice(0, pos) + insertBlock + src.slice(pos);
}

function insertBefore(src, anchor, insertBlock) {
  const idx = src.indexOf(anchor);
  if (idx === -1) return src;
  return src.slice(0, idx) + insertBlock + src.slice(idx);
}

function replaceOnce(src, from, to) {
  const idx = src.indexOf(from);
  if (idx === -1) return src;
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

// 1) Insert dynamic search grid above static grid and hide the static one
{
  const comment = '/* Unified search card for all tables */';
  const commentMarker = '{' + comment + '}';
  const staticGrid = '<div className="grid grid-cols-1 md:grid-cols-3 gap-4">';
  if (s.includes(commentMarker) && s.includes(staticGrid)) {
    const dynBlock = `${nl}          {visibleSearchItems && visibleSearchItems.length > 0 && (<div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">{visibleSearchItems.map((it: any) => (<div key={it.key}>{renderSearchItem(it)}</div>))}</div>)}${nl}`;
    // Insert dynamic grid right after the comment marker
    s = insertAfter(s, commentMarker + nl, dynBlock);
    // Hide static grid when dynamic grid is present
    const staticHidden = '<div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${visibleSearchItems && visibleSearchItems.length > 0 ? \"hidden\" : \"\"}`}>';
    s = replaceOnce(s, staticGrid, staticHidden);
  }
}

// 2) Remove misplaced dynamic grid inside the button row if present
{
  const misplaced = '{visibleSearchItems && visibleSearchItems.length > 0 && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{visibleSearchItems.map((it: any) => (<div key={it.key}>{renderSearchItem(it)}</div>))}</div>)}';
  if (s.includes(misplaced)) {
    s = s.replace(misplaced, '');
  }
}

// 3) Insert Search customization panel (if not already present)
{
  if (!s.includes('Customize Search Card')) {
    const beforeComment = '          {/* Unified search card for all tables */}';
    if (s.includes(beforeComment)) {
      const panel = [
        '          {canEdit && customize && layout && (() => {',
        '            const key = String(table || \"\");',
        '            const base = buildDefaultSearchItems();',
        '            const existing = (layout?.tables?.[key]?.search) || base;',
        '            const ensure = (arr) => {',
        '              const keys = arr.map(e => e.key);',
        '              base.forEach((it) => { if (!keys.includes(it.key)) arr.push({ ...it }); });',
        '              return arr;',
        '            };',
        '            const arrS = ensure(existing.slice());',
        '            return (',
        '              <div className="p-3 rounded border-2 border-[var(--color-dark-steel)] bg-[var(--color-obsidian)]/50 space-y-3 mb-4">',
        '                <div className="text-[var(--color-royal-gold)] font-bold">Customize Search Card</div>',
        '                <div className="space-y-2">',
        '                  {arrS.map((it, idx) => (',
        '                    <div key={it.key} className="flex items-center gap-2" draggable',
        '                      onDragStart={(e)=>{ e.dataTransfer?.setData(\'text/plain\', String(idx)); setDragItem({ scope: \"search\", index: idx }); }}',
        '                      onDragOver={(e)=> e.preventDefault()}',
        '                      onDrop={()=>{ if (!layout) return; const copy = arrS.slice(); const from = (dragItem && dragItem.scope === \"search\") ? (dragItem.index ?? -1) : -1; if (from > -1) { const [m] = copy.splice(from,1); copy.splice(idx,0,m); } const next = { ...(layout || { version: 1, owner: \"botro\", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: \"\", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); setDragItem(null); }}>',
        '                      <span className="cursor-move select-none px-2">≡</span>',
        '                      <input type="checkbox" checked={it.visible !== false} onChange={(e)=> { const copy = arrS.slice(); copy[idx] = { ...it, visible: e.target.checked }; const next = { ...(layout || { version: 1, owner: \"botro\", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: \"\", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} />',
        '                      <span className="text-slate-300 w-48 truncate">{it.key}</span>',
        '                      <input value={it.label || \"\"} onChange={(e)=> { const copy = arrS.slice(); copy[idx] = { ...it, label: e.target.value || undefined }; const next = { ...(layout || { version: 1, owner: \"botro\", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: \"\", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} placeholder="Label" className="flex-1 px-2 py-1 bg-[var(--color-charcoal)] border-2 border-[var(--color-dark-steel)] rounded text-slate-200 text-sm" />',
        '                    </div>',
        '                  ))}',
        '                </div>',
        '              </div>',
        '            );',
        '          })()}',
        ''
      ].join(nl);
      s = insertBefore(s, beforeComment, panel + nl);
    }
  }
}

write(s);
console.log('Inserted dynamic search grid, hid static grid, removed misplaced dynamic grid, and added Customize Search panel.');
