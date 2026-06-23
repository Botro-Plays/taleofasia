import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';
import { checkAdminPrivileges } from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify either cron secret OR authenticated admin session
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || '';
    let isAuthorized = false;

    if (expectedSecret && authHeader === `Bearer ${expectedSecret}`) {
      isAuthorized = true;
    } else {
      const session = await auth();
      if (session?.user?.id) {
        const priv = await checkAdminPrivileges(session.user.id);
        if (priv.isSuperAdmin) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for single-transaction reward request
    let singleTransactionId: string | null = null;
    try {
      const body = await request.clone().json();
      singleTransactionId = body.transactionId || null;
    } catch {
      // No body or invalid JSON, proceed with bulk mode
    }

    if (singleTransactionId) {
      const txnRes = await webDB.query(
        `SELECT TransactionID, AccountName, UsdAmount, PaymentMethod FROM PaymentTransactions
         WHERE TransactionID = @transactionId
           AND Status = 'completed'
           AND (CoinsAwarded IS NULL OR CoinsAwarded = 0)`,
        { transactionId: singleTransactionId }
      );
      const txn = txnRes.recordset?.[0];
      if (!txn) {
        return NextResponse.json({ error: 'Transaction not found or already rewarded' }, { status: 404 });
      }
      const result = await awardCoins(txn.AccountName, txn.TransactionID, Number(txn.UsdAmount) || 0, txn.PaymentMethod);
      return NextResponse.json({
        processed: 1,
        succeeded: result ? 1 : 0,
        failed: result ? 0 : 1,
        details: [{ transactionId: txn.TransactionID, accountName: txn.AccountName, awarded: result?.awarded || 0, success: !!result }],
      });
    }

    // Bulk mode: find all completed transactions with no coins awarded
    const txns = await webDB.query(`
      SELECT TransactionID, AccountName, UsdAmount, PaymentMethod
      FROM PaymentTransactions
      WHERE Status = 'completed'
        AND (CoinsAwarded IS NULL OR CoinsAwarded = 0)
      ORDER BY CreatedAt DESC
    `);

    const records = txns.recordset || [];
    const results: { transactionId: string; accountName: string; awarded: number; success: boolean; error?: string }[] = [];

    for (const txn of records) {
      try {
        const result = await awardCoins(txn.AccountName, txn.TransactionID, Number(txn.UsdAmount) || 0, txn.PaymentMethod);
        results.push({
          transactionId: txn.TransactionID,
          accountName: txn.AccountName,
          awarded: result?.awarded || 0,
          success: !!result,
        });
      } catch (err: any) {
        results.push({
          transactionId: txn.TransactionID,
          accountName: txn.AccountName,
          awarded: 0,
          success: false,
          error: err.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    });
  } catch (error: any) {
    console.error('Payment reward cron error:', error);
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}
