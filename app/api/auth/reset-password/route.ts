import { NextRequest, NextResponse } from 'next/server';
import { userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

const TOKEN_TABLE = 'WebPasswordResets';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'auth-reset-password', 5, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 20 characters long' },
        { status: 400 }
      );
    }

    // Look up the token
    const tokenCheck = await webDB.query(`
      SELECT AccountName, ExpiresAt, Used
      FROM ${TOKEN_TABLE}
      WHERE Token = @token
    `, { token });

    if (tokenCheck.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const row = tokenCheck.recordset[0];

    if (row.Used) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      );
    }

    if (new Date(row.ExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired' },
        { status: 400 }
      );
    }

    const username = row.AccountName;

    // Update password in UserInfo
    await userDB.query(`
      UPDATE UserInfo
      SET Password = @password
      WHERE AccountName = @username
    `, { password, username });

    // Mark token as used
    await webDB.query(`
      UPDATE ${TOKEN_TABLE}
      SET Used = 1
      WHERE Token = @token
    `, { token });

    // Log the password reset
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PASSWORD_RESET_COMPLETE', 'Password reset completed', @ip)
    `, {
      username,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json(
      { message: 'Password has been reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
