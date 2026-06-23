import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
    }

    const txnRes = await webDB.query(
      `SELECT TransactionID, AccountName, Status, PaymentMethod, TxHash, ChainId, WalletAddress,
              UsdAmount, VerificationAttempts, LastVerificationAt, CreatedAt, CompletedAt, CoinsAwarded
       FROM PaymentTransactions WHERE TransactionID = @transactionId`,
      { transactionId }
    );

    const txn = txnRes.recordset?.[0];
    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Also check blockchain config
    const configRes = await webDB.query(`SELECT * FROM CryptoBlockchainConfig`);
    const configs = configRes.recordset || [];

    return NextResponse.json({ transaction: txn, blockchainConfigs: configs });
  } catch (error: any) {
    console.error('[Debug Crypto Transaction] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
