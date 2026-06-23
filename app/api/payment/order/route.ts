import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { getPricingConfig, calculateCoins, validatePaymentAmount } from '@/lib/pricing';
import { convertUsdToLocal, detectCountryFromRequest } from '@/lib/currency';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'create-order', 10, 60 * 1000);
  if (!limit.allowed) {
    try {
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (NULL, 'ORDER_RATE_LIMIT', @details, @ip)` ,
        {
          details: `Order creation throttled (retry after ${limit.retryAfter}s)` ,
          ip,
        }
      );
    } catch (logError) {
      console.error('[Order Rate Limit] Failed to log throttle event:', logError);
    }
    return rateLimitResponse(limit.retryAfter);
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const body = await request.json();
    const { usdAmount, paymentMethod, timezone } = body;

    if (!paymentMethod || !['PayMongo', 'PayPal', 'Crypto', 'GCash'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    let countryCode = await detectCountryFromRequest(request);

    // Client timezone override for reliable country detection
    const TZ_MAP: Record<string, string> = {
      'Asia/Manila': 'PH', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
      'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Ho_Chi_Minh': 'VN',
      'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Australia/Sydney': 'AU',
      'Pacific/Auckland': 'NZ', 'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK',
      'Asia/Dhaka': 'BD', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
      'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
      'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Moscow': 'RU',
      'Europe/Amsterdam': 'NL', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK',
      'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI', 'Europe/Prague': 'CZ',
      'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Warsaw': 'PL',
      'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Africa/Cairo': 'EG',
      'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA', 'America/Toronto': 'CA', 'America/New_York': 'US',
      'America/Los_Angeles': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
    };
    if (timezone && TZ_MAP[timezone]) {
      countryCode = TZ_MAP[timezone];
    }

    const usd = Number(usdAmount);
    if (!usd || usd <= 0) {
      return NextResponse.json({ error: 'Valid USD amount is required' }, { status: 400 });
    }

    const usdAmountVal = Math.round(usd * 100) / 100;

    // Server-side validation
    const pricingConfig = await getPricingConfig();
    // Each payment method has its own minimum; only GCash uses the general platform minimum
    if (paymentMethod === 'GCash') {
      const validation = await validatePaymentAmount(usdAmountVal, pricingConfig);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    let localCurrency = 'USD';
    let localAmount = usdAmountVal;

    if (paymentMethod === 'PayMongo') {
      // PayMongo requires PHP; auto-convert from USD
      const { localAmount: phpAmount } = await convertUsdToLocal(usdAmountVal, 'PHP');
      localCurrency = 'PHP';
      localAmount = phpAmount;
      if (localAmount + 1e-3 < pricingConfig.paymongoMinPhp) {
        return NextResponse.json({
          error: `Minimum PayMongo amount is ₱${pricingConfig.paymongoMinPhp.toFixed(2)}`,
        }, { status: 400 });
      }
    }

    if (paymentMethod === 'PayPal') {
      if (usdAmountVal + 1e-6 < pricingConfig.paypalMinUsd) {
        return NextResponse.json({
          error: `Minimum PayPal amount is $${pricingConfig.paypalMinUsd.toFixed(2)} USD`,
        }, { status: 400 });
      }
    }

    if (paymentMethod === 'Crypto') {
      if (usdAmountVal + 1e-6 < pricingConfig.cryptoMinUsd) {
        return NextResponse.json({
          error: `Minimum crypto amount is $${pricingConfig.cryptoMinUsd.toFixed(2)} USD`,
        }, { status: 400 });
      }
    }

    // Validate amount exists in an active package (defense-in-depth)
    const pkgRes = await webDB.query(
      `SELECT 1 as ActivePackage FROM PaymentPackages WHERE IsActive = 1 AND ABS(UsdAmount - @usdAmountVal) < 0.001`,
      { usdAmountVal }
    );
    if (!pkgRes.recordset || pkgRes.recordset.length === 0) {
      return NextResponse.json({ error: 'Selected package is not available' }, { status: 400 });
    }

    // Calculate coins server-side (prevents frontend manipulation)
    const { totalCoins, bonusCoins, rate } = calculateCoins(usdAmountVal, pricingConfig, paymentMethod);

    // Create order with 30-min expiry
    const transactionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await webDB.query(`
      INSERT INTO PaymentTransactions
      (TransactionID, AccountName, Amount, Currency, UsdAmount, LocalCurrency, LocalAmount,
       PaymentMethod, Status, GatewayTransactionID, CoinsAwarded, BonusRate, ExpiresAt,
       IPAddress, CountryCode, CreatedAt)
      VALUES
      (@transactionId, @username, @amount, @currency, @usdAmount, @localCurrency, @localAmount,
       @paymentMethod, 'pending', '', 0, @rate, @expiresAt, @ip, @countryCode, GETDATE())
    `, {
      transactionId,
      username,
      amount: usdAmountVal,
      currency: 'USD',
      usdAmount: usdAmountVal,
      localCurrency,
      localAmount,
      paymentMethod,
      rate,
      expiresAt,
      ip,
      countryCode,
    });

    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'ORDER_CREATED', @details, @ip)
    `, {
      username,
      details: `Order ${transactionId} | ${paymentMethod} | $${usdAmountVal.toFixed(2)} USD | ${totalCoins} coins | expires ${expiresAt.toISOString()}`,
      ip,
    });

    return NextResponse.json({
      transactionId,
      usdAmount: usdAmountVal,
      localAmount,
      localCurrency,
      currency: 'USD',
      totalCoins,
      bonusCoins,
      rate,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ message: 'Failed to create order' }, { status: 500 });
  }
}
