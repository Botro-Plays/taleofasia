// Simple server-side logging utility
// Usage: await logApi({ action: 'PAYMENT_CREATED', account: 'foo', details: '...' })
import { webDB } from '@/lib/db';

export type LogAction =
  | 'LOGIN'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_FAILED'
  | 'ADMIN_ACTION'
  | 'ERROR';

export async function logApi({
  action,
  account,
  details,
  ip,
  isHidden,
}: {
  action: LogAction;
  account?: string | null;
  details?: string | null;
  ip?: string | null;
  isHidden?: boolean;
}) {
  try {
    await webDB.query(
      'INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress, IsHidden) VALUES (@account, @action, @details, @ip, @isHidden)',
      {
        account: account ?? null,
        action,
        details: details ?? null,
        ip: ip ?? '127.0.0.1',
        isHidden: isHidden ? 1 : 0,
      }
    );
  } catch (e) {
     
    console.error('Failed to write audit log', e);
  }
}

export async function logError({
  where,
  error,
  account,
  ip,
}: {
  where: string;
  error: unknown;
  account?: string | null;
  ip?: string | null;
}) {
  const message = typeof error === 'string' ? error : (error as any)?.message || 'Unknown error';
  await logApi({ action: 'ERROR', account, details: `${where}: ${message}`, ip, isHidden: true });
}
