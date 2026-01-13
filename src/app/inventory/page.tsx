'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { useWalletSync } from '@/hooks';
import { truncateAddress, cn } from '@/lib/utils';
import {
  RefreshCw,
  Image,
  ExternalLink,
  Loader2,
  Wallet,
  Grid3X3,
  List,
} from 'lucide-react';

export default function InventoryPage() {
  const { address, isConnected } = useAccount();
  const { isLoading, isSyncingNFTs, progress, refresh } = useWalletSync();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Get collections and holdings for connected wallet
  const collections = useLiveQuery(
    () => address
      ? db.collections.where('walletAddress').equals(address.toLowerCase()).toArray()
      : [],
    [address]
  ) ?? [];

  const holdings = useLiveQuery(
    () => address
      ? db.holdings.where('ownerAddress').equals(address.toLowerCase()).toArray()
      : [],
    [address]
  ) ?? [];

  // Group holdings by collection
  const holdingsByCollection = holdings.reduce((acc, holding) => {
    const key = holding.collectionAddress;
    if (!acc[key]) acc[key] = [];
    acc[key].push(holding);
    return acc;
  }, {} as Record<string, typeof holdings>);

  const totalNFTs = holdings.length;

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-white/50">View your NFT holdings</p>
        </div>
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50">Connect your wallet to view NFTs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-white/50">
            {totalNFTs} NFTs across {collections.length} collections
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/[0.05] rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                viewMode === 'grid' && "bg-white/[0.1]"
              )}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                viewMode === 'list' && "bg-white/[0.1]"
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="border-white/[0.1] bg-white/[0.02]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Sync Progress */}
      {isSyncingNFTs && (
        <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
            <span className="text-white/70">{progress}</span>
          </div>
        </div>
      )}

      {/* No NFTs */}
      {!isLoading && totalNFTs === 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-12 text-center">
          <Image className="h-12 w-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50 mb-2">No NFTs found</p>
          <p className="text-white/30 text-sm mb-4">
            We scanned recent blocks but didn&apos;t find any NFTs for this wallet
          </p>
          <Button onClick={refresh} variant="outline" className="border-white/[0.1]">
            <RefreshCw className="h-4 w-4 mr-2" />
            Scan Again
          </Button>
        </div>
      )}

      {/* Collections with Holdings */}
      {collections.length > 0 && (
        <div className="space-y-6">
          {collections.map((collection) => {
            const collectionHoldings = holdingsByCollection[collection.address] || [];
            if (collectionHoldings.length === 0) return null;

            return (
              <div
                key={collection.id}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden"
              >
                {/* Collection Header */}
                <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                      <Image className="h-5 w-5 text-white/70" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white/90">{collection.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <code>{truncateAddress(collection.address, 6)}</code>
                        <a
                          href={`https://explorer.monad.xyz/address/${collection.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white/60 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-white/[0.05]">
                      {collection.type}
                    </Badge>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      {collectionHoldings.length} NFTs
                    </Badge>
                  </div>
                </div>

                {/* Holdings Grid/List */}
                <div className="p-4">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {collectionHoldings.slice(0, 24).map((holding) => (
                        <div
                          key={holding.id}
                          className="group relative rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer"
                        >
                          <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-2 overflow-hidden">
                            {holding.image ? (
                              <img
                                src={holding.image}
                                alt={holding.name || `Token #${holding.tokenId}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span className={`text-2xl font-bold text-white/30 ${holding.image ? 'hidden' : ''}`}>
                              #{holding.tokenId.slice(0, 4)}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-white/80 truncate">
                            {holding.name || `Token #${holding.tokenId}`}
                          </div>
                          {holding.amount > 1 && (
                            <div className="text-xs text-white/40">
                              x{holding.amount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {collectionHoldings.slice(0, 50).map((holding) => (
                        <div
                          key={holding.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center overflow-hidden">
                              {holding.image ? (
                                <img
                                  src={holding.image}
                                  alt={holding.name || `Token #${holding.tokenId}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-bold text-white/50">
                                  #{holding.tokenId.slice(0, 3)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white/80">
                                {holding.name || `Token #${holding.tokenId}`}
                              </div>
                              <div className="text-xs text-white/40">
                                {collection.name}
                              </div>
                            </div>
                          </div>
                          {holding.amount > 1 && (
                            <Badge variant="secondary" className="bg-white/[0.05]">
                              x{holding.amount}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {collectionHoldings.length > (viewMode === 'grid' ? 24 : 50) && (
                    <div className="mt-4 text-center">
                      <Button variant="ghost" size="sm" className="text-white/50">
                        View all {collectionHoldings.length} NFTs
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Holdings without collection metadata */}
      {holdings.length > 0 && collections.length === 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
          <div className="p-5 border-b border-white/[0.05]">
            <h3 className="font-semibold text-white/90">Your NFTs</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {holdings.slice(0, 24).map((holding) => (
                <div
                  key={holding.id}
                  className="group relative rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer"
                >
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-white/30">
                      #{holding.tokenId.slice(0, 4)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white/80 truncate">
                    Token #{holding.tokenId}
                  </div>
                  <div className="text-xs text-white/40 truncate">
                    {truncateAddress(holding.collectionAddress)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
