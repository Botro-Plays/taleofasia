import sql from 'mssql';
// Next.js auto-loads .env files based on NODE_ENV:
// .env.development for dev, .env.production for prod

const dbConfig = {
  server: process.env.DB_SERVER || '',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  database: process.env.DB_NAME || 'WebDB',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    useUTC: false,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 15000,
    acquireTimeoutMillis: 10000,
  },
  validateConnection: true,
  connectionTimeout: 15000,
  // Per-query timeout; logDB overrides to 60s for large reports
  requestTimeout: 5000,
};

// Database configurations for different databases
const databases = {
  webDB: {
    ...dbConfig,
    database: process.env.WEBDB_NAME || 'WebDB',
  },
  userDB: {
    ...dbConfig,
    database: process.env.USERDB_NAME || 'UserDB',
  },
  gameDB: {
    ...dbConfig,
    database: process.env.GAMEDB_NAME || 'GameDB',
  },
  clanDB: {
    ...dbConfig,
    database: process.env.CLANDB_NAME || 'ClanDB',
  },
  serverDB: {
    ...dbConfig,
    database: process.env.SERVERDB_NAME || 'ServerDB',
  },
  logDB: {
    ...dbConfig,
    database: process.env.LOGDB_NAME || 'LogDB',
    requestTimeout: 60000,
  },
};

// Connection pools
const pools: Record<string, sql.ConnectionPool> = {};
const connecting: Record<string, Promise<sql.ConnectionPool> | null> = {};

// Get or create connection pool for a specific database
export async function getPool(dbName: keyof typeof databases): Promise<sql.ConnectionPool> {
  if (pools[dbName] && pools[dbName].connected) {
    return pools[dbName];
  }

  // If already connecting, wait for that promise instead of creating a duplicate
  if (connecting[dbName]) {
    return connecting[dbName]!;
  }

  const connectPromise = (async () => {
    // Clean up any old dead pool first
    if (pools[dbName]) {
      try { await pools[dbName].close(); } catch {}
      delete pools[dbName];
    }

    const cfg = databases[dbName];
    const pool = new sql.ConnectionPool(cfg);

    // Recreate pool on fatal errors instead of leaving dead pools in memory
    pool.on('error', (err) => {
      console.error(`[DB] Pool error for ${dbName}:`, err.message);
      if (pools[dbName] === pool) {
        delete pools[dbName];
      }
    });

    pools[dbName] = pool;
    try {
      await pool.connect();
    } catch (e: any) {
      // CRITICAL: clear connecting state so future calls can retry
      delete pools[dbName];
      connecting[dbName] = null;
      throw e;
    }
    connecting[dbName] = null;
    return pool;
  })();

  connecting[dbName] = connectPromise;
  return connectPromise;
}

// Max retries for transient "Connection is closed" errors
const MAX_RETRIES = 2;

// Internal recursive helper to avoid shadowing the exported function name
async function _queryWithRetry<T = any>(
  dbName: keyof typeof databases,
  queryString: string,
  params?: Record<string, any>,
  attempt = 1
): Promise<sql.IResult<T>> {
  const pool = await getPool(dbName);
  const request = pool.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  try {
    return await request.query<T>(queryString);
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Retry on stale connection or connection reset: SQL Server closed/reset it
    const isStaleConnection = /Connection is closed|ECONNRESET|Connection lost/i.test(msg);
    if (isStaleConnection && attempt <= MAX_RETRIES) {
      console.warn(`[DB] Stale connection on ${dbName}, retry ${attempt}/${MAX_RETRIES}...`);
      // Force pool recreation on next call by clearing the cached pool
      const deadPool = pools[dbName];
      delete pools[dbName];
      connecting[dbName] = null;
      if (deadPool) {
        deadPool.close().catch(() => {});
      }
      return _queryWithRetry<T>(dbName, queryString, params, attempt + 1);
    }
    throw err;
  }
}

// Execute query on specific database
export async function query<T = any>(
  dbName: keyof typeof databases,
  queryString: string,
  params?: Record<string, any>
): Promise<sql.IResult<T>> {
  return _queryWithRetry<T>(dbName, queryString, params);
}

// Close all connection pools
export async function closeAllPools(): Promise<void> {
  const entries = Object.entries(pools);
  await Promise.all(
    entries.map(([key, pool]) =>
      pool.close().catch((err) => {
        console.error(`[DB] Error closing pool ${key}:`, err.message);
      })
    )
  );
  Object.keys(pools).forEach(key => delete pools[key]);
  Object.keys(connecting).forEach(key => { connecting[key] = null; });
}

// Specific database helpers
export const webDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('webDB', queryString, params),
};

export const userDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('userDB', queryString, params),
};

export const gameDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('gameDB', queryString, params),
};

export const clanDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('clanDB', queryString, params),
};

export const serverDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('serverDB', queryString, params),
};

export const logDB = {
  query: <T = any>(queryString: string, params?: Record<string, any>) => 
    query<T>('logDB', queryString, params),
};

export default sql;
