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

    // Fetch all unclaimed votes
    const voteCheck = await webDB.query(`
      SELECT LogID
      FROM VoteLogs
      WHERE AccountName = @username AND RewardClaimed = 0
      ORDER BY VoteTime ASC
    `, { username });

    if (voteCheck.recordset.length === 0) {
      return NextResponse.json(
        { error: 'No pending vote found. Please vote first.' },
        { status: 400 }
      );
    }

    const unclaimedCount = voteCheck.recordset.length;

    // Get reward amount from config
    const rewardConfig = await webDB.query(`
      SELECT ConfigKey, ConfigValue FROM WebsiteConfigs 
      WHERE ConfigKey IN ('vote_reward_vp', 'vote_reward_cooldown_hours')
    `);
    const configMap: Record<string, string> = {};
    rewardConfig.recordset.forEach((r: any) => { configMap[r.ConfigKey] = r.ConfigValue; });
    const rewardPerVote = parseInt(configMap['vote_reward_vp'] || '5');
    const totalReward = rewardPerVote * unclaimedCount;

    // Award Vote Points to user (upsert)
    await webDB.query(`
      MERGE WebVotePoints AS t
      USING (SELECT @username AS AccountName) AS s
      ON t.AccountName = s.AccountName
      WHEN MATCHED THEN
        UPDATE SET VotePoints = VotePoints + @reward, TotalEarned = TotalEarned + @reward, UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (AccountName, VotePoints, TotalEarned) VALUES (@username, @reward, @reward);
    `, {
      reward: totalReward,
      username,
    });

    // Atomically mark all unclaimed votes as claimed
    const claimResult = await webDB.query(`
      UPDATE VoteLogs
      SET RewardClaimed = 1, RewardClaimedAt = GETDATE()
      WHERE AccountName = @username AND RewardClaimed = 0
    `, { username });

    if (claimResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { error: 'Reward already claimed. Please vote again.' },
        { status: 400 }
      );
    }

    // Log the reward
    await logApi({
      action: 'ADMIN_ACTION',
      account: username,
      details: `VOTE_REWARD: Awarded ${totalReward} VP for ${unclaimedCount} vote${unclaimedCount !== 1 ? 's' : ''}`,
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
      message: `Successfully claimed ${totalReward} VP from ${unclaimedCount} vote${unclaimedCount !== 1 ? 's' : ''}!`,
      reward: totalReward,
      votePoints: newBalance,
      votesClaimed: unclaimedCount,
    });
  } catch (error) {
    await logError({ where: 'voting/reward', error, account: undefined, ip: '127.0.0.1' });
    return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
  }
}
