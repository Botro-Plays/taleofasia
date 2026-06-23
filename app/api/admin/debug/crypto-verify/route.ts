import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';
import { getNetworkByChainId } from '@/lib/blockchain/config';
import { verifyOnChainTransfer } from '@/lib/blockchain/verify';
import { awardCoins } from '@/lib/pricing';
import { parseUnits } from 'viem';

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
    const transactionId = body?.transactionId;

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });
    }

    const txnRes = await webDB.query(
      `SELECT TransactionID, AccountName, Status, PaymentMethod, TxHash, ChainId, WalletAddress, UsdAmount, CoinsAwarded
       FROM PaymentTransactions WHERE TransactionID = @transactionId`,
      { transactionId }
    );

    const txn = txnRes.recordset?.[0];
    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (txn.PaymentMethod !== 'Crypto') {
      return NextResponse.json({ error: `PaymentMethod is ${txn.PaymentMethod}, expected Crypto` }, { status: 400 });
    }

    if (!txn.TxHash || !String(txn.TxHash).trim()) {
      return NextResponse.json({ error: 'Transaction has no TxHash stored' }, { status: 400 });
    }

    if (!txn.WalletAddress || !String(txn.WalletAddress).trim()) {
      return NextResponse.json({ error: 'Transaction has no WalletAddress stored' }, { status: 400 });
    }

    const txHash = String(txn.TxHash).trim();
    const wallet = String(txn.WalletAddress).trim();

    // Look up network by ChainId first (consistent with cron and verify endpoint)
    let network = txn.ChainId ? await getNetworkByChainId(Number(txn.ChainId)) : null;

    // Fall back to wallet-address matching only if ChainId is NULL (backward compat)
    if (!network) {
      const configRes = await webDB.query(
        `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('crypto_wallet_bep20', 'crypto_wallet_base')`
      );
      const configMap = new Map<string, string>();
      for (const row of configRes.recordset || []) {
        configMap.set(String(row.ConfigKey), String(row.ConfigValue));
      }
      const walletLower = wallet.toLowerCase();
      if (walletLower === (configMap.get('crypto_wallet_bep20') || '').toLowerCase()) {
        network = await getNetworkByChainId(56);
      } else if (walletLower === (configMap.get('crypto_wallet_base') || '').toLowerCase()) {
        network = await getNetworkByChainId(8453);
      }
    }

    if (!network) {
      return NextResponse.json({
        error: 'Unknown wallet network',
        debug: {
          wallet,
          chainId: txn.ChainId,
        },
      }, { status: 400 });
    }

    const usdAmount = Number(txn.UsdAmount) || 0;
    const expectedAmountWei = parseUnits(usdAmount.toString(), network.usdtDecimals);

    console.log(`[Debug Crypto Verify] Forcing verify for txn=${transactionId} txHash=${txHash} network=${network.networkKey}`);
    const result = await verifyOnChainTransfer(
      network,
      txHash,
      wallet,
      expectedAmountWei,
      network.requiredConfirmations
    );

    if (result.valid) {
      await webDB.query(
        `UPDATE PaymentTransactions
         SET Status = 'completed', CompletedAt = GETDATE()
         WHERE TransactionID = @transactionId AND Status = 'pending'`,
        { transactionId }
      );
      const award = await awardCoins(txn.AccountName, transactionId, usdAmount, 'Crypto');
      return NextResponse.json({
        status: 'completed',
        awarded: award?.awarded || 0,
        verification: result,
        debug: {
          wallet,
          networkKey: network.networkKey,
          chainId: network.chainId,
          rpcUrl: network.rpcUrl,
          usdtContract: network.usdtContract,
        },
      });
    } else {
      // Still update attempts and timestamp even for confirming
      await webDB.query(
        `UPDATE PaymentTransactions SET VerificationAttempts = ISNULL(VerificationAttempts, 0) + 1, LastVerificationAt = GETDATE() WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      return NextResponse.json({
        status: 'confirming',
        error: result.error,
        confirmations: result.confirmations,
        verification: result,
        debug: {
          wallet,
          networkKey: network.networkKey,
          chainId: network.chainId,
          rpcUrl: network.rpcUrl,
          usdtContract: network.usdtContract,
          expectedAmountWei: expectedAmountWei.toString(),
        },
      });
    }
  } catch (error: any) {
    console.error('[Debug Crypto Verify] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
