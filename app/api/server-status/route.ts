import { NextRequest, NextResponse } from 'next/server';
import { serverDB } from '@/lib/db';
import { createSocket } from 'dgram';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

// [Cascade] Extended to support per-server status and user counts.
// Backward compatible: still returns top-level status/onlineUsers for existing consumers.
type ServerInfo = {
  status: 'online' | 'offline' | 'maintenance';
  onlineUsers: number;
};

type StatusData = ServerInfo & {
  servers?: {
    login: ServerInfo;
    game1: ServerInfo;
    game2: ServerInfo;
  };
};

let lastStatus: { data: StatusData; ts: number } | null = null;
const TTL_MS = 3_000; // 3s cache TTL

const MAINTENANCE_FILE = path.join(process.cwd(), 'maintenance.php');
const LOGIN_SERVER_IP = '193.23.160.60';

// [Cascade] Status daemon ports for UDP ping.
const STATUS_PORTS = {
  login: 10010,
  game1: 10011,
  game2: 10012,
};

function checkMaintenanceMode(): boolean {
  try {
    if (!existsSync(MAINTENANCE_FILE)) return false;
    const content = readFileSync(MAINTENANCE_FILE, 'utf-8');
    // Check if the file contains "return true;" (PHP maintenance flag)
    return /return\s+true\s*;/.test(content);
  } catch {
    return false;
  }
}

// [Cascade] Generic UDP ping function for any status daemon port.
function pingServer(port: number, ip: string = LOGIN_SERVER_IP, timeoutMs: number = 500): Promise<'online' | 'maintenance' | 'offline'> {
  return new Promise((resolve) => {
    try {
      const socket = createSocket('udp4');
      const msg = Buffer.from('PING');

      socket.on('error', () => {
        resolve('offline');
      });

      let settled = false;

      socket.on('message', (buf) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const resp = buf.toString().trim();
        socket.close();
        if (resp === 'OK') resolve('online');
        else if (resp === 'MAINT') resolve('maintenance');
        else resolve('offline');
      });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        resolve('offline');
      }, timeoutMs);

      socket.send(msg, 0, msg.length, port, ip, (err) => {
        if (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
          }
          socket.close();
          resolve('offline');
        }
      });
    } catch {
      resolve('offline');
    }
  });
}

// [Cascade] Ping all three status daemons in parallel.
function pingAllServers(): Promise<{ login: string; game1: string; game2: string }> {
  return Promise.all([
    pingServer(STATUS_PORTS.login),
    pingServer(STATUS_PORTS.game1),
    pingServer(STATUS_PORTS.game2),
  ]).then(([login, game1, game2]) => ({ login, game1, game2 }));
}

// [Cascade] Get per-server user counts from UsersOnline grouped by ServerCode.
// ServerCode: 0=login, 1=GS1, 2=GS2. We only count game server users (1 and 2)
// for the per-server display, but total includes all.
async function getOnlineUsersByServer(): Promise<{ total: number; login: number; game1: number; game2: number }> {
  try {
    const result = await serverDB.query(`
      SELECT 
        SUM(CASE WHEN ServerCode = 0 THEN 1 ELSE 0 END) AS loginCount,
        SUM(CASE WHEN ServerCode = 1 THEN 1 ELSE 0 END) AS game1Count,
        SUM(CASE WHEN ServerCode = 2 THEN 1 ELSE 0 END) AS game2Count,
        COUNT(*) AS totalCount
      FROM UsersOnline
    `);
    const row = result.recordset?.[0];
    return {
      login: row?.loginCount ?? 0,
      game1: row?.game1Count ?? 0,
      game2: row?.game2Count ?? 0,
      total: row?.totalCount ?? 0,
    };
  } catch (err) {
    console.error('Online users query error:', err);
    const prev = lastStatus?.data;
    return {
      login: prev?.servers?.login.onlineUsers ?? 0,
      game1: prev?.servers?.game1.onlineUsers ?? 0,
      game2: prev?.servers?.game2.onlineUsers ?? 0,
      total: prev?.onlineUsers ?? 0,
    };
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'server-status', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    // Serve cached value if still fresh
    if (lastStatus && Date.now() - lastStatus.ts < TTL_MS) {
      return NextResponse.json(lastStatus.data);
    }

    // 1. Check maintenance mode first
    if (checkMaintenanceMode()) {
      const data: StatusData = {
        status: 'maintenance', onlineUsers: 0,
        servers: {
          login: { status: 'maintenance', onlineUsers: 0 },
          game1: { status: 'maintenance', onlineUsers: 0 },
          game2: { status: 'maintenance', onlineUsers: 0 },
        },
      };
      lastStatus = { data, ts: Date.now() };
      return NextResponse.json(data);
    }

    // 2. Ping all servers and query DB in parallel
    const [serverStates, userCounts] = await Promise.all([
      pingAllServers(),
      getOnlineUsersByServer(),
    ]);

    // Build per-server info
    const loginInfo: ServerInfo = { status: serverStates.login as any, onlineUsers: userCounts.login };
    const game1Info: ServerInfo = { status: serverStates.game1 as any, onlineUsers: userCounts.game1 };
    const game2Info: ServerInfo = { status: serverStates.game2 as any, onlineUsers: userCounts.game2 };

    // Top-level status: online if login server is online, otherwise offline
    const overallStatus = loginInfo.status === 'online' ? 'online' : loginInfo.status === 'maintenance' ? 'maintenance' : 'offline';

    const data: StatusData = {
      status: overallStatus,
      onlineUsers: userCounts.total,
      servers: {
        login: loginInfo,
        game1: game1Info,
        game2: game2Info,
      },
    };
    lastStatus = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching server status:', error);
    return NextResponse.json(lastStatus?.data ?? { status: 'online', onlineUsers: 0 });
  }
}
