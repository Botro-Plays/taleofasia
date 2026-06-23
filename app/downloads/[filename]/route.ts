import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: encoded } = await params;
    const filename = decodeURIComponent(encoded);

    // Prevent directory traversal
    if (filename.includes('..') || /[\\/]/.test(filename)) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'downloads', filename);

    // Check existence
    try {
      await fs.access(filePath);
    } catch {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
      '.7z': 'application/x-7z-compressed',
      '.exe': 'application/x-msdownload',
    };

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new NextResponse('Internal error', { status: 500 });
  }
}
