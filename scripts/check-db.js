const sql = require('mssql');

async function run() {
  const cfg = {
    server: 'WIN-6EI3K1H544I',
    port: 49746,
    user: 'as',
    password: process.env.DB_PASSWORD || '',
    options: { encrypt: false, trustServerCertificate: true }
  };

  // Check UserDB
  try {
    const pool = await sql.connect({ ...cfg, database: 'UserDB' });
    const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log('UserDB tables:', tables.recordset.map(r => r.TABLE_NAME).join(', '));
    
    try {
      const count = await pool.request().query('SELECT COUNT(*) as cnt FROM UserInfo');
      console.log('UserInfo count:', count.recordset[0].cnt);
      const sample = await pool.request().query('SELECT TOP 3 AccountName, Flag, BanStatus FROM UserInfo');
      console.log('Sample users:', JSON.stringify(sample.recordset, null, 2));
    } catch (e) {
      console.log('UserInfo query error:', e.message);
    }
    await pool.close();
  } catch (e) {
    console.error('UserDB error:', e.message);
  }

  // List all databases
  try {
    const pool = await sql.connect({ ...cfg, database: 'master' });
    const dbs = await pool.request().query("SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb') ORDER BY name");
    console.log('Databases:', dbs.recordset.map(r => r.name).join(', '));
    await pool.close();
  } catch (e) {
    console.error('Master error:', e.message);
  }
}

run();
