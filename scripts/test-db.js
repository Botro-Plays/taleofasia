const sql = require('mssql');

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
    max: 10,
    min: 2,
    idleTimeoutMillis: 15000,
    acquireTimeoutMillis: 5000,
  },
  validateConnection: true,
  connectionTimeout: 5000,
  requestTimeout: 5000,
};

async function test() {
  console.log('Config:', JSON.stringify({
    server: dbConfig.server,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    passwordLength: dbConfig.password.length,
  }));

  try {
    const pool = new sql.ConnectionPool(dbConfig);
    pool.on('error', (err) => console.error('Pool error:', err.message));
    await pool.connect();
    console.log('Connected OK');
    const r = await pool.request().query('SELECT 1 AS ok');
    console.log('Query:', r.recordset);
    await pool.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
