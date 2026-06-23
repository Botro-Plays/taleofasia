import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const priv = await checkAdminPrivileges(session.user.id);
    if (!priv.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Seed BEP20 (BSC Mainnet)
    await webDB.query(
      `MERGE INTO CryptoBlockchainConfig AS target
       USING (VALUES ('bep20', 56, 'BSC', 'https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io',
                    '0x55d398326f99059fF775485246999027B3197955', 6, 3, 1, 1)) AS source
       (NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl, UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled)
       ON target.NetworkKey = source.NetworkKey
       WHEN MATCHED THEN
         UPDATE SET ChainId = source.ChainId, ChainName = source.ChainName, RpcUrl = source.RpcUrl,
                    FallbackRpcUrl = source.FallbackRpcUrl, UsdtContract = source.UsdtContract,
                    UsdtDecimals = source.UsdtDecimals, BlockTimeSeconds = source.BlockTimeSeconds,
                    RequiredConfirmations = source.RequiredConfirmations, IsEnabled = source.IsEnabled,
                    UpdatedAt = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl, UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled, UpdatedAt)
         VALUES (source.NetworkKey, source.ChainId, source.ChainName, source.RpcUrl, source.FallbackRpcUrl, source.UsdtContract, source.UsdtDecimals, source.BlockTimeSeconds, source.RequiredConfirmations, source.IsEnabled, GETDATE());`
    );

    // Seed Base Mainnet
    await webDB.query(
      `MERGE INTO CryptoBlockchainConfig AS target
       USING (VALUES ('base', 8453, 'Base', 'https://mainnet.base.org', 'https://base.llamarpc.com',
                    '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 6, 2, 1, 1)) AS source
       (NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl, UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled)
       ON target.NetworkKey = source.NetworkKey
       WHEN MATCHED THEN
         UPDATE SET ChainId = source.ChainId, ChainName = source.ChainName, RpcUrl = source.RpcUrl,
                    FallbackRpcUrl = source.FallbackRpcUrl, UsdtContract = source.UsdtContract,
                    UsdtDecimals = source.UsdtDecimals, BlockTimeSeconds = source.BlockTimeSeconds,
                    RequiredConfirmations = source.RequiredConfirmations, IsEnabled = source.IsEnabled,
                    UpdatedAt = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl, UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled, UpdatedAt)
         VALUES (source.NetworkKey, source.ChainId, source.ChainName, source.RpcUrl, source.FallbackRpcUrl, source.UsdtContract, source.UsdtDecimals, source.BlockTimeSeconds, source.RequiredConfirmations, source.IsEnabled, GETDATE());`
    );

    // Ensure WebsiteConfigs keys for custom RPC exist (empty = use free public RPC)
    const customRpcKeys = [
      { key: 'crypto_custom_rpc_bep20',    desc: 'Custom BSC RPC URL (optional)' },
      { key: 'crypto_custom_api_key_bep20', desc: 'Custom BSC RPC API key (optional)' },
      { key: 'crypto_custom_rpc_base',     desc: 'Custom Base RPC URL (optional)' },
      { key: 'crypto_custom_api_key_base', desc: 'Custom Base RPC API key (optional)' },
    ];
    for (const item of customRpcKeys) {
      await webDB.query(
        `IF NOT EXISTS (SELECT 1 FROM WebsiteConfigs WHERE ConfigKey = @key)
         INSERT INTO WebsiteConfigs (ConfigKey, ConfigValue, Description, LastUpdated)
         VALUES (@key, '', @desc, GETDATE())`,
        { key: item.key, desc: item.desc }
      );
    }

    return NextResponse.json({ success: true, message: 'Crypto blockchain config seeded.' });
  } catch (error) {
    console.error('Error seeding crypto config:', error);
    return NextResponse.json({ error: 'Failed to seed crypto config' }, { status: 500 });
  }
}
