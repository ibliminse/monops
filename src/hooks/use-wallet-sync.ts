'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { db } from '@/lib/db';

export interface SyncStatus {
  isLoading: boolean;
  isSyncingNFTs: boolean;
  progress: string;
  lastSyncAt: number | null;
  error: string | null;
}

export function useWalletSync() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<SyncStatus>({
    isLoading: false,
    isSyncingNFTs: false,
    progress: '',
    lastSyncAt: null,
    error: null,
  });

  const syncWallet = useCallback(async (walletAddress: Address) => {
    setStatus((prev) => ({
      ...prev,
      isLoading: true,
      isSyncingNFTs: true,
      error: null,
      progress: 'Fetching NFTs...',
    }));

    try {
      // Clear old holdings for this wallet
      await db.holdings.where('ownerAddress').equals(walletAddress.toLowerCase()).delete();
      await db.collections.where('walletAddress').equals(walletAddress.toLowerCase()).delete();

      // Fetch NFTs from server API (uses Moralis)
      console.log('[Wallet Sync] Fetching NFTs from API...');
      const response = await fetch(`/api/nfts?address=${walletAddress}`);
      const data = await response.json();

      if (response.ok && data.collections) {
        console.log('[Wallet Sync] API returned', data.totalNFTs, 'NFTs');

        // Store collections and holdings
        for (const collection of data.collections) {
          await db.collections.add({
            address: collection.address.toLowerCase(),
            name: collection.name || 'Unknown Collection',
            symbol: collection.symbol || '???',
            type: 'ERC721',
            walletAddress: walletAddress.toLowerCase(),
            addedAt: Date.now(),
          });

          await db.holdings.bulkAdd(
            collection.holdings.map((nft: { tokenId: string; name?: string; image?: string }) => ({
              collectionAddress: collection.address.toLowerCase(),
              tokenId: nft.tokenId,
              ownerAddress: walletAddress.toLowerCase(),
              amount: 1,
              image: nft.image,
              name: nft.name,
              lastUpdatedBlock: 0,
              lastUpdatedAt: Date.now(),
            }))
          );
        }

        setStatus((prev) => ({ ...prev, progress: `Found ${data.totalNFTs} NFTs` }));
      } else {
        throw new Error(data.error || 'API failed');
      }

      const now = Date.now();
      setStatus({
        isLoading: false,
        isSyncingNFTs: false,
        progress: 'Sync complete!',
        lastSyncAt: now,
        error: null,
      });

      // Store last sync time
      await db.syncState.put({
        key: `wallet_sync_${walletAddress.toLowerCase()}`,
        value: now,
        updatedAt: now,
      });

    } catch (error) {
      console.error('Wallet sync error:', error);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        isSyncingNFTs: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, []);

  // Auto-sync when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      // Check if we've synced recently (within last 30 minutes)
      db.syncState
        .where('key')
        .equals(`wallet_sync_${address.toLowerCase()}`)
        .first()
        .then((state) => {
          const lastSync = state?.value as number | undefined;
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

          if (!lastSync || lastSync < thirtyMinutesAgo) {
            syncWallet(address);
          } else {
            setStatus((prev) => ({
              ...prev,
              lastSyncAt: lastSync,
              progress: 'Using cached data',
            }));
          }
        })
        .catch((error) => {
          console.error('Error checking sync state:', error);
          syncWallet(address);
        });
    }
  }, [isConnected, address, syncWallet]);

  const refresh = useCallback(async () => {
    if (address) {
      // Clear sync cache to force fresh scan
      await db.syncState.where('key').equals(`wallet_sync_${address.toLowerCase()}`).delete();
      syncWallet(address);
    }
  }, [address, syncWallet]);

  return {
    ...status,
    refresh,
  };
}
