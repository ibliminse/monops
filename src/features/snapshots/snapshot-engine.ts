import { createPublicClient, http, type Address, parseAbiItem, zeroAddress, isAddress } from 'viem';
import { monadMainnet, DEFAULT_SCAN_BLOCK_RANGE } from '@/lib/chain';
import { db, type TransferEvent } from '@/lib/db';
import { toCSV, downloadFile, sleep } from '@/lib/utils';
import { getPlanLimits } from '@/lib/db/plan';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

// Zero address variations to exclude
const ZERO_ADDRESSES = [
  zeroAddress,
  '0x000000000000000000000000000000000000dead',
];

export interface HolderSnapshot {
  address: string;
  count: number;
  tokenIds: string[];
}

export interface SnapshotOptions {
  excludeZeroAddress?: boolean;
  excludeContracts?: boolean;
  includeTokenIds?: boolean;
}

export interface SnapshotProgress {
  stage: 'fetching' | 'processing' | 'complete' | 'error';
  currentBlock: bigint;
  targetBlock: bigint;
  holdersFound: number;
  error?: string;
}

export type SnapshotProgressCallback = (progress: SnapshotProgress) => void;

// ERC-721 Transfer event
const ERC721_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

// ERC-1155 TransferSingle event
const ERC1155_TRANSFER_SINGLE_EVENT = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
);

/**
 * Check if an address is a contract
 */
async function isContract(address: string): Promise<boolean> {
  try {
    const code = await client.getCode({ address: address as Address });
    return code !== undefined && code !== '0x';
  } catch {
    return false;
  }
}

/**
 * Build a holder snapshot by scanning Transfer events
 */
export async function buildHolderSnapshot(
  collectionAddress: string,
  type: 'ERC721' | 'ERC1155',
  options: SnapshotOptions = {},
  onProgress?: SnapshotProgressCallback
): Promise<HolderSnapshot[]> {
  const { excludeZeroAddress = true, excludeContracts = false, includeTokenIds = true } = options;

  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - BigInt(DEFAULT_SCAN_BLOCK_RANGE);

  // First check if we have cached transfers
  const cachedTransfers = await db.transfers
    .where('collectionAddress')
    .equals(collectionAddress)
    .toArray();

  let transfers: TransferEvent[] = [];

  if (cachedTransfers.length > 0) {
    onProgress?.({
      stage: 'processing',
      currentBlock: currentBlock,
      targetBlock: currentBlock,
      holdersFound: 0,
    });
    transfers = cachedTransfers;
  } else {
    // Scan for transfers
    const blockRange = 10000n;

    for (let start = fromBlock; start <= currentBlock; start += blockRange) {
      const end = start + blockRange - 1n > currentBlock ? currentBlock : start + blockRange - 1n;

      onProgress?.({
        stage: 'fetching',
        currentBlock: start,
        targetBlock: currentBlock,
        holdersFound: 0,
      });

      try {
        if (type === 'ERC721') {
          const logs = await client.getLogs({
            address: collectionAddress as Address,
            event: ERC721_TRANSFER_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const log of logs) {
            if (log.args.from && log.args.to && log.args.tokenId !== undefined) {
              transfers.push({
                collectionAddress,
                tokenId: log.args.tokenId.toString(),
                from: log.args.from.toLowerCase(),
                to: log.args.to.toLowerCase(),
                amount: 1,
                blockNumber: Number(log.blockNumber),
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
              });
            }
          }
        } else {
          const logs = await client.getLogs({
            address: collectionAddress as Address,
            event: ERC1155_TRANSFER_SINGLE_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const log of logs) {
            if (log.args.from && log.args.to && log.args.id !== undefined) {
              transfers.push({
                collectionAddress,
                tokenId: log.args.id.toString(),
                from: log.args.from.toLowerCase(),
                to: log.args.to.toLowerCase(),
                amount: Number(log.args.value ?? 1),
                blockNumber: Number(log.blockNumber),
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
              });
            }
          }
        }

        await sleep(50);
      } catch (error) {
        console.error(`Error fetching logs for blocks ${start}-${end}:`, error);
      }
    }
  }

  // Process transfers to compute current ownership
  const holdingsMap = new Map<string, Map<string, number>>(); // address -> tokenId -> amount

  // Sort by block and log index
  const sortedTransfers = [...transfers].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.logIndex - b.logIndex;
  });

  for (const transfer of sortedTransfers) {
    const { from, to, tokenId, amount } = transfer;

    // Decrease from sender
    if (holdingsMap.has(from)) {
      const tokens = holdingsMap.get(from)!;
      const current = tokens.get(tokenId) || 0;
      const newAmount = current - amount;
      if (newAmount <= 0) {
        tokens.delete(tokenId);
        if (tokens.size === 0) {
          holdingsMap.delete(from);
        }
      } else {
        tokens.set(tokenId, newAmount);
      }
    }

    // Increase to receiver
    if (!holdingsMap.has(to)) {
      holdingsMap.set(to, new Map());
    }
    const tokens = holdingsMap.get(to)!;
    const current = tokens.get(tokenId) || 0;
    tokens.set(tokenId, current + amount);
  }

  // Convert to snapshot format
  let holders: HolderSnapshot[] = [];

  for (const [address, tokens] of holdingsMap) {
    // Skip zero addresses if requested
    if (excludeZeroAddress && ZERO_ADDRESSES.includes(address.toLowerCase())) {
      continue;
    }

    const tokenIds = Array.from(tokens.keys());
    const count = type === 'ERC721' ? tokenIds.length : Array.from(tokens.values()).reduce((a, b) => a + b, 0);

    holders.push({
      address,
      count,
      tokenIds: includeTokenIds ? tokenIds : [],
    });
  }

  // Filter out contracts if requested
  if (excludeContracts) {
    const filteredHolders: HolderSnapshot[] = [];
    for (const holder of holders) {
      const contract = await isContract(holder.address);
      if (!contract) {
        filteredHolders.push(holder);
      }
    }
    holders = filteredHolders;
  }

  // Sort by count descending
  holders.sort((a, b) => b.count - a.count);

  onProgress?.({
    stage: 'complete',
    currentBlock: currentBlock,
    targetBlock: currentBlock,
    holdersFound: holders.length,
  });

  return holders;
}

/**
 * Export snapshot to CSV
 */
export function exportSnapshotCSV(
  snapshot: HolderSnapshot[],
  collectionName: string,
  includeTokenIds: boolean = false
): void {
  const limits = getPlanLimits();
  const limitedSnapshot = snapshot.slice(0, limits.maxExportRows);

  const headers = includeTokenIds
    ? ['Address', 'Count', 'Token IDs']
    : ['Address', 'Count'];

  const rows = limitedSnapshot.map((holder) =>
    includeTokenIds
      ? [holder.address, holder.count.toString(), holder.tokenIds.join(';')]
      : [holder.address, holder.count.toString()]
  );

  const csv = toCSV(headers, rows);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `${collectionName}-holders-${timestamp}.csv`);
}

/**
 * Get mint events (transfers from zero address)
 */
export async function getMintEvents(
  collectionAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<TransferEvent[]> {
  const logs = await client.getLogs({
    address: collectionAddress as Address,
    event: ERC721_TRANSFER_EVENT,
    fromBlock,
    toBlock,
    args: {
      from: zeroAddress,
    },
  });

  return logs.map((log) => ({
    collectionAddress,
    tokenId: log.args.tokenId!.toString(),
    from: zeroAddress,
    to: log.args.to!.toLowerCase(),
    amount: 1,
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
  }));
}
