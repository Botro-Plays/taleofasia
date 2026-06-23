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

    // Create PaymentPackages table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentPackages')
      BEGIN
        CREATE TABLE PaymentPackages (
          PackageID INT IDENTITY(1,1) PRIMARY KEY,
          UsdAmount DECIMAL(18,2) NOT NULL,
          Label NVARCHAR(100) NULL,
          SortOrder INT DEFAULT 0,
          IsActive BIT DEFAULT 1,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
        PRINT 'Created PaymentPackages table.';
      END
    `);

    // Check if table has data
    const countRes = await pool.request().query(`SELECT COUNT(*) as cnt FROM PaymentPackages`);
    if (countRes.recordset[0].cnt === 0) {
      // Seed default packages
      const defaults = [
        { usd: 1, label: 'Starter Pack', sort: 1 },
        { usd: 5, label: 'Warrior Pack', sort: 2 },
        { usd: 10, label: 'Knight Pack', sort: 3 },
        { usd: 20, label: 'Royal Pack', sort: 4 },
        { usd: 50, label: 'Emperor Pack', sort: 5 },
        { usd: 100, label: 'Legend Pack', sort: 6 },
      ];
      for (const pkg of defaults) {
        await pool.request().query(
          `INSERT INTO PaymentPackages (UsdAmount, Label, SortOrder, IsActive) VALUES (${pkg.usd}, '${pkg.label}', ${pkg.sort}, 1)`
        );
      }
      console.log('Seeded 6 default packages.');
    } else {
      console.log('PaymentPackages already has data.');
    }

    await pool.close();
    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

main();
