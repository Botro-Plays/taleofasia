import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB, serverDB } from '@/lib/db';

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

    // Check if user is admin (same logic as /api/admin/check)
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

    // Total users
    let totalUsers = 0;
    try {
      const usersResult = await userDB.query(`
        SELECT COUNT(*) as count FROM UserInfo
      `);
      totalUsers = usersResult.recordset[0].count;
    } catch (error) {
      console.error('Error counting users:', error);
    }

    // Active sessions (online users)
    let activeSessions = 0;
    try {
      const onlineResult = await serverDB.query(`
        SELECT COUNT(*) as count FROM UsersOnline
      `);
      activeSessions = onlineResult.recordset[0].count;
    } catch (error) {
      console.error('Error counting online users:', error);
    }

    // Pending payments
    let pendingPayments = 0;
    try {
      const paymentsResult = await webDB.query(`
        SELECT COUNT(*) as count FROM PaymentTransactions WHERE Status = 'pending'
      `);
      pendingPayments = paymentsResult.recordset[0].count;
    } catch (error) {
      console.error('Error counting pending payments:', error);
    }

    return NextResponse.json({
      totalUsers,
      activeSessions,
      pendingPayments,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
