const sql = require('mssql');

const cfg = {
  server: process.env.DB_SERVER || 'WIN-6EI3K1H544I\\TALEOFASIA',
  database: 'WebDB',
  user: process.env.DB_USER || 'as',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  try {
    const pool = await sql.connect(cfg);

    // Check which columns already exist
    const colResult = await pool.request().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PaymentTransactions'"
    );
    const existing = new Set(colResult.recordset.map(r => r.COLUMN_NAME));

    const needed = [
      { name: 'UsdAmount', type: 'DECIMAL(18,2) NULL' },
      { name: 'LocalCurrency', type: 'NVARCHAR(10) NULL' },
      { name: 'LocalAmount', type: 'DECIMAL(18,2) NULL' },
      { name: 'CoinsAwarded', type: 'INT NULL' },
      { name: 'BonusRate', type: 'DECIMAL(5,2) NULL' },
      { name: 'ExpiresAt', type: 'DATETIME NULL' },
      { name: 'Notes', type: 'NVARCHAR(500) NULL' },
      { name: 'IPAddress', type: 'NVARCHAR(50) NULL' },
      { name: 'CountryCode', type: 'NVARCHAR(10) NULL' },
    ];

    for (const col of needed) {
      if (existing.has(col.name)) {
        console.log(`Column ${col.name} already exists, skipping.`);
      } else {
        console.log(`Adding column ${col.name}...`);
        await pool.request().query(
          `ALTER TABLE PaymentTransactions ADD ${col.name} ${col.type}`
        );
        console.log(`Added ${col.name}.`);
      }
    }

    await pool.close();
    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

main();
