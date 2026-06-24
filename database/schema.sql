-- Tale of Conquest Website Database Schema
-- This script creates the necessary tables in WebDB for the website

USE WebDB;
GO

-- WebsiteConfigs table for storing website configuration
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
ELSE
    PRINT 'Table WebsiteConfigs already exists.';
GO

-- WebSessions table for JWT session management
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
        UserAgent NVARCHAR(500) NULL,
        FOREIGN KEY (AccountName) REFERENCES UserDB.dbo.UserInfo(AccountName)
    );
    CREATE INDEX IX_WebSessions_AccountName ON WebSessions(AccountName);
    CREATE INDEX IX_WebSessions_ExpiresAt ON WebSessions(ExpiresAt);
    PRINT 'Table WebSessions created successfully.';
END
ELSE
    PRINT 'Table WebSessions already exists.';
GO

-- WebUserPreferences table for user settings
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebUserPreferences')
BEGIN
    CREATE TABLE WebUserPreferences (
        AccountName NVARCHAR(50) PRIMARY KEY,
        Theme NVARCHAR(50) DEFAULT 'dark',
        NotificationsEnabled BIT DEFAULT 1,
        LastLoginIP NVARCHAR(50) NULL,
        LastLoginAt DATETIME NULL,
        FOREIGN KEY (AccountName) REFERENCES UserDB.dbo.UserInfo(AccountName)
    );
    PRINT 'Table WebUserPreferences created successfully.';
END
ELSE
    PRINT 'Table WebUserPreferences already exists.';
GO

-- WebAuditLogs table for audit trail
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
    PRINT 'Table WebAuditLogs created successfully.';
END
ELSE
    PRINT 'Table WebAuditLogs already exists.';
GO

-- PaymentTransactions table for payment tracking
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
        CompletedAt DATETIME NULL,
        FOREIGN KEY (AccountName) REFERENCES UserDB.dbo.UserInfo(AccountName)
    );
    CREATE INDEX IX_PaymentTransactions_AccountName ON PaymentTransactions(AccountName);
    CREATE INDEX IX_PaymentTransactions_Status ON PaymentTransactions(Status);
    CREATE INDEX IX_PaymentTransactions_CreatedAt ON PaymentTransactions(CreatedAt);
    PRINT 'Table PaymentTransactions created successfully.';
END
ELSE
    PRINT 'Table PaymentTransactions already exists.';
GO

-- VoteLogs table for voting system
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VoteLogs')
BEGIN
    CREATE TABLE VoteLogs (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        AccountName NVARCHAR(50) NOT NULL,
        VoteTime DATETIME DEFAULT GETDATE(),
        IPAddress NVARCHAR(50) NOT NULL,
        RewardClaimed BIT DEFAULT 0,
        RewardClaimedAt DATETIME NULL,
        FOREIGN KEY (AccountName) REFERENCES UserDB.dbo.UserInfo(AccountName)
    );
    CREATE INDEX IX_VoteLogs_AccountName ON VoteLogs(AccountName);
    CREATE INDEX IX_VoteLogs_VoteTime ON VoteLogs(VoteTime);
    CREATE INDEX IX_VoteLogs_IPAddress ON VoteLogs(IPAddress);
    PRINT 'Table VoteLogs created successfully.';
END
ELSE
    PRINT 'Table VoteLogs already exists.';
GO

-- AdminUsers table for admin role management
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdminUsers')
BEGIN
    CREATE TABLE AdminUsers (
        AdminID INT IDENTITY(1,1) PRIMARY KEY,
        AccountName NVARCHAR(50) NOT NULL UNIQUE,
        Role NVARCHAR(50) DEFAULT 'admin',
        Permissions NVARCHAR(MAX) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (AccountName) REFERENCES UserDB.dbo.UserInfo(AccountName)
    );
    PRINT 'Table AdminUsers created successfully.';
END
ELSE
    PRINT 'Table AdminUsers already exists.';
GO

