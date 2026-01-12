import { getPublicClient } from '@/lib/chain/client';
import { type Address, parseAbiItem } from 'viem';

export interface NFTHolding {
  contractAddress: Address;
  tokenId: bigint;
  tokenType: 'ERC721' | 'ERC1155';
  balance: bigint; // Always 1 for ERC721, can be >1 for ERC1155
  name?: string;
  symbol?: string;
}

export interface NFTCollection {
  address: Address;
  name: string;
  symbol: string;
  tokenType: 'ERC721' | 'ERC1155';
  holdings: NFTHolding[];
}

// Event signatures
const ERC721_TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

const ERC1155_TRANSFER_SINGLE = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
);

const ERC1155_TRANSFER_BATCH = parseAbiItem(
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
);

// Scan depth - increased to catch older NFTs
const SCAN_DEPTH = 500_000n;

// Minimal ABIs for metadata
const ERC721_METADATA_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tokenId', type: 'uint256' }], name: 'ownerOf', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

const ERC1155_ABI = [
  { inputs: [{ name: 'account', type: 'address' }, { name: 'id', type: 'uint256' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

/**
 * Scan for all NFTs owned by a wallet
 */
export async function scanWalletNFTs(
  walletAddress: Address,
  onProgress?: (message: string) => void
): Promise<NFTCollection[]> {
  const client = getPublicClient();
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock > SCAN_DEPTH ? currentBlock - SCAN_DEPTH : 0n;

  console.log(`[NFT Scanner] Scanning blocks ${fromBlock} to ${currentBlock} for wallet ${walletAddress}`);
  onProgress?.(`Scanning ${Number(currentBlock - fromBlock).toLocaleString()} blocks for NFTs...`);

  // Scan in chunks to avoid RPC limits
  const CHUNK_SIZE = 50_000n;
  let erc721Logs: Awaited<ReturnType<typeof client.getLogs>>  = [];
  let erc1155SingleLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  let erc1155BatchLogs: Awaited<ReturnType<typeof client.getLogs>> = [];

  try {
    for (let start = fromBlock; start < currentBlock; start += CHUNK_SIZE) {
      const end = start + CHUNK_SIZE > currentBlock ? currentBlock : start + CHUNK_SIZE;
      const progress = Number((start - fromBlock) * 100n / (currentBlock - fromBlock));
      onProgress?.(`Scanning blocks... ${progress}%`);

      console.log(`[NFT Scanner] Scanning chunk ${start} to ${end}`);

      const [chunk721, chunk1155Single, chunk1155Batch] = await Promise.all([
        client.getLogs({
          event: ERC721_TRANSFER,
          args: { to: walletAddress },
          fromBlock: start,
          toBlock: end,
        }).catch(err => {
          console.error('[NFT Scanner] ERC721 getLogs error:', err.message);
          return [];
        }),
        client.getLogs({
          event: ERC1155_TRANSFER_SINGLE,
          args: { to: walletAddress },
          fromBlock: start,
          toBlock: end,
        }).catch(err => {
          console.error('[NFT Scanner] ERC1155 Single getLogs error:', err.message);
          return [];
        }),
        client.getLogs({
          event: ERC1155_TRANSFER_BATCH,
          args: { to: walletAddress },
          fromBlock: start,
          toBlock: end,
        }).catch(err => {
          console.error('[NFT Scanner] ERC1155 Batch getLogs error:', err.message);
          return [];
        }),
      ]);

      erc721Logs = [...erc721Logs, ...chunk721];
      erc1155SingleLogs = [...erc1155SingleLogs, ...chunk1155Single];
      erc1155BatchLogs = [...erc1155BatchLogs, ...chunk1155Batch];
    }
  } catch (error) {
    console.error('[NFT Scanner] Scan error:', error);
  }

  console.log(`[NFT Scanner] Found ${erc721Logs.length} ERC-721 transfers, ${erc1155SingleLogs.length} ERC-1155 single, ${erc1155BatchLogs.length} ERC-1155 batch`);
  onProgress?.(`Found ${erc721Logs.length} ERC-721 and ${erc1155SingleLogs.length + erc1155BatchLogs.length} ERC-1155 transfer events`);

  // Track potential NFTs by contract
  const potentialNFTs = new Map<Address, Map<string, { tokenId: bigint; type: 'ERC721' | 'ERC1155' }>>();

  // Process ERC-721 transfers
  for (const log of erc721Logs) {
    const contract = log.address as Address;
    const tokenId = log.args.tokenId as bigint;

    if (!potentialNFTs.has(contract)) {
      potentialNFTs.set(contract, new Map());
    }
    potentialNFTs.get(contract)!.set(tokenId.toString(), { tokenId, type: 'ERC721' });
  }

  // Process ERC-1155 single transfers
  for (const log of erc1155SingleLogs) {
    const contract = log.address as Address;
    const tokenId = log.args.id as bigint;

    if (!potentialNFTs.has(contract)) {
      potentialNFTs.set(contract, new Map());
    }
    potentialNFTs.get(contract)!.set(tokenId.toString(), { tokenId, type: 'ERC1155' });
  }

  // Process ERC-1155 batch transfers
  for (const log of erc1155BatchLogs) {
    const contract = log.address as Address;
    const ids = log.args.ids as bigint[];

    if (!potentialNFTs.has(contract)) {
      potentialNFTs.set(contract, new Map());
    }
    for (const tokenId of ids) {
      potentialNFTs.get(contract)!.set(tokenId.toString(), { tokenId, type: 'ERC1155' });
    }
  }

  onProgress?.(`Checking ownership for ${potentialNFTs.size} collections...`);

  // Verify current ownership and build collection data
  const collections: NFTCollection[] = [];

  for (const [contractAddress, tokens] of potentialNFTs) {
    const holdings: NFTHolding[] = [];
    let collectionName = 'Unknown';
    let collectionSymbol = '???';
    let tokenType: 'ERC721' | 'ERC1155' = 'ERC721';

    // Try to get collection metadata
    try {
      const [name, symbol] = await Promise.all([
        client.readContract({
          address: contractAddress,
          abi: ERC721_METADATA_ABI,
          functionName: 'name',
        }),
        client.readContract({
          address: contractAddress,
          abi: ERC721_METADATA_ABI,
          functionName: 'symbol',
        }),
      ]);
      collectionName = name as string;
      collectionSymbol = symbol as string;
    } catch {
      // Metadata not available
    }

    // Check ownership for each token
    for (const [, { tokenId, type }] of tokens) {
      tokenType = type;

      try {
        if (type === 'ERC721') {
          const owner = await client.readContract({
            address: contractAddress,
            abi: ERC721_METADATA_ABI,
            functionName: 'ownerOf',
            args: [tokenId],
          });

          if ((owner as Address).toLowerCase() === walletAddress.toLowerCase()) {
            holdings.push({
              contractAddress,
              tokenId,
              tokenType: 'ERC721',
              balance: 1n,
              name: collectionName,
              symbol: collectionSymbol,
            });
          }
        } else {
          const balance = await client.readContract({
            address: contractAddress,
            abi: ERC1155_ABI,
            functionName: 'balanceOf',
            args: [walletAddress, tokenId],
          });

          if ((balance as bigint) > 0n) {
            holdings.push({
              contractAddress,
              tokenId,
              tokenType: 'ERC1155',
              balance: balance as bigint,
              name: collectionName,
              symbol: collectionSymbol,
            });
          }
        }
      } catch {
        // Token may have been burned or contract is non-standard
      }
    }

    if (holdings.length > 0) {
      collections.push({
        address: contractAddress,
        name: collectionName,
        symbol: collectionSymbol,
        tokenType,
        holdings,
      });
    }
  }

  onProgress?.(`Found ${collections.length} collections with ${collections.reduce((acc, c) => acc + c.holdings.length, 0)} NFTs`);

  return collections;
}
