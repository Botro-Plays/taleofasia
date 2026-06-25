import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
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

    // Fetch user's most recent vote log
    const voteCheck = await webDB.query(`
      SELECT TOP 1 LogID, VoteTime, RewardClaimed
      FROM VoteLogs
      WHERE AccountName = @username
      ORDER BY VoteTime DESC
    `, { username });

    if (voteCheck.recordset.length === 0) {
      return NextResponse.json(
        { error: 'No pending vote found. Please vote first.' },
        { status: 400 }
      );
    }

    const lastVote = voteCheck.recordset[0];

    if (lastVote.RewardClaimed === 1) {
      return NextResponse.json(
        { error: 'Reward already claimed. Please vote again.' },
        { status: 400 }
      );
    }

    // Get reward amount and cooldown from config
    const rewardConfig = await webDB.query(`
      SELECT ConfigKey, ConfigValue FROM WebsiteConfigs 
      WHERE ConfigKey IN ('vote_reward_coins', 'vote_reward_cooldown_hours')
    `);
    const configMap: Record<string, string> = {};
    rewardConfig.recordset.forEach((r: any) => { configMap[r.ConfigKey] = r.ConfigValue; });
    const rewardAmount = parseInt(configMap['vote_reward_coins'] || '5');
    const cooldownHours = parseInt(configMap['vote_reward_cooldown_hours'] || '12');

    // Check cooldown — reject if vote was within cooldown period
    const voteTime = new Date(lastVote.VoteTime);
    const hoursSinceVote = (Date.now() - voteTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceVote < cooldownHours) {
      const hoursLeft = Math.ceil(cooldownHours - hoursSinceVote);
      return NextResponse.json(
        { error: `Please wait ${hoursLeft} more hour${hoursLeft !== 1 ? 's' : ''} before claiming your reward.` },
        { status: 400 }
      );
    }

    // Award coins to user
    await userDB.query(`
      UPDATE UserInfo
      SET Coins = Coins + @reward
      WHERE AccountName = @username
    `, {
      reward: rewardAmount,
      username,
    });

    // Atomically mark vote as claimed (prevents race condition double-claim)
    const claimResult = await webDB.query(`
      UPDATE VoteLogs
      SET RewardClaimed = 1
      WHERE LogID = @logId AND RewardClaimed = 0
    `, { logId: lastVote.LogID });

    if (claimResult.rowsAffected[0] === 0) {
      // Another request already claimed this vote
      return NextResponse.json(
        { error: 'Reward already claimed. Please vote again.' },
        { status: 400 }
      );
    }

    // Log the reward
    await logApi({
      action: 'ADMIN_ACTION',
      account: username,
      details: `VOTE_REWARD: Awarded ${rewardAmount} coins for voting`,
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      message: `Successfully claimed ${rewardAmount} coins!`,
      reward: rewardAmount
    });
  } catch (error) {
    await logError({ where: 'voting/reward', error, account: undefined, ip: '127.0.0.1' });
    return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
  }
}
