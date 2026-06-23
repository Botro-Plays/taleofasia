import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { getNetworkByChainId } from '@/lib/blockchain/config';
import { verifyOnChainTransfer } from '@/lib/blockchain/verify';
import { awardCoins } from '@/lib/pricing';
import { parseUnits } from 'viem';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'crypto-verify', 30, 60 * 1000);
  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfter);
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, txHash, chainId } = body;

    if (!transactionId || !txHash || !chainId) {
      return NextResponse.json({ error: 'Missing transactionId, txHash, or chainId' }, { status: 400 });
    }

    // Fetch order (include ChainId so we can trust the DB over the frontend)
    const orderRes = await webDB.query(
      `SELECT TransactionID, AccountName, UsdAmount, Status, CoinsAwarded, WalletAddress, ChainId
       FROM PaymentTransactions WHERE TransactionID = @transactionId AND AccountName = @username`,
      { transactionId, username: session.user.id }
    );
    const order = orderRes.recordset?.[0];
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Already completed?
    if (order.Status === 'completed' && order.CoinsAwarded > 0) {
      return NextResponse.json({ status: 'completed', txHash, awarded: order.CoinsAwarded });
    }
    if (order.Status !== 'pending') {
      return NextResponse.json({ status: 'failed', error: `Order is ${order.Status}` });
    }

    // Idempotently record txHash/ChainId if not already set (don't touch attempts/timestamp yet)
    await webDB.query(
      `UPDATE PaymentTransactions
       SET TxHash = COALESCE(TxHash, @txHash),
           ChainId = COALESCE(ChainId, @chainId)
       WHERE TransactionID = @transactionId`,
      { transactionId, txHash, chainId }
    );

    // Anti-replay: a txHash can only ever belong to ONE transaction
    const replayCheck = await webDB.query(
      `SELECT TransactionID, Status FROM PaymentTransactions
       WHERE TxHash = @txHash AND TransactionID <> @transactionId`,
      { txHash, transactionId }
    );
    if ((replayCheck.recordset || []).length > 0) {
      const replayTxn = replayCheck.recordset[0];
      return NextResponse.json({
        status: 'failed',
        error: `Transaction hash already used for order ${replayTxn.TransactionID} (status: ${replayTxn.Status}).`,
      });
    }

    // Trust DB ChainId over frontend chainId (prevents wrong-network verification loops)
    const effectiveChainId = order.ChainId ? Number(order.ChainId) : Number(chainId);
    if (!effectiveChainId || isNaN(effectiveChainId)) {
      return NextResponse.json({ status: 'failed', error: 'No valid chain ID for this transaction.' });
    }

    // Load network config
    const network = await getNetworkByChainId(effectiveChainId);
    if (!network || !network.isEnabled) {
      return NextResponse.json({ status: 'failed', error: `Network ${effectiveChainId} not supported or disabled.` });
    }

    // Determine expected recipient (stored on order, or fallback to config)
    const expectedWallet = order.WalletAddress;
    if (!expectedWallet) {
      return NextResponse.json({ status: 'failed', error: 'No recipient wallet configured for this order.' });
    }

    // Expected amount in wei
    const usdAmount = Number(order.UsdAmount) || 0;
    const expectedAmountWei = parseUnits(usdAmount.toString(), network.usdtDecimals);

    // On-chain verification
    console.log(`[Crypto Verify] Starting verification for txn=${transactionId} txHash=${txHash} chainId=${chainId} expectedWallet=${expectedWallet} expectedAmountWei=${expectedAmountWei}`);
    let result;
    try {
      result = await verifyOnChainTransfer(
        network,
        txHash,
        expectedWallet,
        expectedAmountWei,
        network.requiredConfirmations
      );
    } catch (rpcError: any) {
      // RPC failure — don't update LastVerificationAt so cron can retry immediately
      console.warn(`[Crypto Verify] RPC failure for txn=${transactionId}: ${rpcError.message}`);
      return NextResponse.json({
        status: 'confirming',
        txHash,
        error: 'Blockchain RPC temporarily unavailable. Retrying…',
      }, { status: 503 });
    }

    // Verification actually ran — now update attempts and timestamp
    await webDB.query(
      `UPDATE PaymentTransactions
       SET VerificationAttempts = ISNULL(VerificationAttempts, 0) + 1,
           LastVerificationAt = GETDATE()
       WHERE TransactionID = @transactionId`,
      { transactionId }
    );

    if (!result.valid) {
      console.log(`[Crypto Verify] Failed for txn=${transactionId}: ${result.error}`);
      return NextResponse.json({
        status: 'confirming',
        txHash,
        error: result.error,
        confirmations: result.confirmations,
      });
    }

    console.log(`[Crypto Verify] Success for txn=${transactionId}: from=${result.from} to=${result.to} value=${result.value} confirmations=${result.confirmations}`);

    // All checks passed — mark completed and award coins
    // Guard against race condition with cron or another polling request
    const completionRes = await webDB.query(
      `UPDATE PaymentTransactions
       SET Status = 'completed', CompletedAt = GETDATE()
       OUTPUT inserted.CoinsAwarded
       WHERE TransactionID = @transactionId AND Status = 'pending'`,
      { transactionId }
    );

    if (!completionRes.recordset || completionRes.recordset.length === 0) {
      // Another caller already completed it
      const check = await webDB.query(
        `SELECT CoinsAwarded FROM PaymentTransactions WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      const existingCoins = check.recordset?.[0]?.CoinsAwarded;
      return NextResponse.json({
        status: 'completed',
        txHash,
        awarded: existingCoins || 0,
        message: 'Transaction was already completed by another process.',
      });
    }

    const award = await awardCoins(order.AccountName, transactionId, usdAmount, 'Crypto');
    if (!award) {
      return NextResponse.json({
        status: 'completed',
        txHash,
        warning: 'Transaction verified but coin award failed. Contact support.',
      });
    }

    return NextResponse.json({
      status: 'completed',
      txHash,
      awarded: award.awarded,
      confirmations: result.confirmations,
    });
  } catch (error) {
    console.error('Error in crypto verify:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
