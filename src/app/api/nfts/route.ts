import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://api.etherscan.io/v2/api';
const MONAD_CHAIN_ID = 143;

interface MonadscanNFT {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

interface NFTBalance {
  contractAddress: string;
  tokenId: string;
  name: string;
  symbol: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_MONADSCAN_API_KEY;

  if (!apiKey) {
    console.log('[NFT API] No API key found');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  console.log('[NFT API] Fetching NFTs for', address);

  try {
    // Fetch all NFT transfers
    const allTransfers: MonadscanNFT[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${API_BASE}?chainid=${MONAD_CHAIN_ID}&module=account&action=tokennfttx&address=${address}&page=${page}&offset=${pageSize}&sort=desc&apikey=${apiKey}`;

      console.log(`[NFT API] Fetching page ${page}...`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        console.error('[NFT API] API error:', data.message, data.result);
        hasMore = false;
      }
    }

    console.log(`[NFT API] Total transfers fetched: ${allTransfers.length}`);

    // Calculate current holdings
    const holdings = new Map<string, NFTBalance>();
    const normalizedOwner = address.toLowerCase();

    // Process transfers in chronological order (oldest first)
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
    console.log(`[NFT API] Current holdings: ${nfts.length}`);

    // Group by collection
    const grouped: Record<string, { name: string; symbol: string; nfts: NFTBalance[] }> = {};

    for (const nft of nfts) {
      const key = nft.contractAddress.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name: nft.name || 'Unknown Collection',
          symbol: nft.symbol || '???',
          nfts: [],
        };
      }
      grouped[key].nfts.push(nft);
    }

    return NextResponse.json({
      totalNFTs: nfts.length,
      collections: Object.entries(grouped).map(([address, data]) => ({
        address,
        name: data.name,
        symbol: data.symbol,
        holdings: data.nfts,
      })),
    });
  } catch (error) {
    console.error('[NFT API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
}
