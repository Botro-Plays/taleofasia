-- LauncherNews table for Tale of Asia launcher news & patch notes
-- Run this in WebDB

USE [WebDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'LauncherNews')
BEGIN
    CREATE TABLE [dbo].[LauncherNews] (
        [Id]           INT IDENTITY(1,1) PRIMARY KEY,
        [Title]        NVARCHAR(200)   NOT NULL,
        [Body]         NVARCHAR(MAX)   NOT NULL,
        [Category]     NVARCHAR(20)    NOT NULL DEFAULT 'news',
        [IsPublished]  BIT             NOT NULL DEFAULT 1,
        [SortOrder]    INT             NOT NULL DEFAULT 0,
        [PublishedAt]  DATETIME        NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]    DATETIME        NOT NULL DEFAULT GETDATE(),
        [UpdatedBy]    NVARCHAR(50)    NOT NULL
    );
END
GO
