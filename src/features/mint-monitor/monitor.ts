import { createPublicClient, http, webSocket, type Address, parseAbiItem, zeroAddress } from 'viem';
import { monadMainnet } from '@/lib/chain';

// ERC-721 Transfer event
const ERC721_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
);

export interface MintEvent {
  collectionAddress: string;
  tokenId: string;
  minter: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export type MintEventCallback = (event: MintEvent) => void;

/**
 * Create a mint monitor for a collection
 * Uses WebSocket for real-time updates
 */
export function createMintMonitor(
  collectionAddress: string,
  onMint: MintEventCallback
): { unsubscribe: () => void } {
  const wsUrl = process.env.NEXT_PUBLIC_MONAD_WS_URL || 'wss://rpc.monad.xyz';

  const client = createPublicClient({
    chain: monadMainnet,
    transport: webSocket(wsUrl),
  });

  const unwatch = client.watchContractEvent({
    address: collectionAddress as Address,
    abi: [ERC721_TRANSFER_EVENT],
    eventName: 'Transfer',
    args: {
      from: zeroAddress, // Only watch mints (from zero address)
    },
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.to && log.args.tokenId !== undefined) {
          onMint({
            collectionAddress,
            tokenId: log.args.tokenId.toString(),
            minter: log.args.to,
            txHash: log.transactionHash,
            blockNumber: Number(log.blockNumber),
            timestamp: Date.now(),
          });
        }
      }
    },
  });

  return {
    unsubscribe: () => {
      unwatch();
    },
  };
}

/**
 * Fetch recent mints from a collection
 */
export async function getRecentMints(
  collectionAddress: string,
  blockRange: bigint = 10000n
): Promise<MintEvent[]> {
  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(),
  });

  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - blockRange;

  const logs = await client.getLogs({
    address: collectionAddress as Address,
    event: ERC721_TRANSFER_EVENT,
    args: {
      from: zeroAddress,
    },
    fromBlock,
    toBlock: currentBlock,
  });

  return logs.map((log) => ({
    collectionAddress,
    tokenId: log.args.tokenId!.toString(),
    minter: log.args.to!,
    txHash: log.transactionHash,
    blockNumber: Number(log.blockNumber),
    timestamp: Date.now(), // We don't have actual timestamp without fetching block
  }));
}
