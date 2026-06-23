import { NextRequest, NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';
import { dispatchPaymongoAlert } from '@/lib/paymongo/alerts';
import crypto from 'crypto';

async function getPaymongoWebhookSecret() {
  const res = await webDB.query(`SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'paymongo_webhook_secret'`);
  return res.recordset?.[0]?.ConfigValue || '';
}

function verifyPaymongoSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(',').map(p => p.trim());
  const tPart = parts.find(p => p.startsWith('t='));
  const tePart = parts.find(p => p.startsWith('te='));
  const liPart = parts.find(p => p.startsWith('li='));

  if (!tPart || !secret) return false;

  const timestamp = tPart.slice(2);
  const sig = tePart?.slice(3) || liPart?.slice(3) || '';
  if (!sig) return false;

  const payload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return hmac === sig;
}

/**
 * Extract the link/payment ID from a PayMongo webhook event.
 * For link.payment.paid events, the link ID is in relationships.link.data.id
 */
function extractGatewayId(event: any): string | null {
  const attrs = event?.data?.attributes || {};
  const eventData = attrs?.data || {};

  // checkout_session.payment.paid: payment intent ID is in relationships.payment_intent.data.id
  const paymentIntentId = eventData?.relationships?.payment_intent?.data?.id;
  if (paymentIntentId) return paymentIntentId;

  // link.payment.paid: link ID is in relationships.link.data.id
  const linkId = eventData?.relationships?.link?.data?.id;
  if (linkId) return linkId;

  // payment.paid: payment intent ID is in attributes.payment_intent_id
  const piId = eventData?.attributes?.payment_intent_id;
  if (piId) return piId;

  // Fallback: source.id (for some event types)
  const sourceId = attrs?.source?.id;
  if (sourceId) return sourceId;

  // Fallback: payment id itself
  const dataId = eventData?.id || event?.data?.id;
  if (dataId) return dataId;

  return null;
}

/**
 * CRITICAL: PayMongo REQUIRES webhooks to ALWAYS return HTTP 200.
 * Returning 4xx or 5xx will cause PayMongo to disable the webhook.
 * We process the event, log any errors, but always respond 200.
 */
