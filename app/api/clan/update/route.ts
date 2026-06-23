import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { clanDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clanID, characterName, loginMessage } = body;

    if (!clanID || !characterName) {
      return NextResponse.json({ error: 'Invalid Clan ID or Character Name' }, { status: 400 });
    }

    // Update login message in ClanList table
    if (loginMessage !== undefined) {
      const result = await clanDB.query(`
        UPDATE ClanList 
        SET LoginMessage = @loginMessage 
        WHERE ID = @clanID AND ClanLeader = @characterName
      `, { 
        loginMessage, 
        clanID, 
        characterName 
      });

      if (result.rowsAffected[0] === 0) {
        return NextResponse.json({ error: 'Failed to update login message. You may not be the clan leader.' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, message: 'Login message updated successfully' });
  } catch (error) {
    console.error('Error updating clan:', error);
    return NextResponse.json(
      { error: 'Failed to update clan details' },
      { status: 500 }
    );
  }
}
