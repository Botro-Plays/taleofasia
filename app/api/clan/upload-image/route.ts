import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { clanDB } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const clanID = formData.get('clanID') as string;
    const characterName = formData.get('characterName') as string;
    const clanImage = formData.get('clanImage') as File;

    if (!clanID || !characterName) {
      return NextResponse.json({ error: 'Invalid Clan ID or Character Name' }, { status: 400 });
    }

    // Verify user is clan leader
    const clanResult = await clanDB.query(`
      SELECT ClanLeader FROM ClanList WHERE ID = @clanID
    `, { clanID: parseInt(clanID) });

    if (clanResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Clan not found' }, { status: 404 });
    }

    if (clanResult.recordset[0].ClanLeader !== characterName) {
      return NextResponse.json({ error: 'You are not the clan leader' }, { status: 403 });
    }

    // Handle image upload
    if (clanImage) {
      // Check file extension
      const fileExtension = path.extname(clanImage.name).toLowerCase();
      if (fileExtension !== '.bmp') {
        return NextResponse.json({ error: 'Only BMP files are allowed' }, { status: 400 });
      }

      // Check file size (max 1MB)
      if (clanImage.size > 1024 * 1024) {
        return NextResponse.json({ error: 'File size exceeds 1MB limit' }, { status: 400 });
      }

      // Convert file to buffer
      const bytes = await clanImage.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create upload directory if it doesn't exist
      const uploadDir = 'C:/inetpub/wwwroot/ClanImage/';
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      // Generate filename: (1000000 + clanID).bmp
      const filename = `${1000000 + parseInt(clanID)}.bmp`;
      const filepath = path.join(uploadDir, filename);

      // Write file
      await writeFile(filepath, buffer);

      return NextResponse.json({ success: true, message: 'Clan image uploaded successfully' });
    }

    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  } catch (error) {
    console.error('Error uploading clan image:', error);
    return NextResponse.json(
      { error: 'Failed to upload clan image' },
      { status: 500 }
    );
  }
}
