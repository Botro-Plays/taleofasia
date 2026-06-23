import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { rateLimiter, rateLimitResponse, getClientIP } from '@/lib/rate-limit';
import { getPaymongoConfig, refreshPaymongoTransaction } from '@/lib/paymongo/status';
import { dispatchPaymongoAlert } from '@/lib/paymongo/alerts';

/**
 * Check PayMongo payment status for a given transaction.
 * Called by the dashboard to poll for payment completion when webhook is unavailable.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const limit = rateLimiter.check(ip, 'paymongo-status', 30, 60 * 1000);
    if (!limit.allowed) {
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (NULL, 'PAYMONGO_RATE_LIMIT', @details, @ip)` ,
          {
            details: `PayMongo status polling throttled (retry after ${limit.retryAfter}s)` ,
            ip,
          }
        );
      } catch (logError) {
        console.error('[PayMongo Status Rate Limit] Failed to log throttle event:', logError);
      }
      return rateLimitResponse(limit.retryAfter);
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId } = body;
    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const config = await getPaymongoConfig();
    if (!config.enabled || !config.secretKey) {
      await dispatchPaymongoAlert({
        severity: 'critical',
        title: 'PayMongo status check blocked',
        message: 'Dashboard polling attempted to check a transaction but PayMongo is disabled or the secret key is missing.',
        source: 'paymongo-check',
        context: { transactionId },
        dedupeKey: 'check:not-configured',
      });
      return NextResponse.json({ error: 'PayMongo not configured' }, { status: 503 });
    }

    // Fetch transaction from DB
    const txnRes = await webDB.query(
      `SELECT TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount, CoinsAwarded, Notes
       FROM PaymentTransactions
       WHERE TransactionID = @transactionId AND AccountName = @username`,
      { transactionId, username: session.user.id }
    );
    const txn = txnRes.recordset?.[0];
    if (!txn) {
      await dispatchPaymongoAlert({
        severity: 'warning',
        title: 'PayMongo check transaction missing',
        message: `Polling request could not find transaction ${transactionId} for the current user.`,
        source: 'paymongo-check',
        context: { transactionId, user: session.user.id },
        dedupeKey: `check:txn-missing:${transactionId}`,
      });
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // If already completed or failed, return current status
    if (txn.Status !== 'pending') {
      return NextResponse.json({ status: txn.Status, transactionId, source: 'database' });
    }

    const refresh = await refreshPaymongoTransaction(txn, { auditIp: 'system', configOverride: config });

    const responseBody: Record<string, unknown> = {
      status: refresh.status,
      transactionId,
      source: refresh.source,
    };

    if (refresh.paymongoStatus) {
      responseBody.paymongoStatus = refresh.paymongoStatus;
    }
    if (refresh.error) {
      responseBody.error = refresh.error;
      await dispatchPaymongoAlert({
        severity: 'warning',
        title: 'PayMongo status check error',
        message: `Error while querying PayMongo for transaction ${transactionId}.`,
        source: 'paymongo-check',
        context: {
          transactionId,
          user: session.user.id,
          error: refresh.error,
          paymongoStatus: refresh.paymongoStatus,
        },
        dedupeKey: `check:error:${refresh.error}`,
      });
    }
    if (refresh.detail) {
      responseBody.detail = refresh.detail;
    }

    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error('[PayMongo Check] Error:', error);
    await dispatchPaymongoAlert({
      severity: 'critical',
      title: 'PayMongo check handler crashed',
      message: error?.message || 'Unknown error',
      source: 'paymongo-check',
      context: { stack: error?.stack },
      dedupeKey: 'check:unhandled-error',
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
