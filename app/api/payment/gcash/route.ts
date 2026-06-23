import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;
    const body = await request.json();
    const { amount, referenceNumber } = body;

    if (!amount || !referenceNumber) {
      return NextResponse.json(
        { error: 'Amount and reference number are required' },
        { status: 400 }
      );
    }

    // Create transaction record
    const transactionId = crypto.randomUUID();

    await webDB.query(`
      INSERT INTO PaymentTransactions (TransactionID, AccountName, Amount, Currency, PaymentMethod, Status, GatewayTransactionID, CreatedAt)
      VALUES (@transactionId, @username, @amount, 'PHP', 'GCash', 'pending', @referenceNumber, GETDATE())
    `, {
      transactionId,
      username,
      amount,
      referenceNumber,
    });

    // Log the payment request
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PAYMENT_REQUEST', 'GCash payment: ' + @amount + ' PHP, Ref: ' + @referenceNumber, @ip)
    `, {
      username,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ 
      message: 'Payment request submitted',
      transactionId
    });
  } catch (error) {
    console.error('Error processing GCash payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
