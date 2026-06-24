const mssql = require('mssql');
const cfg = {
  server: 'WIN-6EI3K1H544I',
  port: 49746,
  user: 'as',
  password: 'y4m3TekUD4\x24a1',
  database: 'ClanDB',
  options: { trustServerCertificate: true }
};

(async () => {
  try {
    const pool = await mssql.connect(cfg);
    const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log('Tables:', tables.recordset.map(r => r.TABLE_NAME).join(', '));

    // Check if CL table exists and its columns
    const clCheck = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='CL'");
    if (clCheck.recordset.length > 0) {
      const clCols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CL'");
      console.log('\nCL columns:', clCols.recordset.map(r => `${r.COLUMN_NAME}(${r.DATA_TYPE})`).join(', '));
      const clData = await pool.request().query('SELECT TOP 3 * FROM CL');
      console.log('CL sample:', JSON.stringify(clData.recordset, null, 2));
    } else {
      console.log('No CL table found');
    }

    // Check Note column in ClanList
    const noteCol = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ClanList' AND COLUMN_NAME='Note'");
    console.log('\nNote column:', JSON.stringify(noteCol.recordset[0]));

    await pool.close();
  } catch (e) {
    console.error(e.message);
  }
})();