-- Insert default website configurations
IF NOT EXISTS (SELECT * FROM WebsiteConfigs WHERE ConfigKey = 'maintenance_mode')
BEGIN
    INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description) VALUES 
    ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
    ('registration_enabled', 'true', 'Enable/disable user registration'),
    ('recaptcha_site_key', '6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS', 'Google reCAPTCHA site key'),
    ('recaptcha_secret_key', '6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ', 'Google reCAPTCHA secret key'),
    ('email_provider', 'smtp', 'Email provider: smtp, resend, or zoho'),
    ('email_from', 'noreply@taleofconquest.com', 'Sender email address'),
    ('email_from_name', 'Tale of Conquest', 'Sender display name'),
    ('smtp_host', 'taleofconquest.com', 'SMTP server hostname'),
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
    ('discord_invite_url', 'https://discord.com/invite/taleofasia', 'Discord invite URL'),
    ('facebook_page_url', 'https://www.facebook.com/TaleOfAsia', 'Facebook page URL');
    PRINT 'Default website configurations inserted.';
END
ELSE
    PRINT 'Default website configurations already exist.';
GO

-- WebhookPayloads table for raw webhook payload replay/debugging
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WebhookPayloads')
BEGIN
    CREATE TABLE WebhookPayloads (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        Provider NVARCHAR(50) NOT NULL,
        EventType NVARCHAR(100) NULL,
        GatewayTransactionID NVARCHAR(200) NULL,
        Payload NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NULL,
        IPAddress NVARCHAR(50) NULL,
        Timestamp DATETIME DEFAULT GETDATE()
    );
    CREATE INDEX IX_WebhookPayloads_Provider ON WebhookPayloads(Provider);
    CREATE INDEX IX_WebhookPayloads_Timestamp ON WebhookPayloads(Timestamp);
    CREATE INDEX IX_WebhookPayloads_EventType ON WebhookPayloads(EventType);
    CREATE INDEX IX_WebhookPayloads_GatewayTransactionID ON WebhookPayloads(GatewayTransactionID);
    PRINT 'Table WebhookPayloads created successfully.';
END
ELSE
    PRINT 'Table WebhookPayloads already exists.';
GO

-- CryptoBlockchainConfig table for EVM wallet payment automation
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CryptoBlockchainConfig')
BEGIN
    CREATE TABLE CryptoBlockchainConfig (
        NetworkKey NVARCHAR(20) PRIMARY KEY,
        ChainId INT NOT NULL,
        ChainName NVARCHAR(50) NOT NULL,
        RpcUrl NVARCHAR(200) NOT NULL,
        FallbackRpcUrl NVARCHAR(200) NULL,
        UsdtContract NVARCHAR(42) NOT NULL,
        UsdtDecimals INT DEFAULT 6,
        BlockTimeSeconds INT NOT NULL,
        RequiredConfirmations INT DEFAULT 1,
        IsEnabled BIT DEFAULT 1,
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    PRINT 'Table CryptoBlockchainConfig created successfully.';
END
ELSE
    PRINT 'Table CryptoBlockchainConfig already exists.';
GO

-- Add crypto columns to PaymentTransactions (if not already present)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaymentTransactions') AND name = 'ChainId')
BEGIN
    ALTER TABLE PaymentTransactions ADD ChainId INT NULL;
    PRINT 'Added ChainId column to PaymentTransactions.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaymentTransactions') AND name = 'TxHash')
BEGIN
    ALTER TABLE PaymentTransactions ADD TxHash NVARCHAR(66) NULL;
    CREATE INDEX IX_PaymentTransactions_TxHash ON PaymentTransactions(TxHash);
    PRINT 'Added TxHash column to PaymentTransactions.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaymentTransactions') AND name = 'WalletAddress')
BEGIN
    ALTER TABLE PaymentTransactions ADD WalletAddress NVARCHAR(42) NULL;
    PRINT 'Added WalletAddress column to PaymentTransactions.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaymentTransactions') AND name = 'VerificationAttempts')
BEGIN
    ALTER TABLE PaymentTransactions ADD VerificationAttempts INT DEFAULT 0;
    PRINT 'Added VerificationAttempts column to PaymentTransactions.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaymentTransactions') AND name = 'LastVerificationAt')
BEGIN
    ALTER TABLE PaymentTransactions ADD LastVerificationAt DATETIME NULL;
    PRINT 'Added LastVerificationAt column to PaymentTransactions.';
END
GO

PRINT 'Database schema setup completed successfully.';
