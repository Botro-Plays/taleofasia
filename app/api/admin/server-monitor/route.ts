import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { execFile } from 'child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { createSocket } from 'dgram';
import { createHash } from 'crypto';

const execFileAsync = promisify(execFile);

const SERVERS_BASE = 'C:\\taleofasia-server-project\\servers';
const PAUSE_FILE = join(SERVERS_BASE, 'monitor.pause');
const LOG_FILE = join(SERVERS_BASE, 'monitor.log');
const CONTROL_SCRIPT = join(SERVERS_BASE, 'server-control.ps1');
const PIN_HASH_FILE = join(SERVERS_BASE, 'admin-pin.hash');
const POWERSHELL_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

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

// [Cascade] UDP status daemon ports for liveness ping.
// Login=10010, GS1=10011, GS2=10012.
const STATUS_PORTS: Record<string, number> = {
  'login-server': 10010,
  'game-server1': 10011,
  'game-server2': 10012,
};

// [Cascade] UDP ping function: sends PING to the server's status daemon port.
// Returns true if the server responded within the timeout.
function pingServer(port: number, timeoutMs: number = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const socket = createSocket('udp4');
      const msg = Buffer.from('PING');
      let settled = false;

      socket.on('error', () => {
        if (!settled) { settled = true; socket.close(); resolve(false); }
      });

      socket.on('message', () => {
        if (!settled) { settled = true; clearTimeout(timer); socket.close(); resolve(true); }
      });

      const timer = setTimeout(() => {
        if (!settled) { settled = true; socket.close(); resolve(false); }
      }, timeoutMs);

      socket.send(msg, 0, msg.length, port, '127.0.0.1', (err) => {
        if (err && !settled) { settled = true; clearTimeout(timer); socket.close(); resolve(false); }
      });
    } catch {
      resolve(false);
    }
  });
}

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
    startTime: string | null;
    uptimeSeconds: number | null;
  }> = [];

  // [Cascade] Primary check: UDP ping all status daemon ports in parallel.
  const pingResults: Record<string, boolean> = {};
  const pingPromises = Object.entries(STATUS_PORTS).map(async ([key, port]) => {
    pingResults[key] = await pingServer(port, 1000);
  });

  // Also run netstat in parallel for PID/uptime info
  let netstatOutput = '';
  const netstatPromise = (async () => {
    try {
      const { stdout } = await execFileAsync('netstat', ['-ano'], { timeout: 5000, encoding: 'utf-8' });
      netstatOutput = stdout;
    } catch {
      // netstat failed
    }
  })();

  await Promise.all([...pingPromises, netstatPromise]);

  // Extract PIDs for each server port from netstat output
  const pidMap: Record<string, number | null> = {};
  for (const [key, port] of Object.entries(SERVER_PORTS)) {
    const line = netstatOutput.split('\n').find(l =>
      l.includes('UDP') &&
      l.includes(`:${port} `) &&
      l.trim().length > 0
    );
    if (line) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      pidMap[key] = pid > 0 ? pid : null;
    } else {
      pidMap[key] = null;
    }
  }

  // [Cascade] Fallback: if UDP ping failed but netstat shows the port is bound,
  // consider the server running (status daemon might be temporarily unresponsive).
  for (const [key, port] of Object.entries(SERVER_PORTS)) {
    if (!pingResults[key] && pidMap[key] !== null) {
      pingResults[key] = true;
    }
  }

  // Get process creation times via WMI (non-invasive — no handle access to Server.exe)
  const validPids = Object.values(pidMap).filter((p): p is number => p !== null);
  const creationTimes: Record<number, Date> = {};
  if (validPids.length > 0) {
    try {
      const pidFilter = validPids.map(p => `ProcessId=${p}`).join(' OR ');
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile', '-Command',
        `Get-CimInstance Win32_Process -Filter "${pidFilter}" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; CreationDate = if ($_.CreationDate) { $_.CreationDate.ToString('o') } else { $null } } } | ConvertTo-Json -Compress`,
      ], { timeout: 10000, encoding: 'utf-8', windowsHide: true });

      const parsed = JSON.parse(stdout.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item.ProcessId && item.CreationDate) {
          const d = new Date(item.CreationDate);
          if (!isNaN(d.getTime())) {
            creationTimes[item.ProcessId] = d;
          }
        }
      }
    } catch {
      // WMI query failed — uptime will be null but status still works
    }
  }

  const now = Date.now();
  for (const [key] of Object.entries(SERVER_PATHS)) {
    const port = SERVER_PORTS[key];
    const pid = pidMap[key];
    const running = pingResults[key] ?? false;
    const startTime = pid ? creationTimes[pid] ?? null : null;
    const uptimeSeconds = startTime ? Math.floor((now - startTime.getTime()) / 1000) : null;

    servers.push({
      key,
      label: SERVER_LABELS[key],
      port,
      running,
      pid,
      startTime: startTime && !isNaN(startTime.getTime()) ? startTime.toISOString() : null,
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

function verifyPin(pin: string): boolean {
  try {
    if (!existsSync(PIN_HASH_FILE)) return false;
    const storedHash = readFileSync(PIN_HASH_FILE, 'utf-8').trim();
    const providedHash = createHash('sha256').update(pin).digest('hex');
    return storedHash === providedHash;
  } catch {
    return false;
  }
}

// Actions that require PIN verification (destructive operations)
const PIN_REQUIRED_ACTIONS = new Set([
  'restart-all', 'restart-games', 'stop-server', 'start-server',
]);

// Launch server-control.ps1 as a fully detached process via Start-Process.
// This is more reliable than spawn({detached:true}) from PM2's Node.js process.
async function launchControlScript(args: string[]): Promise<void> {
  const allArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', CONTROL_SCRIPT, ...args];
  const argList = allArgs.map(a => `'${a.replace(/'/g, "''")}'`).join(',');
  const psCommand = `Start-Process -FilePath '${POWERSHELL_EXE}' -ArgumentList @(${argList}) -WindowStyle Normal`;
  await execFileAsync(POWERSHELL_EXE, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand,
  ], { timeout: 15000, windowsHide: true });
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

    // Pause/resume don't require PIN
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

    // All other actions require PIN
    if (PIN_REQUIRED_ACTIONS.has(action)) {
      const pin = body.pin as string | undefined;
      if (!pin) {
        return NextResponse.json({ error: 'Admin PIN required for this action', pinRequired: true }, { status: 403 });
      }
      if (!verifyPin(pin)) {
        return NextResponse.json({ error: 'Invalid admin PIN', pinRequired: true }, { status: 403 });
      }
    }

    if (action === 'restart-all') {
      await launchControlScript(['-Action', 'restart-all']);
      return NextResponse.json({
        message: 'Full restart initiated. Login server starts first, then Game Server 1 after ~50s, then Game Server 2 after ~25s more. Monitor the log for progress.',
        restartInitiated: true,
      });
    }

    if (action === 'restart-games') {
      await launchControlScript(['-Action', 'restart-games']);
      return NextResponse.json({
        message: 'Game server restart initiated. Game Server 1 starts first, then Game Server 2 after ~30s. Monitor the log for progress.',
        restartInitiated: true,
      });
    }

    if (action === 'stop-server') {
      const serverKey = body.serverKey as string | undefined;
      if (!serverKey) {
        return NextResponse.json({ error: 'serverKey is required' }, { status: 400 });
      }
      await launchControlScript(['-Action', 'stop', '-Server', serverKey]);
      return NextResponse.json({
        message: `Stop command sent for ${serverKey}.`,
      });
    }

    if (action === 'start-server') {
      const serverKey = body.serverKey as string | undefined;
      if (!serverKey) {
        return NextResponse.json({ error: 'serverKey is required' }, { status: 400 });
      }
      await launchControlScript(['-Action', 'start', '-Server', serverKey]);
      return NextResponse.json({
        message: `Start command sent for ${serverKey}.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in server monitor action:', error);
    return NextResponse.json({ error: 'Failed to perform action: ' + String(error) }, { status: 500 });
  }
}
