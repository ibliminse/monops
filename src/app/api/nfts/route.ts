import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { MONAD_CHAIN_ID_HEX, ETHERSCAN_API_BASE, MORALIS_API_BASE } from '@/lib/chain/monad';
import { isValidAddress } from '@/lib/utils';

const isDev = process.env.NODE_ENV === 'development';

interface MoralisNFT {
  token_address: string;
  token_id: string;
  amount: string;
  owner_of: string;
  token_hash: string;
  contract_type: string;
  name: string;
  symbol: string;
  token_uri?: string;
  metadata?: string;
  normalized_metadata?: {
    name?: string;
    description?: string;
    image?: string;
  };
}

interface MoralisResponse {
  status: string;
  page: number;
  page_size: number;
  cursor?: string;
  result: MoralisNFT[];
}


export async function GET(request: NextRequest) {
  const { limited, retryAfterMs } = rateLimit('nfts', getClientIp(request), { windowMs: 60_000, maxRequests: 10 });
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

  isDev && console.log('[NFT API] Fetching NFTs for', address);

  // Try Moralis first (complete data)
  const moralisKey = process.env.MORALIS_API_KEY;

  let usedFallback = false;

  if (moralisKey) {
    try {
      isDev && console.log('[NFT API] Using Moralis API');
      const allNFTs: MoralisNFT[] = [];
      let cursor: string | undefined;

      do {
        const url = new URL(MORALIS_API_BASE + '/' + address + '/nft');
        url.searchParams.set('chain', MONAD_CHAIN_ID_HEX);
        url.searchParams.set('format', 'decimal');
        url.searchParams.set('normalizeMetadata', 'true');
        if (cursor) url.searchParams.set('cursor', cursor);

        const response = await fetch(url.toString(), {
          headers: {
            'X-API-Key': moralisKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Moralis API error: ${response.status}`);
        }

        const data: MoralisResponse = await response.json();
        allNFTs.push(...data.result);
        cursor = data.cursor;

        isDev && console.log(`[NFT API] Moralis fetched ${allNFTs.length} NFTs so far...`);
      } while (cursor);

      isDev && console.log(`[NFT API] Moralis total: ${allNFTs.length} NFTs`);

      // Helper to convert IPFS URLs to gateway URLs
      const toGatewayUrl = (url?: string | null): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith('ipfs://')) {
          return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }
        return url;
      };

      // Group by collection
      const grouped: Record<string, { name: string; symbol: string; logo?: string; nfts: Array<{ tokenId: string; name?: string; image?: string }> }> = {};

      for (const nft of allNFTs) {
        const key = nft.token_address.toLowerCase();
        if (!grouped[key]) {
          grouped[key] = {
            name: nft.name || 'Unknown Collection',
            symbol: nft.symbol || '???',
            logo: (nft as unknown as { collection_logo?: string }).collection_logo,
            nfts: [],
          };
        }
        grouped[key].nfts.push({
          tokenId: nft.token_id,
          name: nft.normalized_metadata?.name,
          image: toGatewayUrl(nft.normalized_metadata?.image) || (nft as unknown as { collection_logo?: string }).collection_logo,
        });
      }

      return NextResponse.json({
        totalNFTs: allNFTs.length,
        source: 'moralis',
        collections: Object.entries(grouped).map(([address, data]) => ({
          address,
          name: data.name,
          symbol: data.symbol,
          holdings: data.nfts,
        })),
      });
    } catch (error) {
      console.error('[NFT API] Moralis failed:', error);
      usedFallback = true;
      // Fall through to Etherscan
    }
  }

  // Fallback to Etherscan V2
  const etherscanKey = process.env.NEXT_PUBLIC_MONADSCAN_API_KEY;

  if (!etherscanKey) {
    isDev && console.log('[NFT API] No API keys configured');
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 });
  }

  try {
    isDev && console.log('[NFT API] Using Etherscan V2 API');

    interface EtherscanNFT {
      blockNumber: string;
      from: string;
      contractAddress: string;
      to: string;
      tokenID: string;
      tokenName: string;
      tokenSymbol: string;
    }

    const allTransfers: EtherscanNFT[] = [];
    let page = 1;
    const pageSize = 100;
    const maxPages = 10;
    let hasMore = true;
    let paginationInterrupted = false;

    while (hasMore && page <= maxPages) {
      const url = new URL(ETHERSCAN_API_BASE);
      url.searchParams.set('chainid', '143');
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'tokennfttx');
      url.searchParams.set('address', address);
      url.searchParams.set('page', String(page));
      url.searchParams.set('offset', String(pageSize));
      url.searchParams.set('sort', 'desc');
      url.searchParams.set('apikey', etherscanKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(`[NFT API] Etherscan HTTP error: ${response.status}`);
        if (allTransfers.length > 0) paginationInterrupted = true;
        hasMore = false;
        continue;
      }
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);
        isDev && console.log(`[NFT API] Etherscan page ${page}: ${data.result.length} transfers`);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else if (page >= maxPages) {
          paginationInterrupted = true;
          isDev && console.warn(`[NFT API] Etherscan pagination capped at ${maxPages} pages — data may be incomplete`);
          hasMore = false;
        } else {
          page++;
        }
      } else {
        // Pagination stopped before completion — data may be partial
        if (allTransfers.length > 0) {
          paginationInterrupted = true;
          isDev && console.warn(`[NFT API] Etherscan pagination stopped at page ${page} — data may be incomplete`);
        }
        hasMore = false;
      }
    }

    isDev && console.log(`[NFT API] Etherscan total transfers: ${allTransfers.length}`);

    // Calculate current holdings
    const holdings = new Map<string, { contractAddress: string; tokenId: string; name: string; symbol: string }>();
    const normalizedOwner = address.toLowerCase();

    const sortedTransfers = [...allTransfers].sort(
      (a, b) => (parseInt(a.blockNumber, 10) || 0) - (parseInt(b.blockNumber, 10) || 0)
    );

    for (const transfer of sortedTransfers) {
      const key = `${transfer.contractAddress.toLowerCase()}-${transfer.tokenID}`;
      const isReceiving = transfer.to.toLowerCase() === normalizedOwner;
      const isSending = transfer.from.toLowerCase() === normalizedOwner;

      if (isReceiving) {
        holdings.set(key, {
          contractAddress: transfer.contractAddress,
          tokenId: transfer.tokenID,
          name: transfer.tokenName,
          symbol: transfer.tokenSymbol,
        });
      } else if (isSending) {
        holdings.delete(key);
      }
    }

    const nfts = Array.from(holdings.values());
    isDev && console.log(`[NFT API] Etherscan current holdings: ${nfts.length}`);

    // Group by collection
    const grouped: Record<string, { name: string; symbol: string; nfts: Array<{ tokenId: string }> }> = {};

    for (const nft of nfts) {
      const key = nft.contractAddress.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name: nft.name || 'Unknown Collection',
          symbol: nft.symbol || '???',
          nfts: [],
        };
      }
      grouped[key].nfts.push({ tokenId: nft.tokenId });
    }

    return NextResponse.json({
      totalNFTs: nfts.length,
      source: 'etherscan',
      usedFallback,
      incomplete: paginationInterrupted,
      collections: Object.entries(grouped).map(([address, data]) => ({
        address,
        name: data.name,
        symbol: data.symbol,
        holdings: data.nfts,
      })),
    });
  } catch (error) {
    console.error('[NFT API] Etherscan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
}
