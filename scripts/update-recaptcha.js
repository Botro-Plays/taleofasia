const sql = require('mssql');

const cfg = {
  server: 'WIN-6EI3K1H544I\\TALEOFASIA',
  database: 'WebDB',
  user: 'as',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  try {
    const pool = await sql.connect(cfg);
    console.log('Connected to WebDB');

    const queries = [
      "IF NOT EXISTS(SELECT * FROM WebsiteConfigs WHERE ConfigKey='recaptcha_enabled') INSERT INTO WebsiteConfigs(ConfigKey,ConfigValue,Description) VALUES('recaptcha_enabled','true','Enable reCAPTCHA') ELSE UPDATE WebsiteConfigs SET ConfigValue='true' WHERE ConfigKey='recaptcha_enabled'",
      "IF NOT EXISTS(SELECT * FROM WebsiteConfigs WHERE ConfigKey='recaptcha_site_key') INSERT INTO WebsiteConfigs(ConfigKey,ConfigValue,Description) VALUES('recaptcha_site_key','6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS','Site key') ELSE UPDATE WebsiteConfigs SET ConfigValue='6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS' WHERE ConfigKey='recaptcha_site_key'",
      "IF NOT EXISTS(SELECT * FROM WebsiteConfigs WHERE ConfigKey='recaptcha_secret_key') INSERT INTO WebsiteConfigs(ConfigKey,ConfigValue,Description) VALUES('recaptcha_secret_key','6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ','Secret key') ELSE UPDATE WebsiteConfigs SET ConfigValue='6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ' WHERE ConfigKey='recaptcha_secret_key'",
      "IF NOT EXISTS(SELECT * FROM WebsiteConfigs WHERE ConfigKey='recaptcha_version') INSERT INTO WebsiteConfigs(ConfigKey,ConfigValue,Description) VALUES('recaptcha_version','v2','reCAPTCHA version') ELSE UPDATE WebsiteConfigs SET ConfigValue='v2' WHERE ConfigKey='recaptcha_version'"
    ];

    for (const q of queries) {
      await pool.request().query(q);
      console.log('Executed OK');
    }

    const r = await pool.request().query("SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey LIKE 'recaptcha%'");
    console.log('Current reCAPTCHA config:', JSON.stringify(r.recordset, null, 2));

    await pool.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
