'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { useWalletSync } from '@/hooks';
import { truncateAddress, cn } from '@/lib/utils';
import { PageWrapper, PageHeader, AnimatedCard, EmptyState, StatCard } from '@/components/ui/page-wrapper';
import {
  RefreshCw,
  Image,
  ExternalLink,
  Loader2,
  Wallet,
  Grid3X3,
  List,
  Layers,
  Hash,
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
      <PageWrapper>
        <PageHeader
          title="Inventory"
          description="View your NFT holdings"
          icon={<Image className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />}
        />
        <EmptyState
          icon={<Wallet className="h-8 w-8 text-white/30" />}
          title="Connect your wallet to view NFTs"
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Inventory"
        description={`${totalNFTs} NFTs across ${collections.length} collections`}
        icon={<Image className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />}
        action={
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-lg"
            >
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
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
            </motion.div>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total NFTs"
          value={totalNFTs}
          icon={<Hash className="h-5 w-5 text-white" />}
          gradient="from-purple-500 to-pink-500"
          delay={0.1}
        />
        <StatCard
          label="Collections"
          value={collections.length}
          icon={<Layers className="h-5 w-5 text-white" />}
          gradient="from-cyan-500 to-blue-500"
          delay={0.15}
        />
      </div>

      {/* Sync Progress */}
      <AnimatePresence>
        {isSyncingNFTs && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card rounded-2xl p-4 border-purple-500/30 bg-purple-500/10"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-5 w-5 text-purple-400" />
              </motion.div>
              <span className="text-white/70">{progress}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No NFTs */}
      {!isLoading && totalNFTs === 0 && (
        <EmptyState
          icon={<Image className="h-8 w-8 text-white/30" />}
          title="No NFTs found"
          description="Try refreshing to sync your NFTs from Monad"
          action={
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={refresh} variant="outline" className="border-white/[0.1]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </motion.div>
          }
        />
      )}

      {/* Collections with Holdings */}
      {collections.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          className="space-y-6"
        >
          {collections.map((collection, index) => {
            const collectionHoldings = holdingsByCollection[collection.address] || [];
            if (collectionHoldings.length === 0) return null;

            return (
              <motion.div
                key={collection.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="glass-card rounded-2xl overflow-hidden"
              >
                {/* Collection Header */}
                <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center"
                    >
                      <Image className="h-5 w-5 text-white/70" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-white/90">{collection.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <code>{truncateAddress(collection.address, 6)}</code>
                        <a
                          href={`https://monadvision.com/address/${collection.address}`}
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
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.02 } },
                      }}
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                    >
                      {collectionHoldings.slice(0, 24).map((holding) => (
                        <motion.div
                          key={holding.id}
                          variants={{
                            hidden: { opacity: 0, scale: 0.8 },
                            visible: { opacity: 1, scale: 1 },
                          }}
                          whileHover={{ scale: 1.05, y: -4 }}
                          whileTap={{ scale: 0.95 }}
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
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.02 } },
                      }}
                      className="space-y-1"
                    >
                      {collectionHoldings.slice(0, 50).map((holding) => (
                        <motion.div
                          key={holding.id}
                          variants={{
                            hidden: { opacity: 0, x: -20 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
                          className="flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer"
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
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {collectionHoldings.length > (viewMode === 'grid' ? 24 : 50) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 text-center"
                    >
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white/80">
                        View all {collectionHoldings.length} NFTs
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Holdings without collection metadata */}
      {holdings.length > 0 && collections.length === 0 && (
        <AnimatedCard delay={0.2}>
          <div className="p-5 border-b border-white/[0.05]">
            <h3 className="font-semibold text-white/90">Your NFTs</h3>
          </div>
          <div className="p-4">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
              }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
            >
              {holdings.slice(0, 24).map((holding) => (
                <motion.div
                  key={holding.id}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8 },
                    visible: { opacity: 1, scale: 1 },
                  }}
                  whileHover={{ scale: 1.05, y: -4 }}
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </AnimatedCard>
      )}
    </PageWrapper>
  );
}
