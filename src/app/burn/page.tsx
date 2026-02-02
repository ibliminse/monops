'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import { parseEther, formatEther, type Address, erc20Abi, parseAbi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NetworkGuard } from '@/components/network-guard';
import { PageWrapper, PageHeader, AnimatedCard, EmptyState } from '@/components/ui/page-wrapper';
import { db } from '@/lib/db';
import { truncateAddress, formatMon } from '@/lib/utils';
import {
  Flame,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Image as ImageIcon,
  Coins,
  Check,
} from 'lucide-react';

// Standard burn address
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as Address;

type BurnType = 'nft' | 'token' | 'mon';

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

const ERC721_ABI = parseAbi([
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function burn(uint256 tokenId)',
]);

export default function BurnPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: monBalance } = useBalance({ address });
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];

  // UI State
  const [burnType, setBurnType] = useState<BurnType>('nft');
  const [showConfirm, setShowConfirm] = useState(false);

  // NFT State
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());

  // Token State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [tokenAmount, setTokenAmount] = useState('');

  // MON State
  const [monAmount, setMonAmount] = useState('');

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txHash?: string;
    error?: string;
  } | null>(null);

  // Get unique collections from holdings
  const myCollections = Array.from(
    new Map(
      holdings
        .filter((h) => h.ownerAddress === address?.toLowerCase())
        .map((h) => [h.collectionAddress, h])
    ).values()
  );

  // Get NFTs for selected collection
  const collectionNFTs = holdings.filter(
    (h) =>
      h.collectionAddress === selectedCollection &&
      h.ownerAddress === address?.toLowerCase()
  );

  // Load tokens
  useEffect(() => {
    if (burnType === 'token' && address && tokens.length === 0 && !loadingTokens) {
      setLoadingTokens(true);
      fetch(`/api/tokens?address=${address}`)
        .then((res) => { if (!res.ok) throw new Error('Failed to fetch tokens'); return res.json(); })
        .then((data) => {
          if (data.tokens) {
            setTokens(data.tokens);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingTokens(false));
    }
  }, [burnType, address, tokens.length, loadingTokens]);

  // Toggle NFT selection
  const toggleNFT = (tokenId: string) => {
    setSelectedNFTs((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) {
        next.delete(tokenId);
      } else {
        next.add(tokenId);
      }
      return next;
    });
  };

  // Get confirmation message
  const getConfirmMessage = () => {
    if (burnType === 'nft') {
      return `You are about to permanently burn ${selectedNFTs.size} NFT${selectedNFTs.size > 1 ? 's' : ''}. This action is IRREVERSIBLE.`;
    } else if (burnType === 'token') {
      const token = tokens.find((t) => t.address === selectedToken);
      return `You are about to permanently burn ${tokenAmount} ${token?.symbol || 'tokens'}. This action is IRREVERSIBLE.`;
    } else {
      return `You are about to permanently burn ${monAmount} MON. This action is IRREVERSIBLE.`;
    }
  };

  // Execute burn
  const handleBurn = useCallback(async () => {
    if (!address || !walletClient) return;

    setIsExecuting(true);
    setResult(null);
    setShowConfirm(false);

    try {
      let hash: string;

      if (burnType === 'nft') {
        // Burn NFTs one by one
        for (const tokenId of selectedNFTs) {
          try {
            // Try native burn function first
            hash = await walletClient.writeContract({
              address: selectedCollection as Address,
              abi: ERC721_ABI,
              functionName: 'burn',
              args: [BigInt(tokenId)],
            });
          } catch {
            // Fallback to transfer to burn address
            hash = await walletClient.writeContract({
              address: selectedCollection as Address,
              abi: ERC721_ABI,
              functionName: 'transferFrom',
              args: [address, BURN_ADDRESS, BigInt(tokenId)],
            });
          }
        }
        setResult({ success: true, txHash: hash! });

        // Remove burned NFTs from local database
        const burnedTokenIds = Array.from(selectedNFTs);
        await db.holdings
          .where('collectionAddress')
          .equals(selectedCollection)
          .and((h) => burnedTokenIds.includes(h.tokenId))
          .delete();

        setSelectedNFTs(new Set());
      } else if (burnType === 'token') {
        const token = tokens.find((t) => t.address === selectedToken);
        if (!token) throw new Error('Token not found');

        const amount = BigInt(Math.floor(parseFloat(tokenAmount) * 10 ** token.decimals));

        hash = await walletClient.writeContract({
          address: selectedToken as Address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [BURN_ADDRESS, amount],
        });

        setResult({ success: true, txHash: hash });
        setTokenAmount('');

        // Refresh tokens list
        setTokens([]);
        setSelectedToken('');
      } else {
        // Burn MON
        hash = await walletClient.sendTransaction({
          to: BURN_ADDRESS,
          value: parseEther(monAmount),
        });

        setResult({ success: true, txHash: hash });
        setMonAmount('');
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Burn failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [address, walletClient, burnType, selectedNFTs, selectedCollection, selectedToken, tokenAmount, tokens, monAmount]);

  const selectedTokenData = tokens.find((t) => t.address === selectedToken);

  const canBurn = () => {
    if (burnType === 'nft') return selectedNFTs.size > 0;
    if (burnType === 'token') return selectedToken && tokenAmount && parseFloat(tokenAmount) > 0;
    if (burnType === 'mon') return monAmount && parseFloat(monAmount) > 0;
    return false;
  };

  const tabs = [
    { id: 'nft' as BurnType, label: 'NFTs', icon: ImageIcon },
    { id: 'token' as BurnType, label: 'Tokens', icon: Coins },
    { id: 'mon' as BurnType, label: 'MON', icon: Flame },
  ];

  return (
    <NetworkGuard requireConnection>
      <PageWrapper>
        <PageHeader
          title="Burn"
          description="Permanently destroy tokens or NFTs by sending to the burn address"
          icon={
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Flame className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
            </motion.div>
          }
        />

        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4 border-red-500/30 bg-red-500/10"
        >
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            </motion.div>
            <div>
              <h3 className="font-semibold text-red-400">Warning: Permanent Action</h3>
              <p className="text-sm text-red-300/70 mt-1">
                Burning is irreversible. Assets sent to the burn address ({truncateAddress(BURN_ADDRESS)}) cannot be recovered.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Type Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-1 p-1 bg-white/[0.03] rounded-xl w-fit"
        >
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setBurnType(tab.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                burnType === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* NFT Burn */}
        <AnimatePresence mode="wait">
          {burnType === 'nft' && (
            <motion.div
              key="nft"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <AnimatedCard delay={0.2}>
                <div className="p-5 md:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-orange-500" />
                      Select Collection
                    </h3>
                    <p className="text-sm text-white/40">Choose NFTs to burn</p>
                  </div>
                  <Select value={selectedCollection} onValueChange={(v) => {
                    setSelectedCollection(v);
                    setSelectedNFTs(new Set());
                  }}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                      <SelectValue placeholder="Select a collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {myCollections.map((c) => (
                        <SelectItem key={c.collectionAddress} value={c.collectionAddress}>
                          {c.name || truncateAddress(c.collectionAddress)} ({holdings.filter(h => h.collectionAddress === c.collectionAddress && h.ownerAddress === address?.toLowerCase()).length} owned)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AnimatedCard>

              {selectedCollection && (
                <AnimatedCard delay={0.25}>
                  <div className="p-5 md:p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        Select NFTs to Burn
                      </h3>
                      <p className="text-sm text-white/40">
                        {selectedNFTs.size} selected for burning
                      </p>
                    </div>

                    {collectionNFTs.length === 0 ? (
                      <EmptyState
                        icon={<ImageIcon className="h-8 w-8 text-white/30" />}
                        title="No NFTs found in this collection"
                      />
                    ) : (
                      <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
                        }}
                        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
                      >
                        {collectionNFTs.map((nft) => (
                          <motion.button
                            key={nft.tokenId}
                            variants={{
                              hidden: { opacity: 0, scale: 0.8 },
                              visible: { opacity: 1, scale: 1 },
                            }}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleNFT(nft.tokenId)}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                              selectedNFTs.has(nft.tokenId)
                                ? 'border-orange-500 ring-2 ring-orange-500/50'
                                : 'border-white/[0.08] hover:border-white/20'
                            }`}
                          >
                            {nft.image ? (
                              <img
                                src={nft.image}
                                alt={nft.name || `#${nft.tokenId}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                                <span className="text-xs text-white/50">#{nft.tokenId}</span>
                              </div>
                            )}
                            {selectedNFTs.has(nft.tokenId) && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-orange-500/30 flex items-center justify-center"
                              >
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 0.5, repeat: Infinity }}
                                  className="bg-orange-500 rounded-full p-1"
                                >
                                  <Flame className="h-4 w-4 text-white" />
                                </motion.div>
                              </motion.div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <span className="text-xs text-white truncate">#{nft.tokenId}</span>
                            </div>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </AnimatedCard>
              )}
            </motion.div>
          )}

          {/* Token Burn */}
          {burnType === 'token' && (
            <motion.div
              key="token"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnimatedCard delay={0.2}>
                <div className="p-5 md:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Coins className="h-5 w-5 text-orange-500" />
                      Burn Tokens
                    </h3>
                    <p className="text-sm text-white/40">Send ERC-20 tokens to the burn address</p>
                  </div>

                  {loadingTokens ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
                      <span className="text-white/50">Loading tokens...</span>
                    </div>
                  ) : tokens.length === 0 ? (
                    <EmptyState
                      icon={<Coins className="h-8 w-8 text-white/30" />}
                      title="No tokens found in your wallet"
                    />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-white/70">Token</Label>
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                          <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                            <SelectValue placeholder="Select token to burn" />
                          </SelectTrigger>
                          <SelectContent>
                            {tokens.map((t) => (
                              <SelectItem key={t.address} value={t.address}>
                                {t.symbol} - {parseFloat(t.formattedBalance).toFixed(4)} available
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedTokenData && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-2"
                        >
                          <div className="flex justify-between">
                            <Label className="text-white/70">Amount to Burn</Label>
                            <button
                              className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                              onClick={() => setTokenAmount(selectedTokenData.formattedBalance)}
                            >
                              Burn All: {parseFloat(selectedTokenData.formattedBalance).toFixed(4)}
                            </button>
                          </div>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(e.target.value)}
                            className="bg-white/[0.03] border-white/[0.08]"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </div>
              </AnimatedCard>
            </motion.div>
          )}

          {/* MON Burn */}
          {burnType === 'mon' && (
            <motion.div
              key="mon"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnimatedCard delay={0.2}>
                <div className="p-5 md:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Burn MON
                    </h3>
                    <p className="text-sm text-white/40">Send native MON to the burn address</p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/20"
                  >
                    <div className="text-sm text-white/50">Your Balance</div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {monBalance ? formatMon(monBalance.value) : '0'} MON
                    </div>
                  </motion.div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-white/70">Amount to Burn</Label>
                      {monBalance && (
                        <button
                          className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                          onClick={() => setMonAmount(formatEther(monBalance.value))}
                        >
                          Burn All: {formatMon(monBalance.value)}
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={monAmount}
                      onChange={(e) => setMonAmount(e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08]"
                    />
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Burn Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: canBurn() ? 1.02 : 1 }}
          whileTap={{ scale: canBurn() ? 0.98 : 1 }}
        >
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!canBurn() || isExecuting}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/25"
            size="lg"
          >
            {isExecuting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="mr-2"
              >
                <Flame className="h-5 w-5" />
              </motion.span>
            )}
            Burn Forever
          </Button>
        </motion.div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="bg-[#0a0a0f] border-white/[0.08]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" />
                Confirm Burn
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-white/70">
                {getConfirmMessage()}
                <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-sm text-red-400">
                    <strong>Burn Address:</strong> {BURN_ADDRESS}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBurn}
                className="bg-red-500 hover:bg-red-600"
              >
                <Flame className="mr-2 h-4 w-4" />
                Burn Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`glass-card rounded-2xl p-5 ${
                result.success ? 'border-green-500/30' : 'border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.success ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </motion.div>
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                <div>
                  <div className="font-medium text-white">
                    {result.success ? 'Burn Successful!' : 'Burn Failed'}
                  </div>
                  {result.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {result.error && (
                    <div className="text-sm text-red-400">{result.error}</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PageWrapper>
    </NetworkGuard>
  );
}
