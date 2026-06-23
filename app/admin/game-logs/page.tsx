'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Search, RotateCcw, Save, Settings2, Columns3 } from 'lucide-react';

type Meta = {
  tables?: string[];
  table?: string;
  columns?: Array<{ name: string; type: string; isText?: boolean; isDate?: boolean; isNumeric?: boolean }>;
  defaultDateColumn?: string | null;
  defaultTextColumns?: string[];
};

export default function AdminGameLogsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState<string>('');
  const [columns, setColumns] = useState<Meta['columns']>([]);
  const [dateCol, setDateCol] = useState<string>('');
  const [textCols, setTextCols] = useState<string[]>([]);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [textColumn, setTextColumn] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [canEdit, setCanEdit] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [layout, setLayout] = useState<any>(null);
  const [dragItem, setDragItem] = useState<{ scope: 'search' | 'table' | 'tableHeader'; index: number } | null>(null);
  const [newFilterKey, setNewFilterKey] = useState<string>('');
  const [newFilterLabel, setNewFilterLabel] = useState<string>('');
  const [newFilterOptions, setNewFilterOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [newOptionValue, setNewOptionValue] = useState<string>('');
  const [newOptionLabel, setNewOptionLabel] = useState<string>('');
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [localHiddenCols, setLocalHiddenCols] = useState<Set<string>>(new Set());

  const formatColumnLabel = (s: string): string => {
    if (!s) return '';
    // Insert space between lowercase/number and uppercase
    let r = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // Insert space between acronym and next capitalized word (e.g. IPAddress -> IP Address)
    r = r.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    // Insert space between letter and number
    r = r.replace(/([a-zA-Z])(\d)/g, '$1 $2');
    // Insert space between number and letter
    r = r.replace(/(\d)([a-zA-Z])/g, '$1 $2');
    return r;
  };

  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check');
      const j = await res.json();
      if (!j.isAdmin) { router.push('/dashboard'); return; }
      setIsAdmin(true);
      setLoading(false);
      const meta = await fetch('/api/admin/game-logs/meta');
      const m: Meta = await meta.json();
      if (meta.ok && Array.isArray(m.tables)) {
        const excluded = new Set(['battleroyaleusersrangelog','gamemasterlog','gamemasterlogs','itemcreatelog','inventoryitemlog','characterquest','chatlog','disconnects','mixturelog','mixtruelog','banco_resposta','characteractionfieldinstance', 'userinfotimershop']);
        const filtered = m.tables.filter((t) => !excluded.has((t || '').toLowerCase()));
        setTables(filtered);
        if (filtered.length) {
          setTable(filtered[0]);
        }
      }
    } catch {
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdmin(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdmin]);

  useEffect(() => {
    (async () => {
      if (!table) return;
      setText(''); setTextColumn(''); setTextCols([]); setFilters({}); setRows([]); setTotal(0); setPage(1); setHasSearched(false);
      const r = await fetch(`/api/admin/game-logs/meta?table=${encodeURIComponent(table)}`);
      const j: Meta = await r.json();
      if (r.ok) {
        setColumns(j.columns || []);
        setDateCol(j.defaultDateColumn || '');
        const isAFR = (table || '').toLowerCase() === 'actionfieldrewardlog';
        const defaultText = Array.isArray(j.defaultTextColumns) ? j.defaultTextColumns : [];
        let filteredText = isAFR ? defaultText.filter((n) => (n || '').toLowerCase() !== 'itemcode') : defaultText;
        if ((table || '').toLowerCase() === 'rareitemslog') {
          filteredText = filteredText.filter(n => (n || '').toLowerCase() !== 'itemname');
          const extras = ['CharacterName', 'MonsterName', 'ItemCode1'];
          filteredText = [...filteredText, ...extras.filter(e => !filteredText.includes(e))];
        }
        setTextCols(filteredText);
      } else {
        setColumns([]); setDateCol(''); setTextCols([]);
      }
    })();
  }, [table]);
  
  useEffect(() => {
    if (!layout || !table || canEdit) return;
    const hidden = new Set<string>(Array.isArray((layout as any)?.hiddenTables) ? ((layout as any).hiddenTables as string[]).map(String) : []);
    if (hidden.has(table)) {
      const next = tables.find((t) => !hidden.has(t));
      if (next && next !== table) setTimeout(() => setTable(next), 0);
    }
  }, [layout, table, canEdit, tables]);

  // Load shared layout (DB-backed) and editing capability per table
  useEffect(() => {
    if (!table) return;
    (async () => {
      try {
        const r = await fetch('/api/admin/game-logs/layout');
        const j = await r.json();
        if (r.ok && j && j.layout) {
          setCanEdit(!!j.canEdit);
          const lay = j.layout || {};
          if (!lay.tables) lay.tables = {};
          const key = String(table);
          if (!lay.tables[key]) {
            lay.tables[key] = { title: '', search: [], table: [] };
          }
          setLayout(lay);
        }
      } catch {}
    })();
  }, [table]);

  const doSearch = useCallback(async (p: number, ps: number, dir: 'asc'|'desc') => {
    if (!table) return;
    setRows([]);
    setTotal(0);
    setSearching(true);
    setHasSearched(true);
    try {
      const lower = (table || '').toLowerCase();
      const sendingTextCols = lower === 'actionfieldrewardlog' ? textCols.filter((n) => (n || '').toLowerCase() !== 'itemcode') : textCols;
      const unboundedTables = new Set(['agingrecovery','bellatrahonorlog','bellatrarewardlog','characterlog','cheatlog','furyarenalog']);
      const sendDateFrom = unboundedTables.has(lower) ? undefined : (dateFrom || undefined);
      const sendDateTo = unboundedTables.has(lower) ? undefined : (dateTo || undefined);
      const body = {
        table,
        dateFrom: sendDateFrom,
        dateTo: sendDateTo,
        text: text || undefined,
        textColumn: textColumn || undefined,
        textColumns: sendingTextCols,
        filters,
        page: p,
        pageSize: ps,
        sortBy: dateCol || undefined,
        sortDir: dir,
      };
      const r = await fetch('/api/admin/game-logs/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) {
        setRows(Array.isArray(j.items) ? j.items : []);
        setTotal(Number(j.total || 0));
        setPage(p); setPageSize(ps); setSortDir(dir);
      }
    } finally {
      setSearching(false);
    }
  }, [table, dateFrom, dateTo, text, textColumn, textCols, filters, dateCol]);

  if (status === 'loading' || loading || !isAdmin) {
    return (
      <PageShell label="Admin" title="Game Logs (LogDB)" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  const firstRow = rows[0] || {};
  const lowerTable = (table || '').toLowerCase();
  const isAccountLog = lowerTable === 'accountlog';
  const isActionFieldLog = lowerTable === 'actionfieldlog';
  const isActionFieldRewardLog = lowerTable === 'actionfieldrewardlog';
  const isAgingRecovery = lowerTable === 'agingrecovery';
  const isBellatraHonor = lowerTable === 'bellatrahonorlog';
  const isCharacterLog = lowerTable === 'characterlog';
  const isCheatLog = lowerTable === 'cheatlog';
  const isItemBox = lowerTable === 'itembox';
  const isOnlineRewardLog = lowerTable === 'onlinerewardlog';
  const isPvPHonorLog = lowerTable === 'pvphonorlog';
  const isRareItemsLog = lowerTable === 'rareitemslog';
  const isWarehouseLog = lowerTable === 'warehouselog';
  let cols = Object.keys(firstRow);
  // Standard column ordering per admin-game-logs-standards
  const standardOrder = ['rn', 'IP', 'IPAddress', 'AccountName', 'CharacterName', 'LogID', 'Action', 'Description', 'Code1', 'Code2'];
  // Find the best date column if multiple exist
  const dateCols = ['DateReceived', 'DateDiscarded', 'DateRecovered', 'Date'];
  const foundDateCol = dateCols.find(dc => cols.includes(dc)) || dateCol || '';
  if (foundDateCol && !standardOrder.includes(foundDateCol)) standardOrder.push(foundDateCol);
  // Filter to only columns that exist in this table, preserving standard order
  const presentStandard = standardOrder.filter(c => cols.includes(c));
  const rest = cols.filter(c => !presentStandard.includes(c) && c.toLowerCase() !== 'id');
  cols = [...presentStandard, ...rest];
  // Hide common raw IDs and redundant raw columns that have aliased replacements
  cols = cols.filter(c => c.toLowerCase() !== 'accountid' && ((isPvPHonorLog || isRareItemsLog) ? true : c.toLowerCase() !== 'characterid') && c.toLowerCase() !== 'serverid');
  // Hide raw LogID when Type alias exists (AccountLog)
  if (isAccountLog) cols = cols.filter(c => c.toLowerCase() !== 'logid');
  // Hide raw ModeID when Mode alias exists
  if (isActionFieldLog || isActionFieldRewardLog) cols = cols.filter(c => c.toLowerCase() !== 'modeid');
  // Hide raw ItemCode when Item alias exists (ActionFieldRewardLog)
  if (isActionFieldRewardLog) cols = cols.filter(c => c.toLowerCase() !== 'itemcode');
  // Hide raw MapID when Map alias exists (RareItemsLog)
  if (isRareItemsLog) cols = cols.filter(c => c.toLowerCase() !== 'mapid');
  // Hide raw IsBossMonster when Boss alias exists (RareItemsLog)
  if (isRareItemsLog) cols = cols.filter(c => c.toLowerCase() !== 'isbossmonster');
  // Table-specific column ordering
  if (isActionFieldLog) {
    // Move Mode next to CharacterName
    const modeIdx = cols.indexOf('Mode');
    const charIdx = cols.indexOf('CharacterName');
    if (modeIdx > -1 && charIdx > -1 && modeIdx !== charIdx + 1) {
      cols.splice(modeIdx, 1);
      cols.splice(charIdx + 1, 0, 'Mode');
    }
  }
  if (isActionFieldRewardLog) {
    // Move Item before Quantity
    const itemIdx = cols.indexOf('Item');
    const qtyIdx = cols.findIndex(c => /quantity|qty/i.test(c));
    if (itemIdx > -1 && qtyIdx > -1 && itemIdx !== qtyIdx - 1) {
      cols.splice(itemIdx, 1);
      const newQtyIdx = cols.findIndex(c => /quantity|qty/i.test(c));
      cols.splice(newQtyIdx, 0, 'Item');
    }
    // Move Date to last
    const dateIdx = cols.indexOf('Date');
    if (dateIdx > -1 && dateIdx !== cols.length - 1) {
      cols.splice(dateIdx, 1);
      cols.push('Date');
    }
  }



  // Search layout helpers
  const buildDefaultSearchItems = () => {
    const items: Array<{ key: string; label?: string; visible: boolean }> = [];
    items.push({ key: 'Search', label: 'Search', visible: true });
    items.push({ key: 'Column', label: 'Column', visible: true });
    if (isAccountLog || isCharacterLog || isCheatLog) items.push({ key: 'Type', label: 'Type', visible: true });
    if (isCheatLog) items.push({ key: 'Action', label: 'Action', visible: true });
    if (isActionFieldLog || isActionFieldRewardLog) items.push({ key: 'Mode', label: 'Mode', visible: true });
    if (isAgingRecovery) items.push({ key: 'Age', label: 'Age', visible: true });
    if (isBellatraHonor || isPvPHonorLog) items.push({ key: 'HonorType', label: 'Honor Type', visible: true });
    if (isItemBox) items.push({ key: 'P2P', label: 'Player-to-Player', visible: true });
    items.push({ key: 'Sort', label: 'Sort', visible: true });
    return items;
  };

  const currentSearchTableKey = String(table || '');
  const defaultSearchItems = buildDefaultSearchItems();
  let searchItems = defaultSearchItems;
  try {
    const saved = layout?.tables?.[currentSearchTableKey]?.search;
    if (Array.isArray(saved)) {
      const keys = saved.map((e: any) => e.key);
      const missing = defaultSearchItems.filter((d) => !keys.includes(d.key));
      const merged = [...saved, ...missing];
      searchItems = merged.filter((e: any) => {
        const k = e.key;
        if (k === 'Type' && !(isAccountLog || isCharacterLog || isCheatLog)) return false;
        if (k === 'Action' && !isCheatLog) return false;
        if (k === 'Mode' && !(isActionFieldLog || isActionFieldRewardLog)) return false;
        if (k === 'Age' && !isAgingRecovery) return false;
        if (k === 'HonorType' && !(isBellatraHonor || isPvPHonorLog)) return false;
        if (k === 'P2P' && !isItemBox) return false;
        return true;
      });
    }
  } catch {}

  const visibleSearchItems = searchItems.filter((i: any) => i.visible !== false);

  const renderSearchItem = (it: { key: string; label?: string; visible: boolean }) => {
    const label = it.label || (
      it.key === 'Search' ? 'Search' :
      it.key === 'Column' ? 'Column' :
      it.key === 'Type' ? 'Type' :
      it.key === 'Action' ? 'Action' :
      it.key === 'Mode' ? 'Mode' :
      it.key === 'Age' ? 'Age' :
      it.key === 'HonorType' ? 'Honor Type' :
      it.key === 'P2P' ? 'Player-to-Player' :
      it.key === 'Sort' ? 'Sort' : it.key
    );
    try {
      const savedItems = (layout?.tables?.[currentSearchTableKey]?.search) || [];
      const savedCfg: any = Array.isArray(savedItems) ? savedItems.find((s: any) => s && s.key === it.key) : null;
      const savedOpts = (savedCfg && Array.isArray(savedCfg.options)) ? (savedCfg.options as Array<{ value: string; label: string }>) : null;
      const filteredOpts = (savedOpts && savedOpts.length) ? (savedOpts as any[]).filter((o: any) => !o?.hidden) : null;
      if (it.key !== 'Column' && filteredOpts && filteredOpts.length) {
        const val = (filters as any)[it.key] || '';
        return (
          <div>
            <div className="toa-label-field">{label}</div>
            <select value={val} onChange={(e)=> setFilters(prev => ({ ...prev, [it.key]: e.target.value || undefined }))} className="toa-select">
              <option value="">All</option>
              {filteredOpts.map((o: any) => (
                <option key={String(o.value)} value={String(o.value)}>{o.label ?? String(o.value)}</option>
              ))}
            </select>
          </div>
        );
      }
    } catch {}
    if (it.key === 'Search') {
      return (<div><div className="toa-label-field">{label}</div><input value={text} onChange={(e)=> setText(e.target.value)} placeholder="keyword" className="toa-input" /></div>);
    }
    if (it.key === 'Column') {
      const available = (textCols || []).filter(c => c && c !== 'ItemCode' && !/date|time/i.test(c));
      if (!available.length) return null;
      let labelMap: Record<string, string> = {};
      let allowed: Set<string> | null = null;
      try {
        const itemOpts = (it as any).options;
        const allOpts = Array.isArray(itemOpts) ? (itemOpts as Array<{ value: string; label: string }>) : null;
        const opts = allOpts ? (allOpts as any[]).filter((o: any) => !o?.hidden) : null;
        if (opts && opts.length) {
          const map: Record<string, string> = {};
          for (const o of opts as any[]) { if (o && o.value != null) map[String(o.value)] = o.label ?? String(o.value); }
          labelMap = map;
          allowed = new Set((opts as any[]).map((o: any) => String(o.value)));
        }
      } catch {}
      if (isWarehouseLog) {
        labelMap = { ...labelMap, CharName: labelMap['CharName'] ?? 'Character Name', ItemName: labelMap['ItemName'] ?? 'Item Name', UserID: labelMap['UserID'] ?? 'Account Name' };
      }
      if (isRareItemsLog) {
        labelMap = { ...labelMap, CharacterName: labelMap['CharacterName'] ?? 'Character Name', MonsterName: labelMap['MonsterName'] ?? 'Monster Name', ItemCode1: labelMap['ItemCode1'] ?? 'Item Name' };
      }
      return (
        <div>
          <div className="toa-label-field">{label}</div>
          <select value={textColumn} onChange={(e)=> setTextColumn(e.target.value)} className="toa-select">
            <option value="">All columns</option>
            {(allowed ? available.filter(c => allowed!.has(c)) : available).map(c => (
              <option key={c} value={c}>{labelMap[c] ?? formatColumnLabel(c)}</option>
            ))}
          </select>
        </div>
      );
    }
    if (it.key === 'Type' && (isAccountLog || isCharacterLog || isCheatLog)) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).Type || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Type: e.target.value || undefined }))} className="toa-select">
        <option value="">All</option>
        {isAccountLog && (<><option value="Device Info">Device Info</option><option value="Login Server Logon">Login Server Logon</option><option value="Character Creation">Character Creation</option></>)}
        {isCharacterLog && (<><option value="Save">Save</option><option value="Lose EXP">Lose EXP</option><option value="Temporary Ban">Temporary Ban</option></>)}
        {isCheatLog && (<>
          <option value="Delay Skill Hack">Delay Skill Hack</option><option value="Validate Character Error">Validate Character Error</option><option value="Copied Item Error">Copied Item Error</option><option value="Hack Warning">Hack Warning</option><option value="Copied Item">Copied Item</option><option value="Copied Item Warehouse">Copied Item Warehouse</option><option value="Warehouse Gold">Warehouse Gold</option><option value="Warehouse New Clone">Warehouse New Clone</option><option value="Warehouse Bug">Warehouse Bug</option><option value="Hack Detected">Hack Detected</option><option value="Focus Changed">Focus Changed</option><option value="Gold Limit">Gold Limit</option><option value="Speed Hack">Speed Hack</option><option value="Time Error Speed Hack">Time Error Speed Hack</option><option value="Time Mismatch">Time Mismatch</option><option value="Attack Ratio Error">Attack Ratio Error</option><option value="Potion Check Error">Potion Check Error</option><option value="Potion Count Error">Potion Count Error</option><option value="Char Info Save Error">Char Info Save Error</option><option value="Default Attack Rating Error">Default Attack Rating Error</option><option value="Default Attack Size Error">Default Attack Size Error</option><option value="Continuous Attack Error">Continuous Attack Error</option><option value="Skill Attack Rating Error">Skill Attack Rating Error</option><option value="Skill Continuous Attack Error">Skill Continuous Attack Error</option><option value="Restricted Area Trespassed">Restricted Area Trespassed</option><option value="Weight Potion Position Error">Weight Potion Position Error</option><option value="Item Error">Item Error</option><option value="Copied Item Recall">Copied Item Recall</option><option value="Forced Penalty Boot">Forced Penalty Boot</option><option value="Edit Level Error">Edit Level Error</option><option value="Saved Item Error">Saved Item Error</option><option value="Continuous Save Failed Error">Continuous Save Failed Error</option><option value="Account Character Error">Account Character Error</option><option value="Trade Authorization Error">Trade Authorization Error</option><option value="Money Transfer Error">Money Transfer Error</option><option value="Multiple Connections IP">Multiple Connections IP</option><option value="Too Many Packets">Too Many Packets</option><option value="Game Server IP Error">Game Server IP Error</option><option value="Start Character Error">Start Character Error</option><option value="Server Money Error 1">Server Money Error 1</option><option value="Server Money Error 2">Server Money Error 2</option><option value="Server Money Error 3">Server Money Error 3</option><option value="EXP Hack from Character Data">EXP Hack from Character Data</option><option value="Item Code Error">Item Code Error</option><option value="Item Temp Code Error">Item Temp Code Error</option><option value="Character State Error 1">Character State Error 1</option><option value="Character Skill Point Error">Character Skill Point Error</option><option value="Character Weight Error">Character Weight Error</option><option value="Client Process Time Out">Client Process Time Out</option><option value="Inventory Item Error">Inventory Item Error</option><option value="Character Model Error">Character Model Error</option><option value="Job Code Error">Job Code Error</option><option value="Client Attack Defense Error">Client Attack Defense Error</option><option value="Client Energy Bar Error">Client Energy Bar Error</option><option value="Copied Item From Floor">Copied Item From Floor</option><option value="Tried Connect Disable IP">Tried Connect Disable IP</option><option value="Item Error Inventory">Item Error Inventory</option><option value="Money Error Inventory">Money Error Inventory</option><option value="Server Item Error Inventory">Server Item Error Inventory</option><option value="Item Error Inventory Record">Item Error Inventory Record</option><option value="Server Money Error Inventory">Server Money Error Inventory</option><option value="Server To Server Item Error">Server To Server Item Error</option><option value="Wrong Saving Character Name">Wrong Saving Character Name</option><option value="Item Position Error">Item Position Error</option><option value="Server Inventory Used Full">Server Inventory Used Full</option><option value="Used Item Code Warning">Used Item Code Warning</option><option value="Server Inventory Copied Item">Server Inventory Copied Item</option><option value="Server Copied Item Warehouse">Server Copied Item Warehouse</option><option value="Memory Buffer Saving Error">Memory Buffer Saving Error</option><option value="Warning Auto Mouse">Warning Auto Mouse</option><option value="Warning Macro Mouse">Warning Macro Mouse</option><option value="Warning Auto Click">Warning Auto Click</option><option value="Warning Avg Damage Defense">Warning Avg Damage Defense</option><option value="Warning Avg Damage Attack">Warning Avg Damage Attack</option><option value="Aging Failed Copied Item Sheltom">Aging Failed Copied Item Sheltom</option><option value="Aging Failed Copied Item">Aging Failed Copied Item</option><option value="Reconnect Server">Reconnect Server</option><option value="Checked Inventory Data">Checked Inventory Data</option><option value="Teleport Field Hack">Teleport Field Hack</option><option value="Damage Packet Error">Damage Packet Error</option><option value="Limit Damage Over">Limit Damage Over</option><option value="Limit Damage Time">Limit Damage Time</option><option value="Client Warning Motion Speed">Client Warning Motion Speed</option><option value="Client Warning Skill Attack">Client Warning Skill Attack</option><option value="Client Warning Skill Forgery">Client Warning Skill Forgery</option><option value="Client Warning Skill Forgery 2">Client Warning Skill Forgery 2</option><option value="Initial Character Level Error">Initial Character Level Error</option><option value="Too Many Updated Char Info">Too Many Updated Char Info</option><option value="Client Damage Packet Error">Client Damage Packet Error</option><option value="Warning Invincible Mode">Warning Invincible Mode</option><option value="Find Thread Hack">Find Thread Hack</option><option value="Suspend Thread Hack">Suspend Thread Hack</option><option value="Character State Error 2">Character State Error 2</option><option value="Server Potion Error">Server Potion Error</option><option value="Server Potion Moving Error">Server Potion Moving Error</option><option value="Level Quest Code Warning">Level Quest Code Warning</option><option value="Shop Buy Forgery Item">Shop Buy Forgery Item</option><option value="Server Money Overflow">Server Money Overflow</option></>)}
      </select></div>);
    }
    if (it.key === 'Action' && isCheatLog) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).Action || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Action: e.target.value || undefined }))} className="toa-select"><option value="">All</option><option value="Nothing">Nothing</option><option value="Kicked">Kicked</option><option value="Banned">Banned</option></select></div>);
    }
    if (it.key === 'Mode' && (isActionFieldLog || isActionFieldRewardLog)) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).Mode || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Mode: e.target.value || undefined }))} className="toa-select"><option value="">All</option><option value="Ghost Castle (Solo)">Ghost Castle (Solo)</option><option value="Ghost Castle (Party)">Ghost Castle (Party)</option></select></div>);
    }
    if (it.key === 'Age' && isAgingRecovery) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).Age || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Age: e.target.value || undefined }))} className="toa-select"><option value="">All</option>{Array.from({ length: 11 }, (_, i) => i + 11).map(n => (<option key={n} value={String(n)}>{n}</option>))}</select></div>);
    }
    if (it.key === 'HonorType' && isPvPHonorLog) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).HonorType || ''} onChange={(e)=> setFilters(prev => ({ ...prev, HonorType: e.target.value || undefined }))} className="toa-select"><option value="">All</option><option value="1">Gold</option><option value="2">Silver</option><option value="3">Bronze</option></select></div>);
    }
    if (it.key === 'HonorType' && isBellatraHonor) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).HonorType || ''} onChange={(e)=> setFilters(prev => ({ ...prev, HonorType: e.target.value || undefined }))} className="toa-select"><option value="">All</option><option value="51">Gold</option><option value="52">Silver</option><option value="53">Bronze</option></select></div>);
    }
    if (it.key === 'P2P' && isItemBox) {
      return (<div><div className="toa-label-field">{label}</div><select value={(filters as any).IsItem || ''} onChange={(e)=> setFilters(prev => ({ ...prev, IsItem: e.target.value || undefined }))} className="toa-select"><option value="">All</option><option value="True">True</option><option value="False">False</option></select></div>);
    }
    if (it.key === 'Sort') {
      return (<div><div className="toa-label-field">{label}</div><select value={sortDir} onChange={(e)=> setSortDir(e.target.value as 'asc'|'desc')} className="toa-select"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></div>);
    }
    return null;
  };

  // Apply DB layout to table columns (visibility + label overrides)
  const currentTableKey = String(table || '');
  const baseCols = cols;
  let displayCols = cols;
  let labelOverride = new Map<string, string>();
  try {
    const existing = (layout && layout.tables && layout.tables[currentTableKey] && layout.tables[currentTableKey].table);
    if (Array.isArray(existing)) {
      const keys = existing.map((e: any) => e.key).filter((k: string) => baseCols.includes(k));
      const missing = baseCols.filter((k) => !keys.includes(k)).map((k) => ({ key: k, visible: true }));
      const merged = [...existing, ...missing];
      displayCols = merged.filter((e: any) => e.visible !== false).map((e: any) => e.key).filter((k: string) => baseCols.includes(k));
      labelOverride = new Map(merged.filter((e: any) => e.label).map((e: any) => [e.key, String(e.label)] as [string, string]));
    }
  } catch {}
  // Apply local quick-hide overrides (not persisted; session-only)
  if (localHiddenCols.size > 0) {
    displayCols = displayCols.filter(c => !localHiddenCols.has(c));
  }
  // Identify date-type columns from meta to render timezone suffix consistently
  const dateColumnSet = new Set((columns || [])
    .filter(col => col?.isDate || /date|time/i.test(col?.type || '') || /date|time/i.test(col?.name || ''))
    .map(col => (col?.name || '').toLowerCase()));

  const formatDateDisplay = (raw: any): string => {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    // Match ISO-like with optional fractional seconds and optional trailing ' GMT+8' or 'Z'
    const isoRe = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\sGMT\+8|Z)?$/i;
    // Match YYYY/MM/DD or YYYY-MM-DD HH:mm:ss with optional fractional and optional ' GMT+8'
    const ymdRe = /^(\d{4})[\/-](\d{2})[\/-](\d{2})\s(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\sGMT\+8)?$/i;
    // Match MM/DD/YY HH:mm:ss (AccountLog-like), optional ' GMT+8'
    const shortRe = /^(\d{2})\/(\d{2})\/(\d{2})\s(\d{2}):(\d{2}):(\d{2})(?:\sGMT\+8)?$/i;
    let m = s.match(isoRe);
    if (m) {
      const yy = String(Number(m[1]) % 100).padStart(2, '0');
      // Output as MM/DD/YY HH:mm:ss GMT+8
      return `${m[2]}/${m[3]}/${yy} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
    }
    m = s.match(ymdRe);
    if (m) {
      const yy = String(Number(m[1]) % 100).padStart(2, '0');
      return `${m[2]}/${m[3]}/${yy} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
    }
    m = s.match(shortRe);
    if (m) {
      const out = `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]} GMT+8`;
      return out;
    }
    // If already has GMT+8 but unknown structure, keep original
    if (/GMT\+8$/i.test(s)) return s;
    // If ISO with trailing Z not matched (edge), still replace Z with GMT+8
    if (/Z$/i.test(s)) return s.replace(/Z$/i, ' GMT+8');
    // Fallback: append GMT+8
    return `${s} GMT+8`;
  };

  return (
    <PageShell label="Admin" title={layout?.tables?.[String(table || '')]?.title || 'Game Logs (LogDB)'} backHref="/admin" backLabel="Admin">
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {canEdit && !customize && (<button onClick={() => setCustomize(true)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Settings2 size={13} />&nbsp;Customize</button>)}
            {canEdit && customize && (<>
              <button onClick={async () => { try { await fetch('/api/admin/game-logs/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) }); setCustomize(false); } catch {} }} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Save size={13} />&nbsp;Save</button>
              <button onClick={async () => { try { const r = await fetch('/api/admin/game-logs/layout'); const j = await r.json(); if (j && j.layout) setLayout(j.layout); } catch {} setCustomize(false); }} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
              <button onClick={() => { try { const key = String(table || ''); const base = cols; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = base.map((k:string) => ({ key: k, visible: true })); setLayout(next); } catch {} }} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}>Reset</button>
            </>)}
          </div>
        </div>

        <div className="toa-seal-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="toa-label-field">Table</div>
              <select value={table} onChange={(e)=> setTable(e.target.value)} className="toa-select">
                {(() => {
                  const hidden = new Set<string>(Array.isArray((layout as any)?.hiddenTables) ? ((layout as any).hiddenTables as string[]).map(String) : []);
                  const list = tables.filter(t => !hidden.has(t) || canEdit);
                  return list.map(t => <option key={t} value={t}>{t}</option>);
                })()}
              </select>
            </div>
          </div>

          {canEdit && customize && layout && (() => {
            const key = String(table || "");
            const base = buildDefaultSearchItems();
            const existing = (layout?.tables?.[key]?.search) || base;
            const ensure = (arr: any[]) => {
              const keys = arr.map((e: any) => e.key);
              base.forEach((it) => { if (!keys.includes(it.key)) arr.push({ ...it }); });
              return arr;
            };
            const arrS = ensure(existing.slice());
            try {
              for (let i = 0; i < arrS.length; i++) {
                const e: any = arrS[i];
                if (!e || typeof e.key !== 'string') continue;
                if (e.key === 'Column' && isWarehouseLog && !Array.isArray(e.options)) {
                  arrS[i] = { ...e, options: [
                    { value: 'CharName', label: 'Character Name' },
                    { value: 'ItemName', label: 'Item Name' },
                    { value: 'UserID', label: 'Account Name' },
                  ] };
                }
                if (e.key === 'Column' && isRareItemsLog && !Array.isArray(e.options)) {
                  arrS[i] = { ...e, options: [
                    { value: 'CharacterName', label: 'Character Name' },
                    { value: 'MonsterName', label: 'Monster Name' },
                    { value: 'ItemCode1', label: 'Item Name' },
                  ] };
                }
                if (e.key === 'HonorType' && !Array.isArray(e.options)) {
                  if (isPvPHonorLog) {
                    arrS[i] = { ...e, options: [
                      { value: '1', label: 'Gold' },
                      { value: '2', label: 'Silver' },
                      { value: '3', label: 'Bronze' },
                    ] };
                  } else if (isBellatraHonor) {
                    arrS[i] = { ...e, options: [
                      { value: '51', label: 'Gold' },
                      { value: '52', label: 'Silver' },
                      { value: '53', label: 'Bronze' },
                    ] };
                  }
                }
                if ((e.key === 'Mode') && !Array.isArray(e.options) && (isActionFieldLog || isActionFieldRewardLog)) {
                  arrS[i] = { ...e, options: [
                    { value: 'Ghost Castle (Solo)', label: 'Ghost Castle (Solo)' },
                    { value: 'Ghost Castle (Party)', label: 'Ghost Castle (Party)' },
                  ] };
                }
                if ((e.key === 'Action') && !Array.isArray(e.options) && isCheatLog) {
                  arrS[i] = { ...e, options: [
                    { value: 'Nothing', label: 'Nothing' },
                    { value: 'Kicked', label: 'Kicked' },
                    { value: 'Banned', label: 'Banned' },
                  ] };
                }
                if ((e.key === 'Age') && !Array.isArray(e.options) && isAgingRecovery) {
                  arrS[i] = { ...e, options: Array.from({ length: 11 }, (_, n) => ({ value: String(11 + n), label: String(11 + n) })) };
                }
                if ((e.key === 'Type') && !Array.isArray(e.options)) {
                  if (isAccountLog) {
                    arrS[i] = { ...e, options: [
                      { value: 'Device Info', label: 'Device Info' },
                      { value: 'Login Server Logon', label: 'Login Server Logon' },
                      { value: 'Character Creation', label: 'Character Creation' },
                    ] };
                  } else if (isCharacterLog) {
                    arrS[i] = { ...e, options: [
                      { value: 'Save', label: 'Save' },
                      { value: 'Lose EXP', label: 'Lose EXP' },
                      { value: 'Temporary Ban', label: 'Temporary Ban' },
                    ] };
                  } else if (isCheatLog) {
                  }
                }
              }
            } catch {}
            return (
              <div className="toa-panel">
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Customize Search Card</div>
                <div className="space-y-2">
                  {arrS.map((it: any, idx: number) => (
                    <div key={it.key} className="flex items-center gap-2" draggable
                      onDragStart={(e)=>{ e.dataTransfer?.setData('text/plain', String(idx)); setDragItem({ scope: "search", index: idx }); }}
                      onDragOver={(e)=> e.preventDefault()}
                      onDrop={()=>{ if (!layout) return; const copy = arrS.slice(); const from = (dragItem && dragItem.scope === "search") ? (dragItem.index ?? -1) : -1; if (from > -1) { const [m] = copy.splice(from,1); copy.splice(idx,0,m); } const next = { ...(layout || { version: 1, owner: "botro", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: "", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); setDragItem(null); }}>
                      <span className="cursor-move select-none px-2">≡</span>
                      <input type="checkbox" checked={it.visible !== false} onChange={(e)=> { const copy = arrS.slice(); copy[idx] = { ...it, visible: e.target.checked }; const next = { ...(layout || { version: 1, owner: "botro", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: "", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} />
                      <span style={{ color: 'var(--toa-bone)', width: '12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.key}</span>
                      <input value={it.label || ""} onChange={(e)=> { const copy = arrS.slice(); copy[idx] = { ...it, label: e.target.value || undefined }; const next = { ...(layout || { version: 1, owner: "botro", tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: "", search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} placeholder="Label" className="toa-input toa-btn-sm" />
                    </div>
                  ))}
                </div>
                {(() => {
                  const idxMap: Record<string, number> = {};
                  arrS.forEach((e: any, i: number) => { if (e && typeof e.key === 'string') idxMap[e.key] = i; });
                  const withOpts = arrS.filter((e: any) => Array.isArray(e?.options) && e.options.length);
                  if (!withOpts.length) return null;
                  return (
                    <div className="space-y-3">
                      {withOpts.map((e: any) => {
                        const i = idxMap[e.key];
                        const opts = Array.isArray(e.options) ? e.options : [];
                        return (
                          <div key={e.key} className="toa-panel">
                            <div style={{ color: 'var(--toa-bone)', marginBottom: '0.5rem' }}>Options for {e.key}</div>
                            <div className="space-y-2">
                              {opts.map((op: any, oi: number) => (
                                <div key={String(op.value)+oi} className="flex items-center gap-2">
                                  <input value={String(op.value)} disabled className="toa-input toa-btn-sm" />
                                  <input value={op.label || ''} onChange={(ev)=> { const copy = arrS.slice(); const item = { ...(copy[i] || {}) }; const oarr = Array.isArray(item.options) ? item.options.slice() : []; oarr[oi] = { value: String(op.value), label: ev.target.value, hidden: op.hidden === true ? true : false }; item.options = oarr; copy[i] = item; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} placeholder="Label" className="toa-input" />
                                  <label className="flex items-center gap-1 text-sm select-none" style={{ color: 'var(--toa-bone)' }}>
                                    <input type="checkbox" checked={op.hidden === true ? false : true} onChange={(ev)=> { const copy = arrS.slice(); const item = { ...(copy[i] || {}) }; const oarr = Array.isArray(item.options) ? item.options.slice() : []; const visible = ev.target.checked; const newOp = { value: String(op.value), label: op.label || String(op.value), hidden: visible ? false : true }; oarr[oi] = newOp; item.options = oarr; copy[i] = item; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} />
                                    Visible
                                  </label>
                                  <button onClick={()=> { const copy = arrS.slice(); const item = { ...(copy[i] || {}) }; const oarr = Array.isArray(item.options) ? item.options.slice() : []; oarr.splice(oi,1); item.options = oarr; copy[i] = item; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].search = copy; setLayout(next); }} className="toa-btn toa-btn-ghost toa-btn-xs">Remove</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="toa-panel">
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Add Dropdown Filter</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <div className="toa-label-field">Column</div>
                      <select value={newFilterKey} onChange={(e)=> setNewFilterKey(e.target.value)} className="toa-select toa-btn-sm">
                        <option value="">Select column</option>
                        {(columns || []).filter(c => c && c.name && !/date|time/i.test(c.name)).map(c => (
                          <option key={c.name} value={c.name}>{formatColumnLabel(c.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="toa-label-field">Label</div>
                      <input value={newFilterLabel} onChange={(e)=> setNewFilterLabel(e.target.value)} placeholder="Display label" className="toa-input toa-btn-sm" />
                    </div>
                    <div className="self-end">
                      <button onClick={()=> { if (!newFilterKey) return; const item = { key: newFilterKey, label: newFilterLabel || undefined, visible: true, type: 'select', options: newFilterOptions.slice() }; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) } as any; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; const arr = Array.isArray(next.tables[key].search) ? next.tables[key].search.slice() : []; const ex = arr.findIndex((x: any) => x && x.key === newFilterKey); if (ex > -1) arr[ex] = item; else arr.push(item); next.tables[key].search = arr; setLayout(next); setNewFilterKey(''); setNewFilterLabel(''); setNewFilterOptions([]); setNewOptionValue(''); setNewOptionLabel(''); }} className="toa-btn toa-btn-ghost toa-btn-sm">Add Filter</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <div className="toa-label-field">Option value</div>
                      <input value={newOptionValue} onChange={(e)=> setNewOptionValue(e.target.value)} placeholder="DB value" className="toa-input toa-btn-sm" />
                    </div>
                    <div>
                      <div className="toa-label-field">Option label</div>
                      <div className="flex gap-2">
                        <input value={newOptionLabel} onChange={(e)=> setNewOptionLabel(e.target.value)} placeholder="Display label" className="toa-input toa-btn-sm" />
                        <button onClick={()=> { if (!newOptionValue) return; const next = newFilterOptions.slice(); next.push({ value: String(newOptionValue), label: newOptionLabel || String(newOptionValue) }); setNewFilterOptions(next); setNewOptionValue(''); setNewOptionLabel(''); }} className="toa-btn toa-btn-ghost toa-btn-sm">Add</button>
                      </div>
                    </div>
                  </div>
                  {newFilterOptions.length > 0 && (
                    <div className="space-y-1">
                      {newFilterOptions.map((o, i) => (
                        <div key={String(o.value)+i} className="flex items-center gap-2">
                          <input value={String(o.value)} disabled className="toa-input toa-btn-sm" />
                          <input value={o.label} onChange={(e)=> { const next = newFilterOptions.slice(); next[i] = { value: String(o.value), label: e.target.value }; setNewFilterOptions(next); }} className="toa-input" />
                          <button onClick={()=> { const next = newFilterOptions.slice(); next.splice(i,1); setNewFilterOptions(next); }} className="toa-btn toa-btn-ghost toa-btn-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Unified search card for all tables */}
          {canEdit && customize && layout && (() => {
            const key = String(table || '');
            const baseCols = cols;
            const existing = layout?.tables?.[key]?.table || baseCols.map(k => ({ key: k, visible: true }));
            const ensure = (arr: any[]) => {
              const keys = arr.map((e: any) => e.key);
              baseCols.forEach((k) => { if (!keys.includes(k)) arr.push({ key: k, visible: true }); });
              return arr;
            };
            const arr = ensure(existing.slice());
            return (
              <div className="toa-panel">
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Customize Title</div>
                {(() => { const key = String(table || ''); const val = (layout?.tables?.[key]?.title) || ''; return (<div className="flex items-center gap-2 mb-3"><input value={val} onChange={(e)=> { const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].title = e.target.value; setLayout(next); }} placeholder="Table title" className="toa-input" /></div>); })()}
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Table Visibility</div>
                {(() => { const key = String(table || ''); const hidden = new Set<string>(Array.isArray((layout as any)?.hiddenTables) ? ((layout as any).hiddenTables as string[]).map(String) : []); const isVisible = !hidden.has(key); return (
                  <div className="flex items-center gap-2 mb-3">
                    <input id="toggle-table-visible" type="checkbox" checked={isVisible} onChange={(e) => { const next: any = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; const set = new Set<string>(Array.isArray(next.hiddenTables) ? next.hiddenTables.map(String) : []); if (e.target.checked) { set.delete(key); } else { set.add(key); } next.hiddenTables = Array.from(set); setLayout(next); }} />
                    <label htmlFor="toggle-table-visible" className="select-none" style={{ color: 'var(--toa-bone)' }}>Show this table in dropdown</label>
                  </div>
                ); })()}
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, color: 'var(--toa-gold-bright)' }}>Customize Columns</div>
                <div className="space-y-2">
                  {arr.map((tc: any, idx: number) => (
                    <div key={tc.key} className="flex items-center gap-2" draggable onDragStart={(e)=>{ e.dataTransfer?.setData('text/plain', String(idx)); setDragItem({ scope: 'table', index: idx }); }} onDragOver={(e)=> e.preventDefault()} onDrop={()=>{ if (!layout) return; const copy = arr.slice(); const from = (dragItem && dragItem.scope === 'table') ? (dragItem.index ?? -1) : -1; if (from > -1) { const [m] = copy.splice(from,1); copy.splice(idx,0,m); } const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = copy; setLayout(next); setDragItem(null); }}>
                      <span className="cursor-move select-none px-2">≡</span>
                      <input type="checkbox" checked={tc.visible !== false} onChange={(e)=> { const copy = arr.slice(); copy[idx] = { ...tc, visible: e.target.checked }; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = copy; setLayout(next); }} />
                      <span style={{ color: 'var(--toa-bone)', width: '12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tc.key}</span>
                      <input value={tc.label || ''} onChange={(e)=> { const copy = arr.slice(); copy[idx] = { ...tc, label: e.target.value || undefined }; const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) }; if (!next.tables) next.tables = {}; if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] }; next.tables[key].table = copy; setLayout(next); }} placeholder="Header label" className="toa-input toa-btn-sm" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Unified search card for all tables */}
          {(() => { const hasSaved = Array.isArray(layout?.tables?.[currentSearchTableKey]?.search) && (layout?.tables?.[currentSearchTableKey]?.search?.length > 0); if (hasSaved) { return (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{visibleSearchItems.map((it: any) => (<div key={it.key}>{renderSearchItem(it)}</div>))}</div>); } return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="toa-label-field">Search</div>
              <input value={text} onChange={(e)=> setText(e.target.value)} placeholder="keyword" className="toa-input" />
            </div>
            {(() => {
              const available = (textCols || []).filter(c => c && c !== 'ItemCode' && !/date|time/i.test(c));
              if (!available.length) return null;
              let labelMap: Record<string, string> = {};
              let allowed: Set<string> | null = null;
              try {
                const savedItems = (layout?.tables?.[currentSearchTableKey]?.search) || [];
                const cfg: any = Array.isArray(savedItems) ? savedItems.find((s: any) => s && s.key === 'Column') : null;
                const allOpts = (cfg && Array.isArray(cfg.options)) ? (cfg.options as Array<{ value: string; label: string }>) : null;
                const opts = allOpts ? (allOpts as any[]).filter((o: any) => !o?.hidden) : null;
                if (opts && opts.length) {
                  const map: Record<string, string> = {};
                  for (const o of opts as any[]) { if (o && o.value != null) map[String(o.value)] = o.label ?? String(o.value); }
                  labelMap = map;
                  allowed = new Set((opts as any[]).map((o: any) => String(o.value)));
                }
              } catch {}
              if (isWarehouseLog) {
                labelMap = { ...labelMap, CharName: labelMap['CharName'] ?? 'Character Name', ItemName: labelMap['ItemName'] ?? 'Item Name', UserID: labelMap['UserID'] ?? 'Account Name' };
              }
              if (isRareItemsLog) {
                labelMap = { ...labelMap, CharacterName: labelMap['CharacterName'] ?? 'Character Name', MonsterName: labelMap['MonsterName'] ?? 'Monster Name', ItemCode1: labelMap['ItemCode1'] ?? 'Item Name' };
              }
              return (
                <div>
                  <div className="toa-label-field">Column</div>
                  <select value={textColumn} onChange={(e)=> setTextColumn(e.target.value)} className="toa-select">
                    <option value="">All columns</option>
                    {(allowed ? available.filter(c => allowed!.has(c)) : available).map(c => (
                      <option key={c} value={c}>{labelMap[c] ?? formatColumnLabel(c)}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
            {isAccountLog && (
              <div>
                <div className="toa-label-field">Type</div>
                <select value={(filters as any).Type || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Type: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="Device Info">Device Info</option>
                  <option value="Login Server Logon">Login Server Logon</option>
                  <option value="Character Creation">Character Creation</option>
                </select>
              </div>
            )}
            {isCharacterLog && (
              <div>
                <div className="toa-label-field">Type</div>
                <select value={(filters as any).Type || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Type: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="Save">Save</option>
                  <option value="Lose EXP">Lose EXP</option>
                  <option value="Temporary Ban">Temporary Ban</option>
                </select>
              </div>
            )}
            {isCheatLog && (
              <div>
                <div className="toa-label-field">Type</div>
                <select value={(filters as any).Type || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Type: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="Delay Skill Hack">Delay Skill Hack</option>
                  <option value="Validate Character Error">Validate Character Error</option>
                  <option value="Copied Item Error">Copied Item Error</option>
                  <option value="Hack Warning">Hack Warning</option>
                  <option value="Copied Item">Copied Item</option>
                  <option value="Copied Item Warehouse">Copied Item Warehouse</option>
                  <option value="Warehouse Gold">Warehouse Gold</option>
                  <option value="Warehouse New Clone">Warehouse New Clone</option>
                  <option value="Warehouse Bug">Warehouse Bug</option>
                  <option value="Hack Detected">Hack Detected</option>
                  <option value="Focus Changed">Focus Changed</option>
                  <option value="Gold Limit">Gold Limit</option>
                  <option value="Speed Hack">Speed Hack</option>
                  <option value="Time Error Speed Hack">Time Error Speed Hack</option>
                  <option value="Time Mismatch">Time Mismatch</option>
                  <option value="Attack Ratio Error">Attack Ratio Error</option>
                  <option value="Potion Check Error">Potion Check Error</option>
                  <option value="Potion Count Error">Potion Count Error</option>
                  <option value="Char Info Save Error">Char Info Save Error</option>
                  <option value="Default Attack Rating Error">Default Attack Rating Error</option>
                  <option value="Default Attack Size Error">Default Attack Size Error</option>
                  <option value="Continuous Attack Error">Continuous Attack Error</option>
                  <option value="Skill Attack Rating Error">Skill Attack Rating Error</option>
                  <option value="Skill Continuous Attack Error">Skill Continuous Attack Error</option>
                  <option value="Restricted Area Trespassed">Restricted Area Trespassed</option>
                  <option value="Weight Potion Position Error">Weight Potion Position Error</option>
                  <option value="Item Error">Item Error</option>
                  <option value="Copied Item Recall">Copied Item Recall</option>
                  <option value="Forced Penalty Boot">Forced Penalty Boot</option>
                  <option value="Edit Level Error">Edit Level Error</option>
                  <option value="Saved Item Error">Saved Item Error</option>
                  <option value="Continuous Save Failed Error">Continuous Save Failed Error</option>
                  <option value="Account Character Error">Account Character Error</option>
                  <option value="Trade Authorization Error">Trade Authorization Error</option>
                  <option value="Money Transfer Error">Money Transfer Error</option>
                  <option value="Multiple Connections IP">Multiple Connections IP</option>
                  <option value="Too Many Packets">Too Many Packets</option>
                  <option value="Game Server IP Error">Game Server IP Error</option>
                  <option value="Start Character Error">Start Character Error</option>
                  <option value="Server Money Error 1">Server Money Error 1</option>
                  <option value="Server Money Error 2">Server Money Error 2</option>
                  <option value="Server Money Error 3">Server Money Error 3</option>
                  <option value="EXP Hack from Character Data">EXP Hack from Character Data</option>
                  <option value="Item Code Error">Item Code Error</option>
                  <option value="Item Temp Code Error">Item Temp Code Error</option>
                  <option value="Character State Error 1">Character State Error 1</option>
                  <option value="Character Skill Point Error">Character Skill Point Error</option>
                  <option value="Character Weight Error">Character Weight Error</option>
                  <option value="Client Process Time Out">Client Process Time Out</option>
                  <option value="Inventory Item Error">Inventory Item Error</option>
                  <option value="Character Model Error">Character Model Error</option>
                  <option value="Job Code Error">Job Code Error</option>
                  <option value="Client Attack Defense Error">Client Attack Defense Error</option>
                  <option value="Client Energy Bar Error">Client Energy Bar Error</option>
                  <option value="Copied Item From Floor">Copied Item From Floor</option>
                  <option value="Tried Connect Disable IP">Tried Connect Disable IP</option>
                  <option value="Item Error Inventory">Item Error Inventory</option>
                  <option value="Money Error Inventory">Money Error Inventory</option>
                  <option value="Server Item Error Inventory">Server Item Error Inventory</option>
                  <option value="Item Error Inventory Record">Item Error Inventory Record</option>
                  <option value="Server Money Error Inventory">Server Money Error Inventory</option>
                  <option value="Server To Server Item Error">Server To Server Item Error</option>
                  <option value="Wrong Saving Character Name">Wrong Saving Character Name</option>
                  <option value="Item Position Error">Item Position Error</option>
                  <option value="Server Inventory Used Full">Server Inventory Used Full</option>
                  <option value="Used Item Code Warning">Used Item Code Warning</option>
                  <option value="Server Inventory Copied Item">Server Inventory Copied Item</option>
                  <option value="Server Copied Item Warehouse">Server Copied Item Warehouse</option>
                  <option value="Memory Buffer Saving Error">Memory Buffer Saving Error</option>
                  <option value="Warning Auto Mouse">Warning Auto Mouse</option>
                  <option value="Warning Macro Mouse">Warning Macro Mouse</option>
                  <option value="Warning Auto Click">Warning Auto Click</option>
                  <option value="Warning Avg Damage Defense">Warning Avg Damage Defense</option>
                  <option value="Warning Avg Damage Attack">Warning Avg Damage Attack</option>
                  <option value="Aging Failed Copied Item Sheltom">Aging Failed Copied Item Sheltom</option>
                  <option value="Aging Failed Copied Item">Aging Failed Copied Item</option>
                  <option value="Reconnect Server">Reconnect Server</option>
                  <option value="Checked Inventory Data">Checked Inventory Data</option>
                  <option value="Teleport Field Hack">Teleport Field Hack</option>
                  <option value="Damage Packet Error">Damage Packet Error</option>
                  <option value="Limit Damage Over">Limit Damage Over</option>
                  <option value="Limit Damage Time">Limit Damage Time</option>
                  <option value="Client Warning Motion Speed">Client Warning Motion Speed</option>
                  <option value="Client Warning Skill Attack">Client Warning Skill Attack</option>
                  <option value="Client Warning Skill Forgery">Client Warning Skill Forgery</option>
                  <option value="Client Warning Skill Forgery 2">Client Warning Skill Forgery 2</option>
                  <option value="Initial Character Level Error">Initial Character Level Error</option>
                  <option value="Too Many Updated Char Info">Too Many Updated Char Info</option>
                  <option value="Client Damage Packet Error">Client Damage Packet Error</option>
                  <option value="Warning Invincible Mode">Warning Invincible Mode</option>
                  <option value="Find Thread Hack">Find Thread Hack</option>
                  <option value="Suspend Thread Hack">Suspend Thread Hack</option>
                  <option value="Character State Error 2">Character State Error 2</option>
                  <option value="Server Potion Error">Server Potion Error</option>
                  <option value="Server Potion Moving Error">Server Potion Moving Error</option>
                  <option value="Level Quest Code Warning">Level Quest Code Warning</option>
                  <option value="Shop Buy Forgery Item">Shop Buy Forgery Item</option>
                  <option value="Server Money Overflow">Server Money Overflow</option>
                </select>
              </div>
            )}
            {isCheatLog && (
              <div>
                <div className="toa-label-field">Action</div>
                <select value={(filters as any).Action || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Action: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="Nothing">Nothing</option>
                  <option value="Kicked">Kicked</option>
                  <option value="Banned">Banned</option>
                </select>
              </div>
            )}
            {isAgingRecovery && (
              <div>
                <div className="toa-label-field">Age</div>
                <select value={(filters as any).Age || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Age: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  {Array.from({ length: 11 }, (_, i) => i + 11).map(n => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            {isBellatraHonor && (
              <div>
                <div className="toa-label-field">Honor Type</div>
                <select value={(filters as any).HonorType || ''} onChange={(e)=> setFilters(prev => ({ ...prev, HonorType: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="51">Gold</option>
                  <option value="52">Silver</option>
                  <option value="53">Bronze</option>
                </select>
              </div>
            )}
            {isPvPHonorLog && (
              <div>
                <div className="toa-label-field">Honor Type</div>
                <select value={(filters as any).HonorType || ''} onChange={(e)=> setFilters(prev => ({ ...prev, HonorType: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="1">Gold</option>
                  <option value="2">Silver</option>
                  <option value="3">Bronze</option>
                </select>
              </div>
            )}
            {(isActionFieldLog || isActionFieldRewardLog) && (
              <div>
                <div className="toa-label-field">Mode</div>
                <select value={(filters as any).Mode || ''} onChange={(e)=> setFilters(prev => ({ ...prev, Mode: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="Ghost Castle (Solo)">Ghost Castle (Solo)</option>
                  <option value="Ghost Castle (Party)">Ghost Castle (Party)</option>
                </select>
              </div>
            )}
            {isItemBox && (
              <div>
                <div className="toa-label-field">Player-to-Player</div>
                <select value={(filters as any).IsItem || ''} onChange={(e)=> setFilters(prev => ({ ...prev, IsItem: e.target.value || undefined }))} className="toa-select">
                  <option value="">All</option>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              </div>
            )}
            <div>
              <div className="toa-label-field">Sort</div>
              <select value={sortDir} onChange={(e)=> setSortDir(e.target.value as 'asc'|'desc')} className="toa-select">
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>
          ); })()}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>

            <button onClick={()=> doSearch(1, pageSize, sortDir)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Search size={13} />&nbsp;{searching ? 'Searching…' : 'Search'}</button>
            <button onClick={()=> { setDateFrom(''); setDateTo(''); setText(''); setTextColumn(''); setTextCols([]); setFilters({}); setPage(1); setPageSize(100); setSortDir('desc'); setRows([]); setTotal(0);} } className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><RotateCcw size={13} />&nbsp;Reset</button>
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {/* Quick column visibility toggle */}
          <div className="relative">
            <button
              onClick={() => setColDropdownOpen(v => !v)}
              className="toa-btn toa-btn-ghost toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Columns3 size={13} />&nbsp;Columns ({displayCols.length}/{cols.length})
            </button>
            {colDropdownOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setColDropdownOpen(false)} />
                <div className="toa-panel" style={{ position: 'absolute', right: 0, marginTop: '0.25rem', zIndex: 50, width: '14rem', maxHeight: '20rem', overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--toa-gold-bright)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Toggle Columns</div>
                  {cols.map(c => {
                    const visible = !localHiddenCols.has(c);
                    return (
                      <label key={c} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--toa-bone)' }}>
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => {
                            setLocalHiddenCols(prev => {
                              const next = new Set(prev);
                              if (next.has(c)) next.delete(c);
                              else next.add(c);
                              return next;
                            });
                          }}
                        />
                        <span className="truncate">{labelOverride.get(c) ?? formatColumnLabel(c)}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }} className="hidden sm:inline">Per page:</span>
          <select value={String(pageSize)} onChange={(e)=> { const ps = Number(e.target.value); doSearch(1, ps, sortDir); }} className="toa-select toa-btn-sm">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            return (
              <>
                <button disabled={page <= 1} onClick={() => doSearch(Math.max(1, page - 1), pageSize, sortDir)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</div>
                <button disabled={page >= totalPages} onClick={() => doSearch(Math.min(totalPages, page + 1), pageSize, sortDir)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
              </>
            );
          })()}
        </div>

        <div className="toa-seal-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div className="w-full overflow-x-auto">
            <table className="toa-table">
              <thead>
                <tr>
                  {cols.length === 0 ? (
                    <th>No results</th>
                  ) : (
                    displayCols.map((c, i) => {
                      const lc = c.toLowerCase();
                      let label = c;
                      if (c === 'rn') label = '#';
                      else if (c === 'AccountName') label = 'Account Name';
                      else if (c === 'CharacterName') label = 'Character Name';
                      else if (lc === 'ipaddress' || lc === 'ip') label = 'IP';
                      else if (c === 'Type' || c === 'LogID') label = 'Log Type';
                      else if (c === 'ServerID' || c === 'Server') label = 'Server';
                      else if (c === 'ActionName' || c === 'Action') label = 'Action';
                      else if (c === 'ModeID') label = 'Mode';
                      else if (c === 'SenderName') label = 'Sender Name';
                      else if (c === 'ItemName') label = 'Item Name';
                      else if (c === 'ItemSpec') label = 'Item Spec';
                      else if (c === 'ItemCode') label = 'Item';
                      else if (c === 'IsItem') label = 'P2P Transfer';
                      else if (c === 'DateReceived') label = 'Date Received';
                      else if (c === 'DateDiscarded') label = 'Date Discarded';
                      else if (c === 'HonorType') label = 'Honor Type';
                      else if (c === 'ChestTypeID') label = 'Chest Type';
                      else if (c === 'Map') label = 'Map';
                      else if (c === 'Boss') label = 'Boss';
                      else if (isAgingRecovery) label = c.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');

                      if (labelOverride.has(c)) label = labelOverride.get(c)!;
                      return (
                        <th
                          key={c}
                          draggable={canEdit && customize}
                          onDragStart={(e) => { if (canEdit && customize) { try { e.dataTransfer?.setData('text/plain', String(i)); } catch {} setDragItem({ scope: 'tableHeader', index: i }); } }}
                          onDragOver={(e) => { if (canEdit && customize) e.preventDefault(); }}
                          onDrop={() => {
                            if (!layout || !(canEdit && customize)) return;
                            const from = (dragItem && dragItem.scope === 'tableHeader') ? (dragItem.index ?? -1) : -1;
                            if (from < 0 || from === i) { setDragItem(null); return; }
                            const key = String(table || '');
                            const base = cols; // authoritative displayed columns
                            const arr = (layout?.tables?.[key]?.table) || base.map((k) => ({ key: k, visible: true }));
                            // ensure missing displayed columns are present in the editable array
                            try {
                              const have = new Set(arr.map((e: any) => e.key));
                              for (const k of base) { if (!have.has(k)) arr.push({ key: k, visible: true }); }
                            } catch {}
                            const fromKey = displayCols[from];
                            const toKey = displayCols[i];
                            if (!fromKey || !toKey) { setDragItem(null); return; }
                            const fromArrIndex = arr.findIndex((e: any) => e.key === fromKey);
                            let toArrIndex = arr.findIndex((e: any) => e.key === toKey);
                            if (fromArrIndex === -1 || toArrIndex === -1) { setDragItem(null); return; }
                            const copy = arr.slice();
                            const [m] = copy.splice(fromArrIndex, 1);
                            if (fromArrIndex < toArrIndex) toArrIndex -= 1;
                            copy.splice(toArrIndex, 0, m);
                            const next = { ...(layout || { version: 1, owner: 'botro', tables: {} }) } as any;
                            if (!next.tables) next.tables = {};
                            if (!next.tables[key]) next.tables[key] = { title: '', search: [], table: [] };
                            next.tables[key].table = copy;
                            setLayout(next);
                            setDragItem(null);
                          }}
                          className={`toa-table-th ${isCheatLog && c === 'Description' ? 'max-w-sm' : ''} ${isCheatLog && (lc === 'ip' || lc === 'ipaddress') ? 'w-28' : ''} ${isCheatLog && c === 'Date' ? 'w-32' : ''} ${['Date','Server'].includes(c) ? 'whitespace-nowrap' : ''}`}
                        >
                          {(canEdit && customize) && <span className="cursor-move select-none mr-1">≡</span>}
                          {label}
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? rows.map((row, idx) => (
                  <tr key={idx} className="toa-table-row">
                    {displayCols.map((c) => {
                      let val: any;
                      if (c === 'rn') {
                        val = String(row['rn'] ?? (idx + 1 + (page - 1) * pageSize));
                      } else if (c === 'LogID') {
                        const v = row[c];
                        if (isAccountLog) {
                          const m: Record<string|number, string> = { 501: 'Device Info', 506: 'Login Server Logon', 507: 'Character Creation' };
                          val = m[v] || (v != null ? `Code ${v}` : '');
                        } else if (isCharacterLog) {
                          const m: Record<string|number, string> = { 511: 'Save', 512: 'Lose EXP', 513: 'Temporary Ban' };
                          val = m[v] || (v != null ? `Code ${v}` : '');
                        } else if (isCheatLog) {
                          val = v != null ? `Code ${v}` : '';
                        } else {
                          val = v != null ? `Code ${v}` : '';
                        }
                      } else if (c === 'ServerID') {
                        const v = row[c];
                        const m: Record<string|number, string> = { 0: 'Login Server', 1: 'Mehmed', 2: 'Vlad' };
                        val = m[v] || (v != null ? `Server ${v}` : '');
                      } else if (isCheatLog && c === 'Action') {
                        const v = row[c];
                        const m: Record<string|number, string> = { 0: 'Nothing', 1: 'Kicked', 2: 'Banned' };
                        val = m[v] || (v != null ? String(v) : '');
                      } else if (isWarehouseLog && c === 'Action') {
                        const v = row[c];
                        const m: Record<string|number, string> = { 1: 'Put Item', 2: 'Get Item', 3: 'Deposit Gold', 4: 'Withdraw Gold' };
                        val = m[v] || (v != null ? String(v) : '');
                      } else if (isAgingRecovery && c === 'DateRecovered') {
                        const v = row[c];
                        val = v ? formatDateDisplay(v) : 'Not yet recovered';
                      } else if (c === 'ChestTypeID') {
                        const v = row[c];
                        const map: Record<string|number, string> = { 1: 'Silver Chest', 2: 'Blue Locked Chest' };
                        val = map[v] || (v != null ? String(v) : '');
                      } else if (c === 'HonorType') {
                        const v = row[c];
                        if (isPvPHonorLog) {
                          const map: Record<string|number, string> = { 1: 'Gold', 2: 'Silver', 3: 'Bronze' };
                          val = map[v] || (v != null ? String(v) : '');
                        } else if (isBellatraHonor) {
                          const map: Record<string|number, string> = { 51: 'Gold', 52: 'Silver', 53: 'Bronze' };
                          val = map[v] || (v != null ? String(v) : '');
                        } else {
                          val = v != null ? String(v) : '';
                        }
                      } else if (dateColumnSet.has(c.toLowerCase()) || /date|time/i.test(c)) {
                        const v = row[c];
                        val = formatDateDisplay(v);
                      } else if (isItemBox && c === 'IsItem') {
                        const v = row[c];
                        val = v ? 'True' : 'False';
                      } else if (isOnlineRewardLog && c === 'IsDailyReward') {
                        const v = row[c];
                        if (v === 1 || v === '1' || v === true || String(v).toLowerCase() === 'true') val = 'Daily';
                        else val = 'Hourly';
                      } else if (['Code1','Code2'].includes(c)) {
                        // Render raw checksum/header values without locale formatting
                        val = row[c];
                      } else if (isRareItemsLog && ['ItemCode1','ItemCode2'].includes(c)) {
                        // Render raw item codes without locale formatting
                        val = row[c];
                      } else if (isItemBox && c === 'ItemSpec') {
                        const v = Number(row[c]);
                        const map: Record<number, string> = {
                          0: 'None',
                          1: 'Mechanician',
                          2: 'Fighter',
                          3: 'Pikeman',
                          4: 'Archer',
                          5: 'Atalanta',
                          6: 'Knight',
                          7: 'Magician',
                          8: 'Priestess',
                          9: 'Assassin',
                          10: 'Shaman',
                          65536: 'Knight',
                          131072: 'Atalanta',
                          196608: 'Priestess',
                          262144: 'Magician',
                          327680: 'Shaman',
                          327936: 'Assassin',
                        };
                        val = (v in map) ? map[v] : (row[c] != null ? String(row[c]) : '');
                      } else if (c === 'CharacterID') {
                        val = row[c];
                      } else if (c === 'ItemID' && isWarehouseLog) {
                        val = row[c];
                      } else if ((columns || []).some(col => col.name === c && col.isNumeric) && typeof row[c] === 'number') {
                        val = (row[c] as number).toLocaleString();
                      } else if (/(quantity|qty|count|amount)/i.test(c) && (typeof row[c] === 'number' || (!isNaN(Number(row[c])) && row[c] !== null && row[c] !== ''))) {
                        const n = Number(row[c]);
                        val = isNaN(n) ? row[c] : n.toLocaleString();
                      } else {
                        val = row[c];
                      }
                      return (
                        <td key={c} className={`toa-table-td ${isCheatLog && c === 'Description' ? 'max-w-sm whitespace-pre-wrap break-words align-top' : ''} ${isCheatLog && (c.toLowerCase() === 'ip' || c.toLowerCase() === 'ipaddress') ? 'w-28 text-sm' : ''} ${isCheatLog && c === 'Date' ? 'w-32 text-sm' : ''} ${['Date','Server'].includes(c) ? 'whitespace-nowrap' : ''}`}>{String(val ?? '')}</td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td className="toa-table-td" style={{ textAlign: 'center', color: 'var(--toa-bone)' }} colSpan={displayCols.length || cols.length || 1}>
                      {hasSearched ? 'No results found' : 'Use filters above and click Search'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }} className="hidden sm:inline">Per page:</span>
          <select value={String(pageSize)} onChange={(e)=> { const ps = Number(e.target.value); doSearch(1, ps, sortDir); }} className="toa-select toa-btn-sm">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            return (
              <>
                <button disabled={page <= 1} onClick={() => doSearch(Math.max(1, page - 1), pageSize, sortDir)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                <div style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Page {page} of {totalPages}</div>
                <button disabled={page >= totalPages} onClick={() => doSearch(Math.min(totalPages, page + 1), pageSize, sortDir)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
              </>
            );
          })()}
        </div>
      </div>
    </PageShell>
  );
}
