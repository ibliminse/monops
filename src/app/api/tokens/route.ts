import { NextRequest, NextResponse } from 'next/server';

const MONAD_CHAIN_ID = '0x8f'; // 143 in hex

interface MoralisToken {
  token_address: string;
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  balance: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  console.log('[Token API] Fetching tokens for', address);

  // Try Moralis first
  const moralisKey = process.env.MORALIS_API_KEY;

  if (moralisKey) {
    try {
      console.log('[Token API] Using Moralis API');

      const url = new URL(`https://deep-index.moralis.io/api/v2.2/${address}/erc20`);
      url.searchParams.set('chain', MONAD_CHAIN_ID);

      const response = await fetch(url.toString(), {
        headers: {
          'X-API-Key': moralisKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.status}`);
      }

      const tokens: MoralisToken[] = await response.json();
      console.log(`[Token API] Moralis found ${tokens.length} tokens`);

      // Filter out zero balances and format response
      const validTokens = tokens
        .filter((t) => t.balance !== '0')
        .map((t) => ({
          address: t.token_address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          balance: t.balance,
          formattedBalance: formatBalance(t.balance, t.decimals),
        }));

      return NextResponse.json({
        source: 'moralis',
        tokens: validTokens,
      });
    } catch (error) {
      console.error('[Token API] Moralis failed:', error);
      // Fall through to Etherscan
    }
  }

  // Fallback to Etherscan V2 for token transfers
  const etherscanKey = process.env.NEXT_PUBLIC_MONADSCAN_API_KEY;

  if (!etherscanKey) {
    console.log('[Token API] No API keys configured');
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 });
  }

  try {
    console.log('[Token API] Using Etherscan V2 API');

    interface EtherscanTransfer {
      contractAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tokenDecimal: string;
      from: string;
      to: string;
      value: string;
      blockNumber: string;
    }

    const allTransfers: EtherscanTransfer[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    // Fetch token transfers
    while (hasMore && page <= 10) { // Limit to 10 pages
      const url = `https://api.etherscan.io/v2/api?chainid=143&module=account&action=tokentx&address=${address}&page=${page}&offset=${pageSize}&sort=desc&apikey=${etherscanKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);
        console.log(`[Token API] Etherscan page ${page}: ${data.result.length} transfers`);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[Token API] Etherscan total transfers: ${allTransfers.length}`);

    // Calculate token balances from transfer history
    const balances = new Map<string, {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      balance: bigint;
    }>();

    const normalizedOwner = address.toLowerCase();

    for (const transfer of allTransfers) {
      const key = transfer.contractAddress.toLowerCase();
      const isReceiving = transfer.to.toLowerCase() === normalizedOwner;
      const isSending = transfer.from.toLowerCase() === normalizedOwner;
      const value = BigInt(transfer.value);

      if (!balances.has(key)) {
        balances.set(key, {
          address: transfer.contractAddress,
          symbol: transfer.tokenSymbol,
          name: transfer.tokenName,
          decimals: parseInt(transfer.tokenDecimal, 10),
          balance: 0n,
        });
      }

      const token = balances.get(key)!;
      if (isReceiving) {
        token.balance += value;
      } else if (isSending) {
        token.balance -= value;
      }
    }

    // Filter and format results
    const validTokens = Array.from(balances.values())
      .filter((t) => t.balance > 0n)
      .map((t) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        balance: t.balance.toString(),
        formattedBalance: formatBalance(t.balance.toString(), t.decimals),
      }));

    console.log(`[Token API] Found ${validTokens.length} tokens with balance`);

    return NextResponse.json({
      source: 'etherscan',
      tokens: validTokens,
    });
  } catch (error) {
    console.error('[Token API] Etherscan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}

function formatBalance(balance: string, decimals: number): string {
  const bal = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const whole = bal / divisor;
  const fraction = bal % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, '0');
  // Trim trailing zeros
  const trimmed = fractionStr.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}
