import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { logDB, userDB, gameDB } from '@/lib/db';

function isIsoDate(v: any) {
  return typeof v === 'string' && !isNaN(Date.parse(v));
}

function buildMapIdCase(): string {
  const map: Record<number, string> = {
    [-1]: 'Invalid',
    0: 'Acasia Forest', 1: 'Bamboo Forest', 2: 'Garden Of Freedom', 3: 'Ricarten Town',
    4: 'Refuge Of The Ancients', 5: 'Castle Of The Lost', 6: 'Ruinen Village', 7: 'Cursed Land',
    8: 'Forgotten Land', 9: 'Navisko Town', 10: 'Oasis', 11: 'Ancients Battlefield', 12: 'Forbidden Land',
    13: 'Ancient Prison F1', 14: 'Ancient Prison F2', 15: 'Ancient Prison F3', 16: 'Chess Room',
    17: 'Forest Of Spirits', 18: 'Land Of Dusk', 19: 'Valley Of Tranquility', 20: 'Road To The Wind',
    21: 'Phillai Town', 22: 'Cursed Temple F1', 23: 'Cursed Temple F2', 24: 'Mushroom Cave',
    25: 'Beehive Cave', 26: 'Dark Sanctuary', 27: 'Railway Of Chaos', 28: 'Heart Of Perum',
    29: 'Eura', 30: 'Bellatra', 31: 'Gallubia Valley', 32: 'Quest Arena', 33: 'Bless Castle',
    34: 'Greedy Lake', 35: 'Frozen Sanctuary', 36: 'Kelvezu Lair', 37: 'Land Of Chaos',
    38: 'Lost Temple', 39: 'Ghost Castle', 40: 'Endless Tower F1', 41: 'Endless Tower F2',
    42: 'Cursed Temple F3', 43: 'Endless Tower F3', 44: 'Ice Mine F1', 45: 'Atlantis',
    46: 'Mystery Forest 1', 47: 'Mystery Forest 2', 48: 'Mystery Forest 3', 49: 'Battle Town',
    50: 'Mystery Desert 3', 51: 'Mystery Desert 2', 52: 'Mystery Desert 1', 53: 'Forgotten Temple F1',
    54: 'Forgotten Temple F2', 55: 'Ancient Dungeon F1', 56: 'Ancient Dungeon F2', 57: 'Ancient Dungeon F3',
    58: 'Ancient Weapon', 59: 'Abyss Sea', 60: 'T5 Quest Arena', 61: 'Secret Laboratory',
    62: 'Distorted Forest', 63: 'Swamp', 64: 'Old Ruinen 2', 65: 'Death Island', 66: 'Royal Desert',
    67: 'Forest Dungeon', 68: 'Dragons Dungeon', 69: 'Cursed Desert', 70: 'Iron Core', 71: 'Oasis Royale',
  };
  const cases = Object.entries(map).map(([k, v]) => `WHEN ${k} THEN '${v.replace(/'/g, "''")}'`).join('\n        ');
  return `CASE t.[MapID]\n        ${cases}\n        ELSE 'Map ' + CONVERT(varchar(10), t.[MapID]) END AS [Map]`;
}

function buildCheatLogTypeCase(): string {
  const map: Record<number, string> = {
    52: 'Delay Skill Hack', 81: 'Validate Character Error', 99: 'Copied Item Error',
    100: 'Hack Warning', 1000: 'Copied Item', 1010: 'Copied Item Warehouse',
    1011: 'Warehouse Gold', 1012: 'Warehouse New Clone', 1013: 'Warehouse Bug',
    1100: 'Hack Detected', 1101: 'Focus Changed', 1150: 'Gold Limit',
    1200: 'Speed Hack', 1250: 'Time Error Speed Hack', 1400: 'Time Mismatch',
    1500: 'Attack Ratio Error', 1510: 'Potion Check Error', 1530: 'Potion Count Error',
    1600: 'Char Info Save Error', 1820: 'Default Attack Rating Error',
    1821: 'Default Attack Size Error', 1823: 'Continuous Attack Error',
    1830: 'Skill Attack Rating Error', 1833: 'Skill Continuous Attack Error',
    1840: 'Restricted Area Trespassed', 1900: 'Weight Potion Position Error',
    1950: 'Item Error', 1960: 'Copied Item Recall', 2000: 'Forced Penalty Boot',
    2300: 'Edit Level Error', 2400: 'Saved Item Error', 2700: 'Continuous Save Failed Error',
    2800: 'Account Character Error', 4000: 'Trade Authorization Error',
    4100: 'Money Transfer Error', 5000: 'Multiple Connections IP',
    5100: 'Too Many Packets', 5200: 'Game Server IP Error', 6000: 'Start Character Error',
    6610: 'Server Money Error 1', 6611: 'Server Money Error 2', 6612: 'Server Money Error 3',
    6620: 'EXP Hack from Character Data', 6800: 'Item Code Error',
    6810: 'Item Temp Code Error', 6900: 'Character State Error 1',
    6910: 'Character Skill Point Error', 6920: 'Character Weight Error',
    7000: 'Client Process Time Out', 7010: 'Inventory Item Error',
    7020: 'Character Model Error', 7030: 'Job Code Error',
    7100: 'Client Attack Defense Error', 7110: 'Client Energy Bar Error',
    7130: 'Copied Item From Floor', 7140: 'Tried Connect Disable IP',
    7150: 'Item Error Inventory', 7160: 'Money Error Inventory',
    8000: 'Server Item Error Inventory', 8001: 'Item Error Inventory Record',
    8010: 'Server Money Error Inventory', 8020: 'Server To Server Item Error',
    8030: 'Wrong Saving Character Name', 8040: 'Item Position Error',
    8050: 'Server Inventory Used Full', 8060: 'Used Item Code Warning',
    8070: 'Server Inventory Copied Item', 8071: 'Server Copied Item Warehouse',
    8080: 'Memory Buffer Saving Error', 8100: 'Warning Auto Mouse',
    8102: 'Warning Macro Mouse', 8103: 'Warning Auto Click',
    8110: 'Warning Avg Damage Defense', 8120: 'Warning Avg Damage Attack',
    8200: 'Aging Failed Copied Item Sheltom', 8210: 'Aging Failed Copied Item',
    8300: 'Reconnect Server', 8400: 'Checked Inventory Data',
    8401: 'Teleport Field Hack', 8500: 'Damage Packet Error',
    8510: 'Limit Damage Over', 8511: 'Limit Damage Time',
    8520: 'Client Warning Motion Speed', 8530: 'Client Warning Skill Attack',
    8540: 'Client Warning Skill Forgery', 8550: 'Client Warning Skill Forgery 2',
    8560: 'Initial Character Level Error', 8570: 'Too Many Updated Char Info',
    8580: 'Client Damage Packet Error', 8600: 'Warning Invincible Mode',
    8720: 'Find Thread Hack', 8721: 'Suspend Thread Hack',
    8730: 'Character State Error 2', 8800: 'Server Potion Error',
    8810: 'Server Potion Moving Error', 8820: 'Level Quest Code Warning',
    8830: 'Shop Buy Forgery Item', 8840: 'Server Money Overflow',
    8850: 'Skill Used Level Error', 8860: 'Check Play Field Warning',
    8870: 'Compare Clan Code Error', 8880: 'Model File Error',
    8890: 'Warning Character Reloading', 8900: 'Field NPC Warning',
    8901: 'Level Hack', 8910: 'Item Mesh Error', 8920: 'Illegally Server Connect',
    8950: 'Mature Hack', 8951: 'Aging Hack', 8952: 'Fake GM',
    8953: 'Run Speed Hack', 8954: 'Check Sum Function Error',
    8955: 'Window Hack', 8956: 'State Character Hack', 8957: 'Debugger Hack',
    8958: 'GM Reason', 8959: 'Bellatra Gold Hack Leader',
    8960: 'Defense Mult Hack', 8961: 'Regen Formula Hack',
    8962: 'Easter Egg Fake Item', 8963: 'Respec Fake Item',
    8964: 'NPC Item Shop Fake Item', 8965: 'Item Timer Fake Inventory',
    8966: 'Manufacture Item Fake', 8967: 'Skill Cooldown',
    8968: 'Xmas Rudolph Fake Box', 8969: 'Action Field Fake Item',
    8970: 'Level Error Sync Ex', 8971: 'Perfectize Item Dupe',
    8972: 'Swapper Item Dupe', 8973: 'Item Box Item Dupe',
    8974: 'Module Sync Error', 8975: 'Item Fake Bought Shop ID',
    8976: 'Item Fake Bought Shop Item', 8977: 'Process Hook',
    8978: 'Get Tick Count Hack', 8979: 'Query Performance Hack',
    8980: 'Multiple Window Hack Process', 8981: 'EXE Module Sync Error',
    8982: 'CRC32 Checksum Error', 8983: 'Caravan Item Add Error',
    8984: 'Caravan Item Del Error', 8988: 'Bellatra Request Gold Error',
    8989: 'Weapon Costume Error', 8990: 'Shield Costume Error',
    8991: 'Personal Shop Gold Receive Error', 8992: 'Character Quest Invalid',
    8993: 'Glamorous Item Error', 8994: 'Carnival Fake Puzzle Item',
    8995: 'Earring Item Error', 8996: 'Anti Cheat Offline',
    8997: 'Character Save Checksum Error', 8998: 'Saving Unknown Return',
    8999: 'Model File Not Found', 10000: 'Memory Save Name Error 1',
    10001: 'Memory Save Name Error 2', 10002: 'Memory Save Name Error 3',
    10003: 'Memory Save Name Error 4', 10005: 'Memory Save Name Error 5',
    10006: 'Initial Save Memory Error', 10007: 'Save Buffer Point Error',
    10010: 'Character Account Mismatch', 10020: 'Authentication Error',
    11000: 'Shutdown Service', 21000: 'Event High Score',
    11037: 'Gold Hack NPC', 11034: 'Gold Hack WH', 99000: 'Mixing Item Hack',
  };
  const cases = Object.entries(map).map(([k, v]) => `WHEN ${k} THEN '${v.replace(/'/g, "''")}'`).join('\n        ');
  return `CASE t.[LogID]\n        ${cases}\n        ELSE 'Unknown' END AS [Type]`;
}

