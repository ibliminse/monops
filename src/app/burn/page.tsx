'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import { parseEther, formatEther, type Address, erc20Abi, parseAbi } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        .then((res) => res.json())
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

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            Burn
          </h1>
          <p className="text-muted-foreground">
            Permanently destroy tokens or NFTs by sending to the burn address
          </p>
        </div>

        {/* Warning Banner */}
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400">Warning: Permanent Action</h3>
              <p className="text-sm text-red-300/70 mt-1">
                Burning is irreversible. Assets sent to the burn address ({truncateAddress(BURN_ADDRESS)}) cannot be recovered.
              </p>
            </div>
          </div>
        </div>

        {/* Type Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setBurnType('nft')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              burnType === 'nft'
                ? 'border-orange-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            NFTs
          </button>
          <button
            onClick={() => setBurnType('token')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              burnType === 'token'
                ? 'border-orange-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="h-4 w-4" />
            Tokens
          </button>
          <button
            onClick={() => setBurnType('mon')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              burnType === 'mon'
                ? 'border-orange-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="h-4 w-4" />
            MON
          </button>
        </div>

        {/* NFT Burn */}
        {burnType === 'nft' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Collection</CardTitle>
                <CardDescription>Choose NFTs to burn</CardDescription>
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

            {selectedCollection && (
              <Card>
                <CardHeader>
                  <CardTitle>Select NFTs to Burn</CardTitle>
                  <CardDescription>
                    {selectedNFTs.size} selected for burning
                  </CardDescription>
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
                              ? 'border-orange-500 ring-2 ring-orange-500/50'
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
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                              <div className="bg-orange-500 rounded-full p-1">
                                <Flame className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                            <span className="text-xs text-white truncate">#{nft.tokenId}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Token Burn */}
        {burnType === 'token' && (
          <Card>
            <CardHeader>
              <CardTitle>Burn Tokens</CardTitle>
              <CardDescription>Send ERC-20 tokens to the burn address</CardDescription>
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
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Amount to Burn</Label>
                        <button
                          className="text-xs text-orange-500 hover:underline"
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
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* MON Burn */}
        {burnType === 'mon' && (
          <Card>
            <CardHeader>
              <CardTitle>Burn MON</CardTitle>
              <CardDescription>Send native MON to the burn address</CardDescription>
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
                  <Label>Amount to Burn</Label>
                  {monBalance && (
                    <button
                      className="text-xs text-orange-500 hover:underline"
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
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Burn Button */}
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!canBurn() || isExecuting}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          size="lg"
        >
          {isExecuting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Flame className="mr-2 h-5 w-5" />
          )}
          Burn Forever
        </Button>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" />
                Confirm Burn
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {getConfirmMessage()}
                <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-sm text-red-400">
                    <strong>Burn Address:</strong> {BURN_ADDRESS}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
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
        {result && (
          <Card className={result.success ? 'border-green-500' : 'border-destructive'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <div className="font-medium">
                    {result.success ? 'Burn Successful!' : 'Burn Failed'}
                  </div>
                  {result.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {result.error && (
                    <div className="text-sm text-destructive">{result.error}</div>
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
