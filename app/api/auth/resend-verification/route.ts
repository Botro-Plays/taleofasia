import { NextRequest, NextResponse } from 'next/server';
import { userDB, webDB } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mail';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { isRecaptchaEnabled, verifyRecaptchaToken } from '@/lib/recaptcha';
import crypto from 'crypto';

const VERIFY_TABLE = 'WebVerificationTokens';

async function ensureVerifyTable() {
  const check = await webDB.query(`
    SELECT 1 AS HasTable FROM sys.tables WHERE name = N'${VERIFY_TABLE}'
  `);
  if (!check.recordset[0]?.HasTable) {
    await webDB.query(`
      CREATE TABLE ${VERIFY_TABLE} (
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
  const limit = rateLimiter.check(ip, 'auth-resend-verification', 3, 15 * 60 * 1000);
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

    // Find user by email
    const userCheck = await userDB.query(
      'SELECT AccountName, Active FROM UserInfo WHERE Email = @email',
      { email }
    );

    if (userCheck.recordset.length === 0) {
      // Don't reveal that email doesn't exist
      return NextResponse.json(
        { message: 'If an account exists with that email, you will receive verification instructions shortly.' },
        { status: 200 }
      );
    }

    const user = userCheck.recordset[0];
    const username = user.AccountName;

    // If already active, no need to resend
    if (user.Active === '1' || user.Active === 1) {
      return NextResponse.json(
        { message: 'Account is already verified.' },
        { status: 200 }
      );
    }

    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await ensureVerifyTable();

    // Store new token (old tokens remain but will be ignored once one is used)
    await webDB.query(`
      INSERT INTO ${VERIFY_TABLE} (Token, AccountName, ExpiresAt, Used)
      VALUES (@token, @username, @expiresAt, 0)
    `, {
      token: verifyToken,
      username,
      expiresAt: verifyExpires,
    });

    // Build verification URL
    const siteUrl = process.env.NEXTAUTH_URL || 'https://taleofasia.com';
    const verifyUrl = `${siteUrl}/verify-email?token=${verifyToken}`;

    // Send email
    try {
      await sendVerificationEmail(email, verifyUrl);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
      return NextResponse.json(
        { error: 'Unable to send verification email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'If an account exists with that email, you will receive verification instructions shortly.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
