const sql = require('mssql');

async function run() {
  const cfg = {
    server: 'WIN-6EI3K1H544I',
    port: 49746,
    user: 'as',
    password: process.env.DB_PASSWORD || '',
    options: { encrypt: false, trustServerCertificate: true }
  };

  // Test 1: Direct query with parameter
  try {
    const pool = await sql.connect({ ...cfg, database: 'UserDB' });
    const req = pool.request();
    req.input('username', 'botro');
    const r = await req.query('SELECT AccountName, Password, Email, Flag, BanStatus, Coins FROM UserInfo WHERE AccountName = @username');
    console.log('Test 1 (parameterized):', JSON.stringify(r.recordset, null, 2));
    await pool.close();
  } catch (e) {
    console.error('Test 1 error:', e.message);
  }

  // Test 2: Direct query without parameter
  try {
    const pool = await sql.connect({ ...cfg, database: 'UserDB' });
    const r = await pool.request().query("SELECT AccountName, Password, Email, Flag, BanStatus, Coins FROM UserInfo WHERE AccountName = 'botro'");
    console.log('Test 2 (inline):', JSON.stringify(r.recordset, null, 2));
    await pool.close();
  } catch (e) {
    console.error('Test 2 error:', e.message);
  }

  // Test 3: Check collation
  try {
    const pool = await sql.connect({ ...cfg, database: 'UserDB' });
    const r = await pool.request().query("SELECT SERVERPROPERTY('Collation') as collation, DATABASEPROPERTYEX('UserDB','Collation') as db_collation");
    console.log('Collation:', JSON.stringify(r.recordset, null, 2));
    await pool.close();
  } catch (e) {
    console.error('Test 3 error:', e.message);
  }
}

run();
