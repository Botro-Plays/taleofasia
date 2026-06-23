import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const MAINTENANCE_FILE = path.join(process.cwd(), 'maintenance.php');

function getMaintenanceStatus(): boolean {
  try {
    if (!existsSync(MAINTENANCE_FILE)) return false;
    const content = readFileSync(MAINTENANCE_FILE, 'utf-8');
    return /return\s+true\s*;/.test(content);
  } catch {
    return false;
  }
}

function setMaintenanceStatus(enabled: boolean): void {
  const content = `<?php
// Set to true to activate maintenance mode, or false to deactivate
return ${enabled ? 'true' : 'false'}; // Set this to true or false based on your needs
?>`;
  writeFileSync(MAINTENANCE_FILE, content, 'utf-8');
}

async function checkAdmin(sessionUser: { id?: string | null }) {
  if (!sessionUser?.id) return false;
  const result = await userDB.query(
    `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @actor`,
    { actor: sessionUser.id }
  );
  if (!result.recordset.length) return false;
  const gm = result.recordset[0];
  return gm.GameMasterType === 1 && gm.GameMasterLevel >= 4;
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-maintenance', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session.user);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ maintenance: getMaintenanceStatus() });
  } catch (error) {
    console.error('Maintenance GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-maintenance-toggle', 10, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session.user);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : !getMaintenanceStatus();

    setMaintenanceStatus(enabled);

    return NextResponse.json({ maintenance: enabled, message: enabled ? 'Maintenance mode ENABLED' : 'Maintenance mode DISABLED' });
  } catch (error) {
    console.error('Maintenance POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
