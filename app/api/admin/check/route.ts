import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { isAdmin: false, isSuperAdmin: false },
        { status: 401 }
      );
    }

    const username = session.user.id;

    const result = await cached(`admin-check:${username}`, 30_000, async () => {
      const adminCheck = await userDB.query(`
        SELECT GameMasterType, GameMasterLevel 
        FROM UserInfo 
        WHERE AccountName = @username
      `, { username });
      if (!adminCheck.recordset || adminCheck.recordset.length === 0) return { isAdmin: false, isSuperAdmin: false };
      const user = adminCheck.recordset[0];
      const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
      const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
      return { isAdmin, isSuperAdmin };
    });

    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { isAdmin: false, isSuperAdmin: false },
      { status: 500 }
    );
  }
}
