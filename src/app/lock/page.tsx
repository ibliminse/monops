'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, type Address, erc20Abi, parseAbi } from 'viem';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { NetworkGuard } from '@/components/network-guard';
import { getPublicClient } from '@/lib/chain/client';
import {
  Lock,
  Calendar,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Unlock,
  TrendingUp,
  Settings,
} from 'lucide-react';

// Lock contract ABI (to be deployed)
const LOCK_ABI = parseAbi([
  'function createLock(address token, uint256 amount, uint256 unlockTime) returns (uint256 lockId)',
  'function createVestingLock(address token, uint256 amount, uint256 startTime, uint256 endTime, uint256 cliffDuration) returns (uint256 lockId)',
  'function withdraw(uint256 lockId)',
  'function getClaimableAmount(uint256 lockId) view returns (uint256)',
  'function getLock(uint256 lockId) view returns (address owner, address token, uint256 amount, uint256 claimed, uint256 startTime, uint256 endTime, uint256 cliffEnd, bool isVesting)',
  'function getUserLocks(address user) view returns (uint256[])',
]);

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

interface LockInfo {
  id: number;
  token: Address;
  tokenSymbol: string;
  amount: bigint;
  claimed: bigint;
  startTime: number;
  endTime: number;
  cliffEnd: number;
  isVesting: boolean;
  claimable: bigint;
}

// TODO: Deploy this contract and update the address
const LOCK_CONTRACT_ADDRESS: Address | null = null; // Will be set after deployment

