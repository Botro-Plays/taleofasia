import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const LAUNCHER_DIR = path.resolve(process.cwd(), '..', 'launcher-server');
const VERSION_FILE = path.join(LAUNCHER_DIR, 'launcherVersion.dat');
const UPDATE_FILE = path.join(LAUNCHER_DIR, 'updateContents.xml');

async function checkSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const result = await userDB.query(
    `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
    { username: session.user.id }
  );
  if (!result.recordset?.length) return null;
  const user = result.recordset[0];
  const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
  if (!isSuperAdmin) return null;
  return session.user.id;
}

function readVersion(): string {
  try {
    if (!existsSync(VERSION_FILE)) return '1.0.0.0';
    return readFileSync(VERSION_FILE, 'utf-8').trim();
  } catch {
    return '1.0.0.0';
  }
}

function readUpdateXml(): string {
  try {
    if (!existsSync(UPDATE_FILE)) return '';
    return readFileSync(UPDATE_FILE, 'utf-8');
  } catch {
    return '';
  }
}

function writeVersion(version: string): void {
  writeFileSync(VERSION_FILE, version, 'utf-8');
}

function writeUpdateXml(entries: { version: string; file: string }[]): void {
  const xml = `<?xml version="1.0" encoding="utf-8" ?>\n<theupdates>\n${entries
    .map(e => `\n  <update>\n    <version>${e.version}</version>\n    <file>${e.file}</file>\n  </update>\n`)
    .join('')}\n</theupdates>\n`;
  writeFileSync(UPDATE_FILE, xml, 'utf-8');
}

export async function GET() {
  try {
    const admin = await checkSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const version = readVersion();
    const xml = readUpdateXml();

    const entries: { version: string; file: string }[] = [];
    const regex = /<update>\s*<version>([^<]+)<\/version>\s*<file>([^<]+)<\/file>\s*<\/update>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      entries.push({ version: match[1].trim(), file: match[2].trim() });
    }

    return NextResponse.json({ version, entries });
  } catch (error) {
    console.error('Launcher version GET error:', error);
    return NextResponse.json({ error: 'Failed to read launcher version' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await checkSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { version, entries } = body;

    if (version && typeof version === 'string') {
      writeVersion(version.trim());
    }

    if (Array.isArray(entries)) {
      const clean = entries
        .filter((e: any) => e.version && e.file)
        .map((e: any) => ({ version: String(e.version).trim(), file: String(e.file).trim() }));
      writeUpdateXml(clean);
    }

    return NextResponse.json({
      ok: true,
      version: readVersion(),
      entries: (() => {
        const xml = readUpdateXml();
        const result: { version: string; file: string }[] = [];
        const regex = /<update>\s*<version>([^<]+)<\/version>\s*<file>([^<]+)<\/file>\s*<\/update>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
          result.push({ version: match[1].trim(), file: match[2].trim() });
        }
        return result;
      })(),
    });
  } catch (error) {
    console.error('Launcher version POST error:', error);
    return NextResponse.json({ error: 'Failed to update launcher version' }, { status: 500 });
  }
}
