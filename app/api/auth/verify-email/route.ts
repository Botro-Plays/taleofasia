import { NextRequest, NextResponse } from 'next/server';
import { userDB, webDB } from '@/lib/db';

const VERIFY_TABLE = 'WebVerificationTokens';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Look up the token
    const tokenCheck = await webDB.query(`
      SELECT AccountName, ExpiresAt, Used
      FROM ${VERIFY_TABLE}
      WHERE Token = @token
    `, { token });

    if (tokenCheck.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    const row = tokenCheck.recordset[0];

    if (row.Used) {
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      );
    }

    if (new Date(row.ExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This verification link has expired' },
        { status: 400 }
      );
    }

    const username = row.AccountName;

    // Activate the account (Flag = 98 means activated, ActiveCode = 0 clears verification hash)
    await userDB.query(`
      UPDATE UserInfo
      SET Active = '1', Flag = '98', ActiveCode = '0'
      WHERE AccountName = @username
    `, { username });

    // Mark token as used (non-critical — account is already activated)
    try {
      await webDB.query(`
        UPDATE ${VERIFY_TABLE}
        SET Used = 1
        WHERE Token = @token
      `, { token });
    } catch (e) {
      console.error('Failed to mark verification token as used:', e);
    }

    // Log verification (non-critical)
    try {
      await webDB.query(`
        INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
        VALUES (@username, 'EMAIL_VERIFIED', 'Email verified successfully', @ip)
      `, {
        username,
        ip: request.headers.get('x-forwarded-for') || '127.0.0.1'
      });
    } catch (e) {
      console.error('Failed to log verification audit:', e);
    }

    return NextResponse.json(
      { message: 'Email verified successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
