import { NextRequest, NextResponse } from 'next/server';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

function getClientIPFromRequest(request: NextRequest): string | null {
  const cfConnecting = request.headers.get('cf-connecting-ip');
  if (cfConnecting) return cfConnecting.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return null;
}

// XtremeTop100 postback server IPs — configurable via WebsiteConfigs 'vote_allowed_postback_ips'
// XtremeTop100 is now behind Cloudflare, so their postback IPs may change.
// Admin can set a comma-separated IP list in the config. If empty, all IPs are allowed
// (relying on atomic dedup + cooldown as primary protection).
const DEFAULT_ALLOWED_IPS: string[] = [];

export async function GET(request: NextRequest) {
  const rateLimitIp = getClientIP(request);
  const limit = rateLimiter.check(rateLimitIp, 'voting-postback', 20, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const clientIP = getClientIPFromRequest(request);
  console.log(`[postback] Incoming request from server IP: ${clientIP || 'unknown'} params: ${request.nextUrl.search}`);

  try {
    // Check if testing mode is enabled
    const testingModeResult = await webDB.query(`
      SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_testing_mode'
    `);
    const testingMode = testingModeResult.recordset[0]?.ConfigValue === 'true';

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

    // Verify the request is from an allowed source (skip for testing mode with TEST_SIMULATED)
    const isSimulated = testingMode && votingIp === 'TEST_SIMULATED';
    if (!isSimulated) {
      // Check if admin has configured allowed postback IPs
      const allowedIpsResult = await webDB.query(`
        SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_allowed_postback_ips'
      `);
      const allowedIpsRaw = allowedIpsResult.recordset[0]?.ConfigValue || '';
      const allowedIps = allowedIpsRaw
        ? allowedIpsRaw.split(',').map((ip: string) => ip.trim()).filter(Boolean)
        : DEFAULT_ALLOWED_IPS;

      if (allowedIps.length > 0) {
        if (!clientIP || !allowedIps.includes(clientIP)) {
          console.warn(`[postback] Rejected postback from unauthorized IP: ${clientIP || 'unknown'}`);
          return NextResponse.json(
            { error: 'Unauthorized postback source' },
            { status: 403 }
          );
        }
      }
    }

    if (!testingMode) {
      // Get cooldown hours
      const cooldownResult = await webDB.query(`
        SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_reward_cooldown_hours'
      `);
      const cooldownHours = parseInt(cooldownResult.recordset[0]?.ConfigValue || '12');

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

      // Atomic insert with built-in duplicate check — prevents TOCTOU race condition
      // Checks both IP AND accountName within cooldown in a single INSERT
      const insertResult = await webDB.query(`
        INSERT INTO VoteLogs (AccountName, VoteTime, IPAddress, RewardClaimed)
        SELECT @username, GETDATE(), @ip, 0
        WHERE NOT EXISTS (
          SELECT 1 FROM VoteLogs
          WHERE (IPAddress = @ip OR AccountName = @username)
            AND VoteTime > DATEADD(HOUR, -@cooldown, GETDATE())
        )
      `, { username, ip: votingIp, cooldown: cooldownHours });

      const rowsInserted = insertResult.rowsAffected[0] ?? 0;
      if (rowsInserted === 0) {
        console.warn(`[postback] Duplicate vote rejected for user: ${username} IP: ${votingIp}`);
        return NextResponse.json(
          { error: 'Duplicate vote within cooldown' },
          { status: 409 }
        );
      }
    } else {
      // Testing mode: still log but skip duplicate check for simulated votes
      await webDB.query(`
        INSERT INTO VoteLogs (AccountName, VoteTime, IPAddress, RewardClaimed)
        VALUES (@username, GETDATE(), @ip, 0)
      `, { username, ip: votingIp });
    }

    // Update LastVoteTime in WebVotePoints so cooldown survives log purges
    await webDB.query(`
      IF EXISTS (SELECT 1 FROM WebVotePoints WHERE AccountName = @username)
        UPDATE WebVotePoints SET LastVoteTime = GETDATE() WHERE AccountName = @username
      ELSE
        INSERT INTO WebVotePoints (AccountName, VotePoints, LastVoteTime) VALUES (@username, 0, GETDATE())
    `, { username });

    // Invalidate voting logs cache so dashboard shows the new vote immediately
    invalidate(`votelogs:${username}`);

    // Log the postback
    await webDB.query(`
      INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
      VALUES (@username, 'VOTE_POSTBACK', 'Vote postback received from xtremetop100', @ip)
    `, { username, ip: votingIp });

    return NextResponse.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error processing vote postback:', error);
    return NextResponse.json(
      { error: 'Failed to process vote' },
      { status: 500 }
    );
  }
}
