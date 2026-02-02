import { NextRequest, NextResponse } from 'next/server';
import { type Address, parseAbi } from 'viem';
import { createServerClient } from '@/lib/chain/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { isValidAddress } from '@/lib/utils';

const isDev = process.env.NODE_ENV === 'development';
const client = createServerClient();

// ERC-721 ABI for reading owner data
const ERC721_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
]);

// Zero addresses to exclude
const ZERO_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const { limited, retryAfterMs } = rateLimit('snapshot', getClientIp(request), { windowMs: 60_000, maxRequests: 3 });
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const collectionAddress = searchParams.get('collection');

  if (!collectionAddress || !isValidAddress(collectionAddress)) {
    return NextResponse.json({ error: 'Valid collection address is required' }, { status: 400 });
  }

  isDev && console.log('[Snapshot API] Building snapshot for', collectionAddress);

  try {
    // First, get totalSupply to know how many tokens exist
    let totalSupply: number;
    let collectionName = 'Unknown';

    try {
      const [supply, name] = await Promise.all([
        client.readContract({
          address: collectionAddress as Address,
          abi: ERC721_ABI,
          functionName: 'totalSupply',
        }),
        client.readContract({
          address: collectionAddress as Address,
          abi: ERC721_ABI,
          functionName: 'name',
        }).catch(() => 'Unknown'),
      ]);
      totalSupply = Number(supply);
      collectionName = name as string;
      isDev && console.log(`[Snapshot API] Collection: ${collectionName}, Total Supply: ${totalSupply}`);
    } catch (error) {
      console.error('[Snapshot API] Failed to get totalSupply:', error);
      return NextResponse.json(
        { error: 'Failed to read collection data. Is this a valid ERC-721 contract?' },
        { status: 400 }
      );
    }

    if (totalSupply === 0) {
      return NextResponse.json({
        collection: collectionAddress,
        name: collectionName,
        totalHolders: 0,
        totalSupply: 0,
        holders: [],
      });
    }

    // Query ownerOf for each token
    // Use batching to avoid overwhelming the RPC
    const holdingsMap = new Map<string, string[]>(); // address -> tokenIds
    const batchSize = 50; // Query 50 tokens at a time
    const maxTokens = Math.min(totalSupply, 10000); // Cap at 10k tokens for performance
    let processedTokens = 0;
    let failedTokens = 0;

    isDev && console.log(`[Snapshot API] Querying owners for ${maxTokens} tokens...`);

    for (let startId = 1; startId <= maxTokens; startId += batchSize) {
      const endId = Math.min(startId + batchSize - 1, maxTokens);
      const tokenIds = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

      // Batch query owners
      const ownerPromises = tokenIds.map(async (tokenId) => {
        try {
          const owner = await client.readContract({
            address: collectionAddress as Address,
            abi: ERC721_ABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          });
          return { tokenId: tokenId.toString(), owner: (owner as string).toLowerCase(), failed: false as const };
        } catch {
          // Could be burned/non-existent token OR an RPC error — caller must check failedTokens
          return { tokenId: tokenId.toString(), owner: null, failed: true as const };
        }
      });

      const results = await Promise.all(ownerPromises);

      for (const result of results) {
        if (result.failed) {
          failedTokens++;
          continue;
        }
        if (result.owner && !ZERO_ADDRESSES.includes(result.owner)) {
          if (!holdingsMap.has(result.owner)) {
            holdingsMap.set(result.owner, []);
          }
          holdingsMap.get(result.owner)!.push(result.tokenId);
        }
      }

      processedTokens = endId;

      // Progress logging every 500 tokens
      if (processedTokens % 500 === 0 || processedTokens === maxTokens) {
        const progress = Math.round((processedTokens / maxTokens) * 100);
        isDev && console.log(`[Snapshot API] Progress: ${progress}% (${processedTokens}/${maxTokens} tokens)`);
      }

      // Rate limit
      await sleep(100);
    }

    // Convert to output format
    const holders = Array.from(holdingsMap.entries())
      .map(([address, tokenIds]) => ({
        address,
        count: tokenIds.length,
        tokenIds,
      }))
      .sort((a, b) => b.count - a.count);

    isDev && console.log(`[Snapshot API] Complete: ${holders.length} unique holders, ${failedTokens} failed queries`);

    return NextResponse.json({
      collection: collectionAddress,
      name: collectionName,
      totalHolders: holders.length,
      totalSupply,
      scannedTokens: maxTokens,
      failedTokens,
      incomplete: failedTokens > 0,
      holders,
    });
  } catch (error) {
    console.error('[Snapshot API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build snapshot' },
      { status: 500 }
    );
  }
}
