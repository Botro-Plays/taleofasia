import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';

export async function POST() {
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
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await webDB.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'WebPages')
      BEGIN
        CREATE TABLE WebPages (
          Slug nvarchar(100) NOT NULL PRIMARY KEY,
          Title nvarchar(200) NOT NULL,
          Content nvarchar(max) NULL,
          UpdatedAt datetime NOT NULL CONSTRAINT DF_WebPages_UpdatedAt DEFAULT(GETDATE()),
          UpdatedBy nvarchar(50) NULL
        )
      END
    `);

    await webDB.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes WHERE name = N'IX_WebPages_UpdatedAt' AND object_id = OBJECT_ID(N'WebPages')
      )
      BEGIN
        CREATE INDEX IX_WebPages_UpdatedAt ON WebPages(UpdatedAt DESC)
      END
    `);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Init WebPages error:', e);
    return NextResponse.json({ error: 'Failed to initialize WebPages' }, { status: 500 });
  }
}
