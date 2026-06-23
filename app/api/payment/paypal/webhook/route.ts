import { NextRequest, NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { awardCoins } from '@/lib/pricing';
import { dispatchPaypalAlert } from '@/lib/paypal/alerts';
import { insertWebhookPayload, updateWebhookPayloadStatus, cleanupOldWebhookPayloads } from '@/lib/webhook/store';

async function getPaypalConfig() {
  const res = await webDB.query(`SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN ('paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'paypal_webhook_id')`);
  const rows = res.recordset || [];
  const map = new Map(rows.map((r: { ConfigKey: string; ConfigValue: string }) => [r.ConfigKey, r.ConfigValue]));
  return {
    clientId: map.get('paypal_client_id') || '',
    secret: map.get('paypal_secret') || '',
    sandbox: map.get('paypal_sandbox') === 'true',
    webhookId: map.get('paypal_webhook_id') || '',
  };
}

type PaypalVerificationResult = {
  success: boolean;
  verificationStatus?: string;
  httpStatus?: number;
  error?: string;
  responseBody?: unknown;
};

async function verifyPaypalWebhook(
  rawBody: string,
  headers: Headers,
  config: { clientId: string; secret: string; sandbox: boolean; webhookId: string }
): Promise<PaypalVerificationResult> {
  if (!config.webhookId || !config.clientId || !config.secret) {
    return { success: false, error: 'missing_credentials' };
  }

  const baseUrl = config.sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  try {
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    let tokenData: any = null;
    try {
      tokenData = await tokenRes.json();
    } catch (tokenParseError) {
      return {
        success: false,
        error: 'oauth_json_parse_failed',
        httpStatus: tokenRes.status,
        responseBody: String(tokenParseError),
      };
    }

    if (!tokenRes.ok || !tokenData?.access_token) {
      return {
        success: false,
        error: 'oauth_request_failed',
        httpStatus: tokenRes.status,
        responseBody: tokenData,
      };
    }

    let parsedEvent: unknown = null;
    if (rawBody && rawBody.trim().length > 0) {
      try {
        parsedEvent = JSON.parse(rawBody);
      } catch {
        return {
          success: false,
          error: 'webhook_json_parse_failed',
          responseBody: rawBody.slice(0, 2000),
        };
      }
    } else {
      parsedEvent = {};
    }

    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        transmission_id: headers.get('paypal-transmission-id'),
        cert_url: headers.get('paypal-cert-url'),
        auth_algo: headers.get('paypal-auth-algo'),
        transmission_time: headers.get('paypal-transmission-time'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        webhook_id: config.webhookId,
        webhook_event: parsedEvent,
      }),
    });

    let verifyData: any = null;
    try {
      verifyData = await verifyRes.json();
    } catch (verifyParseError) {
      return {
        success: false,
        error: 'verify_json_parse_failed',
        httpStatus: verifyRes.status,
        responseBody: String(verifyParseError),
      };
    }

    return {
      success: verifyData?.verification_status === 'SUCCESS',
      verificationStatus: verifyData?.verification_status,
      httpStatus: verifyRes.status,
      responseBody: verifyData,
    };
  } catch (networkError) {
    return {
      success: false,
      error: networkError instanceof Error ? networkError.message : String(networkError),
    };
  }
}

type PaypalCaptureResult = {
  success: boolean;
  httpStatus?: number;
  responseBody?: unknown;
  error?: string;
};

type PaypalEventBehavior = {
  status?: 'completed' | 'failed' | 'cancelled' | 'refunded';
  note: string;
  alertSeverity?: 'info' | 'warning' | 'critical';
  autoCapture?: boolean;
};

const EVENT_BEHAVIOR: Record<string, PaypalEventBehavior> = {
  'PAYMENT.CAPTURE.COMPLETED': {
    status: 'completed',
    note: 'PayPal capture completed',
  },
  'PAYMENT.CAPTURE.PENDING': {
    note: 'PayPal capture pending',
    alertSeverity: 'info',
  },
  'PAYMENT.CAPTURE.DENIED': {
    status: 'failed',
    note: 'PayPal capture denied',
    alertSeverity: 'warning',
  },
  'PAYMENT.CAPTURE.REFUNDED': {
    status: 'refunded',
    note: 'PayPal capture refunded',
    alertSeverity: 'warning',
  },
  'PAYMENT.CAPTURE.REVERSED': {
    status: 'refunded',
    note: 'PayPal capture reversed',
    alertSeverity: 'critical',
  },
  'CHECKOUT.ORDER.VOIDED': {
    status: 'cancelled',
    note: 'PayPal order voided upstream',
    alertSeverity: 'info',
  },
  'CHECKOUT.ORDER.DENIED': {
    status: 'failed',
    note: 'PayPal order denied upstream',
    alertSeverity: 'warning',
  },
  'CHECKOUT.ORDER.APPROVED': {
    note: 'PayPal order approved; attempting capture',
    autoCapture: true,
  },
};

