import { webDB, userDB } from '@/lib/db';

export type PaymentMethodKey = 'PayMongo' | 'PayPal' | 'Crypto' | 'GCash';

interface PricingConfig {
  baseRate: number;
  tier1Threshold: number;
  tier1Rate: number;
  tier2Threshold: number;
  tier2Rate: number;
  tier3Threshold: number;
  tier3Rate: number;
  minUsd: number;
  paymongoMinPhp: number;
  paypalMinUsd: number;
  cryptoMinUsd: number;
  methodRates: Record<string, number>;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const res = await webDB.query(`
    SELECT ConfigKey, ConfigValue FROM WebsiteConfigs
    WHERE ConfigKey IN ('coin_base_rate', 'bonus_tier_1_threshold', 'bonus_tier_1_rate',
                        'bonus_tier_2_threshold', 'bonus_tier_2_rate',
                        'bonus_tier_3_threshold', 'bonus_tier_3_rate', 'payment_min_usd',
                        'paymongo_min_php', 'paypal_min_usd', 'crypto_min_usd',
                        'coin_rate_paymongo', 'coin_rate_paypal', 'coin_rate_crypto', 'coin_rate_gcash')
  `);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  const baseRate = parseInt(map.get('coin_base_rate') || '120', 10) || 120;
  return {
    baseRate,
    tier1Threshold: parseInt(map.get('bonus_tier_1_threshold') || '10', 10) || 10,
    tier1Rate: parseInt(map.get('bonus_tier_1_rate') || '130', 10) || 130,
    tier2Threshold: parseInt(map.get('bonus_tier_2_threshold') || '25', 10) || 25,
    tier2Rate: parseInt(map.get('bonus_tier_2_rate') || '140', 10) || 140,
    tier3Threshold: parseInt(map.get('bonus_tier_3_threshold') || '50', 10) || 50,
    tier3Rate: parseInt(map.get('bonus_tier_3_rate') || '150', 10) || 150,
    minUsd: parseFloat(map.get('payment_min_usd') || '1') || 1,
    paymongoMinPhp: parseFloat(map.get('paymongo_min_php') || '1') || 1,
    paypalMinUsd: parseFloat(map.get('paypal_min_usd') || '1') || 1,
    cryptoMinUsd: parseFloat(map.get('crypto_min_usd') || '5') || 5,
    methodRates: {
      PayMongo: parseInt(map.get('coin_rate_paymongo') || String(baseRate), 10) || baseRate,
      PayPal: parseInt(map.get('coin_rate_paypal') || String(baseRate), 10) || baseRate,
      Crypto: parseInt(map.get('coin_rate_crypto') || String(baseRate), 10) || baseRate,
      GCash: parseInt(map.get('coin_rate_gcash') || String(baseRate), 10) || baseRate,
    },
  };
}

export function calculateCoins(
  usdAmount: number,
  config: PricingConfig,
  paymentMethod?: PaymentMethodKey
): { baseCoins: number; bonusCoins: number; totalCoins: number; rate: number } {
  if (usdAmount < 0 || !Number.isFinite(usdAmount)) {
    return { baseCoins: 0, bonusCoins: 0, totalCoins: 0, rate: config.baseRate };
  }

  const methodBaseRate = paymentMethod && config.methodRates[paymentMethod] ? config.methodRates[paymentMethod] : config.baseRate;

  let rate = methodBaseRate;
  if (usdAmount >= config.tier3Threshold) {
    rate = config.tier3Rate;
  } else if (usdAmount >= config.tier2Threshold) {
    rate = config.tier2Rate;
  } else if (usdAmount >= config.tier1Threshold) {
    rate = config.tier1Rate;
  }

  const totalCoins = Math.floor(usdAmount * rate);
  const baseCoins = Math.floor(usdAmount * methodBaseRate);
  const bonusCoins = totalCoins - baseCoins;

  return { baseCoins, bonusCoins, totalCoins, rate };
}

export async function validatePaymentAmount(
  usdAmount: number,
  config?: PricingConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = config ?? (await getPricingConfig());
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return { ok: false, error: 'Invalid amount' };
  }
  if (usdAmount < cfg.minUsd) {
    return { ok: false, error: `Minimum amount is $${cfg.minUsd.toFixed(2)} USD` };
  }
  return { ok: true };
}

export async function awardCoins(accountName: string, transactionId: string, usdAmount: number, paymentMethod?: PaymentMethodKey): Promise<{ awarded: number } | null> {
  try {
    const config = await getPricingConfig();
    const { totalCoins, rate } = calculateCoins(usdAmount, config, paymentMethod);

    // Atomically update PaymentTransactions only if CoinsAwarded is NULL/0.
    // This single UPDATE acts as the guard — concurrent calls will race,
    // but only one will update the row, preventing double-awards.
    const guardRes = await webDB.query(
      `UPDATE PaymentTransactions
       SET CoinsAwarded = @totalCoins,
           BonusRate = @rate,
           CompletedAt = COALESCE(CompletedAt, GETDATE())
       OUTPUT inserted.CoinsAwarded
       WHERE TransactionID = @transactionId AND (CoinsAwarded IS NULL OR CoinsAwarded = 0)`,
      { transactionId, totalCoins, rate }
    );

    const updatedCoins = guardRes.recordset?.[0]?.CoinsAwarded;
    if (!updatedCoins || updatedCoins <= 0) {
      // Row was already awarded by another concurrent call (or update failed)
      const check = await webDB.query(
        `SELECT CoinsAwarded FROM PaymentTransactions WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      const existing = check.recordset?.[0]?.CoinsAwarded;
      if (existing && existing > 0) return { awarded: existing };
      return null;
    }

    try {
      // Only award coins to UserInfo if the PaymentTransactions guard succeeded.
      // UserInfo lives in UserDB, so we must use userDB (cross-DB transaction not possible).
      await userDB.query(
        `UPDATE UserInfo SET Coins = ISNULL(Coins, 0) + @totalCoins WHERE AccountName = @accountName`,
        { accountName, totalCoins }
      );

      return { awarded: totalCoins };
    } catch (userErr: any) {
      console.error('awardCoins userDB update error:', userErr);

      // Roll back the PaymentTransactions guard so recovery cron can retry safely.
      try {
        await webDB.query(
          `UPDATE PaymentTransactions
           SET CoinsAwarded = 0, BonusRate = NULL
           WHERE TransactionID = @transactionId AND CoinsAwarded = @totalCoins`,
          { transactionId, totalCoins }
        );
      } catch (rollbackErr) {
        console.error('awardCoins rollback error:', rollbackErr);
      }

      return null;
    }
  } catch (err) {
    console.error('awardCoins error:', err);
    return null;
  }
}
