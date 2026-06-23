import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';
import { getPaymongoConfig, refreshPaymongoTransaction } from '@/lib/paymongo/status';
import { dispatchPaymongoAlert } from '@/lib/paymongo/alerts';

type PendingTransaction = {
  TransactionID: string;
  AccountName: string;
  GatewayTransactionID: string | null;
  Status: string;
  UsdAmount: number | null;
  CoinsAwarded: number | null;
  Notes: string | null;
};

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

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let singleTransactionId: string | null = null;
    try {
      const body = await request.clone().json();
      if (body && typeof body.transactionId === 'string') {
        singleTransactionId = body.transactionId;
      }
    } catch {
      // ignore JSON parse errors for empty body
    }

    const ip = request.headers.get('x-forwarded-for') || 'system-cron';
    const MAX_ATTEMPTS = 3;

    const run = async (attempt: number): Promise<NextResponse> => {
      try {
        const config = await getPaymongoConfig();
        if (!config.secretKey) {
          if (config.enabled) {
            await dispatchPaymongoAlert({
              severity: 'critical',
              title: 'PayMongo reconcile blocked',
              message: 'Scheduled reconcile job cannot proceed because the secret key is missing.',
              source: 'paymongo-reconcile-cron',
              dedupeKey: 'reconcile:not-configured',
              ip,
            });
          }
          return NextResponse.json({ error: 'PayMongo not configured' }, { status: 503 });
        }

        let transactions: PendingTransaction[] = [];
        if (singleTransactionId) {
          const txnRes = await webDB.query(
            `SELECT TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount, CoinsAwarded, Notes
             FROM PaymentTransactions
             WHERE TransactionID = @transactionId AND PaymentMethod = 'PayMongo'`,
            { transactionId: singleTransactionId }
          );
          if (txnRes.recordset?.[0]) {
            transactions = [txnRes.recordset[0]];
          }
        } else {
          const txnRes = await webDB.query(
            `SELECT TOP (50) TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount, CoinsAwarded, Notes
             FROM PaymentTransactions
             WHERE PaymentMethod = 'PayMongo'
               AND Status = 'pending'
               AND CreatedAt <= DATEADD(minute, -10, GETDATE())
             ORDER BY CreatedAt ASC`
          );
          transactions = txnRes.recordset || [];
        }

        if (!transactions.length) {
          return NextResponse.json({ processed: 0, completed: 0, stillPending: 0, details: [] });
        }

        const details: Array<{
          transactionId: string;
          status: string;
          paymongoStatus?: string;
          updated: boolean;
          error?: string;
        }> = [];

        let completed = 0;
        let stillPending = 0;

        for (const txn of transactions) {
          const refresh = await refreshPaymongoTransaction(txn, { auditIp: ip, configOverride: config });
          details.push({
            transactionId: txn.TransactionID,
            status: refresh.status,
            paymongoStatus: refresh.paymongoStatus,
            updated: refresh.updated,
            error: refresh.error,
          });

          if (refresh.status === 'completed') {
            completed += 1;
          } else {
            stillPending += 1;
          }

          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (NULL, 'PAYMONGO_RECONCILE', 'Txn=' + @transactionId + ' status=' + @status + ' paymongo=' + ISNULL(@paymongoStatus, 'n/a') + ' updated=' + @updated + CASE WHEN @error IS NULL THEN '' ELSE ' error=' + @error END, @ip, GETDATE())`,
            {
              transactionId: txn.TransactionID,
              status: refresh.status,
              paymongoStatus: refresh.paymongoStatus || null,
              updated: refresh.updated ? 'true' : 'false',
              error: refresh.error || null,
              ip,
            }
          );

          if (refresh.error && config.enabled) {
            await dispatchPaymongoAlert({
              severity: 'warning',
              title: 'PayMongo reconcile error',
              message: `Encountered an error while reconciling PayMongo transaction ${txn.TransactionID}.`,
              source: 'paymongo-reconcile-cron',
              context: {
                transactionId: txn.TransactionID,
                gatewayId: txn.GatewayTransactionID,
                error: refresh.error,
                paymongoStatus: refresh.paymongoStatus,
              },
              dedupeKey: `reconcile:error:${refresh.error}`,
              ip,
            });
          }
        }

        if (stillPending > 0 && transactions.length >= 50 && config.enabled) {
          await dispatchPaymongoAlert({
            severity: 'warning',
            title: 'PayMongo reconcile backlog growing',
            message: `Reconcile processed ${transactions.length} transactions but ${stillPending} remain pending. Oldest batch likely exceeds queue limit (50).`,
            source: 'paymongo-reconcile-cron',
            context: { processed: transactions.length, completed, stillPending },
            dedupeKey: 'reconcile:backlog',
            ip,
          });
        }

        return NextResponse.json({
          processed: transactions.length,
          completed,
          stillPending,
          details,
        });
      } catch (error: any) {
        const message = error?.message || String(error);
        if (/Connection is closed/i.test(message) && attempt < MAX_ATTEMPTS) {
          console.warn(`[PayMongo Reconcile] SQL connection closed on attempt ${attempt}; retrying.`);
          // _queryWithRetry already handles stale pool recycling internally
          return run(attempt + 1);
        }
        throw error;
      }
    };

    return await run(1);
  } catch (error: any) {
    console.error('PayMongo reconcile cron error:', error);
    const config = await getPaymongoConfig();
    if (config.enabled) {
      await dispatchPaymongoAlert({
        severity: 'critical',
        title: 'PayMongo reconcile job failed',
        message: error?.message || 'Unknown error',
        source: 'paymongo-reconcile-cron',
        context: { stack: error?.stack },
        dedupeKey: 'reconcile:unhandled-error',
        ip: request.headers.get('x-forwarded-for') || 'system-cron',
      });
    }
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}
