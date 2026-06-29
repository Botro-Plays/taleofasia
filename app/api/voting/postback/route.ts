import { NextRequest, NextResponse } from 'next/server';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';
import { resolve4, resolve6 } from 'dns';
import { promisify } from 'util';

const resolve4Async = promisify(resolve4);
const resolve6Async = promisify(resolve6);

// Cache resolved IPs for 5 minutes to avoid DNS lookup on every request
let cachedIps: Set<string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getXtremeTop100Ips(): Promise<Set<string>> {
  if (cachedIps && Date.now() - cacheTime < CACHE_TTL) {
    return cachedIps;
  }

  const ips = new Set<string>();
  try {
    const ipv4s = await resolve4Async('xtremetop100.com');
    ipv4s.forEach(ip => ips.add(ip));
  } catch {}
  try {
    const ipv6s = await resolve6Async('xtremetop100.com');
    ipv6s.forEach(ip => ips.add(ip));
  } catch {}

  cachedIps = ips;
  cacheTime = Date.now();
  return ips;
}

function getClientIP(request: NextRequest): string | null {
  const cfConnecting = request.headers.get('cf-connecting-ip');
  if (cfConnecting) return cfConnecting.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Check if testing mode is enabled
    const testingModeResult = await webDB.query(`
      SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_testing_mode'
    `);
    const testingMode = testingModeResult.recordset[0]?.ConfigValue === 'true';

    const clientIP = getClientIP(request);

    if (!testingMode) {
      const allowedIps = await getXtremeTop100Ips();
      if (!clientIP || !allowedIps.has(clientIP)) {
        console.warn(`[postback] Rejected request from IP: ${clientIP || 'unknown'} (allowed: ${[...allowedIps].join(', ')})`);
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const votingIp = searchParams.get('votingip');
    const username = searchParams.get('custom');

    if (!votingIp || !username) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // XtremeTop100 custom param allows only [A-Z 0-9]
    if (!/^[A-Za-z0-9]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username format' },
        { status: 400 }
      );
    }

    if (!testingMode) {
      // Check for duplicate postback — reject if a vote from this IP already exists within cooldown
      const cooldownResult = await webDB.query(`
        SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_reward_cooldown_hours'
      `);
      const cooldownHours = parseInt(cooldownResult.recordset[0]?.ConfigValue || '12');

      const duplicateCheck = await webDB.query(`
        SELECT TOP 1 LogID FROM VoteLogs
        WHERE IPAddress = @ip AND VoteTime > DATEADD(HOUR, -@cooldown, GETDATE())
      `, { ip: votingIp, cooldown: cooldownHours });

      if (duplicateCheck.recordset.length > 0) {
        console.warn(`[postback] Duplicate vote from IP: ${votingIp} for user: ${username}`);
        return NextResponse.json(
          { error: 'Duplicate vote' },
          { status: 409 }
        );
      }

      // Verify the account exists before logging the vote
      const userCheck = await userDB.query(`
        SELECT AccountName FROM UserInfo WHERE AccountName = @username
      `, { username });

      if (userCheck.recordset.length === 0) {
        console.warn(`[postback] Vote for non-existent account: ${username}`);
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // Log the vote
    await webDB.query(`
      INSERT INTO VoteLogs (AccountName, VoteTime, IPAddress, RewardClaimed)
      VALUES (@username, GETDATE(), @ip, 0)
    `, {
      username,
      ip: votingIp,
    });

    // Invalidate voting logs cache so dashboard shows the new vote immediately
    invalidate(`votelogs:${username}`);

    // Log the postback
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'VOTE_POSTBACK', 'Vote postback received from xtremetop100', @ip)
    `, {
      username,
      ip: votingIp,
    });

    return NextResponse.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error processing vote postback:', error);
    return NextResponse.json(
      { error: 'Failed to process vote' },
      { status: 500 }
    );
  }
}
