-- Update reCAPTCHA keys in existing WebsiteConfigs table
-- Run this against WebDB to update the reCAPTCHA site key and secret key

USE WebDB;
GO

-- Update or insert recaptcha_site_key
IF EXISTS (SELECT * FROM WebsiteConfigs WHERE ConfigKey = 'recaptcha_site_key')
    UPDATE WebsiteConfigs SET ConfigValue = '6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS' WHERE ConfigKey = 'recaptcha_site_key';
ELSE
    INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description) VALUES ('recaptcha_site_key', '6LexTC0tAAAAAOySjZhUjklMB6pTO14WrSQmz7TS', 'Google reCAPTCHA site key');
GO

-- Update or insert recaptcha_secret_key
IF EXISTS (SELECT * FROM WebsiteConfigs WHERE ConfigKey = 'recaptcha_secret_key')
    UPDATE WebsiteConfigs SET ConfigValue = '6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ' WHERE ConfigKey = 'recaptcha_secret_key';
ELSE
    INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description) VALUES ('recaptcha_secret_key', '6LexTC0tAAAAAExFKhEDgau4fxgxu0T8XqdiMCpJ', 'Google reCAPTCHA secret key');
GO

-- Enable reCAPTCHA
IF EXISTS (SELECT * FROM WebsiteConfigs WHERE ConfigKey = 'recaptcha_enabled')
    UPDATE WebsiteConfigs SET ConfigValue = 'true' WHERE ConfigKey = 'recaptcha_enabled';
ELSE
    INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description) VALUES ('recaptcha_enabled', 'true', 'Enable Google reCAPTCHA on login/register');
GO

PRINT 'reCAPTCHA keys updated successfully.';
GO
