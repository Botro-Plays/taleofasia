import { webDB } from '@/lib/db';

// Simple in-memory OAuth token cache
let tokenCache: {
  accessToken: string;
  expiresAt: number;
  baseUrl: string;
} | null = null;

export async function getPaypalConfig() {
  const res = await webDB.query(
    `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'payment_paypal_enabled')`
  );
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    enabled: map.get('payment_paypal_enabled') === 'true',
    clientId: map.get('paypal_client_id') || '',
    secret: map.get('paypal_secret') || '',
    sandbox: map.get('paypal_sandbox') === 'true',
  };
}

export async function getPaypalToken(config: { clientId: string; secret: string; sandbox: boolean }) {
  const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  // Reuse cached token if still valid (with 60s safety margin)
  if (tokenCache && tokenCache.baseUrl === baseUrl && Date.now() < tokenCache.expiresAt - 60000) {
    return { baseUrl, accessToken: tokenCache.accessToken };
  }

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(`PayPal auth failed: HTTP ${tokenRes.status}`);
  }

  const expiresIn = (tokenData.expires_in as number) || 32400;
  tokenCache = {
    accessToken: tokenData.access_token as string,
    expiresAt: Date.now() + expiresIn * 1000,
    baseUrl,
  };

  return { baseUrl, accessToken: tokenCache.accessToken };
}

export async function invalidatePaypalToken() {
  tokenCache = null;
}

export interface CancelPaypalOrderResult {
  status: 'cancelled' | 'alreadyClosed' | 'notFound' | 'failed';
  error?: string;
}

export async function cancelPaypalOrder(
  orderId: string,
  config: { clientId: string; secret: string; sandbox: boolean }
): Promise<CancelPaypalOrderResult> {
  try {
    const { baseUrl, accessToken } = await getPaypalToken(config);

    const cancelRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (cancelRes.status === 204) {
      return { status: 'cancelled' };
    }

    let errorBody: any = {};
    try { errorBody = await cancelRes.json(); } catch {}

    const issues = errorBody?.details || [];
    const issueCodes = issues.map((i: any) => i.issue || '');

    if (
      cancelRes.status === 422 &&
      (issueCodes.includes('ORDER_ALREADY_VOIDED') || issueCodes.includes('ORDER_ALREADY_CAPTURED'))
    ) {
      return { status: 'alreadyClosed' };
    }

    if (cancelRes.status === 404) {
      return { status: 'notFound' };
    }

    return { status: 'failed', error: `HTTP ${cancelRes.status}: ${errorBody?.message || cancelRes.statusText}` };
  } catch (err: any) {
    return { status: 'failed', error: err?.message || String(err) };
  }
}
