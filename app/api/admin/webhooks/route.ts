import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';

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
    const provider = searchParams.get('provider') || 'all';
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let where = '1=1';
    const params: Record<string, unknown> = { limit, offset };
    if (provider && provider !== 'all') {
      where += ' AND Provider = @provider';
      params.provider = provider;
    }
    if (status && status !== 'all') {
      where += ' AND Status = @status';
      params.status = status;
    }

    const rows = await webDB.query(
      `SELECT LogID, Provider, EventType, GatewayTransactionID, Status, IPAddress, Timestamp
       FROM WebhookPayloads
       WHERE ${where}
       ORDER BY Timestamp DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      params
    );

    const countRes = await webDB.query(
      `SELECT COUNT(*) as total FROM WebhookPayloads WHERE ${where}`,
      params
    );

    return NextResponse.json({
      payloads: rows.recordset || [],
      total: countRes.recordset?.[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching webhook payloads:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook payloads' }, { status: 500 });
  }
}
