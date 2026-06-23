import { webDB } from '@/lib/db';

export interface WebhookPayloadInsert {
  provider: string;
  eventType?: string;
  gatewayTransactionId?: string;
  payload: string;
  status: string;
  ip: string;
}

export async function insertWebhookPayload(data: WebhookPayloadInsert): Promise<number> {
  const result = await webDB.query(
    `INSERT INTO WebhookPayloads (Provider, EventType, GatewayTransactionID, Payload, Status, IPAddress, Timestamp)
     OUTPUT INSERTED.LogID
     VALUES (@provider, @eventType, @gatewayTransactionId, @payload, @status, @ip, GETDATE())`,
    {
      provider: data.provider,
      eventType: data.eventType || null,
      gatewayTransactionId: data.gatewayTransactionId || null,
      payload: data.payload,
      status: data.status,
      ip: data.ip,
    }
  );
  return result.recordset?.[0]?.LogID ?? 0;
}

export async function updateWebhookPayloadStatus(
  logId: number,
  status: string,
  gatewayTransactionId?: string
): Promise<void> {
  if (gatewayTransactionId) {
    await webDB.query(
      `UPDATE WebhookPayloads
       SET Status = @status, GatewayTransactionID = @gatewayTransactionId
       WHERE LogID = @logId`,
      { status, gatewayTransactionId, logId }
    );
  } else {
    await webDB.query(
      `UPDATE WebhookPayloads
       SET Status = @status
       WHERE LogID = @logId`,
      { status, logId }
    );
  }
}

export async function cleanupOldWebhookPayloads(retentionDays = 30): Promise<number> {
  const result = await webDB.query(
    `DELETE FROM WebhookPayloads WHERE Timestamp < DATEADD(day, -@retentionDays, GETDATE())`,
    { retentionDays }
  );
  return result.rowsAffected?.[0] ?? 0;
}