export default function LockPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Token State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');

  // Lock State
  const [lockType, setLockType] = useState<'simple' | 'vesting'>('simple');
  const [amount, setAmount] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [vestingStart, setVestingStart] = useState('');
  const [vestingEnd, setVestingEnd] = useState('');
  const [cliffMonths, setCliffMonths] = useState('0');

  // User's locks
  const [userLocks, setUserLocks] = useState<LockInfo[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(false);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txHash?: string;
    error?: string;
  } | null>(null);

  // Load tokens
  useEffect(() => {
    if (address && tokens.length === 0 && !loadingTokens) {
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
  }, [address, tokens.length, loadingTokens]);

  const selectedTokenData = tokens.find((t) => t.address === selectedToken);

  // Check if contract is deployed
  const isContractDeployed = LOCK_CONTRACT_ADDRESS !== null;

  // Create simple lock
  const handleCreateLock = useCallback(async () => {
    if (!address || !walletClient || !selectedToken || !amount || !unlockDate) return;
    if (!LOCK_CONTRACT_ADDRESS) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const token = tokens.find((t) => t.address === selectedToken);
      if (!token) throw new Error('Token not found');

      const amountWei = parseUnits(amount, token.decimals);
      const unlockTimestamp = Math.floor(new Date(unlockDate).getTime() / 1000);

      // First approve the lock contract
      const approveHash = await walletClient.writeContract({
        address: selectedToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [LOCK_CONTRACT_ADDRESS, amountWei],
      });

      // Wait for approval
      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash: approveHash });

      // Create the lock
      const lockHash = await walletClient.writeContract({
        address: LOCK_CONTRACT_ADDRESS,
        abi: LOCK_ABI,
        functionName: 'createLock',
        args: [selectedToken as Address, amountWei, BigInt(unlockTimestamp)],
      });

      setResult({ success: true, txHash: lockHash });
      setAmount('');
      setUnlockDate('');
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Lock creation failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [address, walletClient, selectedToken, amount, unlockDate, tokens]);

  // Create vesting lock
  const handleCreateVestingLock = useCallback(async () => {
    if (!address || !walletClient || !selectedToken || !amount || !vestingStart || !vestingEnd) return;
    if (!LOCK_CONTRACT_ADDRESS) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const token = tokens.find((t) => t.address === selectedToken);
      if (!token) throw new Error('Token not found');

      const amountWei = parseUnits(amount, token.decimals);
      const startTimestamp = Math.floor(new Date(vestingStart).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(vestingEnd).getTime() / 1000);
      const cliffDuration = parseInt(cliffMonths) * 30 * 24 * 60 * 60; // months to seconds

      // First approve
      const approveHash = await walletClient.writeContract({
        address: selectedToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [LOCK_CONTRACT_ADDRESS, amountWei],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash: approveHash });

      // Create vesting lock
      const lockHash = await walletClient.writeContract({
        address: LOCK_CONTRACT_ADDRESS,
        abi: LOCK_ABI,
        functionName: 'createVestingLock',
        args: [selectedToken as Address, amountWei, BigInt(startTimestamp), BigInt(endTimestamp), BigInt(cliffDuration)],
      });

      setResult({ success: true, txHash: lockHash });
      setAmount('');
      setVestingStart('');
      setVestingEnd('');
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Vesting lock creation failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [address, walletClient, selectedToken, amount, vestingStart, vestingEnd, cliffMonths, tokens]);

  // Calculate unlock progress percentage
  const getProgressPercent = (lock: LockInfo) => {
    const now = Date.now() / 1000;
    if (now < lock.startTime) return 0;
    if (now >= lock.endTime) return 100;
    return Math.floor(((now - lock.startTime) / (lock.endTime - lock.startTime)) * 100);
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Lock className="h-8 w-8 text-cyan-500" />
            Token Lock
          </h1>
          <p className="text-muted-foreground">
            Lock tokens with optional vesting schedules
          </p>
        </div>

        {/* Contract Not Deployed Warning */}
        {!isContractDeployed && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Contract Not Deployed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-300/80">
                The token lock smart contract needs to be deployed to Monad before this feature can be used.
              </p>
              <div className="p-4 bg-black/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">To deploy the contract:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Check <code className="bg-white/10 px-1 rounded">contracts/TokenLock.sol</code> in the repo</li>
                  <li>Deploy using Foundry or Hardhat to Monad mainnet</li>
                  <li>Update <code className="bg-white/10 px-1 rounded">LOCK_CONTRACT_ADDRESS</code> in this file</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lock Type Tabs */}
        <Tabs value={lockType} onValueChange={(v) => setLockType(v as 'simple' | 'vesting')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Simple Lock
            </TabsTrigger>
            <TabsTrigger value="vesting" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Vesting Schedule
            </TabsTrigger>
          </TabsList>

          {/* Simple Lock */}
          <TabsContent value="simple">
            <Card>
              <CardHeader>
                <CardTitle>Simple Time Lock</CardTitle>
                <CardDescription>
                  Lock tokens until a specific date, then unlock all at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading tokens...</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Token to Lock</Label>
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
                              className="text-xs text-cyan-500 hover:underline"
                              onClick={() => setAmount(selectedTokenData.formattedBalance)}
                            >
                              Max: {parseFloat(selectedTokenData.formattedBalance).toFixed(4)}
                            </button>
                          </div>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Unlock Date
                          </Label>
                          <Input
                            type="date"
                            value={unlockDate}
                            onChange={(e) => setUnlockDate(e.target.value)}
                            min={getMinDate()}
                          />
                        </div>
                      </>
                    )}

                    <Button
                      onClick={handleCreateLock}
                      disabled={!selectedToken || !amount || !unlockDate || isExecuting || !isContractDeployed}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    >
                      {isExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Create Lock
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vesting Lock */}
          <TabsContent value="vesting">
            <Card>
              <CardHeader>
                <CardTitle>Vesting Schedule</CardTitle>
                <CardDescription>
                  Gradually unlock tokens over time with optional cliff period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading tokens...</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Token to Lock</Label>
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
                            <Label>Total Amount</Label>
                            <button
                              className="text-xs text-cyan-500 hover:underline"
                              onClick={() => setAmount(selectedTokenData.formattedBalance)}
                            >
                              Max: {parseFloat(selectedTokenData.formattedBalance).toFixed(4)}
                            </button>
                          </div>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Vesting Start
                            </Label>
                            <Input
                              type="date"
                              value={vestingStart}
                              onChange={(e) => setVestingStart(e.target.value)}
                              min={getMinDate()}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Vesting End
                            </Label>
                            <Input
                              type="date"
                              value={vestingEnd}
                              onChange={(e) => setVestingEnd(e.target.value)}
                              min={vestingStart || getMinDate()}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Cliff Period (months)
                          </Label>
                          <Select value={cliffMonths} onValueChange={setCliffMonths}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No cliff</SelectItem>
                              <SelectItem value="1">1 month</SelectItem>
                              <SelectItem value="3">3 months</SelectItem>
                              <SelectItem value="6">6 months</SelectItem>
                              <SelectItem value="12">12 months</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            No tokens can be claimed during the cliff period
                          </p>
                        </div>
                      </>
                    )}

                    <Button
                      onClick={handleCreateVestingLock}
                      disabled={!selectedToken || !amount || !vestingStart || !vestingEnd || isExecuting || !isContractDeployed}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    >
                      {isExecuting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp className="mr-2 h-4 w-4" />
                      )}
                      Create Vesting Lock
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                    {result.success ? 'Lock Created!' : 'Lock Failed'}
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

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-cyan-500" />
                  Simple Lock
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Tokens locked until specified date</li>
                  <li>• 100% unlocks at once when date arrives</li>
                  <li>• Cannot withdraw early</li>
                  <li>• Best for: Team tokens, milestone releases</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                  Vesting Schedule
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Linear unlock between start and end dates</li>
                  <li>• Optional cliff period (no unlocks)</li>
                  <li>• Claim vested amount anytime</li>
                  <li>• Best for: Employee vesting, gradual releases</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </NetworkGuard>
  );
}
