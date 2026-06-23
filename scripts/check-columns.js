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
    const result = await pool.request().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PaymentTransactions'"
    );
    console.log('PaymentTransactions columns:');
    console.log(result.recordset.map(x => x.COLUMN_NAME).join(', '));
    await pool.close();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
