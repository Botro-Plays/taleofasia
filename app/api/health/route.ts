import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
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
