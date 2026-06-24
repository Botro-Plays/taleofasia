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

function parseBmpToRawRgb(buf: Buffer): { rawRgb: Buffer; width: number; height: number; bpp: number } {
  // Check BMP signature
  if (buf[0] !== 0x42 || buf[1] !== 0x4D) {
    throw new Error('Not a valid BMP file');
  }

  const dataOffset = buf.readUInt32LE(10);
  const dibHeaderSize = buf.readUInt32LE(14);
  const width = buf.readInt32LE(18);
  const height = Math.abs(buf.readInt32LE(22));
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);

  if (compression !== 0) {
    throw new Error('Compressed BMP files are not supported');
  }

  const rowSize = Math.floor((bpp * width + 31) / 32) * 4;
  const channels = bpp / 8;
  const rawRgb = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    // BMP stores rows bottom-to-top
    const srcRowOffset = dataOffset + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = srcRowOffset + x * channels;
      const dstIdx = (y * width + x) * 3;

      if (bpp === 24) {
        rawRgb[dstIdx] = buf[srcIdx + 2];     // R
        rawRgb[dstIdx + 1] = buf[srcIdx + 1]; // G
        rawRgb[dstIdx + 2] = buf[srcIdx];     // B
      } else if (bpp === 32) {
        rawRgb[dstIdx] = buf[srcIdx + 2];     // R
        rawRgb[dstIdx + 1] = buf[srcIdx + 1]; // G
        rawRgb[dstIdx + 2] = buf[srcIdx];     // B
        // Skip alpha
      } else {
        throw new Error(`Unsupported BMP bit depth: ${bpp}`);
      }
    }
  }

  return { rawRgb, width, height, bpp };
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

      let rawRgb: Buffer;
      let imgWidth: number;
      let imgHeight: number;

      // Check if file is a BMP (sharp cannot read BMP, so handle natively)
      const isBmp = inputBuffer[0] === 0x42 && inputBuffer[1] === 0x4D;

      if (isBmp) {
        // Parse BMP directly
        const parsed = parseBmpToRawRgb(inputBuffer);
        rawRgb = parsed.rawRgb;
        imgWidth = parsed.width;
        imgHeight = parsed.height;
      } else {
        // Use sharp for non-BMP formats (PNG, JPEG, GIF, WebP, etc.)
        const metadata = await sharp(inputBuffer).metadata();
        imgWidth = metadata.width || 0;
        imgHeight = metadata.height || 0;

        rawRgb = await sharp(inputBuffer)
          .resize(32, 32, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer();

        // sharp already resized to 32x32
        imgWidth = 32;
        imgHeight = 32;
      }

      // If BMP wasn't 32x32, we need to resize — but sharp can't read BMP
      // For non-32x32 BMPs, extract raw pixels and use sharp to resize the raw data
      if (isBmp && (imgWidth !== 32 || imgHeight !== 32)) {
        // Convert raw RGB to a sharp-compatible format (raw pixel buffer)
        rawRgb = await sharp(rawRgb, {
          raw: { width: imgWidth, height: imgHeight, channels: 3 }
        })
          .resize(32, 32, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer();
        imgWidth = 32;
        imgHeight = 32;
      }

      // Construct 24-bit BMP from raw pixels
      const bmpBuffer = create24bitBmp(rawRgb, imgWidth, imgHeight);

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
