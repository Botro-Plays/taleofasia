import { NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const data = await cached('public_config_v1', 10 * 60 * 1000, async () => {
      const tableCheck = await webDB.query(
        `SELECT 1 AS HasTable FROM sys.tables WHERE name = N'WebsiteConfigs'`
      );
      const hasTable = !!tableCheck.recordset?.length;
      if (!hasTable) {
        return { social: {} };
      }

      const res = await webDB.query(
        `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs`
      );

      const rows = res.recordset || [];
      let discord = '';
      let facebook = '';
      let recaptchaEnabled = 'false';
      let recaptchaSiteKey = '';
      let recaptchaVersion = 'v2';
      let voteSiteId = '';
      let voteRewardCoins = '5';
      let voteCooldownHours = '12';
      let voteTestingMode = 'false';
      const payments: Record<string, string> = {};
      for (const row of rows) {
        const key = String(row.ConfigKey || '').toLowerCase();
        const val = String(row.ConfigValue || '');
        if (!discord && key.includes('discord')) discord = val;
        if (!facebook && key.includes('facebook')) facebook = val;
        if (key === 'recaptcha_enabled') recaptchaEnabled = val;
        if (key === 'recaptcha_site_key') recaptchaSiteKey = val;
        if (key === 'recaptcha_version') recaptchaVersion = val;
        if (key === 'xtremetop100_site_id') voteSiteId = val;
        if (key === 'vote_reward_coins') voteRewardCoins = val;
        if (key === 'vote_reward_cooldown_hours') voteCooldownHours = val;
        if (key === 'vote_testing_mode') voteTestingMode = val;
        // Expose payment-related config (no secrets)
        if (key.startsWith('payment_') || key.startsWith('crypto_') || key.startsWith('coin_') || key.startsWith('bonus_') || key.startsWith('paypal_min') || key.startsWith('paymongo_min') || key === 'paymongo_public_key' || key === 'paypal_client_id' || key === 'paypal_sandbox') {
          payments[key] = val;
        }
      }

      // Fetch active packages
      let packages: { packageId: number; usdAmount: number; label: string; sortOrder: number }[] = [];
      try {
        const pkgRes = await webDB.query(
          `SELECT PackageID, UsdAmount, Label, SortOrder FROM PaymentPackages WHERE IsActive = 1 ORDER BY SortOrder, UsdAmount`
        );
        packages = (pkgRes.recordset || []).map((r: any) => ({
          packageId: r.PackageID,
          usdAmount: parseFloat(r.UsdAmount) || 0,
          label: r.Label || '',
          sortOrder: r.SortOrder || 0,
        }));
      } catch {
        // Table may not exist yet
      }

      // Fetch bonus tiers from PaymentBonusTiers table
      let bonusTiers: { tierNumber: number; threshold: number; rate: number }[] = [];
      try {
        const tierRes = await webDB.query(
          `SELECT TierNumber, Threshold, Rate FROM PaymentBonusTiers WHERE IsActive = 1 ORDER BY TierNumber`
        );
        bonusTiers = (tierRes.recordset || []).map((r: any) => ({
          tierNumber: r.TierNumber,
          threshold: parseFloat(r.Threshold) || 0,
          rate: r.Rate || 0,
        }));
      } catch {
        // Table may not exist yet — fallback to flat fields below
      }

      // Build flat fields from bonusTiers if available, otherwise from WebsiteConfigs
      const t1 = bonusTiers.find(t => t.tierNumber === 1);
      const t2 = bonusTiers.find(t => t.tierNumber === 2);
      const t3 = bonusTiers.find(t => t.tierNumber === 3);

      return {
        social: { discord, facebook },
        recaptcha: {
          enabled: recaptchaEnabled === 'true',
          version: recaptchaVersion as 'v2' | 'v3',
          siteKey: recaptchaSiteKey,
        },
        voting: {
          siteId: voteSiteId,
          rewardCoins: parseInt(voteRewardCoins || '5', 10) || 5,
          cooldownHours: parseInt(voteCooldownHours || '12', 10) || 12,
          postbackUrl: 'https://taleofasia.com/api/voting/postback',
          testingMode: voteTestingMode === 'true',
        },
        payments: {
          gcashEnabled: payments.payment_gcash_enabled === 'true',
          paymongoEnabled: payments.payment_paymongo_enabled === 'true',
          paypalEnabled: payments.payment_paypal_enabled === 'true',
          cryptoEnabled: payments.payment_crypto_enabled === 'true',
          paymongoPublicKey: payments.paymongo_public_key || '',
          paypalClientId: payments.paypal_client_id || '',
          paypalSandbox: payments.paypal_sandbox === 'true',
          cryptoWalletBep20: payments.crypto_wallet_bep20 || '',
          cryptoWalletBase: payments.crypto_wallet_base || '',
          cryptoMinUsd: parseInt(payments.crypto_min_usd || '5', 10) || 5,
          coinBaseRate: parseInt(payments.coin_base_rate || '120', 10) || 120,
          bonusTiers,
          bonusTier1Threshold: t1 ? t1.threshold : (parseInt(payments.bonus_tier_1_threshold || '10', 10) || 10),
          bonusTier1Rate: t1 ? t1.rate : (parseInt(payments.bonus_tier_1_rate || '130', 10) || 130),
          bonusTier2Threshold: t2 ? t2.threshold : (parseInt(payments.bonus_tier_2_threshold || '25', 10) || 25),
          bonusTier2Rate: t2 ? t2.rate : (parseInt(payments.bonus_tier_2_rate || '140', 10) || 140),
          bonusTier3Threshold: t3 ? t3.threshold : (parseInt(payments.bonus_tier_3_threshold || '50', 10) || 50),
          bonusTier3Rate: t3 ? t3.rate : (parseInt(payments.bonus_tier_3_rate || '150', 10) || 150),
          paymentMinUsd: parseFloat(payments.payment_min_usd || '1') || 1,
          paymongoMinPhp: parseFloat(payments.paymongo_min_php || '1') || 1,
          paypalMinUsd: parseFloat(payments.paypal_min_usd || payments.payment_min_usd || '1') || 1,
          coinRatePaymongo: parseInt(payments.coin_rate_paymongo || payments.coin_base_rate || '120', 10) || 120,
          coinRatePaypal: parseInt(payments.coin_rate_paypal || payments.coin_base_rate || '120', 10) || 120,
          coinRateCrypto: parseInt(payments.coin_rate_crypto || payments.coin_base_rate || '120', 10) || 120,
          coinRateGcash: parseInt(payments.coin_rate_gcash || payments.coin_base_rate || '120', 10) || 120,
          packages,
        },
      };
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ social: {} });
  }
}
