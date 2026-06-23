import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { bsc, base } from 'viem/chains';

const USDT_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const chainMap: Record<number, typeof bsc | typeof base> = {
  56: bsc,
  8453: base,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, token, account } = body;

    if (!chainId || !token || !account) {
      return NextResponse.json({ error: 'Missing chainId, token, or account' }, { status: 400 });
    }

    const chain = chainMap[chainId as number];
    if (!chain) {
      return NextResponse.json({ error: 'Unsupported chainId' }, { status: 400 });
    }

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const balance = await client.readContract({
      address: token as `0x${string}`,
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [account as `0x${string}`],
    });

    return NextResponse.json({ balance: balance.toString() });
  } catch (error) {
    console.error('Error reading USDT balance:', error);
    return NextResponse.json({ error: 'Failed to read balance' }, { status: 500 });
  }
}
