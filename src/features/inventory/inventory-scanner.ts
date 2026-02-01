import { createPublicClient, http, type Address, parseAbiItem, getAddress, zeroAddress } from 'viem';
import { monadMainnet, DEFAULT_SCAN_BLOCK_RANGE, MAX_LOGS_PER_REQUEST } from '@/lib/chain';
import { db, type NFTHolding, type TransferEvent, type WatchedCollection } from '@/lib/db';
import { sleep, chunk } from '@/lib/utils';
import { updateCollectionSyncState } from './collection-store';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

// ERC-721 Transfer event signature
const ERC721_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

// ERC-1155 TransferSingle event signature
const ERC1155_TRANSFER_SINGLE_EVENT = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
);

// ERC-1155 TransferBatch event signature
const ERC1155_TRANSFER_BATCH_EVENT = parseAbiItem(
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
);

export interface SyncProgress {
  stage: 'fetching' | 'processing' | 'saving' | 'complete' | 'error';
  currentBlock: bigint;
  targetBlock: bigint;
  transfersFound: number;
  holdingsUpdated: number;
  failedRanges?: { from: bigint; to: bigint }[];
  error?: string;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Scan Transfer events for an ERC-721 collection
 */
interface ScanResult {
  transfers: TransferEvent[];
  failedRanges: { from: bigint; to: bigint }[];
}

async function scanERC721Transfers(
  collectionAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
  onProgress?: SyncProgressCallback
): Promise<ScanResult> {
  const transfers: TransferEvent[] = [];
  const failedRanges: { from: bigint; to: bigint }[] = [];
  const blockRange = 10000n; // Scan 10k blocks at a time

  for (let start = fromBlock; start <= toBlock; start += blockRange) {
    const end = start + blockRange - 1n > toBlock ? toBlock : start + blockRange - 1n;

    onProgress?.({
      stage: 'fetching',
      currentBlock: start,
      targetBlock: toBlock,
      transfersFound: transfers.length,
      holdingsUpdated: 0,
    });

    try {
      const logs = await client.getLogs({
        address: collectionAddress,
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

      // Rate limiting - wait 50ms between requests
      await sleep(50);
    } catch (error) {
      console.error(`Error fetching logs for blocks ${start}-${end}:`, error);
      failedRanges.push({ from: start, to: end });
    }
  }

  return { transfers, failedRanges };
}

/**
 * Scan Transfer events for an ERC-1155 collection
 */
async function scanERC1155Transfers(
  collectionAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
  onProgress?: SyncProgressCallback
): Promise<ScanResult> {
  const transfers: TransferEvent[] = [];
  const failedRanges: { from: bigint; to: bigint }[] = [];
  const blockRange = 10000n;

  for (let start = fromBlock; start <= toBlock; start += blockRange) {
    const end = start + blockRange - 1n > toBlock ? toBlock : start + blockRange - 1n;

    onProgress?.({
      stage: 'fetching',
      currentBlock: start,
      targetBlock: toBlock,
      transfersFound: transfers.length,
      holdingsUpdated: 0,
    });

    try {
      // Fetch TransferSingle events
      const singleLogs = await client.getLogs({
        address: collectionAddress,
        event: ERC1155_TRANSFER_SINGLE_EVENT,
        fromBlock: start,
        toBlock: end,
      });

      for (const log of singleLogs) {
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

      // Fetch TransferBatch events
      const batchLogs = await client.getLogs({
        address: collectionAddress,
        event: ERC1155_TRANSFER_BATCH_EVENT,
        fromBlock: start,
        toBlock: end,
      });

      for (const log of batchLogs) {
        if (log.args.from && log.args.to && log.args.ids && log.args.values) {
          for (let i = 0; i < log.args.ids.length; i++) {
            transfers.push({
              collectionAddress,
              tokenId: log.args.ids[i].toString(),
              from: log.args.from.toLowerCase(),
              to: log.args.to.toLowerCase(),
              amount: Number(log.args.values[i]),
              blockNumber: Number(log.blockNumber),
              transactionHash: log.transactionHash,
              logIndex: log.logIndex * 1000 + i, // Unique index for batch items
            });
          }
        }
      }

      await sleep(50);
    } catch (error) {
      console.error(`Error fetching logs for blocks ${start}-${end}:`, error);
      failedRanges.push({ from: start, to: end });
    }
  }

  return { transfers, failedRanges };
}

/**
 * Compute current holdings from transfer history
 */
function computeHoldings(
  transfers: TransferEvent[],
  collectionAddress: string,
  ownerAddress: string
): Map<string, { amount: number; lastBlock: number }> {
  const holdings = new Map<string, { amount: number; lastBlock: number }>();
  const normalizedOwner = ownerAddress.toLowerCase();

  // Sort transfers by block number and log index
  const sortedTransfers = [...transfers].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.logIndex - b.logIndex;
  });

  for (const transfer of sortedTransfers) {
    const tokenId = transfer.tokenId;

    // If owner received tokens
    if (transfer.to === normalizedOwner) {
      const current = holdings.get(tokenId) || { amount: 0, lastBlock: 0 };
      holdings.set(tokenId, {
        amount: current.amount + transfer.amount,
        lastBlock: transfer.blockNumber,
      });
    }

    // If owner sent tokens
    if (transfer.from === normalizedOwner) {
      const current = holdings.get(tokenId) || { amount: 0, lastBlock: 0 };
      const newAmount = current.amount - transfer.amount;
      if (newAmount <= 0) {
        holdings.delete(tokenId);
      } else {
        holdings.set(tokenId, {
          amount: newAmount,
          lastBlock: transfer.blockNumber,
        });
      }
    }
  }

  return holdings;
}

/**
 * Sync inventory for a watched collection
 */
export async function syncCollection(
  collection: WatchedCollection,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; holdingsCount: number }> {
  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = collection.lastSyncBlock
      ? BigInt(collection.lastSyncBlock) + 1n
      : currentBlock - BigInt(DEFAULT_SCAN_BLOCK_RANGE);

    onProgress?.({
      stage: 'fetching',
      currentBlock: fromBlock,
      targetBlock: currentBlock,
      transfersFound: 0,
      holdingsUpdated: 0,
    });

    // Scan transfers based on collection type
    const scanResult = collection.type === 'ERC721'
      ? await scanERC721Transfers(
          collection.address as Address,
          fromBlock,
          currentBlock,
          onProgress
        )
      : await scanERC1155Transfers(
          collection.address as Address,
          fromBlock,
          currentBlock,
          onProgress
        );

    const { transfers, failedRanges } = scanResult;

    if (failedRanges.length > 0) {
      console.warn(`[Inventory] ${failedRanges.length} block range(s) failed during sync — inventory may be incomplete`);
    }

    onProgress?.({
      stage: 'processing',
      currentBlock: currentBlock,
      targetBlock: currentBlock,
      transfersFound: transfers.length,
      holdingsUpdated: 0,
    });

    // Get existing transfers for full history computation
    const existingTransfers = await db.transfers
      .where('collectionAddress')
      .equals(collection.address)
      .toArray();

    const allTransfers = [...existingTransfers, ...transfers];

    // Compute current holdings
    const holdingsMap = computeHoldings(allTransfers, collection.address, collection.walletAddress);

    onProgress?.({
      stage: 'saving',
      currentBlock: currentBlock,
      targetBlock: currentBlock,
      transfersFound: transfers.length,
      holdingsUpdated: holdingsMap.size,
    });

    // Save new transfers
    if (transfers.length > 0) {
      await db.transfers.bulkAdd(transfers);
    }

    // Update holdings (replace all for this collection/wallet)
    await db.holdings
      .where('[collectionAddress+ownerAddress]')
      .equals([collection.address, collection.walletAddress])
      .delete();

    const holdingsToAdd: Omit<NFTHolding, 'id'>[] = [];
    for (const [tokenId, data] of holdingsMap) {
      holdingsToAdd.push({
        collectionAddress: collection.address,
        tokenId,
        ownerAddress: collection.walletAddress,
        amount: data.amount,
        lastUpdatedBlock: data.lastBlock,
        lastUpdatedAt: Date.now(),
      });
    }

    if (holdingsToAdd.length > 0) {
      await db.holdings.bulkAdd(holdingsToAdd);
    }

    // Update sync state
    await updateCollectionSyncState(collection.id!, Number(currentBlock));

    onProgress?.({
      stage: 'complete',
      currentBlock: currentBlock,
      targetBlock: currentBlock,
      transfersFound: transfers.length,
      holdingsUpdated: holdingsMap.size,
      failedRanges: failedRanges.length > 0 ? failedRanges : undefined,
    });

    return { success: true, holdingsCount: holdingsMap.size };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({
      stage: 'error',
      currentBlock: 0n,
      targetBlock: 0n,
      transfersFound: 0,
      holdingsUpdated: 0,
      error: errorMessage,
    });
    return { success: false, error: errorMessage, holdingsCount: 0 };
  }
}

/**
 * Get holdings for a collection/wallet pair
 */
export async function getHoldings(
  collectionAddress: string,
  ownerAddress: string
): Promise<NFTHolding[]> {
  return db.holdings
    .where('[collectionAddress+ownerAddress]')
    .equals([collectionAddress, ownerAddress.toLowerCase()])
    .toArray();
}

/**
 * Get all holdings for a wallet across all collections
 */
export async function getAllHoldingsForWallet(walletAddress: string): Promise<NFTHolding[]> {
  return db.holdings.where('ownerAddress').equals(walletAddress.toLowerCase()).toArray();
}
