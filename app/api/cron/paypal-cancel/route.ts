import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';
import { dispatchPaypalAlert } from '@/lib/paypal/alerts';
import { getPaypalConfig, cancelPaypalOrder } from '@/lib/paypal/api';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || '';

  if (expectedSecret && authHeader === `Bearer ${expectedSecret}`) {
    return true;
  }

  const session = await auth();
  if (session?.user?.id) {
    const priv = await checkAdminPrivileges(session.user.id);
    if (priv.isSuperAdmin) {
      return true;
    }
  }

  return false;
}

interface CancelResult {
  transactionId: string;
  orderId: string;
  status: 'cancelled' | 'alreadyClosed' | 'notFound' | 'failed';
  error?: string;
}

async function cancelSingleTransaction(
  txn: { TransactionID: string; GatewayTransactionID: string; AccountName: string },
  config: { clientId: string; secret: string; sandbox: boolean },
  ip: string
): Promise<CancelResult> {
  const orderId = txn.GatewayTransactionID;
  const result = await cancelPaypalOrder(orderId, config);

  if (result.status === 'cancelled') {
    await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'cancelled',
           Notes = ISNULL(Notes, '') + ' | paypalCancelled=true'
       WHERE TransactionID = @transactionId`,
      { transactionId: txn.TransactionID }
    );
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
       VALUES (@accountName, 'PAYPAL_CANCEL', 'Auto-cancelled expired PayPal order ' + @orderId + ' for txn ' + @transactionId, @ip, GETDATE())`,
      { accountName: txn.AccountName, orderId, transactionId: txn.TransactionID, ip }
    );
    return { transactionId: txn.TransactionID, orderId, status: 'cancelled' };
  }

  if (result.status === 'alreadyClosed') {
    await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'cancelled',
           Notes = ISNULL(Notes, '') + ' | paypalCancelled=alreadyClosed'
       WHERE TransactionID = @transactionId`,
      { transactionId: txn.TransactionID }
    );
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
       VALUES (@accountName, 'PAYPAL_CANCEL', 'PayPal order ' + @orderId + ' already closed for txn ' + @transactionId, @ip, GETDATE())`,
      { accountName: txn.AccountName, orderId, transactionId: txn.TransactionID, ip }
    );
    return { transactionId: txn.TransactionID, orderId, status: 'alreadyClosed' };
  }

  if (result.status === 'notFound') {
    await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'cancelled',
           Notes = ISNULL(Notes, '') + ' | paypalCancelled=notFound'
       WHERE TransactionID = @transactionId`,
      { transactionId: txn.TransactionID }
    );
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
       VALUES (@accountName, 'PAYPAL_CANCEL', 'PayPal order ' + @orderId + ' not found (404) for txn ' + @transactionId + ' — marked cancelled', @ip, GETDATE())`,
      { accountName: txn.AccountName, orderId, transactionId: txn.TransactionID, ip }
    );
    return { transactionId: txn.TransactionID, orderId, status: 'notFound' };
  }

  return { transactionId: txn.TransactionID, orderId, status: 'failed', error: result.error };
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'system-cron';

    let singleTransactionId: string | null = null;
    try {
      const body = await request.clone().json();
      if (body && typeof body.transactionId === 'string') {
        singleTransactionId = body.transactionId;
      }
    } catch {
      // ignore JSON parse errors for empty body
    }

    const config = await getPaypalConfig();
    if (!config.clientId || !config.secret) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });
    }

    let transactions: { TransactionID: string; GatewayTransactionID: string; AccountName: string }[] = [];

    if (singleTransactionId) {
      const txnRes = await webDB.query(
        `SELECT TransactionID, GatewayTransactionID, AccountName
         FROM PaymentTransactions
         WHERE TransactionID = @transactionId AND PaymentMethod = 'PayPal'`,
        { transactionId: singleTransactionId }
      );
      if (txnRes.recordset?.[0]) {
        transactions = [txnRes.recordset[0]];
      }
    } else {
      const txnRes = await webDB.query(
        `SELECT TOP (50) TransactionID, GatewayTransactionID, AccountName
         FROM PaymentTransactions
         WHERE PaymentMethod = 'PayPal'
           AND Status = 'pending'
           AND GatewayTransactionID IS NOT NULL
           AND GatewayTransactionID != ''
           AND CreatedAt <= DATEADD(minute, -30, GETDATE())
         ORDER BY CreatedAt ASC`
      );
      transactions = txnRes.recordset || [];
    }

    if (!transactions.length) {
      return NextResponse.json({ processed: 0, cancelled: 0, alreadyClosed: 0, notFound: 0, failed: 0, details: [] });
    }

    const details: CancelResult[] = [];
    let cancelled = 0;
    let alreadyClosed = 0;
    let notFound = 0;
    let failed = 0;

    for (const txn of transactions) {
      const result = await cancelSingleTransaction(txn, config, ip);
      details.push(result);

      if (result.status === 'cancelled') cancelled++;
      else if (result.status === 'alreadyClosed') alreadyClosed++;
      else if (result.status === 'notFound') notFound++;
      else failed++;

      if (result.status === 'failed' && config.enabled) {
        await dispatchPaypalAlert({
          severity: 'warning',
          title: 'PayPal auto-cancel failed',
          message: `Failed to cancel expired PayPal order ${result.orderId} for txn ${result.transactionId}.`,
          source: 'paypal-cancel-cron',
          context: {
            transactionId: result.transactionId,
            orderId: result.orderId,
            error: result.error,
          },
          dedupeKey: `paypal-cancel:failed:${result.transactionId}`,
          ip,
        });
      }
    }

    const totalFailed = failed;
    if (totalFailed > 0 && transactions.length >= 50 && config.enabled) {
      await dispatchPaypalAlert({
        severity: 'warning',
        title: 'PayPal cancel backlog growing',
        message: `PayPal cancel processed ${transactions.length} transactions but ${totalFailed} failed. Oldest batch likely exceeds queue limit (50).`,
        source: 'paypal-cancel-cron',
        context: { processed: transactions.length, cancelled, alreadyClosed, notFound, failed },
        dedupeKey: 'paypal-cancel:backlog',
        ip,
      });
    }

    return NextResponse.json({
      processed: transactions.length,
      cancelled,
      alreadyClosed,
      notFound,
      failed,
      details,
    });
  } catch (error: any) {
    console.error('PayPal cancel cron error:', error);
    const config = await getPaypalConfig();
    if (config.enabled) {
      await dispatchPaypalAlert({
        severity: 'critical',
        title: 'PayPal cancel job failed',
        message: error?.message || 'Unknown error',
        source: 'paypal-cancel-cron',
        context: { stack: error?.stack },
        dedupeKey: 'paypal-cancel:unhandled-error',
        ip: request.headers.get('x-forwarded-for') || 'system-cron',
      });
    }
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}
