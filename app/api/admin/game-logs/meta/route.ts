import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { logDB, userDB } from '@/lib/db';

function pickDefaultDateColumn(cols: Array<{ name: string; type: string }>): string | null {
  const typeMatches = cols.filter(c => /date|time|smalldatetime|datetime|datetime2|datetimeoffset/i.test(c.type));
  const nameMatches = cols.filter(c => /date|time|created|timestamp/i.test(c.name));
  if (typeMatches.length) return typeMatches[0].name;
  if (nameMatches.length) return nameMatches[0].name;
  return null;
}

function classifyType(udtName: string) {
  const t = udtName.toLowerCase();
  return {
    isText: /char|text|nchar|ntext|varchar|nvarchar/i.test(t),
    isDate: /date|time|smalldatetime|datetime|datetime2|datetimeoffset/i.test(t),
    isNumeric: /int|decimal|numeric|float|real|money|smallmoney|bigint|tinyint|smallint/i.test(t),
  };
}

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const table = (url.searchParams.get('table') || '').trim();

    if (!table) {
      const t = await logDB.query<{ name: string }>(`SELECT name FROM sys.tables ORDER BY name`);
      const excluded = new Set(['battleroyaleusersrangelog','gamemasterlog','gamemasterlogs','itemcreatelog','inventoryitemlog','characterquest','chatlog','disconnects','mixturelog','mixtruelog','bancoresposta','banco_resposta','characteractionfieldinstance','userinfotimershop']);
      const isExcluded = (name: string) => {
        const low = String(name || '').toLowerCase();
        if (excluded.has(low)) return true;
        const norm = low.replace(/[^a-z0-9]/g, '');
        return norm === 'bancoresposta';
      };
      const tables = (t.recordset || [])
        .map(r => r.name)
        .filter(Boolean)
        .filter(n => !isExcluded(String(n)));
      return NextResponse.json({ tables });
    }

    const valid = await logDB.query<{ name: string }>(
      `SELECT name FROM sys.tables WHERE name = @table`,
      { table }
    );
    if (!valid.recordset?.length) return NextResponse.json({ error: 'Table not found' }, { status: 400 });

    const colsRes = await logDB.query<{ name: string; system_type_id: number; user_type_id: number; max_length: number; is_nullable: boolean; udt_name: string }>(
      `SELECT c.name, t.system_type_id, t.user_type_id, c.max_length, c.is_nullable, TYPE_NAME(c.user_type_id) AS udt_name
       FROM sys.columns c
       JOIN sys.types t ON c.user_type_id = t.user_type_id
       WHERE c.object_id = OBJECT_ID(@tbl)
       ORDER BY c.column_id`,
      { tbl: table }
    );

    const columns = (colsRes.recordset || []).map(r => {
      const type = r.udt_name || '';
      const flags = classifyType(type);
      return { name: r.name, type, ...flags };
    });

    const defaultDateColumn = pickDefaultDateColumn(columns.map(c => ({ name: c.name, type: c.type })));
    const defaultTextColumns = columns.filter(c => c.isText).slice(0, 5).map(c => c.name);

    return NextResponse.json({ table, columns, defaultDateColumn, defaultTextColumns });
  } catch (e) {
    console.error('Admin game-logs meta error:', e);
    return NextResponse.json({ error: 'Failed to load metadata' }, { status: 500 });
  }
}
