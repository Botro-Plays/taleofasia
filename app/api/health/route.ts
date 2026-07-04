import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'health', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const started = Date.now();
  const db: Record<string, 'ok' | 'error'> = {};
  try {
    await query('webDB', 'SELECT 1 AS ok');
    db.webDB = 'ok';
  } catch {
    db.webDB = 'error';
  }
  try {
    await query('userDB', 'SELECT 1 AS ok');
    db.userDB = 'ok';
  } catch {
    db.userDB = 'error';
  }
  return NextResponse.json({ ok: true, uptime: process.uptime(), ms: Date.now() - started, db });
}