async function capturePaypalOrder(
  orderId: string,
  config: { clientId: string; secret: string; sandbox: boolean }
): Promise<PaypalCaptureResult> {
  const baseUrl = config.sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  try {
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
      return {
        success: false,
        httpStatus: tokenRes.status,
        responseBody: tokenData,
        error: 'capture_oauth_failed',
      };
    }

    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const captureData = await captureRes.json();
    return {
      success: captureRes.ok && captureData?.status === 'COMPLETED',
      httpStatus: captureRes.status,
      responseBody: captureData,
      error: captureRes.ok ? undefined : 'capture_request_failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractOrderId(resource: any): string | null {
  if (!resource || typeof resource !== 'object') return null;

  const orderId =
    resource?.supplementary_data?.related_ids?.order_id ??
    resource?.id ??
    resource?.order_id ??
    resource?.checkout_session_id ??
    resource?.parent_payment ??
    null;

  return typeof orderId === 'string' && orderId.length > 0 ? orderId : null;
}

export async function POST(request: NextRequest) {
  let payloadLogId = 0;
  try {
    const rawBody = await request.text();
    const config = await getPaypalConfig();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // Persist raw payload immediately for replay/debugging
    let initialEventType = 'unknown';
    try {
      const parsed = JSON.parse(rawBody);
      initialEventType = (parsed?.event_type as string) || 'unknown';
    } catch {
      // ignore parse errors for initial event type extraction
    }
    payloadLogId = await insertWebhookPayload({
      provider: 'PayPal',
      eventType: initialEventType,
      payload: rawBody,
      status: 'received',
      ip,
    });

    if (!config.webhookId || !config.clientId || !config.secret) {
      await dispatchPaypalAlert({
        severity: 'critical',
        title: 'PayPal webhook not configured',
        message: 'Received PayPal webhook but webhook credentials are missing.',
        source: 'paypal-webhook',
        dedupeKey: 'paypal:webhook:not-configured',
        ip,
      });
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_not_configured');
      return NextResponse.json({ error: 'PayPal webhook not configured' }, { status: 503 });
    }

    const verification = await verifyPaypalWebhook(rawBody, request.headers, config);
    if (!verification.success) {
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_signature_failed');
      let eventType = 'unknown';
      try {
        const parsed = JSON.parse(rawBody);
        eventType = parsed?.event_type || 'unknown';
      } catch {
        // ignore parse errors here
      }
      const failureContext: Record<string, unknown> = {
        eventType,
      };
      if (verification.verificationStatus) {
        failureContext.verificationStatus = verification.verificationStatus;
      }
      if (typeof verification.httpStatus === 'number') {
        failureContext.verifyHttpStatus = verification.httpStatus;
      }
      if (verification.error) {
        failureContext.verifyError = verification.error;
      }
      if (verification.responseBody) {
        failureContext.verifyResponse = verification.responseBody;
      }
      if (!verification.responseBody && rawBody) {
        failureContext.webhookRawBody = rawBody.slice(0, 2000);
      }
      await dispatchPaypalAlert({
        severity: 'warning',
        title: 'PayPal webhook signature verification failed',
        message: 'PayPal signature verification returned a non-success status.',
        source: 'paypal-webhook',
        dedupeKey: 'paypal:webhook:signature-invalid',
        context: failureContext,
        ip,
      });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'verified');

    let event: Record<string, unknown> | null = null;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError: unknown) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : 'JSON.parse threw an error for the PayPal webhook payload.';
      await dispatchPaypalAlert({
        severity: 'critical',
        title: 'Failed to parse PayPal webhook payload',
        message,
        source: 'paypal-webhook',
        dedupeKey: 'paypal:webhook:parse-error',
        ip,
      });
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_parse_failed');
      return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
    }

    const eventType = typeof event?.event_type === 'string' ? (event.event_type as string) : 'unknown';
    const resource = (event as { resource?: unknown })?.resource;

    let behavior = EVENT_BEHAVIOR[eventType] || null;
    if (!behavior) {
      await dispatchPaypalAlert({
        severity: 'info',
        title: 'Unhandled PayPal webhook event',
        message: `Received unsupported PayPal event ${eventType}; acknowledging without side effects.`,
        source: 'paypal-webhook',
        dedupeKey: `paypal:webhook:ignored:${eventType}`,
        context: { eventType },
        ip,
      });
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'ignored');
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
         VALUES (NULL, 'WEBHOOK', 'PayPal: ' + @eventType + ' | order=unknown | status=ignored', @ip, GETDATE())`,
        { eventType: String(eventType), ip }
      );
      // Non-blocking cleanup of old payloads
      void cleanupOldWebhookPayloads(30);
      return NextResponse.json({ received: true });
    }

    const orderId = extractOrderId(resource);
    if (!orderId) {
      await dispatchPaypalAlert({
        severity: 'warning',
        title: 'PayPal webhook missing order ID',
        message: `Event ${eventType} did not include a resolvable order identifier; skipping update.`,
        source: 'paypal-webhook',
        dedupeKey: `paypal:webhook:no-order:${eventType}`,
        context: { eventType },
        ip,
      });
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_no_order');
      return NextResponse.json({ received: true });
    }

    if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'processing', orderId);

    const txnRes = await webDB.query(
      `SELECT TransactionID, AccountName, Status, UsdAmount, CoinsAwarded
         FROM PaymentTransactions
         WHERE GatewayTransactionID = @orderId`,
      { orderId }
    );
    const txn = txnRes.recordset?.[0];

    // If we received a capture PENDING event, proactively confirm latest capture status
    if (eventType === 'PAYMENT.CAPTURE.PENDING' && txn?.Status === 'pending') {
      try {
        const captureId = (resource as any)?.id || (resource as any)?.capture_id;
        const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
        const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData?.access_token && captureId) {
          const detRes = await fetch(`${baseUrl}/v2/payments/captures/${captureId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const detData = await detRes.json();
          if (detRes.ok && detData?.status === 'COMPLETED') {
            // finalize now
            const updateRes = await webDB.query(
              `UPDATE PaymentTransactions
                 SET Status = 'completed',
                     CompletedAt = GETDATE(),
                     Notes = ISNULL(Notes, '') + ' | captureConfirmed:' + @captureId
               WHERE TransactionID = @transactionId AND GatewayTransactionID = @orderId AND Status = 'pending'`,
              { transactionId: txn.TransactionID, orderId, captureId: String(captureId) }
            );
            const changed = (updateRes.rowsAffected?.[0] ?? 0) > 0;
            if (changed && txn.UsdAmount && txn.UsdAmount > 0) {
              const award = await awardCoins(txn.AccountName, txn.TransactionID, txn.UsdAmount, 'PayPal');
              if (award) {
                await webDB.query(
                  `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
                   VALUES (@accountName, 'COINS_AWARDED', 'Auto-awarded ' + @coins + ' coins for PayPal payment ' + @orderId, @ip, GETDATE())`,
                  { accountName: txn.AccountName, coins: String(award.awarded), orderId, ip }
                );
              }
            }
            behavior = { status: 'completed', note: 'PayPal capture completed (confirmed from PENDING)' };
          } else {
            await webDB.query(
              `UPDATE PaymentTransactions SET Notes = ISNULL(Notes, '') + ' | capturePending:' + @captureId WHERE TransactionID = @transactionId AND Status = 'pending'`,
              { transactionId: txn.TransactionID, captureId: String(captureId || 'unknown') }
            );
          }
        }
      } catch {
        // ignore network errors; we'll wait for subsequent webhooks
      }
    }

    if (!txn) {
      await dispatchPaypalAlert({
        severity: 'warning',
        title: 'PayPal webhook order mismatch',
        message: `PayPal reported ${eventType} for unknown order ${orderId}.`,
        source: 'paypal-webhook',
        dedupeKey: `paypal:webhook:missing:${orderId}`,
        context: { eventType, orderId },
        ip,
      });
      if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_order_mismatch', orderId);
      return NextResponse.json({ received: true });
    }

    if (behavior.autoCapture && txn.Status === 'pending') {
      const captureResult = await capturePaypalOrder(orderId, config);
      if (!captureResult.success) {
        await dispatchPaypalAlert({
          severity: 'critical',
          title: 'PayPal auto-capture failed',
          message: `Automatic capture for order ${orderId} failed after approval.`,
          source: 'paypal-webhook',
          dedupeKey: `paypal:webhook:auto-capture-failed:${orderId}`,
          context: {
            eventType,
            orderId,
            httpStatus: captureResult.httpStatus,
            error: captureResult.error,
            response: captureResult.responseBody,
          },
          ip,
        });
      } else {
        // If auto-capture returned COMPLETED, safely finalize locally now
        const cap = captureResult.responseBody as any;
        const captureId = cap?.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';
        const suffix = ` | autoCapture:COMPLETED ${captureId ? `#${captureId} ` : ''}@ ${new Date().toISOString()}`;

        const updateRes = await webDB.query(
          `UPDATE PaymentTransactions
             SET Status = 'completed',
                 CompletedAt = GETDATE(),
                 Notes = CASE WHEN @suffix = '' THEN Notes ELSE ISNULL(Notes, '') + @suffix END
           WHERE TransactionID = @transactionId AND GatewayTransactionID = @orderId AND Status = 'pending'`,
          {
            transactionId: txn.TransactionID,
            orderId,
            suffix,
          }
        );

        const changed = (updateRes.rowsAffected?.[0] ?? 0) > 0;
        if (changed) {
          // Attempt coin award immediately; guarded against double-award
          if (txn.UsdAmount && txn.UsdAmount > 0) {
            const award = await awardCoins(txn.AccountName, txn.TransactionID, txn.UsdAmount, 'PayPal');
            if (award) {
              await webDB.query(
                `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
                 VALUES (@accountName, 'COINS_AWARDED', 'Auto-awarded ' + @coins + ' coins for PayPal payment ' + @orderId, @ip, GETDATE())`,
                { accountName: txn.AccountName, coins: String(award.awarded), orderId, ip }
              );
            } else {
              await dispatchPaypalAlert({
                severity: 'critical',
                title: 'PayPal auto-award failed (capture via approval)',
                message: `Coins could not be awarded after auto-capture completion for transaction ${txn.TransactionID}.`,
                source: 'paypal-webhook',
                dedupeKey: `paypal:webhook:award-failed:${txn.TransactionID}`,
                context: { orderId, account: txn.AccountName },
                ip,
              });
            }
          }
        }

        await dispatchPaypalAlert({
          severity: 'info',
          title: 'PayPal auto-capture completed',
          message: `Auto-capture returned COMPLETED for order ${orderId}; transaction finalized locally${changed ? '' : ' (no row changed)'} .`,
          source: 'paypal-webhook',
          dedupeKey: `paypal:webhook:auto-capture-completed:${orderId}`,
          context: {
            eventType,
            orderId,
            httpStatus: captureResult.httpStatus,
            response: captureResult.responseBody,
          },
          ip,
        });
      }
    }

    const behaviorStatus = behavior?.status;
    const noteSuffixStatus = behaviorStatus ?? 'no-status-change';
    const noteSuffix = ` | PayPal event ${eventType} -> ${noteSuffixStatus} @ ${new Date().toISOString()}`;
    let finalStatus = txn.Status;
    let updated = false;

    // Idempotency: if we already marked completed, do not warn on repeated COMPLETED events
    if (behaviorStatus === 'completed' && txn.Status === 'completed') {
      finalStatus = 'completed';
    } else if (behaviorStatus && behaviorStatus !== txn.Status) {
      const expectedStatuses = behaviorStatus === 'refunded' ? ['completed', 'pending'] : ['pending'];
      if (!expectedStatuses.includes(txn.Status)) {
        await dispatchPaypalAlert({
          severity: 'warning',
          title: 'PayPal webhook state mismatch',
          message: `Cannot apply ${eventType} because transaction ${txn.TransactionID} is currently ${txn.Status}.`,
          source: 'paypal-webhook',
          dedupeKey: `paypal:webhook:state-mismatch:${txn.TransactionID}:${eventType}`,
          context: { eventType, orderId, currentStatus: txn.Status, desiredStatus: behaviorStatus },
          ip,
        });
      } else {
        const updateRes = await webDB.query(
          `UPDATE PaymentTransactions
             SET Status = @status,
                 CompletedAt = GETDATE(),
                 Notes = CASE WHEN @noteSuffix = '' THEN Notes ELSE ISNULL(Notes, '') + @noteSuffix END
           WHERE TransactionID = @transactionId AND Status = @expectedStatus`,
          {
            status: behaviorStatus,
            noteSuffix,
            transactionId: txn.TransactionID,
            expectedStatus: txn.Status,
          }
        );
        updated = (updateRes.rowsAffected?.[0] ?? 0) > 0;
        if (!updated) {
          await dispatchPaypalAlert({
            severity: 'warning',
            title: 'PayPal webhook update affected no rows',
            message: `Attempted to set ${txn.TransactionID} (${orderId}) to ${noteSuffixStatus} but no database rows were modified.`,
            source: 'paypal-webhook',
            dedupeKey: `paypal:webhook:no-update:${txn.TransactionID}:${eventType}`,
            context: { eventType, orderId, previousStatus: txn.Status },
            ip,
          });
        } else {
          finalStatus = behaviorStatus;
        }
      }
    } else {
      finalStatus = txn.Status;
    }

    if (behaviorStatus && behavior.alertSeverity) {
      await dispatchPaypalAlert({
        severity: behavior.alertSeverity,
        title: behavior.note,
        message: `Transaction ${txn.TransactionID} (${orderId}) marked ${behaviorStatus}.`,
        source: 'paypal-webhook',
        dedupeKey: `paypal:webhook:event:${eventType}:${orderId}`,
        context: { eventType, orderId, account: txn.AccountName, updated },
        ip,
      });
    }

    if (behaviorStatus === 'completed') {
      const refreshed = await webDB.query(
        `SELECT TransactionID, AccountName, UsdAmount, CoinsAwarded, Status
           FROM PaymentTransactions
           WHERE TransactionID = @transactionId`,
        { transactionId: txn.TransactionID }
      );
      const row = refreshed.recordset?.[0];
      if (row && row.Status === 'completed' && row.UsdAmount && row.UsdAmount > 0 && (!row.CoinsAwarded || row.CoinsAwarded <= 0)) {
        const award = await awardCoins(row.AccountName, row.TransactionID, row.UsdAmount, 'PayPal');
        if (award) {
          await webDB.query(
            `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
             VALUES (@accountName, 'COINS_AWARDED', 'Auto-awarded ' + @coins + ' coins for PayPal payment ' + @orderId, @ip, GETDATE())`,
            { accountName: row.AccountName, coins: String(award.awarded), orderId, ip }
          );
        } else {
          await dispatchPaypalAlert({
            severity: 'critical',
            title: 'PayPal auto-award failed',
            message: `Coins could not be awarded after capture completion for transaction ${row.TransactionID}.`,
            source: 'paypal-webhook',
            dedupeKey: `paypal:webhook:award-failed:${row.TransactionID}`,
            context: { orderId, account: row.AccountName },
            ip,
          });
        }
      }
    }

    if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'processed', orderId);

    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
       VALUES (NULL, 'WEBHOOK', 'PayPal: ' + @eventType + ' | order=' + @orderId + ' | status=' + @status, @ip, GETDATE())`,
      {
        eventType: String(eventType),
        orderId,
        status: finalStatus,
        ip,
      }
    );

    // Non-blocking cleanup of payloads older than 30 days
    void cleanupOldWebhookPayloads(30);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    if (payloadLogId) await updateWebhookPayloadStatus(payloadLogId, 'error_unhandled');
    console.error('PayPal webhook error:', error);
    const message =
      error instanceof Error
        ? error.message
        : (typeof error === 'object' && error && 'message' in error
            ? String((error as Record<string, unknown>).message)
            : 'Unknown error in PayPal webhook.');
    const stack =
      error instanceof Error
        ? error.stack
        : (typeof error === 'object' && error && 'stack' in error
            ? String((error as Record<string, unknown>).stack)
            : undefined);
    await dispatchPaypalAlert({
      severity: 'critical',
      title: 'PayPal webhook handler error',
      message,
      source: 'paypal-webhook',
      dedupeKey: 'paypal:webhook:unhandled',
      context: stack ? { stack } : undefined,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
