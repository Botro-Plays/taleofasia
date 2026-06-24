const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'WIN-6EI3K1H544I\\TALEOFASIA',
  database: 'WebDB',
  user: process.env.DB_USER || 'as',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function setupDatabase() {
  try {
    await sql.connect(config);
    console.log('Connected to WebDB successfully');

    // Create WebsiteConfigs table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebsiteConfigs')
      BEGIN
        CREATE TABLE WebsiteConfigs (
          ConfigKey NVARCHAR(100) PRIMARY KEY,
          ConfigValue NVARCHAR(MAX) NULL,
          Description NVARCHAR(500) NULL,
          LastUpdated DATETIME DEFAULT GETDATE()
        );
        PRINT 'Table WebsiteConfigs created successfully.';
      END
    `);
    console.log('WebsiteConfigs table ready');

    // Create WebSessions table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebSessions')
      BEGIN
        CREATE TABLE WebSessions (
          SessionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          AccountName NVARCHAR(50) NOT NULL,
          Token NVARCHAR(MAX) NOT NULL,
          RefreshToken NVARCHAR(MAX) NOT NULL,
          ExpiresAt DATETIME NOT NULL,
          CreatedAt DATETIME DEFAULT GETDATE(),
          IPAddress NVARCHAR(50) NULL,
          UserAgent NVARCHAR(500) NULL
        );
        CREATE INDEX IX_WebSessions_AccountName ON WebSessions(AccountName);
        CREATE INDEX IX_WebSessions_ExpiresAt ON WebSessions(ExpiresAt);
      END
    `);
    console.log('WebSessions table ready');

    // Create WebUserPreferences table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebUserPreferences')
      BEGIN
        CREATE TABLE WebUserPreferences (
          AccountName NVARCHAR(50) PRIMARY KEY,
          Theme NVARCHAR(50) DEFAULT 'dark',
          NotificationsEnabled BIT DEFAULT 1,
          LastLoginIP NVARCHAR(50) NULL,
          LastLoginAt DATETIME NULL
        );
      END
    `);
    console.log('WebUserPreferences table ready');

    // Create WebAuditLogs table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebAuditLogs')
      BEGIN
        CREATE TABLE WebAuditLogs (
          LogID INT IDENTITY(1,1) PRIMARY KEY,
          AccountName NVARCHAR(50) NULL,
          Action NVARCHAR(100) NOT NULL,
          Details NVARCHAR(MAX) NULL,
          IPAddress NVARCHAR(50) NULL,
          Timestamp DATETIME DEFAULT GETDATE()
        );
        CREATE INDEX IX_WebAuditLogs_AccountName ON WebAuditLogs(AccountName);
        CREATE INDEX IX_WebAuditLogs_Timestamp ON WebAuditLogs(Timestamp);
        CREATE INDEX IX_WebAuditLogs_Action ON WebAuditLogs(Action);
      END
    `);
    console.log('WebAuditLogs table ready');

    // Create PaymentTransactions table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentTransactions')
      BEGIN
        CREATE TABLE PaymentTransactions (
          TransactionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          AccountName NVARCHAR(50) NOT NULL,
          Amount DECIMAL(18,2) NOT NULL,
          Currency NVARCHAR(10) DEFAULT 'PHP',
          UsdAmount DECIMAL(18,2) NULL,
          LocalCurrency NVARCHAR(10) NULL,
          LocalAmount DECIMAL(18,2) NULL,
          PaymentMethod NVARCHAR(50) NOT NULL,
          Status NVARCHAR(50) DEFAULT 'pending',
          GatewayTransactionID NVARCHAR(255) NULL,
          CoinsAwarded INT NULL,
          BonusRate DECIMAL(5,2) NULL,
          ExpiresAt DATETIME NULL,
          Notes NVARCHAR(500) NULL,
          IPAddress NVARCHAR(50) NULL,
          CountryCode NVARCHAR(10) NULL,
          CreatedAt DATETIME DEFAULT GETDATE(),
          CompletedAt DATETIME NULL
        );
        CREATE INDEX IX_PaymentTransactions_AccountName ON PaymentTransactions(AccountName);
        CREATE INDEX IX_PaymentTransactions_Status ON PaymentTransactions(Status);
        CREATE INDEX IX_PaymentTransactions_CreatedAt ON PaymentTransactions(CreatedAt);
      END
    `);
    // Add missing columns for existing tables
    await sql.query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentTransactions')
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'UsdAmount' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD UsdAmount DECIMAL(18,2) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'LocalCurrency' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD LocalCurrency NVARCHAR(10) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'LocalAmount' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD LocalAmount DECIMAL(18,2) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'CoinsAwarded' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD CoinsAwarded INT NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'BonusRate' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD BonusRate DECIMAL(5,2) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'ExpiresAt' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD ExpiresAt DATETIME NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'Notes' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD Notes NVARCHAR(500) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'IPAddress' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD IPAddress NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'CountryCode' AND object_id = OBJECT_ID('PaymentTransactions'))
          ALTER TABLE PaymentTransactions ADD CountryCode NVARCHAR(10) NULL;
      END
    `);
    console.log('PaymentTransactions table ready');

    // Create VoteLogs table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VoteLogs')
      BEGIN
        CREATE TABLE VoteLogs (
          LogID INT IDENTITY(1,1) PRIMARY KEY,
          AccountName NVARCHAR(50) NOT NULL,
          VoteTime DATETIME DEFAULT GETDATE(),
          IPAddress NVARCHAR(50) NOT NULL,
          RewardClaimed BIT DEFAULT 0,
          RewardClaimedAt DATETIME NULL
        );
        CREATE INDEX IX_VoteLogs_AccountName ON VoteLogs(AccountName);
        CREATE INDEX IX_VoteLogs_VoteTime ON VoteLogs(VoteTime);
        CREATE INDEX IX_VoteLogs_IPAddress ON VoteLogs(IPAddress);
      END
    `);
    console.log('VoteLogs table ready');

    // Create AdminUsers table
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdminUsers')
      BEGIN
        CREATE TABLE AdminUsers (
          AdminID INT IDENTITY(1,1) PRIMARY KEY,
          AccountName NVARCHAR(50) NOT NULL UNIQUE,
          Role NVARCHAR(50) DEFAULT 'admin',
          Permissions NVARCHAR(MAX) NULL,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
      END
    `);
    console.log('AdminUsers table ready');

    // Insert default configurations
    const configCheck = await sql.query(`SELECT COUNT(*) as count FROM WebsiteConfigs`);
    if (configCheck.recordset[0].count === 0) {
      await sql.query(`
        INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description) VALUES 
        ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
        ('registration_enabled', 'true', 'Enable/disable user registration'),
        ('recaptcha_site_key', '6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS', 'Google reCAPTCHA site key'),
        ('recaptcha_secret_key', '6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ', 'Google reCAPTCHA secret key'),
        ('email_provider', 'smtp', 'Email provider: smtp, resend, or zoho'),
        ('email_from', 'noreply@taleofasia.com', 'Sender email address'),
        ('email_from_name', 'Tale of Asia', 'Sender display name'),
        ('smtp_host', 'taleofasia.com', 'SMTP server hostname'),
        ('smtp_port', '465', 'SMTP server port'),
        ('smtp_secure', 'true', 'Use SSL/TLS for SMTP'),
        ('smtp_user', '', 'SMTP username'),
        ('smtp_pass', '', 'SMTP password'),
        ('resend_api_key', '', 'Resend API key'),
        ('zoho_user', '', 'Zoho Mail username'),
        ('zoho_pass', '', 'Zoho Mail password'),
        ('zoho_host', 'smtp.zoho.com', 'Zoho SMTP host'),
        ('zoho_port', '465', 'Zoho SMTP port'),
        ('payment_gcash_enabled', 'true', 'Enable GCash QR code payment'),
        ('payment_paymongo_enabled', 'false', 'Enable PayMongo (credit card/GCash e-wallet)'),
        ('payment_paypal_enabled', 'false', 'Enable PayPal checkout'),
        ('payment_crypto_enabled', 'false', 'Enable USDT crypto payments (BEP20 + Base)'),
        ('paymongo_public_key', '', 'PayMongo public API key'),
        ('paymongo_secret_key', '', 'PayMongo secret API key'),
        ('paymongo_webhook_secret', '', 'PayMongo webhook secret (for signature verification)'),
        ('paypal_client_id', '', 'PayPal Client ID'),
        ('paypal_secret', '', 'PayPal Secret'),
        ('paypal_sandbox', 'true', 'PayPal sandbox mode'),
        ('paypal_webhook_id', '', 'PayPal webhook ID (for webhook verification)'),
        ('crypto_wallet_bep20', '', 'USDT BEP20 wallet address'),
        ('crypto_wallet_base', '', 'USDT Base wallet address'),
        ('coin_base_rate', '120', 'Base coins per 1 USD'),
        ('bonus_tier_1_threshold', '10', 'USD threshold for tier 1 bonus'),
        ('bonus_tier_1_rate', '130', 'Coins per 1 USD at tier 1'),
        ('bonus_tier_2_threshold', '25', 'USD threshold for tier 2 bonus'),
        ('bonus_tier_2_rate', '140', 'Coins per 1 USD at tier 2'),
        ('bonus_tier_3_threshold', '50', 'USD threshold for tier 3 bonus'),
        ('bonus_tier_3_rate', '150', 'Coins per 1 USD at tier 3'),
        ('payment_min_usd', '1', 'Minimum USD amount for all payments'),
        ('paymongo_min_php', '1', 'Minimum PayMongo amount in PHP'),
        ('paypal_min_usd', '1', 'Minimum PayPal amount in USD'),
        ('crypto_usd_to_credit_rate', '100', 'Credits per 1 USD for crypto payments'),
        ('crypto_min_usd', '5', 'Minimum USD amount for crypto payments'),
        ('vote_reward_cooldown_hours', '12', 'Hours between vote rewards'),
        ('vote_reward_coins', '5', 'Coins awarded per vote'),
        ('discord_invite_url', 'https://discord.com/invite/nszKZPtvqv', 'Discord invite URL'),
        ('facebook_page_url', 'https://www.facebook.com/TaleOfAsia', 'Facebook page URL');
      `);
      console.log('Default configurations inserted');
    } else {
      console.log('Default configurations already exist');
    }

    console.log('Database schema setup completed successfully!');
  } catch (err) {
    console.error('Database setup error:', err);
    process.exit(1);
  } finally {
    await sql.close();
  }
}

setupDatabase();
