import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { execFile, spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SERVERS_BASE = 'C:\\taleofasia-server-project\\servers';
const PAUSE_FILE = join(SERVERS_BASE, 'monitor.pause');
const LOG_FILE = join(SERVERS_BASE, 'monitor.log');

const SERVER_PATHS: Record<string, string> = {
  'login-server': join(SERVERS_BASE, 'login-server', 'Server.exe'),
  'game-server1': join(SERVERS_BASE, 'game-server1', 'Server.exe'),
  'game-server2': join(SERVERS_BASE, 'game-server2', 'Server.exe'),
};

const DEBUG_LOGS: Record<string, string> = {
  'login-server': join(SERVERS_BASE, 'login-server', 'DEBUG.log'),
  'game-server1': join(SERVERS_BASE, 'game-server1', 'DEBUG.log'),
  'game-server2': join(SERVERS_BASE, 'game-server2', 'DEBUG.log'),
};

const SERVER_LABELS: Record<string, string> = {
  'login-server': 'Login Server',
  'game-server1': 'Game Server 1 (PH)',
  'game-server2': 'Game Server 2 (SG)',
};

const SERVER_PORTS: Record<string, number> = {
  'login-server': 10009,
  'game-server1': 10025,
  'game-server2': 10026,
};

async function checkAdmin(username: string) {
  const adminCheck = await userDB.query(`
    SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
  `, { username });
  if (!adminCheck.recordset?.length) return false;
  const user = adminCheck.recordset[0];
  return user.GameMasterType === 1 && user.GameMasterLevel >= 3;
}

async function getServerStatus() {
  const servers: Array<{
    key: string;
    label: string;
    port: number;
    running: boolean;
    pid: number | null;
    startTime: Date | null;
    uptimeSeconds: number | null;
  }> = [];

  // Get all Server.exe processes with their paths (async, non-blocking)
  const processMap: Map<string, { pid: number; startTime: Date }> = new Map();
  try {
    const psScript = "Get-Process -Name Server -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ($_.Id.ToString() + '|' + $_.Path + '|' + $_.StartTime.ToString('o')) }";
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-Command', psScript],
      { timeout: 5000, encoding: 'utf-8' }
    );
    const output = stdout.trim();

    if (output) {
      for (const line of output.split('\n')) {
        const parts = line.trim().split('|');
        if (parts.length >= 3) {
          const pid = parseInt(parts[0]);
          const path = parts[1];
          const startTime = new Date(parts[2]);
          processMap.set(path, { pid, startTime });
        }
      }
    }
  } catch {
    // Process check failed
  }

  for (const [key, exePath] of Object.entries(SERVER_PATHS)) {
    const proc = processMap.get(exePath);
    const now = new Date();
    const uptimeSeconds = proc ? Math.floor((now.getTime() - proc.startTime.getTime()) / 1000) : null;
    servers.push({
      key,
      label: SERVER_LABELS[key],
      port: SERVER_PORTS[key],
      running: !!proc,
      pid: proc?.pid ?? null,
      startTime: proc?.startTime ?? null,
      uptimeSeconds,
    });
  }

  return servers;
}

function getMonitorLog(lines: number = 50): string[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

function getDebugLog(serverKey: string, lines: number = 30): string[] {
  const logPath = DEBUG_LOGS[serverKey];
  if (!logPath || !existsSync(logPath)) return [];
  try {
    const content = readFileSync(logPath, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const servers = await getServerStatus();
    const monitoringPaused = existsSync(PAUSE_FILE);
    const recentLogs = getMonitorLog(50);
    const allRunning = servers.every(s => s.running);

    // Fetch debug.log tails for each server
    const debugLogs: Record<string, string[]> = {};
    for (const key of Object.keys(DEBUG_LOGS)) {
      debugLogs[key] = getDebugLog(key, 30);
    }

    // Get pause file creation time if it exists
    let pausedAt: string | null = null;
    if (monitoringPaused) {
      try {
        const stat = statSync(PAUSE_FILE);
        pausedAt = stat.mtime.toISOString();
      } catch {}
    }

    return NextResponse.json({
      servers,
      allRunning,
      monitoringPaused,
      pausedAt,
      recentLogs,
      debugLogs,
    });
  } catch (error) {
    console.error('Error fetching server monitor status:', error);
    return NextResponse.json({ error: 'Failed to fetch server status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'pause') {
      if (!existsSync(PAUSE_FILE)) {
        writeFileSync(PAUSE_FILE, new Date().toISOString());
      }
      return NextResponse.json({ monitoringPaused: true, message: 'Monitoring paused' });
    }

    if (action === 'resume') {
      if (existsSync(PAUSE_FILE)) {
        unlinkSync(PAUSE_FILE);
      }
      return NextResponse.json({ monitoringPaused: false, message: 'Monitoring resumed' });
    }

    if (action === 'restart-all') {
      // Spawn monitor.ps1 with -ForceRestart in the background (non-blocking)
      // The script takes 60-90+ seconds; we don't wait for it to finish
      const child = spawn(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', 'C:\\taleofasia-server-project\\servers\\monitor.ps1', '-ForceRestart'],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();

      return NextResponse.json({
        message: 'Full restart initiated. Servers will come back online in 60-90 seconds. Monitor the log for progress.',
        restartInitiated: true,
      });
    }

    if (action === 'restart-games') {
      // Spawn monitor.ps1 with -ForceRestartGames in the background (non-blocking)
      const child = spawn(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', 'C:\\taleofasia-server-project\\servers\\monitor.ps1', '-ForceRestartGames'],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();

      return NextResponse.json({
        message: 'Game server restart initiated. Servers will come back online in 20-40 seconds. Monitor the log for progress.',
        restartInitiated: true,
      });
    }

    if (action === 'restart-game1') {
      const child = spawn(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', 'C:\\taleofasia-server-project\\servers\\monitor.ps1', '-ForceRestartGame1'],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();

      return NextResponse.json({
        message: 'Game Server 1 restart initiated. It will be back online in ~10 seconds.',
        restartInitiated: true,
      });
    }

    if (action === 'restart-game2') {
      const child = spawn(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', 'C:\\taleofasia-server-project\\servers\\monitor.ps1', '-ForceRestartGame2'],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();

      return NextResponse.json({
        message: 'Game Server 2 restart initiated. It will be back online in ~10 seconds.',
        restartInitiated: true,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in server monitor action:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
