'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Papa from 'papaparse';
import { parseEther, formatEther, type Address, erc20Abi } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NetworkGuard } from '@/components/network-guard';
import { db, type NFTHolding } from '@/lib/db';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress, formatMon } from '@/lib/utils';
import { getPublicClient } from '@/lib/chain/client';
import { getAllTokenBalances, type TokenBalance } from '@/lib/scanner/token-scanner';
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
} from 'lucide-react';

type TabType = 'nft' | 'token' | 'mon';
type ModeType = 'lite' | 'pro';

export default function TransferPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: monBalance } = useBalance({ address });
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];
  const limits = getPlanLimits();

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
      getAllTokenBalances(address as Address)
        .then(setTokens)
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

    const collection = myCollections.find((c) => c.collectionAddress === selectedCollection);
    const items: NFTTransferItem[] = Array.from(selectedNFTs).map((tokenId) => ({
      to: nftRecipient,
      tokenId,
      collectionAddress: selectedCollection,
      collectionType: 'ERC721', // TODO: detect type
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
  }, [address, walletClient, selectedNFTs, nftRecipient, selectedCollection, myCollections]);

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

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transfer</h1>
            <p className="text-muted-foreground">
              Send NFTs, tokens, or MON
            </p>
          </div>
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setMode('lite')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'lite'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Lite
            </button>
            <button
              onClick={() => setMode('pro')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'pro'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal className="h-4 w-4" />
              Pro
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('nft')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'nft'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            NFTs
          </button>
          <button
            onClick={() => setActiveTab('token')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'token'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="h-4 w-4" />
            Tokens
          </button>
          <button
            onClick={() => setActiveTab('mon')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mon'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CircleDollarSign className="h-4 w-4" />
            MON
          </button>
        </div>

        {/* NFT Tab */}
        {activeTab === 'nft' && (
          <>
            {mode === 'lite' ? (
              <div className="space-y-6">
                {/* Collection Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select Collection</CardTitle>
                    <CardDescription>
                      Choose from your NFT collections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedCollection} onValueChange={(v) => {
                      setSelectedCollection(v);
                      setSelectedNFTs(new Set());
                    }}>
                      <SelectTrigger>
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
                  </CardContent>
                </Card>

                {/* NFT Grid */}
                {selectedCollection && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Select NFTs</CardTitle>
                        <CardDescription>
                          Click to select NFTs to transfer
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllNFTs}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearSelection}>
                          Clear
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {collectionNFTs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          No NFTs found in this collection
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {collectionNFTs.map((nft) => (
                            <button
                              key={nft.tokenId}
                              onClick={() => toggleNFT(nft.tokenId)}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                selectedNFTs.has(nft.tokenId)
                                  ? 'border-primary ring-2 ring-primary/50'
                                  : 'border-border hover:border-muted-foreground'
                              }`}
                            >
                              {nft.image ? (
                                <img
                                  src={nft.image}
                                  alt={nft.name || `#${nft.tokenId}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">#{nft.tokenId}</span>
                                </div>
                              )}
                              {selectedNFTs.has(nft.tokenId) && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <div className="bg-primary rounded-full p-1">
                                    <Check className="h-4 w-4 text-primary-foreground" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                <span className="text-xs text-white truncate">
                                  #{nft.tokenId}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Recipient & Send */}
                {selectedNFTs.size > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Send {selectedNFTs.size} NFT{selectedNFTs.size > 1 ? 's' : ''}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Recipient Address</Label>
                        <Input
                          placeholder="0x..."
                          value={nftRecipient}
                          onChange={(e) => setNftRecipient(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleNFTTransfer}
                        disabled={!nftRecipient || isExecuting}
                        className="w-full"
                      >
                        {isExecuting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send NFTs
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* Pro Mode - CSV */
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bulk NFT Transfer</CardTitle>
                    <CardDescription>
                      Paste CSV data: recipient,tokenId (one per line)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Collection</Label>
                      <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                        <SelectTrigger>
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
                      <Label>CSV Data</Label>
                      <Textarea
                        placeholder="0x123...abc,1&#10;0x456...def,2&#10;0x789...ghi,3"
                        value={csvInput}
                        onChange={(e) => setCsvInput(e.target.value)}
                        className="font-mono text-sm h-40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCSVParse} variant="secondary">
                        <Upload className="mr-2 h-4 w-4" />
                        Parse CSV
                      </Button>
                      <Badge variant="secondary">
                        Max {limits.maxBatchSize} items
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {parsedItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{parsedItems.length} Transfers Ready</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {parsedItems.slice(0, 20).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm py-1 border-b border-border">
                            <code>{truncateAddress(item.to)}</code>
                            <span>#{item.tokenId}</span>
                          </div>
                        ))}
                        {parsedItems.length > 20 && (
                          <p className="text-sm text-muted-foreground text-center">
                            +{parsedItems.length - 20} more
                          </p>
                        )}
                      </div>
                      <Button className="w-full" disabled={isExecuting}>
                        <Send className="mr-2 h-4 w-4" />
                        Execute Batch Transfer
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {/* Token Tab */}
        {activeTab === 'token' && (
          <Card>
            <CardHeader>
              <CardTitle>Send Tokens</CardTitle>
              <CardDescription>
                Transfer ERC-20 tokens to another address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingTokens ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading tokens...</span>
                </div>
              ) : tokens.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No tokens found in your wallet
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger>
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
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Amount</Label>
                          <button
                            className="text-xs text-primary hover:underline"
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
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Recipient Address</Label>
                        <Input
                          placeholder="0x..."
                          value={tokenRecipient}
                          onChange={(e) => setTokenRecipient(e.target.value)}
                        />
                      </div>

                      <Button
                        onClick={handleTokenTransfer}
                        disabled={!tokenAmount || !tokenRecipient || isExecuting}
                        className="w-full"
                      >
                        {isExecuting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send {selectedTokenData.symbol}
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* MON Tab */}
        {activeTab === 'mon' && (
          <Card>
            <CardHeader>
              <CardTitle>Send MON</CardTitle>
              <CardDescription>
                Transfer native MON to another address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Your Balance</div>
                <div className="text-2xl font-bold">
                  {monBalance ? formatMon(monBalance.value) : '0'} MON
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Amount</Label>
                  {monBalance && (
                    <button
                      className="text-xs text-primary hover:underline"
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
                />
              </div>

              <div className="space-y-2">
                <Label>Recipient Address</Label>
                <Input
                  placeholder="0x..."
                  value={monRecipient}
                  onChange={(e) => setMonRecipient(e.target.value)}
                />
              </div>

              <Button
                onClick={handleMONTransfer}
                disabled={!monAmount || !monRecipient || isExecuting}
                className="w-full"
              >
                {isExecuting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send MON
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Execution Result */}
        {executionResult && (
          <Card className={executionResult.success ? 'border-green-500' : 'border-destructive'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {executionResult.success ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <div className="font-medium">
                    {executionResult.success ? 'Transfer Successful!' : 'Transfer Failed'}
                  </div>
                  {executionResult.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${executionResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {executionResult.error && (
                    <div className="text-sm text-destructive">{executionResult.error}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </NetworkGuard>
  );
}
