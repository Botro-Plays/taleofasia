import { NextRequest, NextResponse } from 'next/server';
import { dispatchPaypalAlert } from '@/lib/paypal/alerts';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { getPricingConfig } from '@/lib/pricing';
import { convertLocalToUsd } from '@/lib/currency';
import { rateLimiter, rateLimitResponse, getClientIP } from '@/lib/rate-limit';

async function getPaypalConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'payment_paypal_enabled')`);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paypal_enabled') === 'true',
    clientId: map.get('paypal_client_id') || '',
    secret: map.get('paypal_secret') || '',
    sandbox: map.get('paypal_sandbox') === 'true',
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const ip = getClientIP(request);

    const rateLimit = rateLimiter.check(ip, `paypal-create:${username}`, 6, 60 * 1000);
    if (!rateLimit.allowed) {
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@username, 'PAYPAL_RATE_LIMIT', @details, @ip)`,
          {
            username,
            details: `PayPal order creation throttled (retry after ${rateLimit.retryAfter}s)`,
            ip,
          }
        );
      } catch (logError) {
        console.error('[PayPal Rate Limit] Failed to log throttle event:', logError);
      }
      return rateLimitResponse(rateLimit.retryAfter);
    }

    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    // Validate order
    const orderCheck = await webDB.query(`
      SELECT Amount, Currency, UsdAmount, LocalAmount, LocalCurrency, Status, ExpiresAt, PaymentMethod
      FROM PaymentTransactions WHERE TransactionID = @transactionId AND AccountName = @username
    `, { transactionId, username });

    const order = orderCheck.recordset?.[0];
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.PaymentMethod !== 'PayPal') {
      return NextResponse.json({ error: 'Invalid payment method for this order' }, { status: 400 });
    }
    if (order.Status !== 'pending') return NextResponse.json({ error: 'Order is not pending' }, { status: 400 });
    if (order.ExpiresAt && new Date(order.ExpiresAt) < new Date()) {
      await webDB.query(`UPDATE PaymentTransactions SET Status = 'cancelled', Notes = ISNULL(Notes, '') + ' | paypalExpired=true' WHERE TransactionID = @transactionId`, { transactionId });
      return NextResponse.json({ error: 'Order expired' }, { status: 410 });
    }

    const config = await getPaypalConfig();
    if (!config.enabled) return NextResponse.json({ error: 'PayPal is not enabled' }, { status: 403 });
    if (!config.clientId || !config.secret) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });

    const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://taleofasia.com';

    const pricingConfig = await getPricingConfig();
    const usdAmount = Number(order.UsdAmount) || (await convertLocalToUsd(Number(order.LocalAmount || order.Amount || 0), String(order.LocalCurrency || order.Currency || 'USD').toUpperCase())).usdAmount;
    if (usdAmount < pricingConfig.paypalMinUsd) {
      return NextResponse.json({
        error: `Minimum PayPal amount is $${pricingConfig.paypalMinUsd.toFixed(2)} USD`,
      }, { status: 400 });
    }

    // Get access token
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return NextResponse.json({ message: 'PayPal authentication failed' }, { status: 502 });

    // Create PayPal order using local amount
    const paypalCurrency = order.LocalCurrency || order.Currency || 'PHP';
    const paypalAmount = order.LocalAmount || order.Amount;
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        application_context: {
          return_url: `${siteOrigin}/api/payment/paypal/return?redirect=${encodeURIComponent('/dashboard/topup?payment=success&method=PayPal')}`,
          cancel_url: `${siteOrigin}/payment/return?status=failed&method=PayPal`,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          brand_name: 'Tale of Asia',
        },
        purchase_units: [{
          description: `In-game coins top-up for ${username} (TX:${transactionId})`,
          custom_id: String(transactionId),
          amount: {
            currency_code: paypalCurrency.toUpperCase(),
            value: Number(paypalAmount).toFixed(2),
          },
        }],
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      try {
        await dispatchPaypalAlert({
          severity: 'critical',
          title: 'PayPal order creation failed',
          message: `Failed to create PayPal order for TX ${transactionId}`,
          source: 'paypal-create',
          dedupeKey: `paypal:create:failed:${transactionId}`,
          context: {
            httpStatus: orderRes.status,
            responseBody: orderData,
            currency: String(paypalCurrency).toUpperCase(),
            amount: Number(paypalAmount).toFixed(2),
            siteOrigin,
            sandbox: config.sandbox,
          },
          ip: getClientIP(request),
        });
      } catch {}
      return NextResponse.json({ message: 'Failed to create PayPal order' }, { status: 502 });
    }

    const approvalLink = orderData.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approvalLink?.href) return NextResponse.json({ message: 'No approval URL from PayPal' }, { status: 502 });

    // Update order with gateway ID and approval URL for reuse
    await webDB.query(`UPDATE PaymentTransactions SET GatewayTransactionID = @orderId, Notes = ISNULL(Notes, '') + ' | approvalUrl:' + @approvalUrl WHERE TransactionID = @transactionId`,
      { transactionId, orderId: orderData.id || '', approvalUrl: approvalLink.href || '' }
    );

    await webDB.query(`INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PAYMENT_REQUEST', 'PayPal order created for ' + @transactionId, @ip)`,
      { username, transactionId, ip }
    );

    return NextResponse.json({ approvalUrl: approvalLink.href, orderId: orderData.id });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    return NextResponse.json({ message: 'Failed to create PayPal order' }, { status: 500 });
  }
}
