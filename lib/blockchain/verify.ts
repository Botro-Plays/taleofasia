import { createPublicClient, http } from 'viem';
import { bsc, base } from 'viem/chains';
import type { BlockchainNetwork } from './config';

const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const chainMap: Record<number, typeof bsc | typeof base> = {
  56: bsc,
  8453: base,
};

export interface VerificationResult {
  valid: boolean;
  error?: string;
  from?: string;
  to?: string;
  value?: string;
  confirmations?: number;
}

async function tryVerifyWithClient(
  client: any,
  txHash: string,
  network: BlockchainNetwork,
  expectedRecipient: string,
  expectedAmountWei: bigint,
  requiredConfirmations: number
): Promise<VerificationResult> {
  console.log(`[tryVerify] chainId=${network.chainId} txHash=${txHash} rpc=${network.rpcUrl} expectedWallet=${expectedRecipient} expectedWei=${expectedAmountWei}`);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (receiptErr: any) {
    console.warn(`[tryVerify] getTransactionReceipt threw: ${receiptErr.message}`);
    throw receiptErr;
  }

  if (!receipt) {
    console.log(`[tryVerify] Receipt is null/undefined for ${txHash}`);
    return { valid: false, error: 'Transaction not found. It may still be pending.' };
  }

  console.log(`[tryVerify] Receipt found: status=${receipt.status} block=${receipt.blockNumber} logs=${receipt.logs?.length || 0}`);

  if (receipt.status !== 'success') {
    return { valid: false, error: 'Transaction failed on-chain.' };
  }

  const latestBlock = await client.getBlockNumber();
  const confirmations = Number(latestBlock - receipt.blockNumber);
  console.log(`[tryVerify] Confirmations: ${confirmations} (required: ${requiredConfirmations}) latestBlock=${latestBlock} receiptBlock=${receipt.blockNumber}`);

  if (confirmations < requiredConfirmations) {
    return {
      valid: false,
      error: `Waiting for confirmations (${confirmations}/${requiredConfirmations})`,
      confirmations,
    };
  }

  const transferLog = receipt.logs.find((log: { address: string; topics: string[] }) => {
    return (
      log.address.toLowerCase() === network.usdtContract.toLowerCase() &&
      log.topics[0]?.toLowerCase() === TRANSFER_EVENT_SIGNATURE
    );
  });

  if (!transferLog) {
    const logAddresses = receipt.logs.map((l: any) => l.address).join(', ');
    console.log(`[tryVerify] No USDT Transfer log found. Log addresses: [${logAddresses}] expectedContract=${network.usdtContract}`);
    return { valid: false, error: 'No USDT Transfer event found in transaction logs.' };
  }

  const from = `0x${transferLog.topics[1]?.slice(-40)}`;
  const to = `0x${transferLog.topics[2]?.slice(-40)}`;
  const value = BigInt(transferLog.data || '0');
  console.log(`[tryVerify] Transfer log: from=${from} to=${to} value=${value}`);

  if (to.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return { valid: false, error: `Transfer recipient mismatch. Expected ${expectedRecipient}, got ${to}.` };
  }

  if (value < expectedAmountWei) {
    return {
      valid: false,
      error: `Insufficient amount. Expected ${expectedAmountWei} wei, received ${value} wei.`,
    };
  }

  return {
    valid: true,
    from,
    to,
    value: value.toString(),
    confirmations,
  };
}

export async function verifyOnChainTransfer(
  network: BlockchainNetwork,
  txHash: string,
  expectedRecipient: string,
  expectedAmountWei: bigint,
  requiredConfirmations: number = 1
): Promise<VerificationResult> {
  const chain = chainMap[network.chainId];
  if (!chain) {
    return { valid: false, error: `Unsupported chain ID: ${network.chainId}` };
  }

  // Try primary RPC first
  const primaryClient = createPublicClient({
    chain,
    transport: http(network.rpcUrl),
  });

  try {
    return await tryVerifyWithClient(primaryClient, txHash, network, expectedRecipient, expectedAmountWei, requiredConfirmations);
  } catch (error: any) {
    console.warn(`Primary RPC ${network.rpcUrl} failed:`, error.message);

    // Try fallback RPC if available
    if (network.fallbackRpcUrl) {
      console.log(`Trying fallback RPC ${network.fallbackRpcUrl}...`);
      const fallbackClient = createPublicClient({
        chain,
        transport: http(network.fallbackRpcUrl),
      });
      try {
        return await tryVerifyWithClient(fallbackClient, txHash, network, expectedRecipient, expectedAmountWei, requiredConfirmations);
      } catch (fallbackError: any) {
        console.warn(`Fallback RPC ${network.fallbackRpcUrl} also failed:`, fallbackError.message);
      }
    }

    if (error.message?.includes('not found') || error.message?.includes('receipt')) {
      return { valid: false, error: 'Transaction not yet confirmed. Please wait.' };
    }
    console.error('On-chain verification error:', error);
    return { valid: false, error: 'Blockchain verification error. Primary and fallback RPC both failed.' };
  }
}
