import { NextRequest, NextResponse } from 'next/server';

const MONAD_CHAIN_ID = '0x8f'; // 143 in hex

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

// Etherscan V2 fallback
const ETHERSCAN_API_BASE = 'https://api.etherscan.io/v2/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  console.log('[NFT API] Fetching NFTs for', address);

  // Try Moralis first (complete data)
  const moralisKey = process.env.MORALIS_API_KEY;

  if (moralisKey) {
    try {
      console.log('[NFT API] Using Moralis API');
      const allNFTs: MoralisNFT[] = [];
      let cursor: string | undefined;

      do {
        const url = new URL('https://deep-index.moralis.io/api/v2.2/' + address + '/nft');
        url.searchParams.set('chain', MONAD_CHAIN_ID);
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

        console.log(`[NFT API] Moralis fetched ${allNFTs.length} NFTs so far...`);
      } while (cursor);

      console.log(`[NFT API] Moralis total: ${allNFTs.length} NFTs`);

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
      // Fall through to Etherscan
    }
  }

  // Fallback to Etherscan V2
  const etherscanKey = process.env.NEXT_PUBLIC_MONADSCAN_API_KEY;

  if (!etherscanKey) {
    console.log('[NFT API] No API keys configured');
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 });
  }

  try {
    console.log('[NFT API] Using Etherscan V2 API');

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
    let hasMore = true;

    while (hasMore) {
      const url = `${ETHERSCAN_API_BASE}?chainid=143&module=account&action=tokennfttx&address=${address}&page=${page}&offset=${pageSize}&sort=desc&apikey=${etherscanKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);
        console.log(`[NFT API] Etherscan page ${page}: ${data.result.length} transfers`);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[NFT API] Etherscan total transfers: ${allTransfers.length}`);

    // Calculate current holdings
    const holdings = new Map<string, { contractAddress: string; tokenId: string; name: string; symbol: string }>();
    const normalizedOwner = address.toLowerCase();

    const sortedTransfers = [...allTransfers].sort(
      (a, b) => parseInt(a.blockNumber) - parseInt(b.blockNumber)
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
    console.log(`[NFT API] Etherscan current holdings: ${nfts.length}`);

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
