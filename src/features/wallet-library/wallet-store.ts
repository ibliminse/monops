import { db, type StoredWallet } from '@/lib/db';
import { isValidAddress } from '@/lib/utils';
import { getPlanLimits } from '@/lib/db/plan';

export interface AddWalletInput {
  address: string;
  label: string;
  isConnected?: boolean;
}

export interface WalletStoreError {
  code: 'INVALID_ADDRESS' | 'DUPLICATE' | 'LIMIT_REACHED';
  message: string;
}

export async function addWallet(input: AddWalletInput): Promise<StoredWallet | WalletStoreError> {
  const { address, label, isConnected = false } = input;

  // Validate address
  if (!isValidAddress(address)) {
    return { code: 'INVALID_ADDRESS', message: 'Invalid Ethereum address format' };
  }

  // Normalize address
  const normalizedAddress = address.toLowerCase() as `0x${string}`;

  // Check for duplicates
  const existing = await db.wallets.where('address').equals(normalizedAddress).first();
  if (existing) {
    return { code: 'DUPLICATE', message: 'Wallet already exists' };
  }

  // Check plan limits
  const limits = getPlanLimits();
  const count = await db.wallets.count();
  if (count >= limits.maxStoredWallets) {
    return {
      code: 'LIMIT_REACHED',
      message: `Maximum ${limits.maxStoredWallets} wallets allowed on your plan`,
    };
  }

  // Add wallet
  const wallet: Omit<StoredWallet, 'id'> = {
    address: normalizedAddress,
    label: label.trim() || `Wallet ${count + 1}`,
    isConnected,
    addedAt: Date.now(),
  };

  const id = await db.wallets.add(wallet);
  return { ...wallet, id };
}

export async function updateWallet(
  id: number,
  updates: Partial<Pick<StoredWallet, 'label' | 'isConnected'>>
): Promise<void> {
  await db.wallets.update(id, updates);
}

export async function removeWallet(id: number): Promise<void> {
  // Also remove associated collections and holdings
  const wallet = await db.wallets.get(id);
  if (wallet) {
    await db.collections.where('walletAddress').equals(wallet.address).delete();
    await db.holdings.where('ownerAddress').equals(wallet.address).delete();
  }
  await db.wallets.delete(id);
}

export async function getWalletByAddress(address: string): Promise<StoredWallet | undefined> {
  const normalizedAddress = address.toLowerCase();
  return db.wallets.where('address').equals(normalizedAddress).first();
}

export async function getAllWallets(): Promise<StoredWallet[]> {
  return db.wallets.orderBy('addedAt').toArray();
}

export async function setConnectedWallet(address: string): Promise<void> {
  // Mark all wallets as not connected
  await db.wallets.toCollection().modify({ isConnected: false });

  // Mark the specified wallet as connected (add if doesn't exist)
  const normalizedAddress = address.toLowerCase();
  const existing = await db.wallets.where('address').equals(normalizedAddress).first();

  if (existing) {
    await db.wallets.update(existing.id!, { isConnected: true });
  } else {
    await addWallet({
      address: normalizedAddress,
      label: 'Connected Wallet',
      isConnected: true,
    });
  }
}
