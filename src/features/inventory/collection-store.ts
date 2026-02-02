import { db, type WatchedCollection } from '@/lib/db';
import { isValidAddress } from '@/lib/utils';
import { getPlanLimits } from '@/lib/db/plan';
import { getAddress } from 'viem';
import { getPublicClient } from '@/lib/chain';
import { ERC721_ABI, ERC1155_ABI, INTERFACE_IDS } from '@/lib/chain/abis';

export interface AddCollectionInput {
  address: string;
  walletAddress: string;
  name?: string;
}

export interface CollectionStoreError {
  code: 'INVALID_ADDRESS' | 'DUPLICATE' | 'LIMIT_REACHED' | 'NOT_NFT';
  message: string;
}

const client = getPublicClient();

/**
 * Detect if a contract is ERC-721 or ERC-1155
 */
export async function detectNFTType(
  address: `0x${string}`
): Promise<'ERC721' | 'ERC1155' | null> {
  try {
    // Check ERC-721
    const isERC721 = await client.readContract({
      address,
      abi: ERC721_ABI,
      functionName: 'supportsInterface',
      args: [INTERFACE_IDS.ERC721 as `0x${string}`],
    });
    if (isERC721) return 'ERC721';

    // Check ERC-1155
    const isERC1155 = await client.readContract({
      address,
      abi: ERC1155_ABI,
      functionName: 'supportsInterface',
      args: [INTERFACE_IDS.ERC1155 as `0x${string}`],
    });
    if (isERC1155) return 'ERC1155';

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch collection metadata (name, symbol)
 */
export async function fetchCollectionMetadata(
  address: `0x${string}`,
  type: 'ERC721' | 'ERC1155'
): Promise<{ name: string; symbol?: string }> {
  try {
    if (type === 'ERC721') {
      const [name, symbol] = await Promise.all([
        client.readContract({
          address,
          abi: ERC721_ABI,
          functionName: 'name',
        }),
        client.readContract({
          address,
          abi: ERC721_ABI,
          functionName: 'symbol',
        }),
      ]);
      return { name, symbol };
    }
    // ERC-1155 doesn't have standard name/symbol
    return { name: `Collection ${address.slice(0, 8)}...` };
  } catch {
    return { name: `Collection ${address.slice(0, 8)}...` };
  }
}

export async function addCollection(
  input: AddCollectionInput
): Promise<WatchedCollection | CollectionStoreError> {
  const { address, walletAddress, name } = input;

  // Validate addresses
  if (!isValidAddress(address)) {
    return { code: 'INVALID_ADDRESS', message: 'Invalid collection address' };
  }
  if (!isValidAddress(walletAddress)) {
    return { code: 'INVALID_ADDRESS', message: 'Invalid wallet address' };
  }

  const normalizedAddress = getAddress(address);
  const normalizedWallet = walletAddress.toLowerCase();

  // Check for duplicates
  const existing = await db.collections
    .where('[walletAddress+address]')
    .equals([normalizedWallet, normalizedAddress])
    .first();
  if (existing) {
    return { code: 'DUPLICATE', message: 'Collection already watched for this wallet' };
  }

  // Check plan limits
  const limits = getPlanLimits();
  const count = await db.collections.where('walletAddress').equals(normalizedWallet).count();
  if (count >= limits.maxWatchedCollections) {
    return {
      code: 'LIMIT_REACHED',
      message: `Maximum ${limits.maxWatchedCollections} collections per wallet on your plan`,
    };
  }

  // Detect NFT type
  const type = await detectNFTType(normalizedAddress);
  if (!type) {
    return { code: 'NOT_NFT', message: 'Contract does not appear to be ERC-721 or ERC-1155' };
  }

  // Fetch metadata
  const metadata = await fetchCollectionMetadata(normalizedAddress, type);

  // Add collection
  const collection: Omit<WatchedCollection, 'id'> = {
    address: normalizedAddress,
    name: name || metadata.name,
    symbol: metadata.symbol,
    type,
    walletAddress: normalizedWallet,
    addedAt: Date.now(),
  };

  const id = await db.collections.add(collection);
  return { ...collection, id };
}

export async function removeCollection(id: number): Promise<void> {
  const collection = await db.collections.get(id);
  if (collection) {
    // Remove associated holdings
    await db.holdings
      .where('[collectionAddress+ownerAddress]')
      .equals([collection.address, collection.walletAddress])
      .delete();
    // Remove associated transfers
    await db.transfers.where('collectionAddress').equals(collection.address).delete();
  }
  await db.collections.delete(id);
}

export async function getCollectionsForWallet(
  walletAddress: string
): Promise<WatchedCollection[]> {
  const normalized = walletAddress.toLowerCase();
  return db.collections.where('walletAddress').equals(normalized).toArray();
}

export async function updateCollectionSyncState(
  id: number,
  blockNumber: number
): Promise<void> {
  await db.collections.update(id, {
    lastSyncBlock: blockNumber,
    lastSyncAt: Date.now(),
  });
}
