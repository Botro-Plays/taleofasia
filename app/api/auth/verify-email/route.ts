import { NextRequest, NextResponse } from 'next/server';
import { userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

const VERIFY_TABLE = 'WebVerificationTokens';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'verify-email', 10, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

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

    // Activate the account (Flag = 98 means verified, Active = 1 means active)
    const updateResult = await userDB.query(`
      UPDATE UserInfo
      SET Active = '1', Flag = '98', ActiveCode = '0'
      WHERE AccountName = @username
    `, { username });

    const rowsAffected = updateResult.rowsAffected?.[0] ?? 0;
    if (rowsAffected === 0) {
      console.error(`[verify-email] UPDATE affected 0 rows for account: ${username}`);
      return NextResponse.json(
        { error: 'Failed to activate account. Please contact support.' },
        { status: 500 }
      );
    }

    // Verify the update was applied
    const verifyCheck = await userDB.query(`
      SELECT Active, Flag FROM UserInfo WHERE AccountName = @username
    `, { username });
    const verifyRow = verifyCheck.recordset[0];
    if (!verifyRow || String(verifyRow.Active) !== '1' || String(verifyRow.Flag) !== '98') {
      console.error(`[verify-email] Post-UPDATE verification failed for ${username}:`, verifyRow);
      return NextResponse.json(
        { error: 'Account activation could not be confirmed. Please contact support.' },
        { status: 500 }
      );
    }

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
        ip: ip.substring(0, 50),
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
