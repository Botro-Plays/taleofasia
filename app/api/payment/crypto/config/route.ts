import { NextResponse } from 'next/server';
import { webDB } from '@/lib/db';

export async function GET() {
  try {
    const result = await webDB.query(
      `SELECT NetworkKey, ChainId, ChainName, RpcUrl, UsdtContract, UsdtDecimals,
              BlockTimeSeconds, RequiredConfirmations, IsEnabled
       FROM CryptoBlockchainConfig
       WHERE IsEnabled = 1
       ORDER BY NetworkKey`
    );

    const rows = result.recordset || [];
    const networks: Record<string, unknown> = {};

    for (const row of rows) {
      networks[row.NetworkKey] = {
        chainId: row.ChainId,
        name: row.ChainName,
        rpcUrl: row.RpcUrl,
        usdtContract: row.UsdtContract,
        decimals: row.UsdtDecimals,
        blockTimeSec: row.BlockTimeSeconds,
        requiredConfirmations: row.RequiredConfirmations,
      };
    }

    return NextResponse.json({ networks });
  } catch (error) {
    console.error('Error fetching crypto config:', error);
    return NextResponse.json({ error: 'Failed to fetch crypto config' }, { status: 500 });
  }
}
