import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { transactionId, txHash, chainId } = body;

    if (!transactionId || !txHash || !chainId) {
      return NextResponse.json({ error: 'Missing transactionId, txHash, or chainId' }, { status: 400 });
    }

    await webDB.query(
      `UPDATE PaymentTransactions
       SET TxHash = @txHash, ChainId = @chainId
       WHERE TransactionID = @transactionId`,
      { transactionId, txHash, chainId }
    );

    return NextResponse.json({ success: true, message: 'TxHash and ChainId updated', transactionId, txHash, chainId });
  } catch (error: any) {
    console.error('[Debug Crypto Set TxHash] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
