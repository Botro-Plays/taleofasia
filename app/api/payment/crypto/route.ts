import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { getClientIP, rateLimiter, rateLimitResponse } from '@/lib/rate-limit';
import { getPricingConfig, calculateCoins } from '@/lib/pricing';
import crypto from 'crypto';

async function getCryptoConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('crypto_wallet_bep20', 'crypto_wallet_base', 'payment_crypto_enabled')`);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_crypto_enabled') === 'true',
    walletBep20: map.get('crypto_wallet_bep20') || '',
    walletBase: map.get('crypto_wallet_base') || '',
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'crypto-ticket', 10, 60 * 1000);
  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfter);
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = session.user.id;
    const body = await request.json();
    const { transactionId, network = 'bep20', txHash, chainId } = body;

    if (!transactionId) return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });

    // Validate order
    const orderCheck = await webDB.query(`
      SELECT Amount, Currency, UsdAmount, LocalAmount, LocalCurrency, Status, ExpiresAt, CoinsAwarded, BonusRate, PaymentMethod, TxHash
      FROM PaymentTransactions WHERE TransactionID = @transactionId AND AccountName = @username
    `, { transactionId, username });

    const order = orderCheck.recordset?.[0];
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.PaymentMethod !== 'Crypto') {
      return NextResponse.json({ error: 'Invalid payment method for this order' }, { status: 400 });
    }
    if (order.Status !== 'pending') return NextResponse.json({ error: 'Order is not pending' }, { status: 400 });
    // Allow crypto orders to continue even if expired - user may have submitted blockchain tx that is still confirming
    // Backend cron job handles actual expiry for crypto orders with txHash

    const config = await getCryptoConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Crypto payments are not enabled' }, { status: 403 });

    const wallet = network === 'base' ? config.walletBase : config.walletBep20;
    if (!wallet) return NextResponse.json({ error: `No wallet address configured for ${network}` }, { status: 503 });

    const reference = `CRYPTO-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;
    // Use the same tiered pricing as other methods, with Crypto-specific rate
    const pricingConfig = await getPricingConfig();
    const { totalCoins } = calculateCoins(Number(order.UsdAmount) || 0, pricingConfig, 'Crypto');
    const credits = order.CoinsAwarded || totalCoins;

    // Update order with reference and expected wallet address
    // If client passes a txHash (rescue mode for stuck transactions), also store it if DB is NULL
    const hasStoredTxHash = order.TxHash != null && String(order.TxHash).trim().length > 0;
    if (txHash && !hasStoredTxHash) {
      await webDB.query(`
        UPDATE PaymentTransactions
        SET GatewayTransactionID = @reference, WalletAddress = @wallet, TxHash = @txHash, ChainId = @chainId
        WHERE TransactionID = @transactionId
      `, { transactionId, reference, wallet, txHash: String(txHash).trim(), chainId: Number(chainId) || 56 });
    } else {
      await webDB.query(`
        UPDATE PaymentTransactions
        SET GatewayTransactionID = @reference, WalletAddress = @wallet
        WHERE TransactionID = @transactionId
      `, { transactionId, reference, wallet });
    }

    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PAYMENT_REQUEST', 'Crypto order ' + @transactionId + ' | network=' + @network + ' | ref=' + @reference, @ip)
    `, {
      username,
      transactionId,
      network,
      reference,
      ip: getClientIP(request),
    });

    return NextResponse.json({ reference, wallet, credits, network });
  } catch (error) {
    console.error('Error processing crypto payment:', error);
    return NextResponse.json({ message: 'Failed to create crypto payment request' }, { status: 500 });
  }
}
