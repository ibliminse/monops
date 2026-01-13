'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, type Address, erc20Abi, parseAbi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
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
import { NetworkGuard } from '@/components/network-guard';
import { PageWrapper, PageHeader, AnimatedCard, StatCard } from '@/components/ui/page-wrapper';
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
  Shield,
  Timer,
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
const LOCK_CONTRACT_ADDRESS: Address = '0xC4Ca03a135B6dE0Dba430e28de5fe9C10cA99CB0';

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
      const cliffDuration = parseInt(cliffMonths) * 30 * 24 * 60 * 60;

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

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <NetworkGuard requireConnection>
      <PageWrapper>
        <PageHeader
          title="Token Lock"
          description="Lock tokens with optional vesting schedules"
          icon={<Lock className="h-6 w-6 md:h-8 md:w-8 text-cyan-500" />}
        />

        {/* Contract Not Deployed Warning */}
        {!isContractDeployed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl border-amber-500/30 bg-amber-500/10 p-4 md:p-6"
          >
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </motion.div>
              <div>
                <h3 className="font-semibold text-amber-400">Contract Not Deployed</h3>
                <p className="text-sm text-amber-300/80 mt-1">
                  The token lock smart contract needs to be deployed to Monad before this feature can be used.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Lock Type Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 p-1 bg-white/[0.03] rounded-xl w-fit"
        >
          <button
            onClick={() => setLockType('simple')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              lockType === 'simple'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Lock className="h-4 w-4" />
            Simple Lock
          </button>
          <button
            onClick={() => setLockType('vesting')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              lockType === 'vesting'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Vesting Schedule
          </button>
        </motion.div>

        {/* Lock Form */}
        <AnimatePresence mode="wait">
          {lockType === 'simple' ? (
            <AnimatedCard key="simple" delay={0.2}>
              <div className="p-5 md:p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Lock className="h-5 w-5 text-cyan-500" />
                    Simple Time Lock
                  </h3>
                  <p className="text-sm text-white/40 mt-1">
                    Lock tokens until a specific date, then unlock all at once
                  </p>
                </div>

                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-500 mr-2" />
                    <span className="text-white/50">Loading tokens...</span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-white/70">Token to Lock</Label>
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
                            className="bg-white/[0.03] border-white/[0.08]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-white/70">
                            <Calendar className="h-4 w-4 text-cyan-500" />
                            Unlock Date
                          </Label>
                          <Input
                            type="date"
                            value={unlockDate}
                            onChange={(e) => setUnlockDate(e.target.value)}
                            min={getMinDate()}
                            className="bg-white/[0.03] border-white/[0.08]"
                          />
                        </div>
                      </motion.div>
                    )}

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleCreateLock}
                        disabled={!selectedToken || !amount || !unlockDate || isExecuting || !isContractDeployed}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25"
                      >
                        {isExecuting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Lock className="mr-2 h-4 w-4" />
                        )}
                        Create Lock
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </AnimatedCard>
          ) : (
            <AnimatedCard key="vesting" delay={0.2}>
              <div className="p-5 md:p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-500" />
                    Vesting Schedule
                  </h3>
                  <p className="text-sm text-white/40 mt-1">
                    Gradually unlock tokens over time with optional cliff period
                  </p>
                </div>

                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-500 mr-2" />
                    <span className="text-white/50">Loading tokens...</span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-white/70">Token to Lock</Label>
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
                            <Label className="text-white/70">Total Amount</Label>
                            <button
                              className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
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
                            className="bg-white/[0.03] border-white/[0.08]"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-white/70">
                              <Calendar className="h-4 w-4 text-cyan-500" />
                              Vesting Start
                            </Label>
                            <Input
                              type="date"
                              value={vestingStart}
                              onChange={(e) => setVestingStart(e.target.value)}
                              min={getMinDate()}
                              className="bg-white/[0.03] border-white/[0.08]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-white/70">
                              <Calendar className="h-4 w-4 text-cyan-500" />
                              Vesting End
                            </Label>
                            <Input
                              type="date"
                              value={vestingEnd}
                              onChange={(e) => setVestingEnd(e.target.value)}
                              min={vestingStart || getMinDate()}
                              className="bg-white/[0.03] border-white/[0.08]"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-white/70">
                            <Clock className="h-4 w-4 text-cyan-500" />
                            Cliff Period (months)
                          </Label>
                          <Select value={cliffMonths} onValueChange={setCliffMonths}>
                            <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
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
                          <p className="text-xs text-white/30">
                            No tokens can be claimed during the cliff period
                          </p>
                        </div>
                      </motion.div>
                    )}

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleCreateVestingLock}
                        disabled={!selectedToken || !amount || !vestingStart || !vestingEnd || isExecuting || !isContractDeployed}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25"
                      >
                        {isExecuting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <TrendingUp className="mr-2 h-4 w-4" />
                        )}
                        Create Vesting Lock
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </AnimatedCard>
          )}
        </AnimatePresence>

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
                    {result.success ? 'Lock Created!' : 'Lock Failed'}
                  </div>
                  {result.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
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

        {/* How It Works */}
        <AnimatedCard delay={0.3} hover={false}>
          <div className="p-5 md:p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-white/50" />
              How It Works
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                whileHover={{ x: 5 }}
                className="space-y-2"
              >
                <h4 className="font-medium flex items-center gap-2 text-white/90">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Lock className="h-4 w-4 text-cyan-400" />
                  </div>
                  Simple Lock
                </h4>
                <ul className="text-sm text-white/50 space-y-1 ml-10">
                  <li>• Tokens locked until specified date</li>
                  <li>• 100% unlocks at once when date arrives</li>
                  <li>• Cannot withdraw early</li>
                  <li>• Best for: Team tokens, milestone releases</li>
                </ul>
              </motion.div>
              <motion.div
                whileHover={{ x: 5 }}
                className="space-y-2"
              >
                <h4 className="font-medium flex items-center gap-2 text-white/90">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                  </div>
                  Vesting Schedule
                </h4>
                <ul className="text-sm text-white/50 space-y-1 ml-10">
                  <li>• Linear unlock between start and end dates</li>
                  <li>• Optional cliff period (no unlocks)</li>
                  <li>• Claim vested amount anytime</li>
                  <li>• Best for: Employee vesting, gradual releases</li>
                </ul>
              </motion.div>
            </div>
          </div>
        </AnimatedCard>
      </PageWrapper>
    </NetworkGuard>
  );
}
