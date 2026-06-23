import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const events = await webDB.query(`
      SELECT EventID, Name, Description, StartDate, EndDate, Type, Status, CreatedAt
      FROM Events
      ORDER BY StartDate DESC
    `);

    return NextResponse.json(events.recordset);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { Name, Description, StartDate, EndDate, Type, Status } = body;

    const result = await webDB.query(`
      INSERT INTO Events (Name, Description, StartDate, EndDate, Type, Status, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.EventID
      VALUES (@name, @desc, @start, @end, @type, @status, GETDATE(), GETDATE())
    `, {
      name: Name,
      desc: Description || '',
      start: StartDate,
      end: EndDate,
      type: Type || 'special',
      status: Status || 'upcoming',
    });

    return NextResponse.json({ eventId: result.recordset[0].EventID, message: 'Event created' });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { EventID, Name, Description, StartDate, EndDate, Type, Status } = body;

    await webDB.query(`
      UPDATE Events
      SET Name = @name, Description = @desc, StartDate = @start, EndDate = @end,
          Type = @type, Status = @status, UpdatedAt = GETDATE()
      WHERE EventID = @id
    `, {
      id: EventID,
      name: Name,
      desc: Description || '',
      start: StartDate,
      end: EndDate,
      type: Type || 'special',
      status: Status || 'upcoming',
    });

    return NextResponse.json({ message: 'Event updated' });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    await webDB.query(`
      DELETE FROM Events WHERE EventID = @id
    `, { id: parseInt(id) });

    return NextResponse.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
