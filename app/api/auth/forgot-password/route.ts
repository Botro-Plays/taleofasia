import { NextRequest, NextResponse } from 'next/server';
import { userDB, webDB } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/mail';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { isRecaptchaEnabled, verifyRecaptchaToken } from '@/lib/recaptcha';
import crypto from 'crypto';

const TOKEN_TABLE = 'WebPasswordResets';

async function ensureTokenTable() {
  const check = await webDB.query(`
    SELECT 1 AS HasTable FROM sys.tables WHERE name = N'${TOKEN_TABLE}'
  `);
  if (!check.recordset[0]?.HasTable) {
    await webDB.query(`
      CREATE TABLE ${TOKEN_TABLE} (
        Token VARCHAR(64) PRIMARY KEY,
        AccountName VARCHAR(100) NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        Used BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'auth-forgot-password', 3, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const body = await request.json();
    const { email, recaptchaToken } = body;

    // Verify reCAPTCHA if enabled
    const captchaOn = await isRecaptchaEnabled();
    if (captchaOn) {
      if (!recaptchaToken) {
        return NextResponse.json({ error: 'reCAPTCHA verification required' }, { status: 400 });
      }
      const valid = await verifyRecaptchaToken(recaptchaToken);
      if (!valid) {
        return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists with this email
    const userCheck = await userDB.query(
      'SELECT AccountName FROM UserInfo WHERE Email = @email',
      { email }
    );

    if (userCheck.recordset.length === 0) {
      // Don't reveal that email doesn't exist for security
      return NextResponse.json(
        { message: 'If an account exists with that email, you will receive password reset instructions shortly.' },
        { status: 200 }
      );
    }

    const username = userCheck.recordset[0].AccountName;

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Ensure token table exists
    await ensureTokenTable();

    // Store reset token in WebDB
    await webDB.query(`
      INSERT INTO ${TOKEN_TABLE} (Token, AccountName, ExpiresAt, Used)
      VALUES (@token, @username, @expiresAt, 0)
    `, {
      token: resetToken,
      username,
      expiresAt,
    });

    // Build reset URL
    const siteUrl = process.env.NEXTAUTH_URL || 'https://taleofasia.com';
    const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (mailErr) {
      console.error('Failed to send password reset email:', mailErr);
      // Don't expose mail errors to client; still return generic success
    }

    // Log the password reset request
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'PASSWORD_RESET_REQUEST', 'Password reset requested', @ip)
    `, {
      username,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json(
      { message: 'If an account exists with that email, you will receive password reset instructions shortly.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
