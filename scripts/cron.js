const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// Load the correct .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, '..', envFile);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const CRON_SECRET = process.env.CRON_SECRET || '';
const PORT = process.env.PORT || '3000';
const HOST = process.env.HOSTNAME || 'localhost';

function log(msg) {
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  console.log(`[CRON ${now}] ${msg}`);
}

async function runPaymongoArchive() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set, skipping PayMongo archive job');
    return;
  }

  const url = `http://${HOST}:${PORT}/api/cron/paymongo-archive`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`PayMongo archive OK — processed ${data.processed || 0}, succeeded ${data.succeeded || 0}, failed ${data.failed || 0}`);
    } else {
      log(`PayMongo archive FAILED — HTTP ${res.status}: ${data.error || 'unknown'}`);
    }
  } catch (err) {
    log(`PayMongo archive ERROR — ${err.message}`);
  }
}

async function runPaymentReward() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set, skipping payment reward job');
    return;
  }

  const url = `http://${HOST}:${PORT}/api/cron/payment-reward`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`Payment reward OK — processed ${data.processed || 0}, succeeded ${data.succeeded || 0}, failed ${data.failed || 0}`);
    } else {
      log(`Payment reward FAILED — HTTP ${res.status}: ${data.error || 'unknown'}`);
    }
  } catch (err) {
    log(`Payment reward ERROR — ${err.message}`);
  }
}

async function runPaypalCancel() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set, skipping PayPal cancel job');
    return;
  }

  const url = `http://${HOST}:${PORT}/api/cron/paypal-cancel`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`PayPal cancel OK — processed ${data.processed || 0}, cancelled ${data.cancelled || 0}, alreadyClosed ${data.alreadyClosed || 0}, notFound ${data.notFound || 0}, failed ${data.failed || 0}`);
    } else {
      log(`PayPal cancel FAILED — HTTP ${res.status}: ${data.error || 'unknown'}`);
    }
  } catch (err) {
    log(`PayPal cancel ERROR — ${err.message}`);
  }
}

async function runCryptoVerify() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set, skipping crypto verify job');
    return;
  }

  const url = `http://${HOST}:${PORT}/api/cron/crypto-verify`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`Crypto verify OK — processed ${data.processed || 0}, completed ${data.completed || 0}, confirming ${data.confirming || 0}, errors ${data.errors || 0}`);
    } else {
      log(`Crypto verify FAILED — HTTP ${res.status}: ${data.error || 'unknown'}`);
    }
  } catch (err) {
    log(`Crypto verify ERROR — ${err.message}`);
  }
}

async function runPaypalReconcile() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set, skipping PayPal reconcile job');
    return;
  }

  const url = `http://${HOST}:${PORT}/api/cron/paypal-reconcile`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`PayPal reconcile OK — processed ${data.processed || 0}, completed ${data.completed || 0}, cancelled ${data.cancelled || 0}, stillPending ${data.stillPending || 0}, failed ${data.failed || 0}`);
    } else {
      log(`PayPal reconcile FAILED — HTTP ${res.status}: ${data.error || 'unknown'}`);
    }
  } catch (err) {
    log(`PayPal reconcile ERROR — ${err.message}`);
  }
}

function startCronJobs() {
  if (!CRON_SECRET) {
    log('WARN: CRON_SECRET not set. Set it in .env to enable automatic cron jobs.');
    log('Example: CRON_SECRET=your-random-secret-here');
    return;
  }

  // PayMongo archive — run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    log('Running scheduled PayMongo archive job...');
    runPaymongoArchive();
  });

  // Payment reward recovery — run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    log('Running scheduled payment reward job...');
    runPaymentReward();
  });

  // Also run once 30 seconds after server startup
  setTimeout(() => {
    log('Running startup PayMongo archive job...');
    runPaymongoArchive();
  }, 30000);

  setTimeout(() => {
    log('Running startup payment reward job...');
    runPaymentReward();
  }, 35000);

  // PayPal cancel — run every hour at minute 30 (offset from archive)
  cron.schedule('30 * * * *', () => {
    log('Running scheduled PayPal cancel job...');
    runPaypalCancel();
  });

  setTimeout(() => {
    log('Running startup PayPal cancel job...');
    runPaypalCancel();
  }, 40000);

  // PayPal reconcile — run every 5 minutes at minute 2,7,12,... (offset from reward)
  cron.schedule('2-59/5 * * * *', () => {
    log('Running scheduled PayPal reconcile job...');
    runPaypalReconcile();
  });

  setTimeout(() => {
    log('Running startup PayPal reconcile job...');
    runPaypalReconcile();
  }, 45000);

  // Crypto verify — run every 3 minutes (offset from reward/reconcile)
  cron.schedule('3-59/5 * * * *', () => {
    log('Running scheduled crypto verify job...');
    runCryptoVerify();
  });

  setTimeout(() => {
    log('Running startup crypto verify job...');
    runCryptoVerify();
  }, 50000);

  log('Cron scheduler started — archive every hour, reward recovery every 5 minutes, PayPal cancel every hour, PayPal reconcile every 5 minutes, crypto verify every 5 minutes');
}

module.exports = { startCronJobs, runPaymongoArchive, runPaymentReward, runPaypalCancel, runPaypalReconcile, runCryptoVerify };
