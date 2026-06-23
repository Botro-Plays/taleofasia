import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isAdmin && !priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pendingRes = await webDB.query(`
      SELECT
        SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) AS totalPending,
        SUM(CASE WHEN Status = 'pending' AND CreatedAt <= DATEADD(minute, -10, GETDATE()) THEN 1 ELSE 0 END) AS stale10,
        SUM(CASE WHEN Status = 'pending' AND CreatedAt <= DATEADD(minute, -30, GETDATE()) THEN 1 ELSE 0 END) AS stale30
      FROM PaymentTransactions
      WHERE PaymentMethod = 'PayMongo'
    `);

    const throughputRes = await webDB.query(`
      SELECT
        SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) AS completed24h,
        SUM(CASE WHEN Status = 'failed' THEN 1 ELSE 0 END) AS failed24h,
        SUM(CASE WHEN Status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled24h
      FROM PaymentTransactions
      WHERE PaymentMethod = 'PayMongo'
        AND CreatedAt >= DATEADD(hour, -24, GETDATE())
    `);

    const reconcileRes = await webDB.query(`
      SELECT
        SUM(CASE WHEN Details LIKE '%status=completed%' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN Details LIKE '%error=%' THEN 1 ELSE 0 END) AS errors
      FROM WebAuditLogs
      WHERE Action = 'PAYMONGO_RECONCILE'
        AND Timestamp >= DATEADD(hour, -24, GETDATE())
    `);

    const webhookRes = await webDB.query(`
      SELECT
        SUM(CASE WHEN Details LIKE '%status=failed%' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN Details LIKE '%Invalid signature%' THEN 1 ELSE 0 END) AS signatureErrors,
        COUNT(1) AS total
      FROM WebAuditLogs
      WHERE Action = 'WEBHOOK'
        AND Timestamp >= DATEADD(hour, -24, GETDATE())
    `);

    const eventsRes = await webDB.query(`
      SELECT TOP (10) Action, Details, Timestamp
      FROM WebAuditLogs
      WHERE Action IN ('WEBHOOK', 'PAYMONGO_RECONCILE', 'COINS_AWARDED')
      ORDER BY Timestamp DESC
    `);

    const pendingStats = pendingRes.recordset?.[0] || {};
    const throughputStats = throughputRes.recordset?.[0] || {};
    const reconcileStats = reconcileRes.recordset?.[0] || {};
    const webhookStats = webhookRes.recordset?.[0] || {};
    const recentEvents = (eventsRes.recordset || []).map((row: any) => ({
      action: row.Action,
      details: row.Details,
      timestamp: row.Timestamp,
    }));

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      pending: {
        total: Number(pendingStats.totalPending || 0),
        stale10Minutes: Number(pendingStats.stale10 || 0),
        stale30Minutes: Number(pendingStats.stale30 || 0),
      },
      last24h: {
        completed: Number(throughputStats.completed24h || 0),
        failed: Number(throughputStats.failed24h || 0),
        cancelled: Number(throughputStats.cancelled24h || 0),
      },
      reconcile: {
        completed: Number(reconcileStats.completed || 0),
        errors: Number(reconcileStats.errors || 0),
      },
      webhook: {
        total: Number(webhookStats.total || 0),
        failed: Number(webhookStats.failed || 0),
        signatureErrors: Number(webhookStats.signatureErrors || 0),
      },
      recentEvents,
    });
  } catch (error: any) {
    console.error('PayMongo health API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load PayMongo health' }, { status: 500 });
  }
}
