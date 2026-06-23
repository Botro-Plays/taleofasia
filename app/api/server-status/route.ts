import { NextResponse } from 'next/server';
import { serverDB } from '@/lib/db';
import { createSocket } from 'dgram';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// In-memory cache to avoid hammering the DB/UDP on every page load
type StatusData = { status: 'online' | 'offline' | 'maintenance'; onlineUsers: number };
let lastStatus: { data: StatusData; ts: number } | null = null;
const TTL_MS = 3_000; // 3s cache TTL

const MAINTENANCE_FILE = path.join(process.cwd(), 'maintenance.php');
const LOGIN_SERVER_IP = '193.23.160.60';
const LOGIN_SERVER_PORT = 10010;

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

function pingLoginServer(): Promise<'online' | 'maintenance' | 'offline'> {
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

      // 500ms timeout (same as old PHP)
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        resolve('offline');
      }, 500);

      socket.send(msg, 0, msg.length, LOGIN_SERVER_PORT, LOGIN_SERVER_IP, (err) => {
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

async function getOnlineUsers(): Promise<number> {
  try {
    const result = await serverDB.query(`SELECT COUNT(*) as count FROM UsersOnline`);
    return result.recordset?.[0]?.count ?? 0;
  } catch (err) {
    console.error('Online users query error:', err);
    return lastStatus?.data.onlineUsers ?? 0;
  }
}

export async function GET() {
  try {
    // Serve cached value if still fresh
    if (lastStatus && Date.now() - lastStatus.ts < TTL_MS) {
      return NextResponse.json(lastStatus.data);
    }

    // 1. Check maintenance mode first
    if (checkMaintenanceMode()) {
      const data: StatusData = { status: 'maintenance', onlineUsers: 0 };
      lastStatus = { data, ts: Date.now() };
      return NextResponse.json(data);
    }

    // 2. Ping login server and query DB in parallel
    const [serverState, onlineUsers] = await Promise.all([
      pingLoginServer(),
      getOnlineUsers(),
    ]);

    const data: StatusData = { status: serverState, onlineUsers };
    lastStatus = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching server status:', error);
    return NextResponse.json(lastStatus?.data ?? { status: 'online', onlineUsers: 0 });
  }
}
