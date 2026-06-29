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
  const limit = rateLimiter.check(ip, 'auth-register', 15, 15 * 60 * 1000);
  if (!limit.allowed) {
    console.warn(`[register] Rate limit hit for IP: ${ip}, retry after ${limit.retryAfter}s`);
    return rateLimitResponse(limit.retryAfter);
  }

  try {
    const body = await request.json();
    const { username, email, password, recaptchaToken } = body;

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

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 20 characters long' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const usernameCheck = await userDB.query(
      'SELECT COUNT(*) as count FROM UserInfo WHERE AccountName = @username',
      { username }
    );

    if (usernameCheck.recordset[0].count > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const emailCheck = await userDB.query(
      'SELECT COUNT(*) as count FROM UserInfo WHERE Email = @email',
      { email }
    );

    if (emailCheck.recordset[0].count > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(16).toString('hex');

    // Format registration date
    const regisDay = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    // Insert new user into UserInfo
    await userDB.query(`
      INSERT INTO UserInfo (
        AccountName, 
        Password, 
        RegisDay, 
        Flag, 
        Active, 
        ActiveCode, 
        Coins, 
        Email, 
        GameMasterType, 
        GameMasterLevel, 
        GameMasterMacAddress, 
        CoinsTraded, 
        BanStatus, 
        UnbanDate
      ) VALUES (
        @username, 
        @password, 
        @regisDay, 
        '64', 
        '0', 
        @token, 
        '0', 
        @email, 
        '0', 
        '0', 
        '0', 
        '0', 
        '0', 
        NULL
      )
    `, {
      username,
      password, // Note: In production, this should be hashed
      regisDay,
      token: verificationToken,
      email,
    });

    // Create web user preferences
    await webDB.query(`
      INSERT INTO WebUserPreferences (AccountName, Theme, NotificationsEnabled)
      VALUES (@username, 'dark', 1)
    `, { username });

    // Log the registration
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'REGISTER', 'User registered successfully', @ip)
    `, {
      username,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    // Generate verification token and store in WebDB
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await ensureVerifyTable();
    await webDB.query(`
      INSERT INTO ${VERIFY_TABLE} (Token, AccountName, ExpiresAt, Used)
      VALUES (@token, @username, @expiresAt, 0)
    `, {
      token: verifyToken,
      username,
      expiresAt: verifyExpires,
    });

    // Send verification email
    const siteUrl = process.env.NEXTAUTH_URL || 'https://taleofasia.com';
    const verifyUrl = `${siteUrl}/verify-email?token=${verifyToken}`;

    try {
      await sendVerificationEmail(email, verifyUrl);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
      // Continue; user can request resend later
    }

    return NextResponse.json(
      { message: 'Registration successful. Please check your email to verify your account.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
