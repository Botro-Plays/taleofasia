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

    // Get reward amount from config
    const rewardConfig = await webDB.query(`
      SELECT ConfigValue FROM WebsiteConfigs WHERE ConfigKey = 'vote_reward_coins'
    `);
    const rewardAmount = parseInt(rewardConfig.recordset[0]?.ConfigValue || '5');

    // Award coins to user
    await userDB.query(`
      UPDATE UserInfo
      SET Coins = Coins + @reward
      WHERE AccountName = @username
    `, {
      reward: rewardAmount,
      username,
    });

    // Mark vote as claimed
    await webDB.query(`
      UPDATE VoteLogs
      SET RewardClaimed = 1
      WHERE LogID = @logId
    `, { logId: lastVote.LogID });

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
