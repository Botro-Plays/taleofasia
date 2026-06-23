import { webDB } from '@/lib/db';

// Map chain IDs to their WebsiteConfig custom-RPC keys
const CUSTOM_RPC_KEYS: Record<number, { rpcKey: string; apiKeyKey: string }> = {
  56:   { rpcKey: 'crypto_custom_rpc_bep20',   apiKeyKey: 'crypto_custom_api_key_bep20' },
  8453: { rpcKey: 'crypto_custom_rpc_base',    apiKeyKey: 'crypto_custom_api_key_base' },
};

/**
 * Check WebsiteConfigs for a custom RPC override for the given chain.
 * If a custom RPC URL is set, it replaces the default RpcUrl.
 * If an API key is also set, it is appended as a query parameter.
 * Falls back to the default free RPC if no custom URL is configured.
 */
async function applyCustomRpc(network: BlockchainNetwork): Promise<BlockchainNetwork> {
  const mapping = CUSTOM_RPC_KEYS[network.chainId];
  if (!mapping) return network;

  const res = await webDB.query(
    `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey IN (@rpcKey, @apiKeyKey)`,
    { rpcKey: mapping.rpcKey, apiKeyKey: mapping.apiKeyKey }
  );

  const map = new Map<string, string>();
  for (const row of res.recordset || []) {
    map.set(String(row.ConfigKey), String(row.ConfigValue || ''));
  }

  const customRpc = map.get(mapping.rpcKey)?.trim();
  if (!customRpc) return network; // no custom override

  const apiKey = map.get(mapping.apiKeyKey)?.trim();
  const rpcUrl = apiKey ? `${customRpc}${customRpc.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(apiKey)}` : customRpc;

  return {
    ...network,
    rpcUrl,
    // If a custom RPC is set, the free fallback becomes the fallback RPC
    fallbackRpcUrl: network.rpcUrl,
  };
}

export interface BlockchainNetwork {
  networkKey: string;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  fallbackRpcUrl?: string;
  usdtContract: string;
  usdtDecimals: number;
  blockTimeSeconds: number;
  requiredConfirmations: number;
  isEnabled: boolean;
}

export async function getBlockchainNetworks(): Promise<BlockchainNetwork[]> {
  const result = await webDB.query(
    `SELECT NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl,
            UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled
     FROM CryptoBlockchainConfig`
  );
  const networks = (result.recordset || []).map((r: Record<string, unknown>) => ({
    networkKey: String(r.NetworkKey),
    chainId: Number(r.ChainId),
    chainName: String(r.ChainName),
    rpcUrl: String(r.RpcUrl),
    fallbackRpcUrl: r.FallbackRpcUrl ? String(r.FallbackRpcUrl) : undefined,
    usdtContract: String(r.UsdtContract),
    usdtDecimals: Number(r.UsdtDecimals) || 6,
    blockTimeSeconds: Number(r.BlockTimeSeconds),
    requiredConfirmations: Number(r.RequiredConfirmations) || 1,
    isEnabled: Boolean(r.IsEnabled),
  }));
  return Promise.all(networks.map(applyCustomRpc));
}

export async function getEnabledNetworks(): Promise<BlockchainNetwork[]> {
  const all = await getBlockchainNetworks();
  return all.filter(n => n.isEnabled);
}

export async function getNetworkByKey(key: string): Promise<BlockchainNetwork | null> {
  const result = await webDB.query(
    `SELECT NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl,
            UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled
     FROM CryptoBlockchainConfig
     WHERE NetworkKey = @key`,
    { key }
  );
  const r = result.recordset?.[0];
  if (!r) return null;
  return {
    networkKey: String(r.NetworkKey),
    chainId: Number(r.ChainId),
    chainName: String(r.ChainName),
    rpcUrl: String(r.RpcUrl),
    fallbackRpcUrl: r.FallbackRpcUrl ? String(r.FallbackRpcUrl) : undefined,
    usdtContract: String(r.UsdtContract),
    usdtDecimals: Number(r.UsdtDecimals) || 6,
    blockTimeSeconds: Number(r.BlockTimeSeconds),
    requiredConfirmations: Number(r.RequiredConfirmations) || 1,
    isEnabled: Boolean(r.IsEnabled),
  };
}

export async function getNetworkByChainId(chainId: number): Promise<BlockchainNetwork | null> {
  const result = await webDB.query(
    `SELECT NetworkKey, ChainId, ChainName, RpcUrl, FallbackRpcUrl,
            UsdtContract, UsdtDecimals, BlockTimeSeconds, RequiredConfirmations, IsEnabled
     FROM CryptoBlockchainConfig
     WHERE ChainId = @chainId`,
    { chainId }
  );
  const r = result.recordset?.[0];
  if (!r) return null;
  const network: BlockchainNetwork = {
    networkKey: String(r.NetworkKey),
    chainId: Number(r.ChainId),
    chainName: String(r.ChainName),
    rpcUrl: String(r.RpcUrl),
    fallbackRpcUrl: r.FallbackRpcUrl ? String(r.FallbackRpcUrl) : undefined,
    usdtContract: String(r.UsdtContract),
    usdtDecimals: Number(r.UsdtDecimals) || 6,
    blockTimeSeconds: Number(r.BlockTimeSeconds),
    requiredConfirmations: Number(r.RequiredConfirmations) || 1,
    isEnabled: Boolean(r.IsEnabled),
  };
  return applyCustomRpc(network);
}
