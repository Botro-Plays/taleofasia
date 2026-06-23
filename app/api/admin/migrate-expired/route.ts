import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

/**
 * One-time migration endpoint: converts all Status = 'expired' to 'cancelled'.
 * Run this once via an admin POST request, then it can be removed.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
    }

    const result = await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'cancelled',
           Notes = ISNULL(Notes, '') + ' | migratedFromExpired=true'
       OUTPUT inserted.TransactionID, inserted.AccountName, inserted.PaymentMethod
       WHERE Status = 'expired'`
    );

    const migrated = result.recordset || [];

    for (const txn of migrated) {
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
         VALUES (@accountName, 'STATUS_MIGRATION', 'Migrated transaction ' + @transactionId + ' (' + @paymentMethod + ') from expired to cancelled', @ip, GETDATE())`,
        {
          accountName: txn.AccountName || 'system',
          transactionId: txn.TransactionID,
          paymentMethod: txn.PaymentMethod,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        }
      );
    }

    return NextResponse.json({
      migrated: migrated.length,
      transactions: migrated.map((t: any) => ({
        transactionId: t.TransactionID,
        accountName: t.AccountName,
        paymentMethod: t.PaymentMethod,
      })),
    });
  } catch (error: any) {
    console.error('Migrate expired error:', error);
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
