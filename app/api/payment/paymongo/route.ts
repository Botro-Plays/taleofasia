import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { getPricingConfig, calculateCoins } from '@/lib/pricing';
import { convertUsdToLocal } from '@/lib/currency';
import { rateLimiter, rateLimitResponse, getClientIP } from '@/lib/rate-limit';

async function getPaymongoConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paymongo_secret_key', 'payment_paymongo_enabled')`);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paymongo_enabled') === 'true',
    secretKey: map.get('paymongo_secret_key') || '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const rateLimit = rateLimiter.check(ip, `paymongo-link:${username}`, 6, 60 * 1000);
    if (!rateLimit.allowed) {
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@username, 'PAYMONGO_RATE_LIMIT', @details, @ip)` ,
          {
            username,
            details: `PayMongo link creation throttled (retry after ${rateLimit.retryAfter}s)`,
            ip,
          }
        );
      } catch (logError) {
        console.error('[PayMongo Rate Limit] Failed to log throttle event:', logError);
      }
      return rateLimitResponse(rateLimit.retryAfter);
    }

    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    // Validate order exists and belongs to user
    const orderCheck = await webDB.query(`
      SELECT Amount, Currency, UsdAmount, LocalAmount, LocalCurrency, Status, ExpiresAt, PaymentMethod
      FROM PaymentTransactions WHERE TransactionID = @transactionId AND AccountName = @username
    `, { transactionId, username });

    const order = orderCheck.recordset?.[0];
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.PaymentMethod !== 'PayMongo') {
      return NextResponse.json({ error: 'Invalid payment method for this order' }, { status: 400 });
    }
    if (order.Status !== 'pending') {
      return NextResponse.json({ error: 'Order is not pending' }, { status: 400 });
    }
    if (order.ExpiresAt && new Date(order.ExpiresAt) < new Date()) {
      await webDB.query(`UPDATE PaymentTransactions SET Status = 'cancelled', Notes = ISNULL(Notes, '') + ' | paymongoExpired=true' WHERE TransactionID = @transactionId`, { transactionId });
      return NextResponse.json({ error: 'Order has expired. Please create a new order.' }, { status: 410 });
    }

    const config = await getPaymongoConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: 'PayMongo is not enabled' }, { status: 403 });
    }
    if (!config.secretKey) {
      return NextResponse.json({ error: 'PayMongo is not configured' }, { status: 503 });
    }

    const pricingConfig = await getPricingConfig();
    const usdAmount = Number(order.UsdAmount) || 0;
    const localCurrency = String(order.LocalCurrency || order.Currency || 'PHP').toUpperCase();
    const rawLocalAmount = Number(order.LocalAmount || order.Amount || 0);
    const localAmountPhp = localCurrency === 'PHP'
      ? rawLocalAmount
      : (await convertUsdToLocal(usdAmount, 'PHP')).localAmount;

    if (localAmountPhp + 1e-3 < pricingConfig.paymongoMinPhp) {
      return NextResponse.json({
        error: `Minimum PayMongo amount is ₱${pricingConfig.paymongoMinPhp.toFixed(2)}`,
      }, { status: 400 });
    }

    // Use local amount for PayMongo (they accept PHP)
    const paymongoAmount = order.LocalAmount || order.Amount;
    const paymongoCurrency = order.LocalCurrency || order.Currency || 'PHP';
    const amountInCents = Math.round(Number(paymongoAmount) * 100);

    // Build description with expected coin breakdown
    const { totalCoins, baseCoins, bonusCoins } = calculateCoins(usdAmount, pricingConfig);
    const coinDesc = bonusCoins > 0
      ? `${totalCoins} Coins (${baseCoins} Base + ${bonusCoins} Bonus)`
      : `${totalCoins} Coins (${baseCoins} Base)`;
    const description = `Tale of Asia Top-Up by ${username} for ${coinDesc}`;

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://taleofasia.com';
    const successUrl = `${siteOrigin}/payment/return?status=success&method=PayMongo`;
    const failedUrl = `${siteOrigin}/payment/return?status=failed&method=PayMongo`;

    // Create PayMongo Checkout Session (enables success_url/failed_url auto-redirect)
    const paymongoRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            description,
            line_items: [
              {
                name: 'Tale of Asia Coins',
                amount: amountInCents,
                currency: paymongoCurrency.toUpperCase(),
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash', 'paymaya', 'card', 'qrph'],
            success_url: successUrl,
            failed_url: failedUrl,
            metadata: {
              transaction_id: transactionId,
              username,
            },
          },
        },
      }),
    });

    const paymongoData = await paymongoRes.json();

    if (!paymongoRes.ok) {
      console.error('PayMongo error:', paymongoData);
      return NextResponse.json(
        { message: paymongoData?.errors?.[0]?.detail || 'PayMongo API error' },
        { status: 502 }
      );
    }

    const checkoutUrl = paymongoData?.data?.attributes?.checkout_url;
    const sessionId = paymongoData?.data?.id;
    const paymentIntentId: string = paymongoData?.data?.attributes?.payment_intent?.id || sessionId;

    if (!checkoutUrl) {
      return NextResponse.json({ message: 'No checkout URL returned from PayMongo' }, { status: 502 });
    }

    // Update order with gateway transaction ID (payment intent) and checkout URL for reuse
    await webDB.query(`
      UPDATE PaymentTransactions SET GatewayTransactionID = @linkId, Notes = ISNULL(Notes, '') + ' | checkoutUrl:' + @checkoutUrl WHERE TransactionID = @transactionId
    `, { transactionId, linkId: paymentIntentId || '', checkoutUrl: checkoutUrl || '' });

    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PAYMENT_REQUEST', 'PayMongo link created for order ' + @transactionId, @ip)
    `, {
      username,
      transactionId,
      ip,
    });

    return NextResponse.json({ checkoutUrl, linkId: paymentIntentId });
  } catch (error) {
    console.error('Error processing PayMongo payment:', error);
    return NextResponse.json({ message: 'Failed to create PayMongo payment' }, { status: 500 });
  }
}
