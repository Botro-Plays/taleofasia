import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';
import { dispatchPaypalAlert } from '@/lib/paypal/alerts';

type PendingTransaction = {
  TransactionID: string;
  AccountName: string;
  GatewayTransactionID: string | null;
  Status: string;
  UsdAmount: number | null;
  CoinsAwarded: number | null;
  Notes: string | null;
};

async function getPaypalConfig() {
  const res = await webDB.query(
    `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'payment_paypal_enabled')`
  );
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paypal_enabled') === 'true',
    clientId: map.get('paypal_client_id') || '',
    secret: map.get('paypal_secret') || '',
    sandbox: map.get('paypal_sandbox') === 'true',
  };
}

async function getPaypalToken(config: { clientId: string; secret: string; sandbox: boolean }) {
  const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(`PayPal auth failed: HTTP ${tokenRes.status}`);
  }
  return { baseUrl, accessToken: tokenData.access_token as string };
}

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

interface ReconcileResult {
  transactionId: string;
  orderId: string;
  paypalStatus: string;
  newStatus: 'completed' | 'cancelled' | 'pending' | 'failed';
  updated: boolean;
  awarded?: number;
  error?: string;
}

async function reconcileSingleTransaction(
  txn: PendingTransaction,
  config: { clientId: string; secret: string; sandbox: boolean },
  ip: string
): Promise<ReconcileResult> {
  const orderId = txn.GatewayTransactionID;
  if (!orderId) {
    return {
      transactionId: txn.TransactionID,
      orderId: '',
      paypalStatus: 'missing-order-id',
      newStatus: 'failed',
      updated: false,
      error: 'GatewayTransactionID is empty',
    };
  }

  try {
    const { baseUrl, accessToken } = await getPaypalToken(config);

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!orderRes.ok) {
      const errorBody = await orderRes.json().catch(() => ({}));
      const errorMsg = `HTTP ${orderRes.status}: ${errorBody?.message || orderRes.statusText}`;
      return {
        transactionId: txn.TransactionID,
        orderId,
        paypalStatus: `error-${orderRes.status}`,
        newStatus: 'failed',
        updated: false,
        error: errorMsg,
      };
    }

    const orderData = await orderRes.json();
    const paypalStatus: string = orderData?.status || 'UNKNOWN';
    const captures: any[] = orderData?.purchase_units?.[0]?.payments?.captures || [];
    const completedCapture = captures.find((c: any) => c?.status === 'COMPLETED');

    let updated = false;
    let awarded: number | undefined;

    // COMPLETED with a capture → mark completed and award coins
    if (paypalStatus === 'COMPLETED' && completedCapture) {
      const up = await webDB.query(
        `UPDATE PaymentTransactions
         SET Status = 'completed', CompletedAt = GETDATE(),
             Notes = ISNULL(Notes, '') + ' | paypalReconcile:COMPLETED #' + @capId
         WHERE TransactionID = @transactionId AND Status = 'pending'`,
        { transactionId: txn.TransactionID, capId: String(completedCapture.id || '') }
      );
      updated = (up.rowsAffected?.[0] ?? 0) > 0;

      if (updated && txn.AccountName && (txn.UsdAmount || 0) > 0) {
        const award = await awardCoins(txn.AccountName, txn.TransactionID, txn.UsdAmount || 0, 'PayPal');
        if (award) {
          awarded = award.awarded;
          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (@accountName, 'COINS_AWARDED', 'Reconcile awarded ' + @coins + ' coins for PayPal ' + @orderId + ' txn=' + @transactionId, @ip, GETDATE())`,
            { accountName: txn.AccountName, coins: String(award.awarded), orderId, transactionId: txn.TransactionID, ip }
          );
        }
      }

      return { transactionId: txn.TransactionID, orderId, paypalStatus, newStatus: 'completed', updated, awarded };
    }

    // VOIDED → mark cancelled
    if (paypalStatus === 'VOIDED') {
      const up = await webDB.query(
        `UPDATE PaymentTransactions
         SET Status = 'cancelled',
             Notes = ISNULL(Notes, '') + ' | paypalReconcile:VOIDED'
         WHERE TransactionID = @transactionId AND Status = 'pending'`,
        { transactionId: txn.TransactionID }
      );
      updated = (up.rowsAffected?.[0] ?? 0) > 0;
      return { transactionId: txn.TransactionID, orderId, paypalStatus, newStatus: 'cancelled', updated };
    }

    // PAYER_ACTION_REQUIRED / CREATED / APPROVED (without capture) → leave pending, just log
    const noteMap: Record<string, string> = {
      CREATED: 'CREATED',
      APPROVED: 'APPROVED_no_capture',
      PAYER_ACTION_REQUIRED: 'PAYER_ACTION_REQUIRED',
    };
    const note = noteMap[paypalStatus];
    if (note) {
      await webDB.query(
        `UPDATE PaymentTransactions
         SET Notes = ISNULL(Notes, '') + ' | paypalReconcile:' + @note
         WHERE TransactionID = @transactionId`,
        { transactionId: txn.TransactionID, note }
      );
    }

    return { transactionId: txn.TransactionID, orderId, paypalStatus, newStatus: 'pending', updated: false };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[PayPal Reconcile] txn=${txn.TransactionID} order=${orderId} error:`, errorMsg);
    return { transactionId: txn.TransactionID, orderId, paypalStatus: 'error', newStatus: 'failed', updated: false, error: errorMsg };
  }
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
        const config = await getPaypalConfig();
        if (!config.clientId || !config.secret) {
          if (config.enabled) {
            await dispatchPaypalAlert({
              severity: 'critical',
              title: 'PayPal reconcile blocked',
              message: 'Scheduled reconcile job cannot proceed because PayPal credentials are missing.',
              source: 'paypal-reconcile-cron',
              dedupeKey: 'reconcile:not-configured',
              ip,
            });
          }
          return NextResponse.json({ error: 'PayPal not configured' }, { status: 503 });
        }

        let transactions: PendingTransaction[] = [];
        if (singleTransactionId) {
          const txnRes = await webDB.query(
            `SELECT TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount, CoinsAwarded, Notes
             FROM PaymentTransactions
             WHERE TransactionID = @transactionId AND PaymentMethod = 'PayPal'`,
            { transactionId: singleTransactionId }
          );
          if (txnRes.recordset?.[0]) {
            transactions = [txnRes.recordset[0]];
          }
        } else {
          const txnRes = await webDB.query(
            `SELECT TOP (50) TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount, CoinsAwarded, Notes
             FROM PaymentTransactions
             WHERE PaymentMethod = 'PayPal'
               AND Status = 'pending'
               AND CreatedAt <= DATEADD(minute, -10, GETDATE())
             ORDER BY CreatedAt ASC`
          );
          transactions = txnRes.recordset || [];
        }

        if (!transactions.length) {
          return NextResponse.json({ processed: 0, completed: 0, cancelled: 0, stillPending: 0, failed: 0, details: [] });
        }

        const details: ReconcileResult[] = [];
        let completed = 0;
        let cancelled = 0;
        let stillPending = 0;
        let failed = 0;

        for (const txn of transactions) {
          const result = await reconcileSingleTransaction(txn, config, ip);
          details.push(result);

          if (result.newStatus === 'completed') completed++;
          else if (result.newStatus === 'cancelled') cancelled++;
          else if (result.newStatus === 'pending') stillPending++;
          else failed++;

          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (NULL, 'PAYPAL_RECONCILE', 'Txn=' + @transactionId + ' paypal=' + @paypalStatus + ' new=' + @newStatus + ' updated=' + @updated + CASE WHEN @error IS NULL THEN '' ELSE ' error=' + @error END, @ip, GETDATE())`,
            {
              transactionId: txn.TransactionID,
              paypalStatus: result.paypalStatus,
              newStatus: result.newStatus,
              updated: result.updated ? 'true' : 'false',
              error: result.error || null,
              ip,
            }
          );

          if (result.error && config.enabled) {
            await dispatchPaypalAlert({
              severity: 'warning',
              title: 'PayPal reconcile error',
              message: `Encountered an error while reconciling PayPal transaction ${txn.TransactionID}.`,
              source: 'paypal-reconcile-cron',
              context: {
                transactionId: txn.TransactionID,
                gatewayId: txn.GatewayTransactionID,
                error: result.error,
                paypalStatus: result.paypalStatus,
              },
              dedupeKey: `reconcile:error:${result.error}`,
              ip,
            });
          }
        }

        if (stillPending > 0 && transactions.length >= 50 && config.enabled) {
          await dispatchPaypalAlert({
            severity: 'warning',
            title: 'PayPal reconcile backlog growing',
            message: `Reconcile processed ${transactions.length} transactions but ${stillPending} remain pending. Oldest batch likely exceeds queue limit (50).`,
            source: 'paypal-reconcile-cron',
            context: { processed: transactions.length, completed, cancelled, stillPending, failed },
            dedupeKey: 'reconcile:backlog',
            ip,
          });
        }

        return NextResponse.json({
          processed: transactions.length,
          completed,
          cancelled,
          stillPending,
          failed,
          details,
        });
      } catch (error: any) {
        const message = error?.message || String(error);
        if (/Connection is closed/i.test(message) && attempt < MAX_ATTEMPTS) {
          console.warn(`[PayPal Reconcile] SQL connection closed on attempt ${attempt}; retrying.`);
          // _queryWithRetry already handles stale pool recycling internally
          return run(attempt + 1);
        }
        throw error;
      }
    };

    return await run(1);
  } catch (error: any) {
    console.error('PayPal reconcile cron error:', error);
    const config = await getPaypalConfig();
    if (config.enabled) {
      await dispatchPaypalAlert({
        severity: 'critical',
        title: 'PayPal reconcile job failed',
        message: error?.message || 'Unknown error',
        source: 'paypal-reconcile-cron',
        context: { stack: error?.stack },
        dedupeKey: 'reconcile:unhandled-error',
        ip: request.headers.get('x-forwarded-for') || 'system-cron',
      });
    }
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}