function getCheatLogTypeIdByName(name: string): number | undefined {
  const map: Record<number, string> = {
    52: 'Delay Skill Hack', 81: 'Validate Character Error', 99: 'Copied Item Error',
    100: 'Hack Warning', 1000: 'Copied Item', 1010: 'Copied Item Warehouse',
    1011: 'Warehouse Gold', 1012: 'Warehouse New Clone', 1013: 'Warehouse Bug',
    1100: 'Hack Detected', 1101: 'Focus Changed', 1150: 'Gold Limit',
    1200: 'Speed Hack', 1250: 'Time Error Speed Hack', 1400: 'Time Mismatch',
    1500: 'Attack Ratio Error', 1510: 'Potion Check Error', 1530: 'Potion Count Error',
    1600: 'Char Info Save Error', 1820: 'Default Attack Rating Error',
    1821: 'Default Attack Size Error', 1823: 'Continuous Attack Error',
    1830: 'Skill Attack Rating Error', 1833: 'Skill Continuous Attack Error',
    1840: 'Restricted Area Trespassed', 1900: 'Weight Potion Position Error',
    1950: 'Item Error', 1960: 'Copied Item Recall', 2000: 'Forced Penalty Boot',
    2300: 'Edit Level Error', 2400: 'Saved Item Error', 2700: 'Continuous Save Failed Error',
    2800: 'Account Character Error', 4000: 'Trade Authorization Error',
    4100: 'Money Transfer Error', 5000: 'Multiple Connections IP',
    5100: 'Too Many Packets', 5200: 'Game Server IP Error', 6000: 'Start Character Error',
    6610: 'Server Money Error 1', 6611: 'Server Money Error 2', 6612: 'Server Money Error 3',
    6620: 'EXP Hack from Character Data', 6800: 'Item Code Error',
    6810: 'Item Temp Code Error', 6900: 'Character State Error 1',
    6910: 'Character Skill Point Error', 6920: 'Character Weight Error',
    7000: 'Client Process Time Out', 7010: 'Inventory Item Error',
    7020: 'Character Model Error', 7030: 'Job Code Error',
    7100: 'Client Attack Defense Error', 7110: 'Client Energy Bar Error',
    7130: 'Copied Item From Floor', 7140: 'Tried Connect Disable IP',
    7150: 'Item Error Inventory', 7160: 'Money Error Inventory',
    8000: 'Server Item Error Inventory', 8001: 'Item Error Inventory Record',
    8010: 'Server Money Error Inventory', 8020: 'Server To Server Item Error',
    8030: 'Wrong Saving Character Name', 8040: 'Item Position Error',
    8050: 'Server Inventory Used Full', 8060: 'Used Item Code Warning',
    8070: 'Server Inventory Copied Item', 8071: 'Server Copied Item Warehouse',
    8080: 'Memory Buffer Saving Error', 8100: 'Warning Auto Mouse',
    8102: 'Warning Macro Mouse', 8103: 'Warning Auto Click',
    8110: 'Warning Avg Damage Defense', 8120: 'Warning Avg Damage Attack',
    8200: 'Aging Failed Copied Item Sheltom', 8210: 'Aging Failed Copied Item',
    8300: 'Reconnect Server', 8400: 'Checked Inventory Data',
    8401: 'Teleport Field Hack', 8500: 'Damage Packet Error',
    8510: 'Limit Damage Over', 8511: 'Limit Damage Time',
    8520: 'Client Warning Motion Speed', 8530: 'Client Warning Skill Attack',
    8540: 'Client Warning Skill Forgery', 8550: 'Client Warning Skill Forgery 2',
    8560: 'Initial Character Level Error', 8570: 'Too Many Updated Char Info',
    8580: 'Client Damage Packet Error', 8600: 'Warning Invincible Mode',
    8720: 'Find Thread Hack', 8721: 'Suspend Thread Hack',
    8730: 'Character State Error 2', 8800: 'Server Potion Error',
    8810: 'Server Potion Moving Error', 8820: 'Level Quest Code Warning',
    8830: 'Shop Buy Forgery Item', 8840: 'Server Money Overflow',
    8850: 'Skill Used Level Error', 8860: 'Check Play Field Warning',
    8870: 'Compare Clan Code Error', 8880: 'Model File Error',
    8890: 'Warning Character Reloading', 8900: 'Field NPC Warning',
    8901: 'Level Hack', 8910: 'Item Mesh Error', 8920: 'Illegally Server Connect',
    8950: 'Mature Hack', 8951: 'Aging Hack', 8952: 'Fake GM',
    8953: 'Run Speed Hack', 8954: 'Check Sum Function Error',
    8955: 'Window Hack', 8956: 'State Character Hack', 8957: 'Debugger Hack',
    8958: 'GM Reason', 8959: 'Bellatra Gold Hack Leader',
    8960: 'Defense Mult Hack', 8961: 'Regen Formula Hack',
    8962: 'Easter Egg Fake Item', 8963: 'Respec Fake Item',
    8964: 'NPC Item Shop Fake Item', 8965: 'Item Timer Fake Inventory',
    8966: 'Manufacture Item Fake', 8967: 'Skill Cooldown',
    8968: 'Xmas Rudolph Fake Box', 8969: 'Action Field Fake Item',
    8970: 'Level Error Sync Ex', 8971: 'Perfectize Item Dupe',
    8972: 'Swapper Item Dupe', 8973: 'Item Box Item Dupe',
    8974: 'Module Sync Error', 8975: 'Item Fake Bought Shop ID',
    8976: 'Item Fake Bought Shop Item', 8977: 'Process Hook',
    8978: 'Get Tick Count Hack', 8979: 'Query Performance Hack',
    8980: 'Multiple Window Hack Process', 8981: 'EXE Module Sync Error',
    8982: 'CRC32 Checksum Error', 8983: 'Caravan Item Add Error',
    8984: 'Caravan Item Del Error', 8988: 'Bellatra Request Gold Error',
    8989: 'Weapon Costume Error', 8990: 'Shield Costume Error',
    8991: 'Personal Shop Gold Receive Error', 8992: 'Character Quest Invalid',
    8993: 'Glamorous Item Error', 8994: 'Carnival Fake Puzzle Item',
    8995: 'Earring Item Error', 8996: 'Anti Cheat Offline',
    8997: 'Character Save Checksum Error', 8998: 'Saving Unknown Return',
    8999: 'Model File Not Found', 10000: 'Memory Save Name Error 1',
    10001: 'Memory Save Name Error 2', 10002: 'Memory Save Name Error 3',
    10003: 'Memory Save Name Error 4', 10005: 'Memory Save Name Error 5',
    10006: 'Initial Save Memory Error', 10007: 'Save Buffer Point Error',
    10010: 'Character Account Mismatch', 10020: 'Authentication Error',
    11000: 'Shutdown Service', 21000: 'Event High Score',
    11037: 'Gold Hack NPC', 11034: 'Gold Hack WH', 99000: 'Mixing Item Hack',
  };
  const lower = name.toLowerCase();
  for (const [id, friendly] of Object.entries(map)) {
    if (friendly.toLowerCase() === lower) return Number(id);
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = session.user.id;
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const table = String(body.table || '').trim();
    const dateFromVal: Date | null = isIsoDate(body.dateFrom) ? new Date(body.dateFrom) : null;
    const dateToVal: Date | null = isIsoDate(body.dateTo) ? new Date(body.dateTo) : null;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const textColumn = typeof body.textColumn === 'string' ? body.textColumn.trim() : '';
    const textColumns = Array.isArray(body.textColumns) ? body.textColumns : [];
    const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
    const page = Math.max(1, Number(body.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(body.pageSize || 100)));
    const sortBy = typeof body.sortBy === 'string' ? body.sortBy.trim() : '';
    const sortDir = (String(body.sortDir || 'desc').toLowerCase() === 'asc') ? 'ASC' : 'DESC';

    if (!table) return NextResponse.json({ error: 'Missing table' }, { status: 400 });

    // Strict allowlist: only known game-log tables may be queried
    const ALLOWED_TABLES = new Set([
      'AccountLog', 'ActionFieldLog', 'ActionFieldRewardLog', 'AgingRecovery',
      'BellatraHonorLog', 'BellatraRewardLog', 'PvPHonorLog', 'FuryArenaLog',
      'ItemBox', 'CoinLog', 'CharacterLog', 'CheatLog', 'RareItemsLog',
      'UserTimeCoinLog',
    ]);
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'Table not allowed' }, { status: 400 });
    }

    const tCheck = await logDB.query(`SELECT name FROM sys.tables WHERE name = @table`, { table });
    if (!tCheck.recordset?.length) return NextResponse.json({ error: 'Table not found' }, { status: 400 });

    const colsRes = await logDB.query<{ name: string; udt_name: string }>(
      `SELECT c.name, TYPE_NAME(c.user_type_id) AS udt_name FROM sys.columns c WHERE c.object_id = OBJECT_ID(@tbl)`,
      { tbl: table }
    );
    const cols = (colsRes.recordset || []).map(r => ({ name: r.name, type: r.udt_name || '' }));
    const colSet = new Set(cols.map(c => c.name));

    // Determine a date column for sorting/windowing (pin known columns)
    const lowerTable = table.toLowerCase();
    let pinnedDateCol = '';
    if (lowerTable === 'accountlog') pinnedDateCol = 'Date';
    else if (lowerTable === 'actionfieldlog') pinnedDateCol = 'Date';
    else if (lowerTable === 'characterlog') pinnedDateCol = 'Date';
    else if (lowerTable === 'cheatlog') pinnedDateCol = 'Date';
    else if (lowerTable === 'itembox') pinnedDateCol = 'Date';
    else if (lowerTable === 'furyarenalog') pinnedDateCol = 'Date';
    const dateCols = cols.filter(c => /date|time|created|timestamp/i.test(c.name) || /date|time/i.test(c.type)).map(c => c.name);
    const dateCol = (sortBy && colSet.has(sortBy)) ? sortBy : (pinnedDateCol || dateCols[0] || cols[0]?.name || '');

    const whereParts: string[] = [];
    const params: Record<string, any> = {};
    let joinSql = '';
    let selectCols = 't.*';

    // Table-specific constraints
    if (lowerTable === 'accountlog') {
      // Allowed search: AccountName, IP, Description; Sort by date
      const accNameCol = colSet.has('AccountName') ? 'AccountName' : (Array.from(colSet).find(n => /account.?name/i.test(n)) as string) || '';
      const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : (Array.from(colSet).find(n => /ip(address)?/i.test(n)) as string) || '');
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      const logNameExpr = `CASE t.[LogID]
        WHEN 501 THEN 'Device Info'
        WHEN 506 THEN 'Login Server Logon'
        WHEN 507 THEN 'Character Creation'
        ELSE 'Code ' + CONVERT(varchar(10), t.[LogID]) END AS [Type]`;
      const serverNameExpr = `CASE t.[ServerID]
        WHEN 0 THEN 'Login Server'
        WHEN 1 THEN 'Mehmed'
        WHEN 2 THEN 'Vlad'
        ELSE 'Server ' + CONVERT(varchar(10), t.[ServerID]) END AS [Server]`;
      selectCols = `t.*, ${logNameExpr}, ${serverNameExpr}`;
      const t = (s: string) => s ? `[${s}]` : 'NULL';
      if (text) {
        const likeParts: string[] = [];
        if (accNameCol) { likeParts.push(`${t(accNameCol)} LIKE @txt`); }
        if (ipCol) { likeParts.push(`CONVERT(varchar(20), ${t(ipCol)}) LIKE @txt`); }
        if (descCol) { likeParts.push(`${t(descCol)} LIKE @txt`); }
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      // ignore generic filters except AccountName/IP/Description exact
      if (filters && typeof filters === 'object') {
        // Type filter maps to LogID
        const typeVal = (filters as any).Type;
        if (typeof typeVal === 'string' && typeVal.trim()) {
          const key = typeVal.trim().toLowerCase();
          const map: Record<string, number> = {
            'device info': 501,
            'login server logon': 506,
            'character creation': 507,
          };
          const lid = map[key];
          if (typeof lid === 'number') { whereParts.push(`t.[LogID] = @logtype`); (params as any).logtype = lid; }
        }
        Object.entries(filters).forEach(([k, v], i) => {
          if (![accNameCol, ipCol, descCol].includes(k)) return;
          if (!colSet.has(k)) return;
          const p = `f${i}`;
          if (v === null) whereParts.push(`[${k}] IS NULL`); else { whereParts.push(`[${k}] = @${p}`); params[p] = v; }
        });
      }
    } else if (lowerTable === 'actionfieldlog') {
      // Allowed search: AccountName (via AccountID), CharacterName (via CharacterID), IP, Description
      const accIdCol = colSet.has('AccountID') ? 'AccountID' : (Array.from(colSet).find(n => /account.*id/i.test(n)) as string) || '';
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : (Array.from(colSet).find(n => /ip(address)?/i.test(n)) as string) || '');
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      // Resolve names from UserDB
      if (accIdCol) joinSql += ` LEFT JOIN UserDB.dbo.UserInfo ui ON ui.ID = t.[${accIdCol}]`;
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      // Build a safe select list without duplicate names
      const parts: string[] = ['t.*'];
      const modeNameExpr = `CASE t.[ModeID] WHEN 200 THEN 'Ghost Castle (Solo)' WHEN 201 THEN 'Ghost Castle (Party)' ELSE 'Mode ' + CONVERT(varchar(10), t.[ModeID]) END AS [Mode]`;
      if (accIdCol) parts.push('ui.AccountName AS AccountName');
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      parts.push(modeNameExpr);
      selectCols = parts.join(', ');
      if (text) {
        const likeParts: string[] = [];
        if (accIdCol) likeParts.push(`ui.AccountName LIKE @txt`);
        if (charIdCol) likeParts.push(`ci.Name LIKE @txt`);
        if (ipCol) likeParts.push(`CONVERT(varchar(20), t.[${ipCol}]) LIKE @txt`);
        if (descCol) likeParts.push(`t.[${descCol}] LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      if (filters && typeof filters === 'object') {
        // Mode filter maps to ModeID
        const modeVal = (filters as any).Mode;
        if (typeof modeVal === 'string' && modeVal.trim()) {
          const key = modeVal.trim().toLowerCase();
          const mmap: Record<string, number> = {
            'ghost castle (solo)': 200,
            'ghost castle (party)': 201,
          };
          const mid = mmap[key];
          if (typeof mid === 'number') { whereParts.push(`t.[ModeID] = @modeid`); (params as any).modeid = mid; }
        }
        Object.entries(filters).forEach(([k, v], i) => {
          // Only allow AccountName, CharacterName, IP, Description semantics
          const allow = (k === 'AccountName' && accIdCol) || (k === 'CharacterName' && charIdCol) || (k === (ipCol || '')) || (k === (descCol || ''));
          if (!allow) return;
          const p = `f${i}`;
          if (k === 'AccountName' && accIdCol) {
            whereParts.push(`ui.AccountName = @${p}`); params[p] = v;
          } else if (k === 'CharacterName' && charIdCol) {
            whereParts.push(`ci.Name = @${p}`); params[p] = v;
          } else if (k === ipCol || k === descCol) {
            whereParts.push(`t.[${k}] = @${p}`); params[p] = v;
          }
        });
      }
    } else if (lowerTable === 'actionfieldrewardlog') {
      // Special handling: map Mode, resolve Item from GameDB.ItemList (szItemName by szLastCategory = ItemCode), and resolve names from UserDB
      const modeNameExpr = `CASE t.[ModeID] WHEN 200 THEN 'Ghost Castle (Solo)' WHEN 201 THEN 'Ghost Castle (Party)' ELSE 'Mode ' + CONVERT(varchar(10), t.[ModeID]) END AS [Mode]`;
      const accIdCol = colSet.has('AccountID') ? 'AccountID' : (Array.from(colSet).find(n => /account.*id/i.test(n)) as string) || '';
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      joinSql += ` LEFT JOIN GameDB.dbo.ItemList il ON il.szLastCategory = t.[ItemCode]`;
      if (accIdCol) joinSql += ` LEFT JOIN UserDB.dbo.UserInfo ui ON ui.ID = t.[${accIdCol}]`;
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      const parts: string[] = ['t.*'];
      if (accIdCol) parts.push('ui.AccountName AS AccountName');
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      parts.push('il.szItemName AS Item');
      parts.push(modeNameExpr);
      selectCols = parts.join(', ');
      // Text filter on names/IP/Description/Item
      const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : '');
      const descCol = colSet.has('Description') ? 'Description' : '';
      if (text) {
        const likeParts: string[] = [];
        if (accIdCol) likeParts.push(`ui.AccountName LIKE @txt`);
        if (charIdCol) likeParts.push(`ci.Name LIKE @txt`);
        if (ipCol) likeParts.push(`t.[${ipCol}] LIKE @txt`);
        if (descCol) likeParts.push(`t.[${descCol}] LIKE @txt`);
        likeParts.push(`il.szItemName LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      if (filters && typeof filters === 'object') {
        // Mode filter maps to ModeID
        const modeVal = (filters as any).Mode;
        if (typeof modeVal === 'string' && modeVal.trim()) {
          const key = modeVal.trim().toLowerCase();
          const mmap: Record<string, number> = {
            'ghost castle (solo)': 200,
            'ghost castle (party)': 201,
          };
          const mid = mmap[key];
          if (typeof mid === 'number') { whereParts.push(`t.[ModeID] = @modeid`); (params as any).modeid = mid; }
        }
        // Optional equality filters for resolved names/IP/Description/Item
        Object.entries(filters).forEach(([k, v], i) => {
          const allow = (k === 'AccountName' && accIdCol) || (k === 'CharacterName' && charIdCol) || (k === (ipCol || '')) || (k === (descCol || '')) || k === 'Item';
          if (!allow) return; const p = `f${i}`;
          if (k === 'AccountName' && accIdCol) { whereParts.push(`ui.AccountName = @${p}`); params[p] = v; }
          else if (k === 'CharacterName' && charIdCol) { whereParts.push(`ci.Name = @${p}`); params[p] = v; }
          else if (k === ipCol || k === descCol) { whereParts.push(`t.[${k}] = @${p}`); params[p] = v; }
          else if (k === 'Item') { whereParts.push(`il.szItemName = @${p}`); params[p] = v; }
        });
      }
    } else if (lowerTable === 'agingrecovery') {
      // Resolve CharacterName from CharacterID
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      const parts: string[] = ['t.*'];
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      selectCols = parts.join(', ');
      // Text search across likely text fields
      const accCol = colSet.has('AccountName') ? 'AccountName' : '';
      const itemCol = colSet.has('ItemName') ? 'ItemName' : '';
      if (text) {
        const likeParts: string[] = [];
        if (accCol) likeParts.push(`t.[${accCol}] LIKE @txt`);
        if (charIdCol) likeParts.push(`ci.Name LIKE @txt`);
        if (itemCol) likeParts.push(`t.[${itemCol}] LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      // Age filter
      const ageVal = (filters as any)?.Age;
      if (ageVal) {
        whereParts.push(`t.[AgeNumber] = @ageNum`);
        (params as any).ageNum = Number(ageVal);
      }
    } else if (lowerTable === 'bellatrahonorlog') {
      // Resolve CharacterName from CharacterID
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      const parts: string[] = ['t.*'];
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      selectCols = parts.join(', ');
      // Text search: Account Name only
      const accCol = colSet.has('AccountName') ? 'AccountName' : '';
      if (text && accCol) {
        whereParts.push(`t.[${accCol}] LIKE @txt`); params.txt = `%${text}%`;
      }
      // Honor Type filter (51=Gold, 52=Silver, 53=Bronze)
      const honorVal = (filters as any)?.HonorType;
      if (honorVal === '51' || honorVal === '52' || honorVal === '53') {
        whereParts.push(`t.[HonorType] = @honortype`);
        (params as any).honortype = Number(honorVal);
      }
    } else if (lowerTable === 'bellatrarewardlog') {
      // Alias Name as CharacterName to standardize and resolve Item via GameDB.ItemList
      const parts: string[] = ['t.*'];
      if (colSet.has('Name')) parts.push('t.[Name] AS CharacterName');
      // Resolve item name: prefer ItemCode -> ItemList.szLastCategory, otherwise try ItemName match (code or name)
      const hasItemCode = colSet.has('ItemCode');
      if (hasItemCode) {
        joinSql += ` LEFT JOIN GameDB.dbo.ItemList il ON il.szLastCategory = t.[ItemCode]`;
      } else if (colSet.has('ItemName')) {
        joinSql += ` LEFT JOIN GameDB.dbo.ItemList il ON il.szLastCategory = t.[ItemName] OR il.szItemName = t.[ItemName]`;
      }
      if (hasItemCode || colSet.has('ItemName')) {
        parts.push('il.szItemName AS Item');
      }
      selectCols = parts.join(', ');
      // Text search across AccountName, CharacterName (Name), and resolved Item
      const accCol = colSet.has('AccountName') ? 'AccountName' : '';
      const hasName = colSet.has('Name');
      if (text) {
        const likeParts: string[] = [];
        if (accCol) likeParts.push(`t.[${accCol}] LIKE @txt`);
        if (hasName) likeParts.push(`t.[Name] LIKE @txt`);
        likeParts.push(`il.szItemName LIKE @txt`);
        if (colSet.has('ItemName')) likeParts.push(`t.[ItemName] LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
    } else if (lowerTable === 'pvphonorlog') {
      // PvPHonorLog: resolve CharacterName from CharacterID; include CharacterID in results
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      const parts: string[] = ['t.*'];
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      selectCols = parts.join(', ');
      // Text search: Account Name only if present
      const accCol = colSet.has('AccountName') ? 'AccountName' : '';
      if (text && accCol) {
        whereParts.push(`t.[${accCol}] LIKE @txt`); params.txt = `%${text}%`;
      }
      // Honor Type filter (51=Gold, 52=Silver, 53=Bronze), when column exists
      const hasHonorType = colSet.has('HonorType');
      const honorVal = (filters as any)?.HonorType;
      if (hasHonorType && (honorVal === '1' || honorVal === '2' || honorVal === '3')) {
        whereParts.push(`t.[HonorType] = @honortype`);
        (params as any).honortype = Number(honorVal);
      }
    } else if (lowerTable === 'furyarenalog') {
      // FuryArenaLog: keyword only searches Description
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      if (text && descCol) {
        whereParts.push(`t.[${descCol}] LIKE @txt`); params.txt = `%${text}%`;
      }
    } else if (lowerTable === 'itembox') {
      // ItemBox: expose ItemName via GameDB.ItemList join using ItemCode; enable text search and P2P filter
      const hasItemCode = colSet.has('ItemCode');
      if (hasItemCode) {
        joinSql += ` LEFT JOIN GameDB.dbo.ItemList il ON il.szLastCategory = t.[ItemCode] OR il.szItemName = t.[ItemCode]`;
        selectCols = `t.*, il.szItemName AS ItemName`;
      }
      if (text) {
        const likeParts: string[] = [];
        if (colSet.has('AccountName')) likeParts.push(`t.[AccountName] LIKE @txt`);
        if (colSet.has('SenderName')) likeParts.push(`t.[SenderName] LIKE @txt`);
        if (hasItemCode) likeParts.push(`il.szItemName LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      if (filters && typeof filters === 'object') {
        const v = (filters as any).IsItem;
        if (v === 'True') { whereParts.push(`t.[IsItem] = @p2p`); (params as any).p2p = 1; }
        else if (v === 'False') { whereParts.push(`t.[IsItem] = @p2p`); (params as any).p2p = 0; }
      }
    } else if (lowerTable === 'coinlog') {
      // CoinLog: text search on AccountName and Description only
      const accCol = colSet.has('AccountName') ? 'AccountName' : (Array.from(colSet).find(n => /account.?name/i.test(n)) as string) || '';
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      if (text && (accCol || descCol)) {
        const likeParts: string[] = [];
        if (accCol) likeParts.push(`t.[${accCol}] LIKE @txt`);
        if (descCol) likeParts.push(`t.[${descCol}] LIKE @txt`);
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      // After fetching, we will resolve Bought[CODE] -> Bought[ItemName]
    } else if (lowerTable === 'characterlog') {
      const accNameCol = colSet.has('AccountName') ? 'AccountName' : (Array.from(colSet).find(n => /account.?name/i.test(n)) as string) || '';
      const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : (Array.from(colSet).find(n => /ip(address)?/i.test(n)) as string) || '');
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      const logNameExpr = `CASE t.[LogID]
        WHEN 511 THEN 'Save'
        WHEN 512 THEN 'Lose EXP'
        WHEN 513 THEN 'Temporary Ban'
        ELSE 'Unknown' END AS [Type]`;
      const serverNameExpr = `CASE t.[ServerID]
        WHEN 0 THEN 'Login Server'
        WHEN 1 THEN 'Mehmed'
        WHEN 2 THEN 'Vlad'
        ELSE 'Server ' + CONVERT(varchar(10), t.[ServerID]) END AS [Server]`;
      selectCols = `t.*, ${logNameExpr}, ${serverNameExpr}`;
      if (text) {
        const likeParts: string[] = [];
        if (textColumn && (textColumn === accNameCol || textColumn === ipCol || textColumn === descCol)) {
          likeParts.push(`t.[${textColumn}] LIKE @txt`);
        } else {
          const used = new Set<string>();
          const pushLike = (col?: string) => {
            if (col && !used.has(col)) {
              likeParts.push(`CONVERT(varchar(max), t.[${col}]) LIKE @txt`);
              used.add(col);
            }
          };
          pushLike(accNameCol); pushLike(ipCol); pushLike(descCol);
          // Add other common text-like columns if present
          for (const c of cols) {
            const n = c.name;
            if (/name|desc|message|detail|ip/i.test(n)) pushLike(n);
          }
        }
        // Also support searching by friendly Type names (Save, Lose EXP, Temporary Ban)
        const tl = String(text).toLowerCase();
        const wantedIds: number[] = [];
        if (/\bsave\b/.test(tl)) wantedIds.push(511);
        if (/(lose\s*exp|\blosexp\b)/.test(tl)) wantedIds.push(512);
        if (/(temporary\s*ban|\btemp\s*ban\b|\btempban\b)/.test(tl)) wantedIds.push(513);
        let typeExpr = '';
        if (wantedIds.length) {
          const phs: string[] = [];
          wantedIds.forEach((id, i) => { const k = `clid${i}`; (params as any)[k] = String(id); phs.push(`@${k}`); });
          typeExpr = `t.[LogID] IN (${phs.join(', ')})`;
        }
        const parts = [...likeParts];
        if (typeExpr) parts.push(typeExpr);
        if (parts.length) { whereParts.push(`(${parts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      if (filters && typeof filters === 'object') {
        const typeVal = (filters as any).Type;
        if (typeof typeVal === 'string' && typeVal.trim()) {
          const key = typeVal.trim().toLowerCase();
          const map: Record<string, number> = { 'save': 511, 'lose exp': 512, 'temporary ban': 513 };
          const lid = map[key];
          if (typeof lid === 'number') { whereParts.push(`t.[LogID] = @logtype`); (params as any).logtype = String(lid); }
        }
      }
    } else if (lowerTable === 'cheatlog') {
      const accNameCol = colSet.has('AccountName') ? 'AccountName' : (Array.from(colSet).find(n => /account.?name/i.test(n)) as string) || '';
      const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : (Array.from(colSet).find(n => /ip(address)?/i.test(n)) as string) || '');
      const descCol = colSet.has('Description') ? 'Description' : (Array.from(colSet).find(n => /desc(ription)?|message|detail/i.test(n)) as string) || '';
      const logNameExpr = buildCheatLogTypeCase();
      const serverNameExpr = `CASE t.[ServerID]
        WHEN 0 THEN 'Login Server'
        WHEN 1 THEN 'Mehmed'
        WHEN 2 THEN 'Vlad'
        ELSE 'Server ' + CONVERT(varchar(10), t.[ServerID]) END AS [Server]`;
      selectCols = `t.*, ${logNameExpr}, ${serverNameExpr}`;
      const tbr = (s: string) => s ? `[${s}]` : 'NULL';
      if (text) {
        const likeParts: string[] = [];
        if (textColumn && (textColumn === accNameCol || textColumn === ipCol || textColumn === descCol)) {
          likeParts.push(`${tbr(textColumn)} LIKE @txt`);
        } else {
          if (accNameCol) likeParts.push(`${tbr(accNameCol)} LIKE @txt`);
          if (ipCol) likeParts.push(`CONVERT(varchar(20), ${tbr(ipCol)}) LIKE @txt`);
          if (descCol) likeParts.push(`${tbr(descCol)} LIKE @txt`);
        }
        if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
      }
      if (filters && typeof filters === 'object') {
        const typeVal = (filters as any).Type;
        if (typeof typeVal === 'string' && typeVal.trim()) {
          const lid = getCheatLogTypeIdByName(typeVal.trim());
          if (typeof lid === 'number') { whereParts.push(`t.[LogID] = @logtype`); (params as any).logtype = String(lid); }
        }
        const actionVal = (filters as any).Action;
        if (typeof actionVal === 'string' && actionVal.trim()) {
          const key = actionVal.trim().toLowerCase();
          const map: Record<string, number> = { 'nothing': 0, 'kicked': 1, 'banned': 2 };
          const aid = map[key];
          if (typeof aid === 'number') { whereParts.push(`t.[Action] = @actionid`); (params as any).actionid = String(aid); }
        }
      }
    } else if (lowerTable === 'rareitemslog') {
      const charIdCol = colSet.has('CharacterID') ? 'CharacterID' : (Array.from(colSet).find(n => /char.*id/i.test(n)) as string) || '';
      if (charIdCol) joinSql += ` LEFT JOIN UserDB.dbo.CharacterInfo ci ON ci.ID = t.[${charIdCol}]`;
      const mapExpr = buildMapIdCase();
      const bossExpr = `CASE t.[IsBossMonster] WHEN 0 THEN 'false' WHEN 1 THEN 'true' ELSE CONVERT(varchar(10), t.[IsBossMonster]) END AS [Boss]`;
      const parts: string[] = ['t.*'];
      if (charIdCol) parts.push('ci.Name AS CharacterName');
      parts.push(mapExpr);
      parts.push(bossExpr);
      selectCols = parts.join(', ');
      if (text) {
        if (textColumn) {
          if (textColumn === 'CharacterName' && charIdCol) {
            whereParts.push(`ci.Name LIKE @txt`); params.txt = `%${text}%`;
          } else if (colSet.has(textColumn)) {
            whereParts.push(`t.[${textColumn}] LIKE @txt`); params.txt = `%${text}%`;
          }
        } else {
          const likeParts: string[] = [];
          if (colSet.has('MonsterName')) likeParts.push(`t.[MonsterName] LIKE @txt`);
          if (colSet.has('ItemCode1')) likeParts.push(`CONVERT(varchar(20), t.[ItemCode1]) LIKE @txt`);
          if (colSet.has('ItemCode2')) likeParts.push(`CONVERT(varchar(20), t.[ItemCode2]) LIKE @txt`);
          if (likeParts.length) { whereParts.push(`(${likeParts.join(' OR ')})`); params.txt = `%${text}%`; }
        }
      }
      if (filters && typeof filters === 'object') {
        const bossVal = (filters as any).Boss;
        if (bossVal === 'false') { whereParts.push(`t.[IsBossMonster] = @boss`); (params as any).boss = 0; }
        else if (bossVal === 'true') { whereParts.push(`t.[IsBossMonster] = @boss`); (params as any).boss = 1; }
        Object.entries(filters).forEach(([k, v], i) => {
          if (k === 'Boss') return;
          if (k === 'CharacterName' && charIdCol) {
            whereParts.push(`ci.Name = @f${i}`); (params as any)[`f${i}`] = v; return;
          }
          if (!colSet.has(k)) return;
          const p = `f${i}`;
          if (v === null) whereParts.push(`[${k}] IS NULL`); else { whereParts.push(`[${k}] = @${p}`); params[p] = v; }
        });
      }
    } else {
      // Default behavior (generic): like-search over provided textColumns
      const textCols = textColumns.filter((c: any) => typeof c === 'string' && colSet.has(c));
      if (text && textColumn && colSet.has(textColumn)) {
        whereParts.push(`[${textColumn}] LIKE @txt`);
        params.txt = `%${text}%`;
      } else if (text && textCols.length) {
        const orParts: string[] = [];
        textCols.forEach((c: string, i: number) => { const key = `txt${i}`; orParts.push(`[${c}] LIKE @${key}`); params[key] = `%${text}%`; });
        whereParts.push(`(${orParts.join(' OR ')})`);
      } else if (text && !textCols.length) {
        // If no text columns specified, try common text-like columns
        const guesses = cols.filter(c => /name|desc|message|detail|ip|item/i.test(c.name)).map(c => c.name);
        if (guesses.length) {
          const orParts: string[] = [];
          guesses.forEach((c: string, i: number) => { const key = `gt${i}`; orParts.push(`CONVERT(varchar(max), [${c}]) LIKE @${key}`); params[key] = `%${text}%`; });
          whereParts.push(`(${orParts.join(' OR ')})`);
        }
      }
      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([k, v], i) => {
          if (!colSet.has(k)) return; const p = `f${i}`;
          if (v === null) whereParts.push(`[${k}] IS NULL`); else { whereParts.push(`[${k}] = @${p}`); params[p] = v; }
        });
      }
    }

    // Build date expression (handles AccountLog.Date as varchar). Only apply for true date/time types otherwise.
    let dateExpr = '';
    const varcharDateTables = new Set(['accountlog', 'characterlog', 'cheatlog']);
    if (dateCol) {
      if (varcharDateTables.has(lowerTable) && dateCol.toLowerCase() === 'date') {
        // Try common formats; then reconstruct ISO from mm/dd/yy HH:MM:SS
        const rebuiltIso = `('20' + SUBSTRING(t.[Date],7,2) + '-' + SUBSTRING(t.[Date],1,2) + '-' + SUBSTRING(t.[Date],4,2) + ' ' + SUBSTRING(t.[Date],10,8))`;
        dateExpr = `COALESCE(
          TRY_CONVERT(datetime, t.[Date], 121),
          TRY_CONVERT(datetime, t.[Date], 120),
          TRY_CONVERT(datetime, t.[Date], 126),
          TRY_CONVERT(datetime, t.[Date], 20),
          TRY_CONVERT(datetime, t.[Date], 23),
          TRY_CONVERT(datetime, t.[Date], 101),
          TRY_CONVERT(datetime, t.[Date], 103),
          TRY_CONVERT(datetime, ${rebuiltIso}, 120),
          TRY_CONVERT(datetime, t.[Date])
        )`;
      } else {
        const colInfo = cols.find(c => c.name === dateCol);
        const dateColType = (colInfo?.type || '').toLowerCase();
        const isDateType = /date|time|smalldatetime|datetime|datetime2|datetimeoffset/.test(dateColType);
        const looksLikeDateName = /date|time|created|timestamp|log/i.test(dateCol);
        if (isDateType) {
          dateExpr = `t.[${dateCol}]`;
        } else if (looksLikeDateName) {
          // Try to parse common string datetime formats for generic tables
          const colRef = `t.[${dateCol}]`;
          const rebuiltIso = `('20' + SUBSTRING(${colRef},7,2) + '-' + SUBSTRING(${colRef},1,2) + '-' + SUBSTRING(${colRef},4,2) + ' ' + SUBSTRING(${colRef},10,8))`;
          dateExpr = `COALESCE(
            TRY_CONVERT(datetime, ${colRef}, 121),
            TRY_CONVERT(datetime, ${colRef}, 120),
            TRY_CONVERT(datetime, ${colRef}, 126),
            TRY_CONVERT(datetime, ${colRef}, 20),
            TRY_CONVERT(datetime, ${colRef}, 23),
            TRY_CONVERT(datetime, ${colRef}, 101),
            TRY_CONVERT(datetime, ${colRef}, 103),
            TRY_CONVERT(datetime, ${rebuiltIso}, 120),
            TRY_CONVERT(datetime, ${colRef})
          )`;
        }
      }
    }

    const suppressDateFilter = lowerTable === 'accountlog';
    // Apply date filter only if a bound is provided and not suppressed (AccountLog)
    if (dateExpr && !suppressDateFilter) {
      if (dateFromVal && dateToVal) {
        if (varcharDateTables.has(lowerTable) && (dateCol || '').toLowerCase() === 'date') {
          // Also compare using original varchar Date between MM/DD/YY HH:MM:SS strings
          const pad = (n: number) => String(n).padStart(2, '0');
          const fmt = (d: Date) => `${pad(d.getMonth()+1)}/${pad(d.getDate())}/${pad(d.getFullYear()%100)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          const fromStr = fmt(dateFromVal);
          const toStr = fmt(dateToVal);
          whereParts.unshift(`( ${dateExpr} BETWEEN @from AND @to OR t.[Date] BETWEEN @fromStr AND @toStr )`);
          params.from = dateFromVal; params.to = dateToVal; (params as any).fromStr = fromStr; (params as any).toStr = toStr;
        } else {
          whereParts.unshift(`${dateExpr} BETWEEN @from AND @to`);
          params.from = dateFromVal; params.to = dateToVal;
        }
      } else if (dateFromVal) {
        whereParts.unshift(`${dateExpr} >= @from`);
        params.from = dateFromVal;
      } else if (dateToVal) {
        whereParts.unshift(`${dateExpr} <= @to`);
        params.to = dateToVal;
      }
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    // For varchar-date tables, avoid expensive COALESCE sort on large datasets; use ID (clustered PK) instead
    let orderSql = '';
    if (varcharDateTables.has(lowerTable) && (dateCol || '').toLowerCase() === 'date' && colSet.has('ID')) {
      orderSql = `ORDER BY t.[ID] ${sortDir}`;
    } else if (dateExpr) {
      orderSql = `ORDER BY ${dateExpr} ${sortDir}`;
    }
    if (!orderSql && colSet.has('ID')) {
      orderSql = `ORDER BY t.[ID] ${sortDir}`;
    }
    if (!orderSql && cols[0]?.name) {
      const firstCol = cols[0].name.replace(/]/g, '');
      orderSql = `ORDER BY t.[${firstCol}] ${sortDir}`;
    }
    if (!orderSql) {
      orderSql = 'ORDER BY (SELECT 1)';
    }
    const windowOrderSql = orderSql || (colSet.has('ID') ? `ORDER BY t.[ID] ${sortDir}` : (cols[0]?.name ? `ORDER BY t.[${cols[0].name}] ${sortDir}` : 'ORDER BY (SELECT 1)'));
    const offset = (page - 1) * pageSize;

    let total = 0;
    let items: any[] = [];
    try {
      const [totalRes, rowsRes] = await Promise.all([
        logDB.query<{ Total: number }>(
          `SELECT COUNT(*) AS Total FROM [${table}] t ${joinSql} ${whereSql}`,
          params
        ),
        logDB.query(
          `SELECT ${selectCols}, ROW_NUMBER() OVER (${windowOrderSql}) AS rn 
           FROM [${table}] t
           ${joinSql}
           ${whereSql}
           ${windowOrderSql}
           OFFSET @offset ROWS
           FETCH NEXT @limit ROWS ONLY`,
          { ...params, offset, limit: pageSize }
        )
      ]);
      total = Number(totalRes.recordset?.[0]?.Total || 0);
      items = rowsRes.recordset || [];
    } catch (err) {
      // Fallback for ActionFieldLog if cross-DB joins are not permitted
      if (lowerTable === 'actionfieldlog') {
        const fbWhere: string[] = [];
        const fbParams: Record<string, any> = {};
        // Reuse date bounds
        if (dateExpr) {
          if (dateFromVal && dateToVal) { fbWhere.push(`${dateExpr} BETWEEN @from AND @to`); fbParams.from = dateFromVal; fbParams.to = dateToVal; }
          else if (dateFromVal) { fbWhere.push(`${dateExpr} >= @from`); fbParams.from = dateFromVal; }
          else if (dateToVal) { fbWhere.push(`${dateExpr} <= @to`); fbParams.to = dateToVal; }
        }
        // Only IP/Description text filter without joins
        const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : '');
        const descCol = colSet.has('Description') ? 'Description' : '';
        if (text && (ipCol || descCol)) {
          const orParts: string[] = [];
          if (ipCol) { orParts.push(`t.[${ipCol}] LIKE @txt`); }
          if (descCol) { orParts.push(`t.[${descCol}] LIKE @txt`); }
          if (orParts.length) { fbWhere.push(`(${orParts.join(' OR ')})`); fbParams.txt = `%${text}%`; }
        }
        if (filters && typeof filters === 'object') {
          Object.entries(filters).forEach(([k, v], i) => {
            if (![ipCol, descCol].includes(k)) return; const p = `f${i}`;
            if (v === null) fbWhere.push(`t.[${k}] IS NULL`); else { fbWhere.push(`t.[${k}] = @${p}`); (fbParams as any)[p] = v; }
          });
        }
        const fbWhereSql = fbWhere.length ? `WHERE ${fbWhere.join(' AND ')}` : '';
        const fbOrderSql = dateExpr ? `ORDER BY ${dateExpr} ${sortDir}` : 'ORDER BY (SELECT 1)';

        const totalRes2 = await logDB.query<{ Total: number }>(
          `SELECT COUNT(*) AS Total FROM [${table}] t ${fbWhereSql}`,
          fbParams
        );
        total = Number(totalRes2.recordset?.[0]?.Total || 0);

        const rowsRes2 = await logDB.query(
          `SELECT TOP (@limit) * FROM (
             SELECT t.* , ROW_NUMBER() OVER (${fbOrderSql}) AS rn
             FROM [${table}] t
             ${fbWhereSql}
           ) x
           WHERE x.rn > @offset
           ORDER BY x.rn`,
          { ...fbParams, offset, limit: pageSize }
        );
        items = rowsRes2.recordset || [];
      } else if (lowerTable === 'actionfieldrewardlog') {
        const fbWhere: string[] = [];
        const fbParams: Record<string, any> = {};
        if (dateExpr) {
          if (dateFromVal && dateToVal) { fbWhere.push(`${dateExpr} BETWEEN @from AND @to`); fbParams.from = dateFromVal; fbParams.to = dateToVal; }
          else if (dateFromVal) { fbWhere.push(`${dateExpr} >= @from`); fbParams.from = dateFromVal; }
          else if (dateToVal) { fbWhere.push(`${dateExpr} <= @to`); fbParams.to = dateToVal; }
        }
        const ipCol = colSet.has('IP') ? 'IP' : (colSet.has('IPAddress') ? 'IPAddress' : '');
        const descCol = colSet.has('Description') ? 'Description' : '';
        if (text && (ipCol || descCol)) {
          const orParts: string[] = [];
          if (ipCol) { orParts.push(`t.[${ipCol}] LIKE @txt`); }
          if (descCol) { orParts.push(`t.[${descCol}] LIKE @txt`); }
          if (orParts.length) { fbWhere.push(`(${orParts.join(' OR ')})`); fbParams.txt = `%${text}%`; }
        }
        const fbWhereSql = fbWhere.length ? `WHERE ${fbWhere.join(' AND ')}` : '';
        const fbOrderSql = dateExpr ? `ORDER BY ${dateExpr} ${sortDir}` : 'ORDER BY (SELECT 1)';
        const totalRes2 = await logDB.query<{ Total: number }>(
          `SELECT COUNT(*) AS Total FROM [${table}] t ${fbWhereSql}`,
          fbParams
        );
        total = Number(totalRes2.recordset?.[0]?.Total || 0);
        const rowsRes2 = await logDB.query(
          `SELECT TOP (@limit) * FROM (
             SELECT t.* , ROW_NUMBER() OVER (${fbOrderSql}) AS rn
             FROM [${table}] t
             ${fbWhereSql}
           ) x
           WHERE x.rn > @offset
           ORDER BY x.rn`,
          { ...fbParams, offset, limit: pageSize }
        );
        items = rowsRes2.recordset || [];
      } else {
        throw err;
      }
    }

    // Resolve bracketed item/chest codes in ActionFieldLog Description using GameDB.ItemList
    if (lowerTable === 'actionfieldlog' && Array.isArray(items) && items.length) {
      // If checksum/header columns exist, skip resolution
      const hasCode1 = cols.some(c => c.name.toLowerCase() === 'code1');
      const hasCode2 = cols.some(c => c.name.toLowerCase() === 'code2');
      if (!(hasCode1 && hasCode2)) {
      const codeSet = new Set<string>();
      const codeRe = /\[([A-Za-z]{1,3}\d{1,6})\]/g;
      for (const row of items) {
        const desc = row?.Description;
        if (typeof desc === 'string') {
          let m: RegExpExecArray | null;
          while ((m = codeRe.exec(desc)) !== null) {
            codeSet.add((m[1] || '').toUpperCase());
          }
        }
      }
      if (codeSet.size) {
        const codes = Array.from(codeSet);
        const params: Record<string, any> = {};
        const placeholders = codes.map((c, i) => { const k = `c${i}`; params[k] = c; return `@${k}`; });
        try {
          const mapRes = await gameDB.query<{ szLastCategory: string; szItemName: string }>(
            `SELECT szLastCategory, szItemName FROM ItemList WHERE szLastCategory IN (${placeholders.join(',')})`,
            params
          );
          const nameMap: Record<string, string> = {};
          for (const r of mapRes.recordset || []) {
            if (r && r.szLastCategory) nameMap[String(r.szLastCategory).toUpperCase()] = r.szItemName || '';
          }
          items = items.map((row: any) => {
            const desc = row?.Description;
            if (typeof desc === 'string') {
              const newDesc = desc.replace(codeRe, (full, code) => {
                const name = nameMap[(code || '').toUpperCase()];
                return name ? `[${name}]` : full;
              });
              return { ...row, Description: newDesc };
            }
            return row;
          });
        } catch {
          // If lookup fails, leave descriptions as-is
        }
      }
    }
    }

    // Resolve Bought[CODE] in CoinLog Description to item names from GameDB.ItemList.szItemName
    if (lowerTable === 'coinlog' && Array.isArray(items) && items.length) {
      const codeSet = new Set<string>();
      const codeRe = /Bought\[([^\]]+)\]/gi;
      for (const row of items) {
        const desc = row?.Description;
        if (typeof desc === 'string') {
          let m: RegExpExecArray | null;
          while ((m = codeRe.exec(desc)) !== null) {
            const code = String(m[1] || '').trim();
            if (code) codeSet.add(code.toUpperCase());
          }
        }
      }
      if (codeSet.size) {
        const codes = Array.from(codeSet);
        const p: Record<string, any> = {};
        const placeholders = codes.map((c, i) => { const k = `cc${i}`; p[k] = c; return `@${k}`; });
        try {
          const mapRes = await gameDB.query<{ szLastCategory: string; szItemName: string }>(
            `SELECT szLastCategory, szItemName FROM ItemList WHERE UPPER(szLastCategory) IN (${placeholders.join(',')})`,
            p
          );
          const nameMap: Record<string, string> = {};
          for (const r of mapRes.recordset || []) {
            if (r && r.szLastCategory) nameMap[String(r.szLastCategory).toUpperCase()] = r.szItemName || '';
          }
          items = items.map((row: any) => {
            const desc = row?.Description;
            if (typeof desc === 'string') {
              const newDesc = desc.replace(codeRe, (full, code) => {
                const key = String(code || '').toUpperCase();
                const name = nameMap[key];
                return name ? `Bought[${name}]` : full;
              });
              return { ...row, Description: newDesc };
            }
            return row;
          });
        } catch {
          // leave as-is if lookup fails
        }
      }
    }

    // Resolve Bought[CODE] in UserTimeCoinLog Description to item names from GameDB.ItemList.szItemName
    if (lowerTable === 'usertimecoinlog' && Array.isArray(items) && items.length) {
      const codeSet = new Set<string>();
      const codeRe = /Bought\[([^\]]+)\]/gi;
      for (const row of items) {
        const desc = row?.Description;
        if (typeof desc === 'string') {
          let m: RegExpExecArray | null;
          while ((m = codeRe.exec(desc)) !== null) {
            const code = String(m[1] || '').trim();
            if (code) codeSet.add(code.toUpperCase());
          }
        }
      }
      if (codeSet.size) {
        const codes = Array.from(codeSet);
        const p: Record<string, any> = {};
        const placeholders = codes.map((c, i) => { const k = `utc${i}`; p[k] = c; return `@${k}`; });
        try {
          const mapRes = await gameDB.query<{ szLastCategory: string; szItemName: string }>(
            `SELECT szLastCategory, szItemName FROM ItemList WHERE UPPER(szLastCategory) IN (${placeholders.join(',')})`,
            p
          );
          const nameMap: Record<string, string> = {};
          for (const r of mapRes.recordset || []) {
            if (r && r.szLastCategory) nameMap[String(r.szLastCategory).toUpperCase()] = r.szItemName || '';
          }
          items = items.map((row: any) => {
            const desc = row?.Description;
            if (typeof desc === 'string') {
              const newDesc = desc.replace(codeRe, (full, code) => {
                const key = String(code || '').toUpperCase();
                const name = nameMap[key];
                return name ? `Bought[${name}]` : full;
              });
              return { ...row, Description: newDesc };
            }
            return row;
          });
        } catch {
          // leave as-is if lookup fails
        }
      }
    }

    // Mask sensitive password values in AccountLog description
    if (lowerTable === 'accountlog' && Array.isArray(items)) {
      const re = /Password\[[^\]]*\]/gi;
      items = items.map((row: any) => {
        if (row && typeof row.Description === 'string') {
          row = { ...row, Description: row.Description.replace(re, 'Password[****]') };
        }
        return row;
      });
    }

    return NextResponse.json({ items, page, pageSize, hasMore: offset + items.length < total, total, dateCol });
  } catch (e) {
    console.error('Admin game-logs search error:', e);
    return NextResponse.json({ error: 'Failed to search logs' }, { status: 500 });
  }
}