export async function POST(request: NextRequest) {
  let rawBody = '';
  let signatureHeader = '';
  let eventType = 'unknown';
  let gatewayId: string | null = null;
  const requestIp = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    rawBody = await request.text();
    signatureHeader = request.headers.get('paymongo-signature') || '';

    const secret = await getPaymongoWebhookSecret();
    if (!secret) {
      console.error('[PayMongo Webhook] Secret not configured');
      await dispatchPaymongoAlert({
        severity: 'critical',
        title: 'PayMongo webhook secret missing',
        message: 'WebsiteConfigs.paymongo_webhook_secret is empty, so incoming webhooks cannot be verified.',
        source: 'paymongo-webhook',
        context: { hasSignatureHeader: Boolean(signatureHeader) },
        dedupeKey: 'webhook:missing-secret',
        ip: requestIp,
      });
      return NextResponse.json({ received: true });
    }

    if (!verifyPaymongoSignature(rawBody, signatureHeader, secret)) {
      console.error('[PayMongo Webhook] Invalid signature');
      await dispatchPaymongoAlert({
        severity: 'warning',
        title: 'PayMongo webhook signature mismatch',
        message: 'Rejected a PayMongo webhook because the signature header failed verification.',
        source: 'paymongo-webhook',
        context: {
          signatureHeader: signatureHeader?.slice(0, 200) || 'none',
          rawBodyLength: rawBody.length,
        },
        dedupeKey: 'webhook:invalid-signature',
        ip: requestIp,
      });
      return NextResponse.json({ received: true });
    }

    const event = JSON.parse(rawBody);
    eventType = event.data?.attributes?.type || event.data?.type || 'unknown';
    gatewayId = extractGatewayId(event);

    console.log(`[PayMongo Webhook] event=${eventType} gatewayId=${gatewayId || 'none'}`);

    const successEvents = ['link.payment.paid', 'payment.paid', 'source.chargeable', 'checkout_session.payment.paid', 'checkout_session.payment.can_complete'];
    const failedEvents = ['link.payment.failed', 'payment.failed', 'payment.cancelled', 'checkout_session.payment.failed'];

    if (!successEvents.includes(eventType) && !failedEvents.includes(eventType)) {
      console.log(`[PayMongo Webhook] Ignoring non-outcome event: ${eventType}`);
      return NextResponse.json({ received: true });
    }

    if (!gatewayId) {
      console.error('[PayMongo Webhook] No gatewayId found in event');
      await dispatchPaymongoAlert({
        severity: 'warning',
        title: 'PayMongo webhook missing gateway ID',
        message: `PayMongo event ${eventType} did not include a recognizable link/payment identifier.`,
        source: 'paymongo-webhook',
        context: { eventType, rawBodyLength: rawBody.length },
        dedupeKey: `webhook:no-gateway:${eventType}`,
        ip: requestIp,
      });
      return NextResponse.json({ received: true });
    }

    const status = successEvents.includes(eventType) ? 'completed' : 'failed';

    // Update by GatewayTransactionID first
    const updateResult = await webDB.query(`
      UPDATE PaymentTransactions
      SET Status = @status, CompletedAt = GETDATE()
      WHERE GatewayTransactionID = @gatewayId AND Status = 'pending'
      SELECT @@ROWCOUNT as affected
    `, { status, gatewayId });

    let affectedRows = updateResult.recordset?.[0]?.affected || 0;
    console.log(`[PayMongo Webhook] Updated ${affectedRows} rows for gatewayId=${gatewayId}`);

    // If no rows updated, try matching by stripping link_ prefix (PayMongo sometimes uses different ID formats)
    if (affectedRows === 0 && gatewayId) {
      const altGatewayId = gatewayId.startsWith('link_') ? gatewayId.replace('link_', '') : 'link_' + gatewayId;
      const fallback = await webDB.query(`
        UPDATE PaymentTransactions
        SET Status = @status, CompletedAt = GETDATE()
        WHERE GatewayTransactionID = @altGatewayId AND Status = 'pending'
        SELECT @@ROWCOUNT as affected
      `, { status, altGatewayId });
      console.log(`[PayMongo Webhook] Fallback update by altGatewayId=${altGatewayId}: ${fallback.recordset?.[0]?.affected || 0} rows`);
      affectedRows += fallback.recordset?.[0]?.affected || 0;
    }

    // Check if this transaction belongs to us at all (cross-project webhooks on shared PayMongo account)
    const existsResult = await webDB.query(
      `SELECT TOP (1) TransactionID, Status FROM PaymentTransactions WHERE GatewayTransactionID = @gatewayId`,
      { gatewayId }
    );
    const existsRow = existsResult.recordset?.[0];

    if (affectedRows === 0 && status === 'completed') {
      if (!existsRow) {
        // Cross-project webhook — silently log, no email alert
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
           VALUES (NULL, 'WEBHOOK', 'PayMongo cross-project webhook ignored: gateway=' + @gatewayId + ' | event=' + @eventType, @ip, GETDATE())`,
          { gatewayId, eventType, ip: requestIp }
        );
      } else {
        await dispatchPaymongoAlert({
          severity: 'warning',
          title: 'PayMongo webhook unmatched transaction',
          message: `Completed event ${eventType} for ${gatewayId} but no pending transactions were updated (current status: ${existsRow.Status}).`,
          source: 'paymongo-webhook',
          context: { eventType, gatewayId, currentStatus: existsRow.Status },
          dedupeKey: `webhook:unmatched:${gatewayId}`,
          ip: requestIp,
        });
      }
    }

    // Auto-award coins on successful payment
    if (status === 'completed') {
      let txn = await webDB.query(
        `SELECT TransactionID, AccountName, UsdAmount, CoinsAwarded FROM PaymentTransactions WHERE GatewayTransactionID = @gatewayId`,
        { gatewayId }
      );
      let row = txn.recordset?.[0];

      // If not found, try alternate ID format (some events use stripped/prefixed versions)
      if (!row && gatewayId) {
        const altGatewayId = gatewayId.startsWith('link_') ? gatewayId.replace('link_', '') : 'link_' + gatewayId;
        txn = await webDB.query(
          `SELECT TransactionID, AccountName, UsdAmount, CoinsAwarded FROM PaymentTransactions WHERE GatewayTransactionID = @altGatewayId`,
          { altGatewayId }
        );
        row = txn.recordset?.[0];
      }

      if (!row) {
        if (!existsRow) {
          // Cross-project webhook — already logged above, skip email alert
          console.log(`[PayMongo Webhook] Cross-project webhook ignored for coin award: gatewayId=${gatewayId}`);
        } else {
          await dispatchPaymongoAlert({
            severity: 'warning',
            title: 'PayMongo webhook missing transaction record',
            message: `Webhook ${eventType} for ${gatewayId} had no corresponding transaction record in the database.`,
            source: 'paymongo-webhook',
            context: { gatewayId, eventType },
            dedupeKey: `webhook:no-record:${gatewayId}`,
            ip: requestIp,
          });
        }
      }

      if (row && row.UsdAmount && row.UsdAmount > 0 && (!row.CoinsAwarded || row.CoinsAwarded <= 0)) {
        const award = await awardCoins(row.AccountName, row.TransactionID, row.UsdAmount, 'PayMongo');
        if (award) {
          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (@accountName, 'COINS_AWARDED', 'Auto-awarded ' + @coins + ' coins for PayMongo payment ' + @gatewayId, @ip, GETDATE())`,
            { accountName: row.AccountName, coins: String(award.awarded), gatewayId, ip: request.headers.get('x-forwarded-for') || 'unknown' }
          );
        } else {
          await dispatchPaymongoAlert({
            severity: 'warning',
            title: 'PayMongo coin award skipped',
            message: `Unable to award coins for transaction ${row.TransactionID} despite webhook completion.`,
            source: 'paymongo-webhook',
            context: { gatewayId, transactionId: row.TransactionID, account: row.AccountName },
            dedupeKey: `webhook:award-failed:${row.TransactionID}`,
            ip: requestIp,
          });
        }
      }
    }

    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
      VALUES (NULL, 'WEBHOOK', 'PayMongo: ' + @eventType + ' | gateway=' + @gatewayId + ' | status=' + @status, @ip, GETDATE())
    `, {
      eventType: String(eventType),
      gatewayId: gatewayId || '',
      status,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
  } catch (error: any) {
    console.error('[PayMongo Webhook] Unhandled error:', error.message, error.stack);
    await dispatchPaymongoAlert({
      severity: 'critical',
      title: 'PayMongo webhook handler crashed',
      message: error?.message || 'Unknown error',
      source: 'paymongo-webhook',
      context: { stack: error?.stack },
      dedupeKey: 'webhook:unhandled-error',
      ip: requestIp,
    });
  }

  // ALWAYS return 200 - this is critical for PayMongo webhook health
  return NextResponse.json({ received: true });
}
