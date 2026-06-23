import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

const ALLOWED_EXT = new Set(['.zip', '.rar', '.7z', '.exe']);

interface MagicCheck {
  sig: number[];
  offset?: number;
  type: string;
}

const MAGIC_CHECKS: MagicCheck[] = [
  { sig: [0x50, 0x4B, 0x03, 0x04], type: 'zip' },
  { sig: [0x50, 0x4B, 0x05, 0x06], type: 'zip' },
  { sig: [0x50, 0x4B, 0x07, 0x08], type: 'zip' },
  { sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], type: 'rar' },
  { sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00], type: 'rar' },
  { sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], type: '7z' },
  { sig: [0x4D, 0x5A], type: 'exe' },
];

function detectType(buffer: Buffer): string | null {
  for (const check of MAGIC_CHECKS) {
    const offset = check.offset || 0;
    if (offset + check.sig.length > buffer.length) continue;
    const matches = check.sig.every((byte, i) => buffer[offset + i] === byte);
    if (matches) return check.type;
  }
  return null;
}

function getExt(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.zip' || ext === '.rar' || ext === '.7z' || ext === '.exe') return ext;
  // Some archives use generic extensions
  return ext;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = session.user.id;
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const originalName = String((file as any).name || 'upload.bin');
    const ext = getExt(originalName);
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: 'Only .zip, .rar, .7z, .exe files are allowed' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const detected = detectType(buffer);
    if (!detected) {
      return NextResponse.json({ error: 'File content does not match allowed types' }, { status: 400 });
    }

    // Ensure extension matches detected type
    const extToType: Record<string, string> = {
      '.zip': 'zip',
      '.rar': 'rar',
      '.7z': '7z',
      '.exe': 'exe',
    };
    if (extToType[ext] && extToType[ext] !== detected) {
      return NextResponse.json({ error: `File appears to be ${detected}, not ${extToType[ext]}` }, { status: 400 });
    }

    const safeBase = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `${Date.now()}-${safeBase}`;

    const dir = path.join(process.cwd(), 'public', 'downloads');
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, finalName);
    await fs.writeFile(full, buffer);

    const url = `/downloads/${encodeURIComponent(finalName)}`;
    return NextResponse.json({ ok: true, url, filename: finalName, size: buffer.length });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
