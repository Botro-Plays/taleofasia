import { NextRequest, NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { getEnabledNetworks, getNetworkByChainId } from '@/lib/blockchain/config';
import { verifyOnChainTransfer } from '@/lib/blockchain/verify';
import { awardCoins } from '@/lib/pricing';
import { parseUnits } from 'viem';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === process.env.CRON_SECRET) return true;
  }
  const { searchParams } = new URL(request.url);
  if (searchParams.get('token') === process.env.CRON_SECRET) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Load wallet -> network mapping
    const configRes = await webDB.query(
      `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('crypto_wallet_bep20', 'crypto_wallet_base')`
    );
    const configMap = new Map<string, string>();
    for (const row of configRes.recordset || []) {
      configMap.set(String(row.ConfigKey), String(row.ConfigValue));
    }

    const networks = await getEnabledNetworks();
    const networkByWallet = new Map<string, typeof networks[0]>();
    for (const net of networks) {
      if (net.networkKey === 'bep20') {
        const w = configMap.get('crypto_wallet_bep20');
        if (w) networkByWallet.set(w.toLowerCase(), net);
      }
      if (net.networkKey === 'base') {
        const w = configMap.get('crypto_wallet_base');
        if (w) networkByWallet.set(w.toLowerCase(), net);
      }
    }

    // Find pending crypto transactions with a txHash that haven't been checked recently
    const txns = await webDB.query(`
      SELECT TransactionID, AccountName, UsdAmount, WalletAddress, TxHash, ChainId,
             VerificationAttempts, LastVerificationAt
      FROM PaymentTransactions
      WHERE Status = 'pending'
        AND PaymentMethod = 'Crypto'
        AND TxHash IS NOT NULL
        AND LEN(TxHash) > 0
        AND (LastVerificationAt IS NULL OR LastVerificationAt < DATEADD(minute, -2, GETDATE()))
      ORDER BY CreatedAt ASC
    `);

    const records = txns.recordset || [];
    const results: { transactionId: string; status: string; error?: string; awarded?: number }[] = [];

    for (const txn of records) {
      try {
        const txHash = String(txn.TxHash).trim();
        const wallet = String(txn.WalletAddress || '').trim();
        if (!txHash || !wallet) {
          results.push({ transactionId: txn.TransactionID, status: 'skipped', error: 'Missing txHash or wallet' });
          continue;
        }

        // Look up network by ChainId first (most reliable), fall back to wallet matching
        let network = txn.ChainId ? await getNetworkByChainId(Number(txn.ChainId)) : null;
        if (!network) {
          network = networkByWallet.get(wallet.toLowerCase()) ?? null;
        }
        if (!network) {
          results.push({ transactionId: txn.TransactionID, status: 'skipped', error: `Unknown wallet network. ChainId=${txn.ChainId}, Wallet=${wallet}` });
          continue;
        }

        const usdAmount = Number(txn.UsdAmount) || 0;
        const expectedAmountWei = parseUnits(usdAmount.toString(), network.usdtDecimals);

        console.log(`[Crypto Cron] Verifying txn=${txn.TransactionID} txHash=${txHash} network=${network.networkKey}`);
        const result = await verifyOnChainTransfer(
          network,
          txHash,
          wallet,
          expectedAmountWei,
          network.requiredConfirmations
        );

        if (result.valid) {
          // Mark completed — guard against race with frontend polling
          const completionRes = await webDB.query(
            `UPDATE PaymentTransactions
             SET Status = 'completed', CompletedAt = GETDATE()
             OUTPUT inserted.CoinsAwarded
             WHERE TransactionID = @transactionId AND Status = 'pending'`,
            { transactionId: txn.TransactionID }
          );

          if (!completionRes.recordset || completionRes.recordset.length === 0) {
            // Another process already completed it
            const check = await webDB.query(
              `SELECT CoinsAwarded FROM PaymentTransactions WHERE TransactionID = @transactionId`,
              { transactionId: txn.TransactionID }
            );
            const existingCoins = check.recordset?.[0]?.CoinsAwarded;
            console.log(`[Crypto Cron] Already completed txn=${txn.TransactionID} awarded=${existingCoins || 0}`);
            results.push({ transactionId: txn.TransactionID, status: 'completed', awarded: existingCoins || 0 });
            continue;
          }

          const award = await awardCoins(txn.AccountName, txn.TransactionID, usdAmount, 'Crypto');
          console.log(`[Crypto Cron] Completed txn=${txn.TransactionID} awarded=${award?.awarded || 0}`);
          results.push({ transactionId: txn.TransactionID, status: 'completed', awarded: award?.awarded || 0 });
        } else {
          // Still confirming or failed — update attempt count and timestamp
          await webDB.query(
            `UPDATE PaymentTransactions
             SET VerificationAttempts = ISNULL(VerificationAttempts, 0) + 1,
                 LastVerificationAt = GETDATE()
             WHERE TransactionID = @transactionId`,
            { transactionId: txn.TransactionID }
          );
          console.log(`[Crypto Cron] Confirming txn=${txn.TransactionID}: ${result.error}`);
          results.push({ transactionId: txn.TransactionID, status: 'confirming', error: result.error });
        }
      } catch (innerError: any) {
        console.error(`[Crypto Cron] Error verifying txn=${txn.TransactionID}:`, innerError.message);
        results.push({ transactionId: txn.TransactionID, status: 'error', error: innerError.message });
      }
    }

    return NextResponse.json({
      processed: records.length,
      completed: results.filter((r) => r.status === 'completed').length,
      confirming: results.filter((r) => r.status === 'confirming').length,
      errors: results.filter((r) => r.status === 'error' || r.status === 'skipped').length,
      details: results,
    });
  } catch (error: any) {
    console.error('Crypto verify cron error:', error);
    return NextResponse.json({ error: 'Crypto verify cron failed' }, { status: 500 });
  }
}
