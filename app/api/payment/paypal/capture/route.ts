import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { rateLimiter, rateLimitResponse, getClientIP } from '@/lib/rate-limit';

async function getPaypalConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox')`);
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const ip = getClientIP(request);

    const rateLimit = rateLimiter.check(ip, `paypal-capture:${username}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@username, 'PAYPAL_RATE_LIMIT', @details, @ip)`,
          {
            username,
            details: `PayPal capture throttled (retry after ${rateLimit.retryAfter}s)`,
            ip,
          }
        );
      } catch (logError) {
        console.error('[PayPal Rate Limit] Failed to log throttle event:', logError);
      }
      return rateLimitResponse(rateLimit.retryAfter);
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const config = await getPaypalConfig();
    if (!config.clientId || !config.secret) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 });
    }

    const baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

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
    if (!tokenRes.ok) {
      return NextResponse.json({ message: 'PayPal authentication failed' }, { status: 502 });
    }

    // Capture order
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const captureData = await captureRes.json();
    if (!captureRes.ok) {
      console.error('PayPal capture error:', captureData);
      return NextResponse.json(
        { message: captureData?.message || 'Failed to capture PayPal order' },
        { status: 502 }
      );
    }

    const status = captureData.status === 'COMPLETED' ? 'completed' : 'pending';

    // Update transaction
    await webDB.query(`
      UPDATE PaymentTransactions
      SET Status = @status, CompletedAt = GETDATE()
      WHERE GatewayTransactionID = @orderId AND AccountName = @username
    `, {
      status,
      orderId,
      username,
    });

    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PAYMENT_CAPTURE', 'PayPal captured: order ' + @orderId + ' status=' + @status, @ip)
    `, {
      username,
      orderId,
      status,
      ip,
    });

    return NextResponse.json({
      success: status === 'completed',
      status,
      orderId,
    });
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return NextResponse.json({ message: 'Failed to capture PayPal order' }, { status: 500 });
  }
}
