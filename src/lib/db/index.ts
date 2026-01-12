import Dexie, { type Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

export interface StoredWallet {
  id?: number;
  address: string;
  label: string;
  isConnected: boolean;
  addedAt: number;
}

export interface WatchedCollection {
  id?: number;
  address: string;
  name: string;
  symbol?: string;
  type: 'ERC721' | 'ERC1155';
  walletAddress: string;
  addedAt: number;
  lastSyncBlock?: number;
  lastSyncAt?: number;
}

export interface NFTHolding {
  id?: number;
  collectionAddress: string;
  tokenId: string;
  ownerAddress: string;
  amount: number; // 1 for ERC721, variable for ERC1155
  lastUpdatedBlock: number;
  lastUpdatedAt: number;
}

export interface TransferEvent {
  id?: number;
  collectionAddress: string;
  tokenId: string;
  from: string;
  to: string;
  amount: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp?: number;
}

export type BatchStatus = 'pending' | 'simulating' | 'executing' | 'paused' | 'completed' | 'failed';
export type BatchType = 'TRANSFER_NFT' | 'DISPERSE_MON' | 'DISPERSE_ERC20';
export type BatchItemStatus = 'pending' | 'simulating' | 'executing' | 'success' | 'failed' | 'skipped';

export interface BatchItem {
  index: number;
  status: BatchItemStatus;
  data: Record<string, unknown>;
  txHash?: string;
  error?: string;
  gasUsed?: string;
  completedAt?: number;
}

export interface Batch {
  id?: number;
  type: BatchType;
  status: BatchStatus;
  signerAddress: string;
  items: BatchItem[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface SyncState {
  id?: number;
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface AppSettings {
  id?: number;
  key: string;
  value: unknown;
}

export interface StoredToken {
  id?: number;
  address: string;
  walletAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string; // Store as string for bigint compatibility
  formattedBalance: string;
  lastUpdatedAt: number;
}

// ============================================================================
// Database Class
// ============================================================================

export class MonOpsDB extends Dexie {
  wallets!: Table<StoredWallet>;
  collections!: Table<WatchedCollection>;
  holdings!: Table<NFTHolding>;
  transfers!: Table<TransferEvent>;
  batches!: Table<Batch>;
  syncState!: Table<SyncState>;
  settings!: Table<AppSettings>;
  tokens!: Table<StoredToken>;

  constructor() {
    super('monops');

    // Single version with all tables - cleaner for new installs
    this.version(3).stores({
      wallets: '++id, address, label, isConnected, addedAt',
      collections: '++id, address, walletAddress, type, [walletAddress+address], lastSyncBlock',
      holdings: '++id, collectionAddress, tokenId, ownerAddress, [collectionAddress+ownerAddress], [collectionAddress+tokenId]',
      transfers: '++id, collectionAddress, tokenId, from, to, blockNumber, transactionHash, [collectionAddress+blockNumber]',
      batches: '++id, type, status, signerAddress, createdAt',
      syncState: '++id, &key',
      settings: '++id, &key',
      tokens: '++id, address, walletAddress, symbol, [walletAddress+address]',
    });
  }
}

// Singleton instance
export const db = new MonOpsDB();

// ============================================================================
// Helper Functions
// ============================================================================

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.where('key').equals(key).first();
  return (setting?.value as T) ?? defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing) {
    await db.settings.update(existing.id!, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

export async function getSyncState<T>(key: string): Promise<T | undefined> {
  const state = await db.syncState.where('key').equals(key).first();
  return state?.value as T | undefined;
}

export async function setSyncState<T>(key: string, value: T): Promise<void> {
  const existing = await db.syncState.where('key').equals(key).first();
  if (existing) {
    await db.syncState.update(existing.id!, { value, updatedAt: Date.now() });
  } else {
    await db.syncState.add({ key, value, updatedAt: Date.now() });
  }
}
