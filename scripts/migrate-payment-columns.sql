-- Migration: Add missing columns to PaymentTransactions
-- Date: 2026-06-07
-- Issue: Production table was created before these columns were added to schema.sql

USE WebDB;
GO

ALTER TABLE PaymentTransactions
ADD UsdAmount DECIMAL(18,2) NULL,
    LocalCurrency NVARCHAR(10) NULL,
    LocalAmount DECIMAL(18,2) NULL,
    CoinsAwarded INT NULL,
    BonusRate DECIMAL(5,2) NULL,
    ExpiresAt DATETIME NULL,
    Notes NVARCHAR(500) NULL,
    IPAddress NVARCHAR(50) NULL,
    CountryCode NVARCHAR(10) NULL;
GO

PRINT 'Migration complete: Added missing columns to PaymentTransactions.';
GO
