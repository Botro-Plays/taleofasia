import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';

async function getPaymongoConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paymongo_secret_key', 'payment_paymongo_enabled')`);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paymongo_enabled') === 'true',
    secretKey: map.get('paymongo_secret_key') || '',
  };
}

function extractLinkIdFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  // Try checkout.paymongo.com (legacy/v1)
  const m1 = notes.match(/checkout\.paymongo\.com\/([a-zA-Z0-9_-]+)/i);
  if (m1) return m1[1];
  // Try pm.link (v2 payment links)
  const m2 = notes.match(/pm\.link\/[^/]+\/([a-zA-Z0-9_-]+)/i);
  if (m2) return m2[1];
  return null;
}

async function tryArchiveEndpoint(endpoint: string, linkId: string, config: { secretKey: string }, txnId: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const url = `https://api.paymongo.com/v1/${endpoint}/${linkId}/archive`;
  console.log(`[PayMongo Archive] Trying ${url} for txn ${txnId}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
    let body = '';
    try { body = await res.text(); } catch {}
    console.log(`[PayMongo Archive] ${url} → status ${res.status}, body: ${body.slice(0, 200)}`);
    if (res.ok || res.status === 404) {
      return { ok: true, status: res.status, body };
    }
    return { ok: false, status: res.status, body };
  } catch (err: any) {
    console.error(`[PayMongo Archive] Exception on ${url}:`, err.message);
    return { ok: false, status: 0, body: err.message };
  }
}

async function tryArchiveLink(linkId: string, config: { secretKey: string }, txnId: string): Promise<{ ok: boolean; status: number; body?: string }> {
  // Try v1 links endpoint first, then v2 payment_links endpoint
  const endpoints = ['links', 'payment_links'];
  for (const ep of endpoints) {
    const result = await tryArchiveEndpoint(ep, linkId, config, txnId);
    if (result.ok) return result;
  }
  // Return the last failed result
  return { ok: false, status: 0, body: 'All endpoints failed' };
}

async function archiveSingleTransaction(txn: any, config: { secretKey: string; enabled: boolean }) {
  let linkId = txn.GatewayTransactionID;
  console.log(`[PayMongo Archive] txn=${txn.TransactionID} GatewayTransactionID=${linkId || '(empty)'} Notes=${(txn.Notes || '').slice(0, 120)}`);
  if (!linkId) {
    linkId = extractLinkIdFromNotes(txn.Notes);
    console.log(`[PayMongo Archive] txn=${txn.TransactionID} extracted linkId=${linkId || '(none)'}`);
  }
  if (!linkId) {
    console.log(`[PayMongo Archive] txn=${txn.TransactionID} No link ID found anywhere`);
    return { transactionId: txn.TransactionID, linkId: '', success: false, error: 'No PayMongo link ID found in GatewayTransactionID or Notes' };
  }

  // Try multiple strategies:
  // 1. Stored linkId as-is
  // 2. Without "link_" prefix
  // 3. With "link_" prefix added
  const candidates = [linkId];
  if (linkId.startsWith('link_')) {
    candidates.push(linkId.replace('link_', ''));
  } else {
    candidates.push('link_' + linkId);
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    const result = await tryArchiveLink(candidate, config, txn.TransactionID);
    if (result.ok) {
      await webDB.query(`
        UPDATE PaymentTransactions
        SET Notes = ISNULL(Notes, '') + ' | archived=true'
        WHERE TransactionID = @transactionId
      `, { transactionId: txn.TransactionID });
      return { transactionId: txn.TransactionID, linkId: candidate, success: true };
    }
    errors.push(`${candidate} → HTTP ${result.status}: ${result.body?.slice(0, 100) || ''}`);
  }

  return { transactionId: txn.TransactionID, linkId, success: false, error: errors.join(' | ') };
}

export async function POST(request: NextRequest) {
  try {
    // Verify either cron secret OR authenticated admin session
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || '';
    let isAuthorized = false;

    if (expectedSecret && authHeader === `Bearer ${expectedSecret}`) {
      isAuthorized = true;
    } else {
      const session = await auth();
      if (session?.user?.id) {
        const priv = await checkAdminPrivileges(session.user.id);
        if (priv.isSuperAdmin) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getPaymongoConfig();
    if (!config.enabled || !config.secretKey) {
      return NextResponse.json({ error: 'PayMongo not configured' }, { status: 503 });
    }

    // Check for single-transaction archive request
    let singleTransactionId: string | null = null;
    try {
      const body = await request.clone().json();
      singleTransactionId = body.transactionId || null;
    } catch {
      // No body or invalid JSON, proceed with bulk mode
    }

    if (singleTransactionId) {
      const txnRes = await webDB.query(`
        SELECT TransactionID, GatewayTransactionID, Notes, Status
        FROM PaymentTransactions
        WHERE TransactionID = @transactionId AND PaymentMethod = 'PayMongo'
      `, { transactionId: singleTransactionId });
      const txn = txnRes.recordset?.[0];
      if (!txn) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      const result = await archiveSingleTransaction(txn, config);
      return NextResponse.json({ processed: 1, succeeded: result.success ? 1 : 0, failed: result.success ? 0 : 1, details: [result] });
    }

    // Bulk mode: find all cancelled/completed PayMongo transactions not yet archived
    // Include transactions where GatewayTransactionID is missing but Notes may have the checkout URL
    const txns = await webDB.query(`
      SELECT TransactionID, GatewayTransactionID, Notes, Status
      FROM PaymentTransactions
      WHERE PaymentMethod = 'PayMongo'
        AND Status IN ('cancelled', 'completed')
        AND (Notes IS NULL OR Notes NOT LIKE '%archived=true%')
        AND (
          (GatewayTransactionID IS NOT NULL AND GatewayTransactionID != '')
          OR (Notes IS NOT NULL AND Notes LIKE '%checkout.paymongo.com%')
        )
    `);

    const records = txns.recordset || [];
    const results: { transactionId: string; linkId: string; success: boolean; error?: string }[] = [];

    for (const txn of records) {
      const result = await archiveSingleTransaction(txn, config);
      results.push(result);
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    });
  } catch (error: any) {
    console.error('PayMongo archive cron error:', error);
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}
