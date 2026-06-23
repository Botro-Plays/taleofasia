import { webDB } from '@/lib/db';
import { sendEmail } from '@/lib/mail';

export type PaymongoAlertSeverity = 'info' | 'warning' | 'critical';

export interface PaymongoAlertOptions {
  severity: PaymongoAlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  dedupeKey?: string;
  source?: string;
  ip?: string;
}

declare global {
  var __paymongoAlertCache: Map<string, number> | undefined;
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getCache(): Map<string, number> {
  if (!globalThis.__paymongoAlertCache) {
    globalThis.__paymongoAlertCache = new Map();
  }
  return globalThis.__paymongoAlertCache;
}

function parseRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[;,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

async function getAlertRecipients(): Promise<string[]> {
  const dbResult = await webDB.query(
    `SELECT TOP (1) ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'paymongo_alert_recipients'`
  );
  const configValue = dbResult.recordset?.[0]?.ConfigValue as string | undefined;
  const envValue = process.env.PAYMONGO_ALERT_EMAILS;

  const recipients = [...parseRecipients(configValue), ...parseRecipients(envValue)];
  return Array.from(new Set(recipients));
}

function summarizeContext(context?: Record<string, unknown>): string | null {
  if (!context || Object.keys(context).length === 0) return null;
  try {
    return JSON.stringify(context, null, 2).slice(0, 2000);
  } catch (error) {
    console.error('[PayMongo Alert] Failed to stringify context payload:', error);
    return null;
  }
}

export async function dispatchPaymongoAlert(options: PaymongoAlertOptions): Promise<void> {
  const { severity, title, message, context, dedupeKey, source, ip } = options;
  const cacheKey = dedupeKey || `${severity}:${title}:${message}`;
  const cache = getCache();
  const now = Date.now();
  const previousSentAt = cache.get(cacheKey) ?? 0;
  const contextSummary = summarizeContext(context);
  const logDetails = [
    `[${severity.toUpperCase()}] ${title}`,
    message,
    contextSummary ? `context=${contextSummary}` : null,
    source ? `source=${source}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  try {
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, Timestamp)
       VALUES (NULL, 'PAYMONGO_ALERT', @details, @ip, GETDATE())`,
      {
        details: logDetails.slice(0, 2000),
        ip: ip || 'system',
      }
    );
  } catch (error) {
    console.error('[PayMongo Alert] Failed to persist WebAuditLog entry:', error);
  }

  const recipients = await getAlertRecipients();
  if (recipients.length === 0) {
    console.warn('[PayMongo Alert] No alert recipients configured; skipping email dispatch');
    return;
  }

  if (previousSentAt && now - previousSentAt < DEDUPE_WINDOW_MS) {
    console.log('[PayMongo Alert] Email suppressed due to dedupe window', { cacheKey });
    return;
  }

  const subject = `[PayMongo][${severity.toUpperCase()}] ${title}`;
  const contextBlock = contextSummary
    ? `<pre style="background:rgba(8,8,12,0.8);border:1px solid rgba(184,155,94,0.15);padding:14px 16px;white-space:pre-wrap;font-size:12px;color:#9B95A9;overflow-x:auto;">${contextSummary}</pre>`
    : '';
  const severityColor = severity === 'critical' ? '#B33A3A' : severity === 'warning' ? '#C77A30' : '#B89B5E';
  const html = `
    <div style="background: #08080C; padding: 20px 16px; font-family: 'Segoe UI', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(145deg, #141219, #0C0A10); border: 1px solid rgba(184,155,94,0.22); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #141219 0%, #0A0810 100%); padding: 20px 24px; border-bottom: 1px solid rgba(184,155,94,0.25); display: flex; align-items: center; justify-content: space-between;">
          <span style="font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #B89B5E;">Tale of Asia</span>
          <span style="background: ${severityColor}22; border: 1px solid ${severityColor}66; color: ${severityColor}; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 3px 10px;">${severity}</span>
        </div>
        <div style="padding: 28px 24px; color: #C8C2B6; font-size: 14px; line-height: 1.7;">
          <h2 style="margin: 0 0 16px; color: #D4B97A; font-family: Georgia, serif; font-size: 16px; font-weight: 700; letter-spacing: 1px;">${title}</h2>
          <p style="margin: 0 0 16px;">${message}</p>
          ${contextBlock}
          <p style="margin-top: 24px; font-size: 11px; color: #9B95A9; border-top: 1px solid rgba(184,155,94,0.1); padding-top: 16px;">Automated alert — PayMongo guardrail</p>
        </div>
      </div>
    </div>
  `;
  const textParts = [
    `${title} (${severity.toUpperCase()})`,
    message,
    contextSummary ? `\nContext:\n${contextSummary}` : '',
  ].filter(Boolean);

  try {
    await sendEmail({
      to: recipients,
      subject,
      html,
      text: textParts.join('\n\n'),
    });
    cache.set(cacheKey, now);
  } catch (error) {
    console.error('[PayMongo Alert] Failed to send email notification:', error);
  }
}
