'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Papa from 'papaparse';
import { parseEther, formatEther, type Address, erc20Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NetworkGuard } from '@/components/network-guard';
import { PageWrapper, PageHeader, AnimatedCard, EmptyState } from '@/components/ui/page-wrapper';
import { db, type NFTHolding } from '@/lib/db';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress, formatMon } from '@/lib/utils';
import { getPublicClient } from '@/lib/chain/client';
import {
  executeNFTTransfers,
  type NFTTransferItem,
} from '@/lib/batch-engine';
import {
  Send,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Terminal,
  Image as ImageIcon,
  Coins,
  CircleDollarSign,
  Check,
  ArrowRight,
} from 'lucide-react';

type TabType = 'nft' | 'token' | 'mon';
type ModeType = 'lite' | 'pro';

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

export default function TransferPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: monBalance } = useBalance({ address });
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];
  const limits = getPlanLimits(address);

  // UI State
  const [mode, setMode] = useState<ModeType>('lite');
  const [activeTab, setActiveTab] = useState<TabType>('nft');

  // NFT State
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [nftRecipient, setNftRecipient] = useState('');

  // Token State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenRecipient, setTokenRecipient] = useState('');

  // MON State
  const [monAmount, setMonAmount] = useState('');
  const [monRecipient, setMonRecipient] = useState('');

  // Pro Mode State
  const [csvInput, setCsvInput] = useState('');
  const [parsedItems, setParsedItems] = useState<NFTTransferItem[]>([]);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
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

  // Load tokens when Token tab is active
  useEffect(() => {
    if (activeTab === 'token' && address && tokens.length === 0 && !loadingTokens) {
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
  }, [activeTab, address, tokens.length, loadingTokens]);

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

  // Select all NFTs in collection
  const selectAllNFTs = () => {
    setSelectedNFTs(new Set(collectionNFTs.map((n) => n.tokenId)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedNFTs(new Set());
  };

  // Execute NFT transfer (Lite mode)
  const handleNFTTransfer = useCallback(async () => {
    if (!address || !walletClient || selectedNFTs.size === 0 || !nftRecipient) return;

    setIsExecuting(true);
    setExecutionResult(null);

    const items: NFTTransferItem[] = Array.from(selectedNFTs).map((tokenId) => ({
      to: nftRecipient,
      tokenId,
      collectionAddress: selectedCollection,
      collectionType: 'ERC721',
    }));

    try {
      await executeNFTTransfers(items, address, walletClient, {
        onItemComplete: (index, txHash) => {
          setExecutionResult({ success: true, txHash });
        },
        onItemFailed: (index, error) => {
          setExecutionResult({ success: false, error });
        },
        onBatchComplete: () => {
          setIsExecuting(false);
          setSelectedNFTs(new Set());
        },
        onBatchFailed: (error) => {
          setIsExecuting(false);
          setExecutionResult({ success: false, error });
        },
      });
    } catch (error) {
      setIsExecuting(false);
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      });
    }
  }, [address, walletClient, selectedNFTs, nftRecipient, selectedCollection]);

  // Execute Token transfer
  const handleTokenTransfer = useCallback(async () => {
    if (!address || !walletClient || !selectedToken || !tokenAmount || !tokenRecipient) return;

    setIsExecuting(true);
    setExecutionResult(null);

    const token = tokens.find((t) => t.address === selectedToken);
    if (!token) return;

    try {
      const amount = BigInt(Math.floor(parseFloat(tokenAmount) * 10 ** token.decimals));

      const hash = await walletClient.writeContract({
        address: selectedToken as Address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [tokenRecipient as Address, amount],
      });

      setExecutionResult({ success: true, txHash: hash });
      setTokenAmount('');
      setTokenRecipient('');
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [address, walletClient, selectedToken, tokenAmount, tokenRecipient, tokens]);

  // Execute MON transfer
  const handleMONTransfer = useCallback(async () => {
    if (!address || !walletClient || !monAmount || !monRecipient) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const hash = await walletClient.sendTransaction({
        to: monRecipient as Address,
        value: parseEther(monAmount),
      });

      setExecutionResult({ success: true, txHash: hash });
      setMonAmount('');
      setMonRecipient('');
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [address, walletClient, monAmount, monRecipient]);

  // Pro mode CSV parse
  const handleCSVParse = () => {
    const parsed = Papa.parse<string[]>(csvInput.trim(), { skipEmptyLines: true });
    const items: NFTTransferItem[] = [];

    for (const row of parsed.data) {
      if (row.length >= 2) {
        const [to, tokenId] = row;
        items.push({
          to: to.trim(),
          tokenId: tokenId.trim(),
          collectionAddress: selectedCollection,
          collectionType: 'ERC721',
        });
      }
    }

    setParsedItems(items.slice(0, limits.maxBatchSize));
  };

  const selectedTokenData = tokens.find((t) => t.address === selectedToken);

  const tabs = [
    { id: 'nft' as TabType, label: 'NFTs', icon: ImageIcon, color: 'from-purple-500 to-pink-500' },
    { id: 'token' as TabType, label: 'Tokens', icon: Coins, color: 'from-cyan-500 to-blue-500' },
    { id: 'mon' as TabType, label: 'MON', icon: CircleDollarSign, color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <NetworkGuard requireConnection>
      <PageWrapper>
        <PageHeader
          title="Transfer"
          description="Send NFTs, tokens, or MON"
          icon={<Send className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />}
          action={
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-lg"
            >
              <button
                onClick={() => setMode('lite')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'lite'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Lite
              </button>
              <button
                onClick={() => setMode('pro')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'pro'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Terminal className="h-4 w-4" />
                Pro
              </button>
            </motion.div>
          }
        />

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-1 p-1 bg-white/[0.03] rounded-xl w-fit"
        >
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* NFT Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'nft' && (
            <motion.div
              key="nft"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {mode === 'lite' ? (
                <>
                  {/* Collection Selection */}
                  <AnimatedCard delay={0.15}>
                    <div className="p-5 md:p-6 space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Select Collection</h3>
                        <p className="text-sm text-white/40">Choose from your NFT collections</p>
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

                  {/* NFT Grid */}
                  {selectedCollection && (
                    <AnimatedCard delay={0.2}>
                      <div className="p-5 md:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">Select NFTs</h3>
                            <p className="text-sm text-white/40">Click to select NFTs to transfer</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={selectAllNFTs} className="border-white/[0.1] bg-white/[0.02]">
                              Select All
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearSelection} className="border-white/[0.1] bg-white/[0.02]">
                              Clear
                            </Button>
                          </div>
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
                                    ? 'border-purple-500 ring-2 ring-purple-500/50'
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
                                  <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    <span className="text-xs text-white/50">#{nft.tokenId}</span>
                                  </div>
                                )}
                                {selectedNFTs.has(nft.tokenId) && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute inset-0 bg-purple-500/30 flex items-center justify-center"
                                  >
                                    <div className="bg-purple-500 rounded-full p-1">
                                      <Check className="h-4 w-4 text-white" />
                                    </div>
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

                  {/* Recipient & Send */}
                  <AnimatePresence>
                    {selectedNFTs.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -20, height: 0 }}
                      >
                        <AnimatedCard delay={0}>
                          <div className="p-5 md:p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                              <Send className="h-5 w-5 text-purple-500" />
                              Send {selectedNFTs.size} NFT{selectedNFTs.size > 1 ? 's' : ''}
                            </h3>
                            <div className="space-y-2">
                              <Label className="text-white/70">Recipient Address</Label>
                              <Input
                                placeholder="0x..."
                                value={nftRecipient}
                                onChange={(e) => setNftRecipient(e.target.value)}
                                className="bg-white/[0.03] border-white/[0.08]"
                              />
                            </div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                onClick={handleNFTTransfer}
                                disabled={!nftRecipient || isExecuting}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25"
                              >
                                {isExecuting ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="mr-2 h-4 w-4" />
                                )}
                                Send NFTs
                              </Button>
                            </motion.div>
                          </div>
                        </AnimatedCard>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                /* Pro Mode - CSV */
                <>
                  <AnimatedCard delay={0.15}>
                    <div className="p-5 md:p-6 space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Terminal className="h-5 w-5 text-purple-500" />
                          Bulk NFT Transfer
                        </h3>
                        <p className="text-sm text-white/40">Paste CSV data: recipient,tokenId (one per line)</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70">Collection</Label>
                        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                          <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                            <SelectValue placeholder="Select collection" />
                          </SelectTrigger>
                          <SelectContent>
                            {myCollections.map((c) => (
                              <SelectItem key={c.collectionAddress} value={c.collectionAddress}>
                                {c.name || truncateAddress(c.collectionAddress)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70">CSV Data</Label>
                        <Textarea
                          placeholder="0x123...abc,1&#10;0x456...def,2&#10;0x789...ghi,3"
                          value={csvInput}
                          onChange={(e) => setCsvInput(e.target.value)}
                          className="font-mono text-sm h-40 bg-white/[0.03] border-white/[0.08]"
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button onClick={handleCSVParse} variant="secondary" className="bg-white/[0.05]">
                            <Upload className="mr-2 h-4 w-4" />
                            Parse CSV
                          </Button>
                        </motion.div>
                        <Badge variant="secondary" className="bg-white/[0.05]">
                          Max {limits.maxBatchSize} items
                        </Badge>
                      </div>
                    </div>
                  </AnimatedCard>

                  {parsedItems.length > 0 && (
                    <AnimatedCard delay={0.2}>
                      <div className="p-5 md:p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white">{parsedItems.length} Transfers Ready</h3>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {parsedItems.slice(0, 20).map((item, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.02 }}
                              className="flex justify-between items-center text-sm py-2 border-b border-white/[0.05]"
                            >
                              <code className="text-white/70">{truncateAddress(item.to)}</code>
                              <ArrowRight className="h-4 w-4 text-white/30" />
                              <span className="text-white/50">#{item.tokenId}</span>
                            </motion.div>
                          ))}
                          {parsedItems.length > 20 && (
                            <p className="text-sm text-white/30 text-center py-2">
                              +{parsedItems.length - 20} more
                            </p>
                          )}
                        </div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500" disabled={isExecuting}>
                            <Send className="mr-2 h-4 w-4" />
                            Execute Batch Transfer
                          </Button>
                        </motion.div>
                      </div>
                    </AnimatedCard>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Token Tab */}
          {activeTab === 'token' && (
            <motion.div
              key="token"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnimatedCard delay={0.15}>
                <div className="p-5 md:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Coins className="h-5 w-5 text-cyan-500" />
                      Send Tokens
                    </h3>
                    <p className="text-sm text-white/40">Transfer ERC-20 tokens to another address</p>
                  </div>

                  {loadingTokens ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-500 mr-2" />
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
                            <SelectValue placeholder="Select token" />
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
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-white/70">Amount</Label>
                              <button
                                className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
                                onClick={() => setTokenAmount(selectedTokenData.formattedBalance)}
                              >
                                Max: {parseFloat(selectedTokenData.formattedBalance).toFixed(4)}
                              </button>
                            </div>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={tokenAmount}
                              onChange={(e) => setTokenAmount(e.target.value)}
                              className="bg-white/[0.03] border-white/[0.08]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/70">Recipient Address</Label>
                            <Input
                              placeholder="0x..."
                              value={tokenRecipient}
                              onChange={(e) => setTokenRecipient(e.target.value)}
                              className="bg-white/[0.03] border-white/[0.08]"
                            />
                          </div>

                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handleTokenTransfer}
                              disabled={!tokenAmount || !tokenRecipient || isExecuting}
                              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25"
                            >
                              {isExecuting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="mr-2 h-4 w-4" />
                              )}
                              Send {selectedTokenData.symbol}
                            </Button>
                          </motion.div>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </div>
              </AnimatedCard>
            </motion.div>
          )}

          {/* MON Tab */}
          {activeTab === 'mon' && (
            <motion.div
              key="mon"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnimatedCard delay={0.15}>
                <div className="p-5 md:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CircleDollarSign className="h-5 w-5 text-green-500" />
                      Send MON
                    </h3>
                    <p className="text-sm text-white/40">Transfer native MON to another address</p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20"
                  >
                    <div className="text-sm text-white/50">Your Balance</div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {monBalance ? formatMon(monBalance.value) : '0'} MON
                    </div>
                  </motion.div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-white/70">Amount</Label>
                      {monBalance && (
                        <button
                          className="text-xs text-green-500 hover:text-green-400 transition-colors"
                          onClick={() => setMonAmount(formatEther(monBalance.value))}
                        >
                          Max: {formatMon(monBalance.value)}
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

                  <div className="space-y-2">
                    <Label className="text-white/70">Recipient Address</Label>
                    <Input
                      placeholder="0x..."
                      value={monRecipient}
                      onChange={(e) => setMonRecipient(e.target.value)}
                      className="bg-white/[0.03] border-white/[0.08]"
                    />
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleMONTransfer}
                      disabled={!monAmount || !monRecipient || isExecuting}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25"
                    >
                      {isExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send MON
                    </Button>
                  </motion.div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution Result */}
        <AnimatePresence>
          {executionResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`glass-card rounded-2xl p-5 ${
                executionResult.success ? 'border-green-500/30' : 'border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {executionResult.success ? (
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
                    {executionResult.success ? 'Transfer Successful!' : 'Transfer Failed'}
                  </div>
                  {executionResult.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${executionResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {executionResult.error && (
                    <div className="text-sm text-red-400">{executionResult.error}</div>
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
