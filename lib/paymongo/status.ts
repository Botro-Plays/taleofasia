import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';

export interface PaymongoConfig {
  enabled: boolean;
  secretKey: string;
}

export interface PaymongoTransactionRow {
  TransactionID: string;
  AccountName: string;
  GatewayTransactionID: string | null;
  Status: string;
  UsdAmount: number | null;
  CoinsAwarded: number | null;
  Notes: string | null;
}

export interface RefreshResult {
  status: string;
  source: 'database' | 'paymongo';
  paymongoStatus?: string;
  updated: boolean;
  error?: string;
  detail?: string;
}

export interface RefreshOptions {
  auditIp?: string;
  configOverride?: PaymongoConfig;
}

export async function getPaymongoConfig(): Promise<PaymongoConfig> {
  const res = await webDB.query(`
    SELECT ConfigKey, ConfigValue
    FROM WebsiteConfigs
    WHERE ConfigKey IN ('paymongo_secret_key', 'payment_paymongo_enabled')
  `);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paymongo_enabled') === 'true',
    secretKey: map.get('paymongo_secret_key') || '',
  };
}

export async function refreshPaymongoTransaction(
  transaction: PaymongoTransactionRow,
  options: RefreshOptions = {}
): Promise<RefreshResult> {
  if (!transaction || !transaction.TransactionID) {
    return { status: 'not_found', source: 'database', updated: false, error: 'Transaction not provided' };
  }

  if (transaction.Status !== 'pending') {
    return { status: transaction.Status, source: 'database', updated: false };
  }

  const linkId = transaction.GatewayTransactionID;
  if (!linkId) {
    return { status: 'pending', source: 'database', updated: false, error: 'Missing PayMongo link ID' };
  }

  const config = options.configOverride || (await getPaymongoConfig());
  if (!config.secretKey) {
    return { status: 'pending', source: 'database', updated: false, error: 'PayMongo not configured' };
  }

  let response: Response;
  try {
    // GatewayTransactionID may be a payment_intent ID (from checkout sessions) or a link ID (legacy)
    const gatewayId = transaction.GatewayTransactionID;
    const isPaymentIntent = gatewayId?.startsWith('pi_');
    const endpoint = isPaymentIntent
      ? `https://api.paymongo.com/v1/payment_intents/${gatewayId}`
      : `https://api.paymongo.com/v1/links/${gatewayId}`;
    response = await fetch(endpoint, {
      headers: {
        Authorization: `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return {
      status: 'pending',
      source: 'paymongo',
      updated: false,
      paymongoStatus: 'error',
      error: error?.message || 'Network error contacting PayMongo',
    };
  }

  if (!response.ok) {
    let body = '';
    try {
      body = (await response.text()) || '';
    } catch {
      // ignore text parse errors
    }
    return {
      status: 'pending',
      source: 'paymongo',
      updated: false,
      paymongoStatus: 'error',
      error: `HTTP ${response.status}`,
      detail: body.slice(0, 200),
    };
  }

  let paymongoData: any = null;
  try {
    paymongoData = await response.json();
  } catch {
    return {
      status: 'pending',
      source: 'paymongo',
      updated: false,
      paymongoStatus: 'error',
      error: 'Invalid JSON response from PayMongo',
    };
  }

  const attributes = paymongoData?.data?.attributes || {};
  const paymongoStatus: string = attributes.status || 'unknown';
  const amountPaid: number = attributes.amount_paid || 0;
  const amount: number = attributes.amount || 0;
  const payments = attributes.payments || [];
  const hasSuccessfulPayment = Array.isArray(payments) && payments.some((p: any) => p?.attributes?.status === 'paid');

  if (paymongoStatus === 'paid' || paymongoStatus === 'succeeded' || hasSuccessfulPayment || (amount && amountPaid >= amount)) {
    await webDB.query(
      `UPDATE PaymentTransactions SET Status = 'completed', CompletedAt = GETDATE() WHERE TransactionID = @transactionId AND Status = 'pending'`,
      { transactionId: transaction.TransactionID }
    );

    const freshTxnRes = await webDB.query(
      `SELECT TransactionID, AccountName, UsdAmount, CoinsAwarded FROM PaymentTransactions WHERE TransactionID = @transactionId`,
      { transactionId: transaction.TransactionID }
    );
    const freshTxn = freshTxnRes.recordset?.[0];

    if (freshTxn && freshTxn.UsdAmount && freshTxn.UsdAmount > 0 && (!freshTxn.CoinsAwarded || freshTxn.CoinsAwarded <= 0)) {
      const award = await awardCoins(freshTxn.AccountName, freshTxn.TransactionID, freshTxn.UsdAmount, 'PayMongo');
      if (award) {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
           VALUES (@accountName, 'COINS_AWARDED', 'Auto-awarded ' + @coins + ' coins via PayMongo reconciliation for ' + @transactionId, @ip, GETDATE())`,
          {
            accountName: freshTxn.AccountName,
            coins: String(award.awarded),
            transactionId: freshTxn.TransactionID,
            ip: options.auditIp || 'system',
          }
        );
      }
    }

    return {
      status: 'completed',
      source: 'paymongo',
      paymongoStatus,
      updated: true,
    };
  }

  return {
    status: 'pending',
    source: 'paymongo',
    paymongoStatus,
    updated: false,
  };
}
