import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'register-txhash', 20, 60 * 1000);
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

    const orderRes = await webDB.query(
      `SELECT TransactionID, Status, AccountName, TxHash, ChainId FROM PaymentTransactions
       WHERE TransactionID = @transactionId AND AccountName = @username`,
      { transactionId, username: session.user.id }
    );

    const order = orderRes.recordset?.[0];
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.Status !== 'pending') {
      return NextResponse.json({ error: `Order is ${order.Status}` }, { status: 400 });
    }

    // Anti-replay: block if this txHash is already used on ANY other transaction
    const replayCheck = await webDB.query(
      `SELECT TransactionID FROM PaymentTransactions
       WHERE TxHash = @txHash AND TransactionID <> @transactionId`,
      { txHash, transactionId }
    );
    if ((replayCheck.recordset || []).length > 0) {
      return NextResponse.json({ error: 'Transaction hash already registered for another order.' }, { status: 409 });
    }

    // Idempotent: only write if not already set
    await webDB.query(
      `UPDATE PaymentTransactions
       SET TxHash = COALESCE(TxHash, @txHash),
           ChainId = COALESCE(ChainId, @chainId)
       WHERE TransactionID = @transactionId`,
      { transactionId, txHash, chainId }
    );

    return NextResponse.json({ success: true, transactionId, txHash, chainId });
  } catch (error: any) {
    console.error('[Crypto Register TxHash] Error:', error);
    return NextResponse.json({ error: 'Failed to register transaction hash' }, { status: 500 });
  }
}
