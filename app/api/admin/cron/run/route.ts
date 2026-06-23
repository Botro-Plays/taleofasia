import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { TASKS } from '@/lib/cron/tasks';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function resolveSchtasksPath(): string {
  const systemRoot = process.env.SYSTEMROOT || process.env.SystemRoot;
  if (systemRoot) {
    return path.join(systemRoot, 'System32', 'schtasks.exe');
  }
  return 'schtasks';
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const taskId = body?.taskId;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = TASKS.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: `Unknown task: ${taskId}` }, { status: 400 });
    }

    const schtasksPath = resolveSchtasksPath();
    const { stdout, stderr } = await execFileAsync(
      schtasksPath,
      ['/Run', '/TN', task.schtasksName],
      { encoding: 'utf8', windowsHide: true }
    );

    const output = stdout?.trim() || stderr?.trim() || '';
    const success = /SUCCESS/i.test(output);

    return NextResponse.json({
      success,
      message: output || 'Task triggered',
      taskId: task.id,
      label: task.label,
    });
  } catch (error: any) {
    console.error('[Admin Cron Run] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run task', success: false },
      { status: 500 }
    );
  }
}
