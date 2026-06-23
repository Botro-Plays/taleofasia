import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { TASKS, type TaskConfig } from '@/lib/cron/tasks';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function resolveSchtasksPath(): string {
  const systemRoot = process.env.SYSTEMROOT || process.env.SystemRoot;
  if (systemRoot) {
    return path.join(systemRoot, 'System32', 'schtasks.exe');
  }
  return 'schtasks';
}

interface RawTaskStatus {
  nextRunTime: string;
  lastRunTime: string;
  status: string;
  lastResult: string;
  scheduleType: string;
  taskToRun: string;
  author: string;
}

function parseListOutput(output: string): RawTaskStatus {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const map = new Map<string, string>();
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) {
      map.set(key, value);
    }
  }

  return {
    nextRunTime: map.get('Next Run Time') || '',
    lastRunTime: map.get('Last Run Time') || '',
    status: map.get('Status') || '',
    lastResult: map.get('Last Result') || '',
    scheduleType: map.get('Schedule Type') || map.get('Schedule') || '',
    taskToRun: map.get('Task To Run') || '',
    author: map.get('Author') || '',
  };
}

function normalizeDate(raw: string): { raw: string; iso: string | null; display: string } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'n/a') {
    return { raw: trimmed, iso: null, display: trimmed || 'N/A' };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { raw: trimmed, iso: null, display: trimmed };
  }
  return {
    raw: trimmed,
    iso: parsed.toISOString(),
    display: parsed.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
  };
}

function parseLastResult(raw: string): { raw: string; code: number | null; success: boolean; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw: '', code: null, success: false, message: 'No result' };
  }

  const hexMatch = trimmed.match(/0x([0-9a-fA-F]+)/);
  const decMatch = trimmed.match(/\b(\d+)\b/);
  let code: number | null = null;
  if (hexMatch) {
    code = parseInt(hexMatch[1], 16);
  } else if (decMatch) {
    code = parseInt(decMatch[1], 10);
  }
  const success = code === 0;
  let message = trimmed;
  if (code === 0) message = 'OK';
  else if (code === 1) message = 'Error (exit 1)';
  else if (code === 2) message = 'Error (exit 2)';
  else if (code !== null) message = `Error (exit ${code})`;
  return {
    raw: trimmed,
    code,
    success,
    message,
  };
}

function decodeSchtasksOutput(output: Buffer | string): string {
  if (typeof output === 'string') {
    return output;
  }

  if (!output?.length) {
    return '';
  }

  const utf8 = output.toString('utf8');
  if (/Folder:/i.test(utf8) || /TaskName:/i.test(utf8)) {
    return utf8;
  }

  return output.toString('ucs2');
}

async function getTaskStatus(task: TaskConfig) {
  const schtasksPath = resolveSchtasksPath();
  try {
    const { stdout } = await execFileAsync(schtasksPath, ['/Query', '/TN', task.schtasksName, '/FO', 'LIST', '/V'], {
      encoding: 'buffer',
      windowsHide: true,
    });
    const parsed = parseListOutput(decodeSchtasksOutput(stdout));
    const nextRun = normalizeDate(parsed.nextRunTime);
    const lastRun = normalizeDate(parsed.lastRunTime);
    const lastResult = parseLastResult(parsed.lastResult);
    return {
      id: task.id,
      label: task.label,
      scheduleType: parsed.scheduleType,
      status: parsed.status,
      nextRun,
      lastRun,
      lastResult,
      taskToRun: parsed.taskToRun,
      author: parsed.author,
      error: null as string | null,
    };
  } catch (error: any) {
    return {
      id: task.id,
      label: task.label,
      scheduleType: '',
      status: 'Unavailable',
      nextRun: { raw: '', iso: null, display: 'N/A' },
      lastRun: { raw: '', iso: null, display: 'N/A' },
      lastResult: { raw: '', code: null, success: false, message: error?.message || 'Unable to query task' },
      taskToRun: '',
      author: '',
      error: error?.message || 'Unable to query task',
    };
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = await Promise.all(TASKS.map((task) => getTaskStatus(task)));
    return NextResponse.json({
      tasks: results,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin Cron Status] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Failed to query cron status' }, { status: 500 });
  }
}
