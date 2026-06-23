import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { awardCoins } from '@/lib/pricing';
import { getPaypalConfig, cancelPaypalOrder } from '@/lib/paypal/api';
import { dispatchPaypalAlert } from '@/lib/paypal/alerts';

async function checkAdmin(sessionUser: string) {
  const adminCheck = await userDB.query(
    `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
    { username: sessionUser }
  );
  const user = adminCheck.recordset?.[0];
  if (!user || !(user.GameMasterType === 1 && user.GameMasterLevel >= 3)) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const account = searchParams.get('account');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let where = '1=1';
    const params: Record<string, unknown> = { limit, offset };
    if (status && status !== 'all') { where += ' AND Status = @status'; params.status = status; }
    if (method && method !== 'all') { where += ' AND PaymentMethod = @method'; params.method = method; }
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

    const countRes = await webDB.query(`
      SELECT COUNT(*) as total FROM PaymentTransactions WHERE ${where}
    `, params);

    return NextResponse.json({
      payments: payments.recordset || [],
      total: countRes.recordset?.[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-payment-action', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = session.user.id;
    if (!(await checkAdmin(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { action, transactionId, notes } = body;

    if (!transactionId || !['approve', 'reject', 'refund'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const txnRes = await webDB.query(`
      SELECT TransactionID, AccountName, UsdAmount, Status, CoinsAwarded, PaymentMethod, GatewayTransactionID
      FROM PaymentTransactions WHERE TransactionID = @transactionId
    `, { transactionId });
    const txn = txnRes.recordset?.[0];
    if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    if (action === 'approve') {
      if (txn.Status === 'completed') return NextResponse.json({ error: 'Already completed' }, { status: 400 });
      if (txn.Status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 400 });
      if (txn.Status === 'rejected') return NextResponse.json({ error: 'Already rejected' }, { status: 400 });
      // Auto-award coins if not already awarded
      if (!txn.CoinsAwarded && txn.UsdAmount > 0) {
        await awardCoins(txn.AccountName, txn.TransactionID, txn.UsdAmount, txn.PaymentMethod);
      }
      await webDB.query(`
        UPDATE PaymentTransactions SET Status = 'completed', CompletedAt = GETDATE(), Notes = ISNULL(Notes, '') + ' | Approved by ' + @actor
        WHERE TransactionID = @transactionId
      `, { transactionId, actor });
      await webDB.query(`
        INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
        VALUES (@actor, 'ADMIN_PAYMENT_APPROVE', 'Approved transaction ' + @transactionId + ' for ' + @target, @ip)
      `, { actor, transactionId, target: txn.AccountName, ip });
      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'reject') {
      if (txn.Status === 'rejected') return NextResponse.json({ error: 'Already rejected' }, { status: 400 });
      if (txn.Status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 400 });
      if (txn.Status === 'completed') return NextResponse.json({ error: 'Cannot reject a completed transaction' }, { status: 400 });

      // For PayPal, void the order upstream before marking local transaction rejected
      let paypalVoidResult: Awaited<ReturnType<typeof cancelPaypalOrder>> | null = null;
      if (txn.PaymentMethod === 'PayPal' && txn.GatewayTransactionID) {
        try {
          const paypalConfig = await getPaypalConfig();
          if (paypalConfig.clientId && paypalConfig.secret) {
            paypalVoidResult = await cancelPaypalOrder(txn.GatewayTransactionID, paypalConfig);
          }
        } catch (e: any) {
          console.error(`[Admin Reject] PayPal void failed for txn ${transactionId}:`, e?.message || String(e));
          await dispatchPaypalAlert({
            severity: 'warning',
            title: 'Admin PayPal reject void failed',
            message: `Admin rejected txn ${transactionId} but PayPal void call failed: ${e?.message || 'Unknown'}. Local transaction was still rejected.`,
            source: 'admin-payment-reject',
            context: { transactionId, orderId: txn.GatewayTransactionID, error: e?.message },
            dedupeKey: `admin-reject:void-fail:${transactionId}`,
            ip,
          });
        }
      }

      const paypalNote = paypalVoidResult
        ? ` | PayPal void=${paypalVoidResult.status}${paypalVoidResult.error ? ` (${paypalVoidResult.error})` : ''}`
        : '';

      await webDB.query(`
        UPDATE PaymentTransactions SET Status = 'rejected', Notes = ISNULL(Notes, '') + ' | Rejected by ' + @actor + ': ' + @notes + @paypalNote
        WHERE TransactionID = @transactionId
      `, { transactionId, actor, notes: (notes || '').slice(0, 200), paypalNote: paypalNote.slice(0, 200) });
      await webDB.query(`
        INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
        VALUES (@actor, 'ADMIN_PAYMENT_REJECT', 'Rejected transaction ' + @transactionId + ' for ' + @target + @paypalNote, @ip)
      `, { actor, transactionId, target: txn.AccountName, paypalNote: paypalNote.slice(0, 200), ip });
      return NextResponse.json({ success: true, action: 'rejected', paypalVoid: paypalVoidResult?.status || null });
    }

    if (action === 'refund') {
      if (txn.Status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 400 });
      if (txn.Status === 'rejected') return NextResponse.json({ error: 'Cannot refund a rejected transaction' }, { status: 400 });
      if (txn.Status !== 'completed') return NextResponse.json({ error: 'Only completed transactions can be refunded' }, { status: 400 });
      if (txn.CoinsAwarded && txn.CoinsAwarded > 0) {
        // Check user's current balance before deducting
        const balanceCheck = await userDB.query(`SELECT Coins FROM UserInfo WHERE AccountName = @accountName`, { accountName: txn.AccountName });
        const currentCoins = balanceCheck.recordset?.[0]?.Coins || 0;
        if (currentCoins < txn.CoinsAwarded) {
          return NextResponse.json({ error: `User only has ${currentCoins} coins; cannot deduct ${txn.CoinsAwarded}` }, { status: 400 });
        }
        // Deduct coins
        await userDB.query(`
          UPDATE UserInfo SET Coins = ISNULL(Coins, 0) - @coins WHERE AccountName = @accountName
        `, { coins: txn.CoinsAwarded, accountName: txn.AccountName });
      }
      await webDB.query(`
        UPDATE PaymentTransactions SET Status = 'refunded', Notes = ISNULL(Notes, '') + ' | Refunded by ' + @actor + ': ' + @notes
        WHERE TransactionID = @transactionId
      `, { transactionId, actor, notes: (notes || '').slice(0, 200) });
      await webDB.query(`
        INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
        VALUES (@actor, 'ADMIN_PAYMENT_REFUND', 'Refunded transaction ' + @transactionId + ' for ' + @target + ' (-' + @coins + ' coins)', @ip)
      `, { actor, transactionId, target: txn.AccountName, coins: String(txn.CoinsAwarded || 0), ip });
      return NextResponse.json({ success: true, action: 'refunded' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Admin payment action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
