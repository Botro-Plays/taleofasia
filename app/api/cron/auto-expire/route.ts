import { NextRequest, NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { getClientIP } from '@/lib/rate-limit';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === process.env.CRON_SECRET) return true;
  }
  const { searchParams } = new URL(request.url);
  if (searchParams.get('token') === process.env.CRON_SECRET) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIP(request);

  try {
    // Mark dead pending transactions as 'cancelled'
    // EXCLUDE PayPal (handled by paypal-cancel cron via API void)
    // EXCLUDE PayMongo (handled by paymongo-reconcile cron via API status check)
    // EXCLUDE crypto with txHash (blockchain may be slow, user may have submitted tx)
    // TARGET: GCash and other manual payment methods, plus crypto without txHash
    const result = await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'cancelled',
           Notes = ISNULL(Notes, '') + ' | autoExpired=true'
       OUTPUT inserted.TransactionID, inserted.AccountName, inserted.PaymentMethod
       WHERE Status = 'pending'
         AND ExpiresAt < GETDATE()
         AND PaymentMethod NOT IN ('PayPal', 'PayMongo')
         AND NOT (PaymentMethod = 'Crypto' AND TxHash IS NOT NULL AND LEN(TxHash) > 0)`
    );

    const expired = result.recordset || [];

    for (const txn of expired) {
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
         VALUES (@accountName, 'AUTO_EXPIRE', 'Auto-expired pending transaction ' + @transactionId + ' (' + @paymentMethod + ')', @ip, GETDATE())`,
        { accountName: txn.AccountName || 'system', transactionId: txn.TransactionID, paymentMethod: txn.PaymentMethod, ip }
      );
    }

    return NextResponse.json({
      processed: expired.length,
      details: expired.map((t: any) => ({ transactionId: t.TransactionID, paymentMethod: t.PaymentMethod })),
    });
  } catch (error) {
    console.error('Auto-expire cron error:', error);
    return NextResponse.json({ error: 'Auto-expire failed' }, { status: 500 });
  }
}
