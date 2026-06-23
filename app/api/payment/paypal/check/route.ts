import { NextRequest, NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';

async function getPaypalConfig() {
  const res = await webDB.query(
    `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox')`
  );
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    clientId: map.get('paypal_client_id') || '',
    secret: map.get('paypal_secret') || '',
    sandbox: map.get('paypal_sandbox') === 'true',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { transactionId, orderId: explicitOrderId } = body || {};

    if (!transactionId && !explicitOrderId) {
      return NextResponse.json({ error: 'transactionId or orderId required' }, { status: 400 });
    }

    let orderId = String(explicitOrderId || '');
    let accountName = '';
    let usdAmount = 0;

    if (transactionId) {
      const txn = await webDB.query(
        `SELECT TransactionID, AccountName, GatewayTransactionID, Status, UsdAmount
         FROM PaymentTransactions WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      const row = txn.recordset?.[0];
      if (!row) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      orderId = row.GatewayTransactionID || orderId;
      accountName = row.AccountName || '';
      usdAmount = Number(row.UsdAmount || 0);
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID not found' }, { status: 404 });
    }

    const config = await getPaypalConfig();
    if (!config.clientId || !config.secret) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });
    }

    const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    // OAuth token
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
      return NextResponse.json({ error: 'PayPal auth failed', status: tokenRes.status, body: tokenData }, { status: 502 });
    }

    // Fetch order details
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch PayPal order', status: orderRes.status, body: orderData }, { status: 502 });
    }

    const captures: any[] = orderData?.purchase_units?.[0]?.payments?.captures || [];
    const completedCapture = captures.find((c: any) => c?.status === 'COMPLETED');

    let updated = false;
    if (orderData?.status === 'COMPLETED' && completedCapture) {
      const up = await webDB.query(
        `UPDATE PaymentTransactions
           SET Status = 'completed', CompletedAt = GETDATE(),
               Notes = ISNULL(Notes, '') + ' | paypalCheck:COMPLETED #' + @capId
         WHERE GatewayTransactionID = @orderId AND Status = 'pending'`,
        { orderId, capId: String(completedCapture.id || '') }
      );
      updated = (up.rowsAffected?.[0] ?? 0) > 0;

      if (updated && accountName && usdAmount > 0) {
        const award = await awardCoins(accountName, transactionId, usdAmount, 'PayPal');
        if (award) {
          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (@acc, 'COINS_AWARDED', 'Manual check awarded ' + @coins + ' coins for PayPal ' + @orderId, @ip, GETDATE())`,
            { acc: accountName, coins: String(award.awarded), orderId, ip: request.headers.get('x-forwarded-for') || 'system' }
          );
        }
      }
    }

    return NextResponse.json({
      orderId,
      paypalStatus: orderData?.status,
      captureId: completedCapture?.id || null,
      updated,
    });
  } catch (error) {
    console.error('PayPal check error:', error);
    return NextResponse.json({ message: 'Failed to check PayPal order' }, { status: 500 });
  }
}
