import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { MONAD_CHAIN_ID_HEX, ETHERSCAN_API_BASE, MORALIS_API_BASE } from '@/lib/chain/monad';
import { isValidAddress } from '@/lib/utils';

const isDev = process.env.NODE_ENV === 'development';

interface MoralisToken {
  token_address: string;
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  balance: string;
}

export async function GET(request: NextRequest) {
  const { limited, retryAfterMs } = rateLimit('tokens', getClientIp(request), { windowMs: 60_000, maxRequests: 10 });
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address || !isValidAddress(address)) {
    return NextResponse.json({ error: 'Valid Ethereum address is required' }, { status: 400 });
  }

  isDev && console.log('[Token API] Fetching tokens for', address);

  // Try Moralis first
  const moralisKey = process.env.MORALIS_API_KEY;

  if (moralisKey) {
    try {
      isDev && console.log('[Token API] Using Moralis API');

      const url = new URL(`${MORALIS_API_BASE}/${address}/erc20`);
      url.searchParams.set('chain', MONAD_CHAIN_ID_HEX);

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
      isDev && console.log(`[Token API] Moralis found ${tokens.length} tokens`);

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
    isDev && console.log('[Token API] No API keys configured');
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 });
  }

  try {
    isDev && console.log('[Token API] Using Etherscan V2 API');

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
    const maxPages = 10;
    let hasMore = true;
    let paginationInterrupted = false;

    // Fetch token transfers
    while (hasMore && page <= maxPages) {
      const url = new URL(ETHERSCAN_API_BASE);
      url.searchParams.set('chainid', '143');
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'tokentx');
      url.searchParams.set('address', address);
      url.searchParams.set('page', String(page));
      url.searchParams.set('offset', String(pageSize));
      url.searchParams.set('sort', 'desc');
      url.searchParams.set('apikey', etherscanKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(`[Token API] Etherscan HTTP error: ${response.status}`);
        if (allTransfers.length > 0) paginationInterrupted = true;
        hasMore = false;
        continue;
      }
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);
        isDev && console.log(`[Token API] Etherscan page ${page}: ${data.result.length} transfers`);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else if (page >= maxPages) {
          paginationInterrupted = true;
          isDev && console.warn(`[Token API] Etherscan pagination capped at ${maxPages} pages — data may be incomplete`);
          hasMore = false;
        } else {
          page++;
        }
      } else {
        if (allTransfers.length > 0) {
          paginationInterrupted = true;
          isDev && console.warn(`[Token API] Etherscan pagination stopped at page ${page} — data may be incomplete`);
        }
        hasMore = false;
      }
    }

    isDev && console.log(`[Token API] Etherscan total transfers: ${allTransfers.length}`);

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
          decimals: parseInt(transfer.tokenDecimal, 10) || 18,
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

    isDev && console.log(`[Token API] Found ${validTokens.length} tokens with balance`);

    return NextResponse.json({
      source: 'etherscan',
      incomplete: paginationInterrupted,
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
