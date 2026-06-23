const path = require('path');
const fs = require('fs');

// Global crash protection — log but don't crash on transient errors
process.on('unhandledRejection', (err) => {
  console.error('⨯ unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('⨯ uncaughtException:', err?.message || err);
});

// Load .env.production BEFORE requiring next so env vars are available during Next.js init
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track HTTP server and cron for graceful shutdown
let httpServer = null;
let cronScheduler = null;
let shuttingDown = false;

app.prepare().then(() => {
  httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Start built-in cron scheduler
  try {
    const { startCronJobs } = require('./scripts/cron');
    cronScheduler = startCronJobs();
  } catch (cronErr) {
    console.error('Failed to start cron scheduler:', cronErr.message);
  }
});

// Graceful shutdown — close DB pools, stop cron, close HTTP server
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n> Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  if (httpServer) {
    httpServer.close(() => {
      console.log('> HTTP server closed.');
    });
  }

  // Stop cron scheduler if it has a stop method
  if (cronScheduler && typeof cronScheduler.stop === 'function') {
    try { cronScheduler.stop(); } catch {}
  }

  // Close all DB pools
  try {
    const { closeAllPools } = require('./lib/db');
    await closeAllPools();
    console.log('> All DB pools closed.');
  } catch (err) {
    console.error('> Error closing DB pools:', err.message);
  }

  // Force exit after 3s if anything is stuck
  setTimeout(() => {
    console.log('> Forcing exit.');
    process.exit(0);
  }, 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
