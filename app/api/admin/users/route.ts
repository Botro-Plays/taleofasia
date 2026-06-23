import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';

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
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all users
    const users = await userDB.query(`
      SELECT AccountName, Email, Coins, Active, BanStatus FROM UserInfo
      ORDER BY AccountName
    `);

    return NextResponse.json(users.recordset);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
