'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { db } from '@/lib/db';
import { getAllTokenBalances } from '@/lib/scanner/token-scanner';
import { scanWalletNFTs } from '@/lib/scanner/nft-scanner';
// API route handles Etherscan calls server-side

export interface SyncStatus {
  isLoading: boolean;
  isSyncingTokens: boolean;
  isSyncingNFTs: boolean;
  progress: string;
  lastSyncAt: number | null;
  error: string | null;
}

export function useWalletSync() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<SyncStatus>({
    isLoading: false,
    isSyncingTokens: false,
    isSyncingNFTs: false,
    progress: '',
    lastSyncAt: null,
    error: null,
  });

  const syncWallet = useCallback(async (walletAddress: Address) => {
    setStatus((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: 'Starting wallet sync...',
    }));

    try {
      // Add/update wallet in DB
      const existingWallet = await db.wallets
        .where('address')
        .equals(walletAddress.toLowerCase())
        .first();

      if (!existingWallet) {
        await db.wallets.add({
          address: walletAddress.toLowerCase(),
          label: 'Connected Wallet',
          isConnected: true,
          addedAt: Date.now(),
        });
      } else {
        await db.wallets.update(existingWallet.id!, { isConnected: true });
      }

      // Sync tokens
      setStatus((prev) => ({
        ...prev,
        isSyncingTokens: true,
        progress: 'Scanning for tokens...',
      }));

      const tokens = await getAllTokenBalances(walletAddress, (msg) => {
        setStatus((prev) => ({ ...prev, progress: msg }));
      });

      // Clear old tokens for this wallet and add new ones
      await db.tokens.where('walletAddress').equals(walletAddress.toLowerCase()).delete();

      if (tokens.length > 0) {
        await db.tokens.bulkAdd(
          tokens.map((t) => ({
            address: t.address.toLowerCase(),
            walletAddress: walletAddress.toLowerCase(),
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            balance: t.balance.toString(),
            formattedBalance: t.formattedBalance,
            lastUpdatedAt: Date.now(),
          }))
        );
      }

      setStatus((prev) => ({
        ...prev,
        isSyncingTokens: false,
        isSyncingNFTs: true,
        progress: 'Scanning for NFTs...',
      }));

      // Clear old holdings for this wallet
      await db.holdings.where('ownerAddress').equals(walletAddress.toLowerCase()).delete();
      await db.collections.where('walletAddress').equals(walletAddress.toLowerCase()).delete();

      // Try server-side API first (uses Etherscan API securely)
      try {
        console.log('[Wallet Sync] Using server API');
        setStatus((prev) => ({ ...prev, progress: 'Fetching NFTs from API...' }));

        const response = await fetch(`/api/nfts?address=${walletAddress}`);
        const data = await response.json();

        if (response.ok && data.collections) {
          console.log('[Wallet Sync] API returned', data.totalNFTs, 'NFTs');

          // Add collections and holdings from API response
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
              collection.holdings.map((nft: { tokenId: string }) => ({
                collectionAddress: collection.address.toLowerCase(),
                tokenId: nft.tokenId,
                ownerAddress: walletAddress.toLowerCase(),
                amount: 1,
                lastUpdatedBlock: 0,
                lastUpdatedAt: Date.now(),
              }))
            );
          }

          setStatus((prev) => ({ ...prev, progress: `Found ${data.totalNFTs} NFTs` }));
        } else {
          throw new Error(data.error || 'API failed');
        }
      } catch (apiError) {
        console.log('[Wallet Sync] API failed, falling back to block scanning:', apiError);
        // Fallback to log scanning (slower, limited history)
        console.log('[Wallet Sync] No Monadscan API key, falling back to log scanning');
        setStatus((prev) => ({ ...prev, progress: 'Scanning blockchain for NFTs (slow)...' }));

        const collections = await scanWalletNFTs(walletAddress, (msg) => {
          setStatus((prev) => ({ ...prev, progress: msg }));
        });

        // Add collections and holdings
        for (const collection of collections) {
          await db.collections.add({
            address: collection.address.toLowerCase(),
            name: collection.name,
            symbol: collection.symbol,
            type: collection.tokenType,
            walletAddress: walletAddress.toLowerCase(),
            addedAt: Date.now(),
          });

          await db.holdings.bulkAdd(
            collection.holdings.map((h) => ({
              collectionAddress: h.contractAddress.toLowerCase(),
              tokenId: h.tokenId.toString(),
              ownerAddress: walletAddress.toLowerCase(),
              amount: Number(h.balance),
              lastUpdatedBlock: 0,
              lastUpdatedAt: Date.now(),
            }))
          );
        }
      }

      const now = Date.now();
      setStatus({
        isLoading: false,
        isSyncingTokens: false,
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
        isSyncingTokens: false,
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
          // Still try to sync even if we can't check the state
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
