import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const result = await webDB.query(`
      SELECT VotePoints, TotalEarned, TotalSpent
      FROM WebVotePoints
      WHERE AccountName = @username
    `, { username });

    if (result.recordset.length === 0) {
      return NextResponse.json({ votePoints: 0, totalEarned: 0, totalSpent: 0 });
    }

    const row = result.recordset[0];
    return NextResponse.json({
      votePoints: row.VotePoints,
      totalEarned: row.TotalEarned,
      totalSpent: row.TotalSpent,
    });
  } catch (error) {
    console.error('Error fetching vote points:', error);
    return NextResponse.json({ error: 'Failed to fetch vote points' }, { status: 500 });
  }
}
