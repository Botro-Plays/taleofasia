import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { clanDB } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

function create24bitBmp(rawRgb: Buffer, width: number, height: number): Buffer {
  const rowSize = width * 3;
  const padding = (4 - (rowSize % 4)) % 4;
  const paddedRowSize = rowSize + padding;
  const pixelDataSize = paddedRowSize * height;
  const fileSize = 14 + 40 + pixelDataSize;

  const bmp = Buffer.alloc(fileSize);
  let offset = 0;

  // BMP File Header (14 bytes)
  bmp.write('BM', offset); offset += 2;
  bmp.writeUInt32LE(fileSize, offset); offset += 4;
  bmp.writeUInt16LE(0, offset); offset += 2;
  bmp.writeUInt16LE(0, offset); offset += 2;
  bmp.writeUInt32LE(14 + 40, offset); offset += 4;

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  bmp.writeUInt32LE(40, offset); offset += 4;
  bmp.writeInt32LE(width, offset); offset += 4;
  bmp.writeInt32LE(height, offset); offset += 4;
  bmp.writeUInt16LE(1, offset); offset += 2;
  bmp.writeUInt16LE(24, offset); offset += 2;
  bmp.writeUInt32LE(0, offset); offset += 4;
  bmp.writeUInt32LE(pixelDataSize, offset); offset += 4;
  bmp.writeInt32LE(2835, offset); offset += 4;
  bmp.writeInt32LE(2835, offset); offset += 4;
  bmp.writeUInt32LE(0, offset); offset += 4;
  bmp.writeUInt32LE(0, offset); offset += 4;

  // Pixel data (BMP stores rows bottom-to-top, BGR order)
  for (let y = height - 1; y >= 0; y--) {
    const srcOffset = y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = srcOffset + x * 3;
      bmp[offset++] = rawRgb[srcIdx + 2]; // B
      bmp[offset++] = rawRgb[srcIdx + 1]; // G
      bmp[offset++] = rawRgb[srcIdx];     // R
    }
    offset += padding;
  }

  return bmp;
}

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
      // Check file size (max 5MB for source image)
      if (clanImage.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
      }

      // Convert file to buffer
      const bytes = await clanImage.arrayBuffer();
      const inputBuffer = Buffer.from(bytes);

      // Use sharp to resize to 32x32 and get raw RGB pixel data
      const rawRgb = await sharp(inputBuffer)
        .resize(32, 32, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();

      // Construct 24-bit BMP from raw pixels
      const bmpBuffer = create24bitBmp(rawRgb, 32, 32);

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
      await writeFile(filepath, bmpBuffer);

      return NextResponse.json({ success: true, message: 'Clan image uploaded and converted to 32x32 24-bit BMP successfully' });
    }

    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  } catch (error) {
    console.error('Error uploading clan image:', error);
    return NextResponse.json(
      { error: 'Failed to upload clan image. Please ensure the file is a valid image.' },
      { status: 500 }
    );
  }
}
