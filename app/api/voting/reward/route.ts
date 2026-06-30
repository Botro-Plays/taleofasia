import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';
import { logApi, logError } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;
    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reward config first
    const rewardConfig = await webDB.query(`
      SELECT ConfigKey, ConfigValue FROM WebsiteConfigs 
      WHERE ConfigKey = 'vote_reward_vp'
    `);
    const configMap: Record<string, string> = {};
    rewardConfig.recordset.forEach((r: any) => { configMap[r.ConfigKey] = r.ConfigValue; });
    const rewardPerVote = Math.max(1, parseInt(configMap['vote_reward_vp'] || '5', 10));

    // STEP 1: Atomically mark all unclaimed votes as claimed FIRST.
    // This prevents race conditions where two concurrent requests both see
    // unclaimed votes and both award VP before either marks them claimed.
    const claimResult = await webDB.query(`
      UPDATE VoteLogs
      SET RewardClaimed = 1, RewardClaimedAt = GETDATE()
      WHERE AccountName = @username AND RewardClaimed = 0
    `, { username });

    const claimedCount = claimResult.rowsAffected[0];
    if (claimedCount === 0) {
      return NextResponse.json(
        { error: 'No pending vote found. Please vote first.' },
        { status: 400 }
      );
    }

    const totalReward = rewardPerVote * claimedCount;

    // STEP 2: Award Vote Points (upsert). Votes are already marked, so if this
    // fails VP is lost but votes won't re-award — admin can manually correct.
    await webDB.query(`
      MERGE WebVotePoints AS t
      USING (SELECT @username AS AccountName) AS s
      ON t.AccountName = s.AccountName
      WHEN MATCHED THEN
        UPDATE SET VotePoints = VotePoints + @reward, TotalEarned = TotalEarned + @reward, UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (AccountName, VotePoints, TotalEarned) VALUES (@username, @reward, @reward);
    `, { reward: totalReward, username });

    // Log the reward
    await logApi({
      action: 'ADMIN_ACTION',
      account: username,
      details: `VOTE_REWARD: Awarded ${totalReward} VP for ${claimedCount} vote${claimedCount !== 1 ? 's' : ''}`,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    // Invalidate voting logs cache so dashboard updates immediately
    invalidate(`votelogs:${username}`);

    // Fetch updated VP balance
    const vpResult = await webDB.query(`
      SELECT VotePoints FROM WebVotePoints WHERE AccountName = @username
    `, { username });
    const newBalance = vpResult.recordset[0]?.VotePoints ?? 0;

    return NextResponse.json({
      message: `Successfully claimed ${totalReward} VP from ${claimedCount} vote${claimedCount !== 1 ? 's' : ''}!`,
      reward: totalReward,
      votePoints: newBalance,
      votesClaimed: claimedCount,
    });
  } catch (error) {
    await logError({ where: 'voting/reward', error, account: undefined, ip: '127.0.0.1' });
    return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
  }
}
