import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;

    // Check if user is admin
    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all website configs
    const configs = await webDB.query(`
      SELECT ConfigKey, ConfigValue, Description FROM WebsiteConfigs ORDER BY ConfigKey
    `);

    return NextResponse.json(configs.recordset);
  } catch (error) {
    console.error('Error fetching website configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;

    // Check if user is admin
    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { configs } = body;

    // Upsert configs
    for (const config of configs) {
      await webDB.query(`
        MERGE WebsiteConfigs AS target
        USING (SELECT @key AS ConfigKey) AS source
        ON target.ConfigKey = source.ConfigKey
        WHEN MATCHED THEN
          UPDATE SET ConfigValue = @value, LastUpdated = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (ConfigKey, ConfigValue, Description, LastUpdated)
          VALUES (@key, @value, @desc, GETDATE());
      `, {
        key: config.ConfigKey,
        value: config.ConfigValue,
        desc: config.Description || config.ConfigKey,
      });
    }

    // Clear public config cache so reCAPTCHA and other settings take effect immediately
    invalidate('public_config_');

    return NextResponse.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating website configs:', error);
    return NextResponse.json(
      { error: 'Failed to update configs' },
      { status: 500 }
    );
  }
}
