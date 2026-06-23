/**
 * Pre-start cleanup: kills any zombie process holding port 3000.
 * Called by ecosystem.config.js via `pre_start_script` before PM2 launches server.js.
 */
const { execSync } = require('child_process');

const PORT = 3000;

function killZombiesOnPort() {
  try {
    // Find PIDs listening on port 3000
    const output = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const pids = new Set();
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid);
      }
    }

    if (pids.size === 0) {
      console.log('[prestart] No zombie processes on port', PORT);
      return;
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe', timeout: 5000 });
        console.log(`[prestart] Killed zombie PID ${pid} on port ${PORT}`);
      } catch {
        // Process may have already exited
      }
    }

    // Brief wait for OS to release the port
    execSync('ping 127.0.0.1 -n 3 > nul', { stdio: 'pipe', timeout: 5000 });
  } catch {
    // netstat found nothing or command failed — port is free
    console.log('[prestart] Port', PORT, 'is free');
  }
}

killZombiesOnPort();
