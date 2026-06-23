import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { convertUsdToLocal } from '@/lib/currency';
import { invalidate } from '@/lib/cache';

async function checkAdmin(sessionUser: string) {
  const priv = await checkAdminPrivileges(sessionUser);
  return priv.isAdmin;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'packages';

    if (type === 'packages') {
      const res = await webDB.query(
        `SELECT PackageID, UsdAmount, Label, SortOrder, IsActive FROM PaymentPackages ORDER BY SortOrder, UsdAmount`
      );
      return NextResponse.json({ packages: res.recordset || [] });
    }

    if (type === 'pricing') {
      const res = await webDB.query(
        `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('coin_base_rate','bonus_tier_1_threshold','bonus_tier_1_rate','bonus_tier_2_threshold','bonus_tier_2_rate','bonus_tier_3_threshold','bonus_tier_3_rate','payment_min_usd','paymongo_min_php','paypal_min_usd','crypto_min_usd','coin_rate_paymongo','coin_rate_paypal','coin_rate_crypto','coin_rate_gcash','payment_gcash_enabled','payment_paymongo_enabled','payment_paypal_enabled','payment_crypto_enabled')`
      );
      const map = new Map((res.recordset || []).map((r: any) => [r.ConfigKey, r.ConfigValue]));
      const baseRate = parseInt(map.get('coin_base_rate') || '120', 10) || 120;

      // Fetch bonus tiers from PaymentBonusTiers table
      let bonusTiers: { tierId: number; tierNumber: number; threshold: number; rate: number; isActive: boolean }[] = [];
      try {
        const tierRes = await webDB.query(
          `SELECT TierID, TierNumber, Threshold, Rate, IsActive FROM PaymentBonusTiers ORDER BY TierNumber`
        );
        bonusTiers = (tierRes.recordset || []).map((r: any) => ({
          tierId: r.TierID,
          tierNumber: r.TierNumber,
          threshold: parseFloat(r.Threshold) || 0,
          rate: r.Rate || 0,
          isActive: !!r.IsActive,
        }));
      } catch {
        // Table may not exist yet
      }

      return NextResponse.json({
        coinBaseRate: baseRate,
        bonusTiers,
        bonusTier1Threshold: parseInt(map.get('bonus_tier_1_threshold') || '10', 10) || 10,
        bonusTier1Rate: parseInt(map.get('bonus_tier_1_rate') || '130', 10) || 130,
        bonusTier2Threshold: parseInt(map.get('bonus_tier_2_threshold') || '25', 10) || 25,
        bonusTier2Rate: parseInt(map.get('bonus_tier_2_rate') || '140', 10) || 140,
        bonusTier3Threshold: parseInt(map.get('bonus_tier_3_threshold') || '50', 10) || 50,
        bonusTier3Rate: parseInt(map.get('bonus_tier_3_rate') || '150', 10) || 150,
        paymentMinUsd: parseFloat(map.get('payment_min_usd') || '1') || 1,
        paymongoMinPhp: parseFloat(map.get('paymongo_min_php') || '1') || 1,
        paypalMinUsd: parseFloat(map.get('paypal_min_usd') || '1') || 1,
        cryptoMinUsd: parseFloat(map.get('crypto_min_usd') || '5') || 5,
        coinRatePaymongo: parseInt(map.get('coin_rate_paymongo') || String(baseRate), 10) || baseRate,
        coinRatePaypal: parseInt(map.get('coin_rate_paypal') || String(baseRate), 10) || baseRate,
        coinRateCrypto: parseInt(map.get('coin_rate_crypto') || String(baseRate), 10) || baseRate,
        coinRateGcash: parseInt(map.get('coin_rate_gcash') || String(baseRate), 10) || baseRate,
        gcashEnabled: map.get('payment_gcash_enabled') === 'true',
        paymongoEnabled: map.get('payment_paymongo_enabled') === 'true',
        paypalEnabled: map.get('payment_paypal_enabled') === 'true',
        cryptoEnabled: map.get('payment_crypto_enabled') === 'true',
      });
    }

    if (type === 'transactions') {
      const status = searchParams.get('status');
      const account = searchParams.get('account');
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      let where = '1=1';
      const params: Record<string, unknown> = { limit, offset };
      if (status && status !== 'all') { where += ' AND Status = @status'; params.status = status; }
      if (account) { where += ' AND AccountName LIKE @account'; params.account = `%${account}%`; }

      const payments = await webDB.query(`
        SELECT TransactionID, AccountName, Amount, Currency, UsdAmount, LocalCurrency, LocalAmount,
               PaymentMethod, Status, GatewayTransactionID, CoinsAwarded, BonusRate,
               ExpiresAt, Notes, IPAddress, CountryCode, CreatedAt, CompletedAt
        FROM PaymentTransactions
        WHERE ${where}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params);

      const countRes = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE ${where}`, params);

      return NextResponse.json({
        payments: payments.recordset || [],
        total: countRes.recordset?.[0]?.total || 0,
      });
    }

    if (type === 'stats') {
      const totalTxn = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions`);
      const completedTxn = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE Status = 'completed'`);
      const pendingTxn = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE Status = 'pending'`);
      const cancelledTxn = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE Status = 'cancelled'`);
      const refundedTxn = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE Status = 'refunded'`);
      const revenue = await webDB.query(`SELECT ISNULL(SUM(UsdAmount), 0) as total FROM PaymentTransactions WHERE Status = 'completed'`);
      const totalCoins = await webDB.query(`SELECT ISNULL(SUM(CoinsAwarded), 0) as total FROM PaymentTransactions WHERE Status = 'completed'`);
      const auditCount = await webDB.query(`SELECT COUNT(*) as total FROM WebAuditLogs WHERE Action LIKE 'ADMIN_PAYMENT_%'`);

      const totalRevenue = parseFloat(revenue.recordset?.[0]?.total || 0);
      let totalRevenuePhp = 0;
      try {
        const phpConv = await convertUsdToLocal(totalRevenue, 'PHP');
        totalRevenuePhp = phpConv.localAmount;
      } catch {
        totalRevenuePhp = totalRevenue * 56; // rough fallback
      }

      return NextResponse.json({
        totalTransactions: totalTxn.recordset?.[0]?.total || 0,
        completed: completedTxn.recordset?.[0]?.total || 0,
        pending: pendingTxn.recordset?.[0]?.total || 0,
        cancelled: cancelledTxn.recordset?.[0]?.total || 0,
        refunded: refundedTxn.recordset?.[0]?.total || 0,
        totalRevenue,
        netRevenue: totalRevenue, // TODO: subtract PayPal fees once fee tracking is implemented
        totalRevenuePhp,
        totalCoinsAwarded: totalCoins.recordset?.[0]?.total || 0,
        adminActions: auditCount.recordset?.[0]?.total || 0,
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Finances GET error:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-finances', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = session.user.id;
    if (!(await checkAdmin(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { action } = body;

    // Package CRUD
    if (action === 'create-package') {
      const { usdAmount, label, sortOrder } = body;
      if (!usdAmount || usdAmount <= 0) return NextResponse.json({ error: 'Valid USD amount required' }, { status: 400 });
      await webDB.query(
        `INSERT INTO PaymentPackages (UsdAmount, Label, SortOrder, IsActive) VALUES (@usdAmount, @label, @sortOrder, 1)`,
        { usdAmount, label: label || '', sortOrder: sortOrder || 0 }
      );
      invalidate('public_config_v1');
      return NextResponse.json({ success: true });
    }

    if (action === 'update-package') {
      const { packageId, usdAmount, label, sortOrder, isActive } = body;
      if (!packageId) return NextResponse.json({ error: 'Package ID required' }, { status: 400 });
      await webDB.query(
        `UPDATE PaymentPackages SET UsdAmount = @usdAmount, Label = @label, SortOrder = @sortOrder, IsActive = @isActive WHERE PackageID = @packageId`,
        { packageId, usdAmount, label: label || '', sortOrder: sortOrder || 0, isActive: isActive ? 1 : 0 }
      );
      invalidate('public_config_v1');
      return NextResponse.json({ success: true });
    }

    if (action === 'delete-package') {
      const { packageId } = body;
      if (!packageId) return NextResponse.json({ error: 'Package ID required' }, { status: 400 });
      await webDB.query(`DELETE FROM PaymentPackages WHERE PackageID = @packageId`, { packageId });
      invalidate('public_config_v1');
      return NextResponse.json({ success: true });
    }

    // Bonus Tier CRUD
    if (action === 'create-tier') {
      const { tierNumber, threshold, rate } = body;
      if (tierNumber == null || tierNumber < 1) return NextResponse.json({ error: 'Valid tier number required' }, { status: 400 });
      if (threshold == null || threshold < 0) return NextResponse.json({ error: 'Valid threshold required' }, { status: 400 });
      if (!rate || rate < 1) return NextResponse.json({ error: 'Valid rate required' }, { status: 400 });
      try {
        await webDB.query(
          `INSERT INTO PaymentBonusTiers (TierNumber, Threshold, Rate, IsActive) VALUES (@tierNumber, @threshold, @rate, 1)`,
          { tierNumber, threshold, rate }
        );
        invalidate('public_config_v1');
        return NextResponse.json({ success: true });
      } catch (err: any) {
        if (String(err?.message || '').includes('UQ_BonusTierNumber')) {
          return NextResponse.json({ error: 'Tier number already exists' }, { status: 400 });
        }
        throw err;
      }
    }

    if (action === 'update-tier') {
      const { tierId, tierNumber, threshold, rate, isActive } = body;
      if (!tierId) return NextResponse.json({ error: 'Tier ID required' }, { status: 400 });
      if (tierNumber == null || tierNumber < 1) return NextResponse.json({ error: 'Valid tier number required' }, { status: 400 });
      if (threshold == null || threshold < 0) return NextResponse.json({ error: 'Valid threshold required' }, { status: 400 });
      if (!rate || rate < 1) return NextResponse.json({ error: 'Valid rate required' }, { status: 400 });
      try {
        await webDB.query(
          `UPDATE PaymentBonusTiers SET TierNumber = @tierNumber, Threshold = @threshold, Rate = @rate, IsActive = @isActive WHERE TierID = @tierId`,
          { tierId, tierNumber, threshold, rate, isActive: isActive ? 1 : 0 }
        );
        invalidate('public_config_v1');
        return NextResponse.json({ success: true });
      } catch (err: any) {
        if (String(err?.message || '').includes('UQ_BonusTierNumber')) {
          return NextResponse.json({ error: 'Tier number already exists' }, { status: 400 });
        }
        throw err;
      }
    }

    if (action === 'delete-tier') {
      const { tierId } = body;
      if (!tierId) return NextResponse.json({ error: 'Tier ID required' }, { status: 400 });
      await webDB.query(`DELETE FROM PaymentBonusTiers WHERE TierID = @tierId`, { tierId });
      invalidate('public_config_v1');
      return NextResponse.json({ success: true });
    }

    // Pricing config update
    if (action === 'update-pricing') {
      const updates = body.updates as Record<string, string | number>;
      if (!updates || Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
      for (const [key, value] of Object.entries(updates)) {
        await webDB.query(
          `UPDATE WebsiteConfigs SET ConfigValue = @value, LastUpdated = GETDATE() WHERE ConfigKey = @key;
           IF @@ROWCOUNT = 0 INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, LastUpdated) VALUES (@key, @value, GETDATE())`,
          { key, value: String(value) }
        );
      }
      invalidate('public_config_v1');
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress) VALUES (@actor, 'ADMIN_PRICING_UPDATE', 'Updated pricing config by ' + @actor, @ip)`,
        { actor, ip }
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'cancel-transaction') {
      const { transactionId } = body;
      if (!transactionId) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

      // Fetch transaction details
      const txnRes = await webDB.query(
        `SELECT TransactionID, AccountName, PaymentMethod, Status, GatewayTransactionID, ExpiresAt
         FROM PaymentTransactions WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      const txn = txnRes.recordset?.[0];
      if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      if (txn.Status !== 'pending') return NextResponse.json({ error: 'Only pending transactions can be cancelled' }, { status: 400 });

      // Attempt PayPal cancellation if applicable
      if (txn.PaymentMethod === 'PayPal' && txn.GatewayTransactionID) {
        try {
          const paypalCfg = await webDB.query(
            `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id','paypal_secret','paypal_sandbox')`
          );
          const paypalMap = new Map((paypalCfg.recordset || []).map((r: any) => [r.ConfigKey, r.ConfigValue]));
          const clientId = paypalMap.get('paypal_client_id') || '';
          const secret = paypalMap.get('paypal_secret') || '';
          const sandbox = paypalMap.get('paypal_sandbox') === 'true';
          const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

          if (clientId && secret) {
            const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'grant_type=client_credentials',
            });
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              // Try to void/cancel the order
              await fetch(`${baseUrl}/v2/checkout/orders/${txn.GatewayTransactionID}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch (paypalErr) {
          console.error('PayPal cancel attempt failed:', paypalErr);
        }
      }

      // For PayMongo: archive the link first so the user can't still pay it
      if (txn.PaymentMethod === 'PayMongo' && txn.GatewayTransactionID) {
        try {
          const paymongoCfg = await webDB.query(
            `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paymongo_secret_key', 'payment_paymongo_enabled')`
          );
          const paymongoMap = new Map((paymongoCfg.recordset || []).map((r: any) => [r.ConfigKey, r.ConfigValue]));
          const secretKey = paymongoMap.get('paymongo_secret_key') || '';
          if (secretKey) {
            const linkId = txn.GatewayTransactionID;
            const candidates = [linkId];
            if (linkId.startsWith('link_')) candidates.push(linkId.replace('link_', ''));
            else candidates.push('link_' + linkId);

            let archived = false;
            for (const candidate of candidates) {
              for (const ep of ['links', 'payment_links']) {
                const url = `https://api.paymongo.com/v1/${ep}/${candidate}/archive`;
                const archiveRes = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json',
                  },
                });
                if (archiveRes.ok || archiveRes.status === 404) {
                  archived = true;
                  break;
                }
              }
              if (archived) break;
            }
            if (archived) {
              await webDB.query(
                `UPDATE PaymentTransactions SET Notes = ISNULL(Notes, '') + ' | archived=true' WHERE TransactionID = @transactionId`,
                { transactionId }
              );
            }
          }
        } catch (archiveErr) {
          console.error('PayMongo archive during cancel failed:', archiveErr);
        }
      }

      await webDB.query(
        `UPDATE PaymentTransactions SET Status = 'cancelled', Notes = ISNULL(Notes, '') + ' | Admin cancelled by ' + @actor + ' at ' + CONVERT(VARCHAR, GETDATE(), 120) WHERE TransactionID = @transactionId`,
        { transactionId, actor }
      );

      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_PAYMENT_CANCEL', 'Cancelled transaction ' + @transactionId + ' for user ' + @targetUser, @ip)`,
        { actor, transactionId, targetUser: txn.AccountName, ip }
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'delete-transaction') {
      const { transactionId } = body;
      if (!transactionId) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
      const actorPriv = await checkAdminPrivileges(actor);
      if (!actorPriv.isSuperAdmin) return NextResponse.json({ error: 'Only super admin can delete transactions' }, { status: 403 });

      const txnRes = await webDB.query(
        `SELECT TransactionID, AccountName, PaymentMethod, Status, GatewayTransactionID, Notes FROM PaymentTransactions WHERE TransactionID = @transactionId`,
        { transactionId }
      );
      const txn = txnRes.recordset?.[0];
      if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

      // If PayMongo with a link ID, archive it first before deleting
      if (txn.PaymentMethod === 'PayMongo' && txn.GatewayTransactionID) {
        try {
          const paymongoCfg = await webDB.query(
            `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paymongo_secret_key', 'payment_paymongo_enabled')`
          );
          const paymongoMap = new Map((paymongoCfg.recordset || []).map((r: any) => [r.ConfigKey, r.ConfigValue]));
          const secretKey = paymongoMap.get('paymongo_secret_key') || '';
          if (secretKey) {
            const linkId = txn.GatewayTransactionID;
            const candidates = [linkId];
            if (linkId.startsWith('link_')) candidates.push(linkId.replace('link_', ''));
            else candidates.push('link_' + linkId);

            let archived = false;
            for (const candidate of candidates) {
              for (const ep of ['links', 'payment_links']) {
                const url = `https://api.paymongo.com/v1/${ep}/${candidate}/archive`;
                const archiveRes = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json',
                  },
                });
                if (archiveRes.ok || archiveRes.status === 404) {
                  archived = true;
                  break;
                }
              }
              if (archived) break;
            }
            if (archived) {
              await webDB.query(
                `UPDATE PaymentTransactions SET Notes = ISNULL(Notes, '') + ' | archived=true' WHERE TransactionID = @transactionId`,
                { transactionId }
              );
            }
          }
        } catch (archiveErr) {
          console.error('PayMongo archive before delete failed:', archiveErr);
          // Continue with deletion even if archive fails
        }
      }

      await webDB.query(`DELETE FROM PaymentTransactions WHERE TransactionID = @transactionId`, { transactionId });
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_PAYMENT_DELETE', 'Deleted transaction ' + @transactionId + ' for user ' + @targetUser, @ip)`,
        { actor, transactionId, targetUser: txn.AccountName, ip }
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'delete-all-cancelled') {
      const actorPriv = await checkAdminPrivileges(actor);
      if (!actorPriv.isSuperAdmin) return NextResponse.json({ error: 'Only super admin can bulk delete transactions' }, { status: 403 });

      const beforeRes = await webDB.query(`SELECT COUNT(*) as total FROM PaymentTransactions WHERE Status = 'cancelled'`);
      const beforeCount = Number(beforeRes.recordset?.[0]?.total || 0);

      if (beforeCount > 0) {
        await webDB.query(`DELETE FROM PaymentTransactions WHERE Status = 'cancelled'`);
      }

      const details = `Deleted all ${beforeCount} cancelled transactions`;
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_PAYMENT_BULK_DELETE', @details, @ip)`,
        { actor, details, ip }
      );
      return NextResponse.json({ success: true, deleted: beforeCount });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Finances POST error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
