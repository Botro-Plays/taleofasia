-- Create PaymentBonusTiers table and seed from existing WebsiteConfigs values
-- Run this once on the production database

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'PaymentBonusTiers')
BEGIN
  CREATE TABLE PaymentBonusTiers (
    TierID     INT IDENTITY(1,1) PRIMARY KEY,
    TierNumber INT NOT NULL,          -- 1, 2, 3, ... (display order)
    Threshold  DECIMAL(18,2) NOT NULL, -- minimum USD to qualify
    Rate       INT NOT NULL,           -- coins per $1 at this tier
    IsActive   BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_BonusTierNumber UNIQUE (TierNumber)
  );

  -- Seed from existing WebsiteConfigs values (with safe defaults)
  DECLARE @t1_threshold DECIMAL(18,2) = 10, @t1_rate INT = 130;
  DECLARE @t2_threshold DECIMAL(18,2) = 25, @t2_rate INT = 140;
  DECLARE @t3_threshold DECIMAL(18,2) = 50, @t3_rate INT = 150;

  SELECT @t1_threshold = CAST(ConfigValue AS DECIMAL(18,2)) FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_1_threshold';
  SELECT @t1_rate       = CAST(ConfigValue AS INT)          FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_1_rate';
  SELECT @t2_threshold = CAST(ConfigValue AS DECIMAL(18,2)) FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_2_threshold';
  SELECT @t2_rate       = CAST(ConfigValue AS INT)          FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_2_rate';
  SELECT @t3_threshold = CAST(ConfigValue AS DECIMAL(18,2)) FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_3_threshold';
  SELECT @t3_rate       = CAST(ConfigValue AS INT)          FROM WebsiteConfigs WHERE ConfigKey = 'bonus_tier_3_rate';

  -- Use defaults if not found
  SET @t1_threshold = ISNULL(@t1_threshold, 10);
  SET @t1_rate      = ISNULL(@t1_rate, 130);
  SET @t2_threshold = ISNULL(@t2_threshold, 25);
  SET @t2_rate      = ISNULL(@t2_rate, 140);
  SET @t3_threshold = ISNULL(@t3_threshold, 50);
  SET @t3_rate      = ISNULL(@t3_rate, 150);

  INSERT INTO PaymentBonusTiers (TierNumber, Threshold, Rate, IsActive) VALUES
    (1, @t1_threshold, @t1_rate, 1),
    (2, @t2_threshold, @t2_rate, 1),
    (3, @t3_threshold, @t3_rate, 1);

  PRINT 'PaymentBonusTiers table created and seeded with 3 tiers.';
END
ELSE
BEGIN
  PRINT 'PaymentBonusTiers table already exists.';
END
