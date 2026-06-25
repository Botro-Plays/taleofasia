import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;

    const logs = await cached(`votelogs:${username}`, 15_000, async () => {
      const votingLogsResult = await webDB.query(`
        SELECT TOP 10 LogID, VoteTime, IPAddress AS IP, RewardClaimed
        FROM VoteLogs
        WHERE AccountName = @username
        ORDER BY VoteTime DESC
      `, { username });
      return votingLogsResult.recordset;
    });

    return NextResponse.json(logs, { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (error) {
    console.error('Error fetching voting logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voting logs' },
      { status: 500 }
    );
  }
}
