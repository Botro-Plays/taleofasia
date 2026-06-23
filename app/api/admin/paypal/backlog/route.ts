import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PayPal-specific backlog metrics
    const pendingOld = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status = 'pending'
         AND CreatedAt < DATEADD(minute, -10, GETDATE())`,
      {}
    );

    const pendingVeryOld = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status = 'pending'
         AND CreatedAt < DATEADD(minute, -30, GETDATE())`,
      {}
    );

    const stuckInProcessing = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status = 'pending'
         AND ExpiresAt < GETDATE()`,
      {}
    );

    const recentFailures = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status IN ('failed', 'rejected')
         AND CreatedAt >= DATEADD(hour, -24, GETDATE())`,
      {}
    );

    const totalPending = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status = 'pending'`,
      {}
    );

    const totalCompleted24h = await webDB.query(
      `SELECT COUNT(*) as count
       FROM PaymentTransactions
       WHERE PaymentMethod = 'PayPal' AND Status = 'completed'
         AND CompletedAt >= DATEADD(hour, -24, GETDATE())`,
      {}
    );

    return NextResponse.json({
      paypal: {
        totalPending: totalPending.recordset?.[0]?.count || 0,
        pendingOver10Min: pendingOld.recordset?.[0]?.count || 0,
        pendingOver30Min: pendingVeryOld.recordset?.[0]?.count || 0,
        expiredPending: stuckInProcessing.recordset?.[0]?.count || 0,
        recentFailures: recentFailures.recordset?.[0]?.count || 0,
        completed24h: totalCompleted24h.recordset?.[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching PayPal backlog:', error);
    return NextResponse.json({ error: 'Failed to fetch PayPal backlog' }, { status: 500 });
  }
}
