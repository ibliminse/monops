'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatUnits, type Address, parseAbi } from 'viem';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { NetworkGuard } from '@/components/network-guard';
import { PageWrapper, PageHeader, StatCard, AnimatedCard, EmptyState } from '@/components/ui/page-wrapper';
import { getPublicClient } from '@/lib/chain/client';
import { TOKEN_STREAM_ADDRESS } from '@/lib/contracts';
import { cn } from '@/lib/utils';
import {
  Waves,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';

// Stream contract ABI
const STREAM_ABI = parseAbi([
  'function getStream(uint256 streamId) view returns (address sender, address recipient, address token, uint256 depositAmount, uint256 startTime, uint256 endTime, uint256 cliffEnd, uint256 withdrawn)',
  'function getWithdrawableAmount(uint256 streamId) view returns (uint256)',
  'function getSenderStreams(address user) view returns (uint256[])',
  'function getRecipientStreams(address user) view returns (uint256[])',
  'function withdraw(uint256 streamId) returns (uint256)',
  'function withdrawBatch(uint256[] streamIds) returns (uint256)',
  'function getStreamRate(uint256 streamId) view returns (uint256)',
]);

interface StreamInfo {
  id: bigint;
  sender: Address;
  recipient: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  depositAmount: bigint;
  startTime: number;
  endTime: number;
  cliffEnd: number;
  withdrawn: bigint;
  withdrawable: bigint;
  status: 'scheduled' | 'streaming' | 'completed';
}

const tokenCache: Record<string, { symbol: string; decimals: number }> = {};

export default function StreamsPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isContractDeployed = TOKEN_STREAM_ADDRESS !== null;

  const getTokenInfo = useCallback(async (tokenAddress: Address) => {
    if (tokenCache[tokenAddress]) return tokenCache[tokenAddress];

    const client = getPublicClient();
    try {
      const [symbol, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: parseAbi(['function symbol() view returns (string)']),
          functionName: 'symbol',
        }),
        client.readContract({
          address: tokenAddress,
          abi: parseAbi(['function decimals() view returns (uint8)']),
          functionName: 'decimals',
        }),
      ]);
      tokenCache[tokenAddress] = { symbol: symbol as string, decimals: decimals as number };
      return tokenCache[tokenAddress];
    } catch {
      return { symbol: 'UNKNOWN', decimals: 18 };
    }
  }, []);

  const getStreamStatus = (stream: Omit<StreamInfo, 'status'>) => {
    const now = Date.now() / 1000;
    if (now < stream.startTime) return 'scheduled';
    if (stream.withdrawn >= stream.depositAmount) return 'completed';
    if (now >= stream.endTime) return 'completed';
    return 'streaming';
  };

  const loadStreams = useCallback(async () => {
    if (!address || !TOKEN_STREAM_ADDRESS) return;

    setLoading(true);
    setError(null);

    try {
      const client = getPublicClient();

      const streamIds = await client.readContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: tab === 'incoming' ? 'getRecipientStreams' : 'getSenderStreams',
        args: [address],
      }) as bigint[];

      const streamDetails = await Promise.all(
        streamIds.map(async (id) => {
          const [streamData, withdrawable] = await Promise.all([
            client.readContract({
              address: TOKEN_STREAM_ADDRESS,
              abi: STREAM_ABI,
              functionName: 'getStream',
              args: [id],
            }),
            client.readContract({
              address: TOKEN_STREAM_ADDRESS,
              abi: STREAM_ABI,
              functionName: 'getWithdrawableAmount',
              args: [id],
            }),
          ]);

          const [sender, recipient, token, depositAmount, startTime, endTime, cliffEnd, withdrawn] = streamData as [Address, Address, Address, bigint, bigint, bigint, bigint, bigint];
          const tokenInfo = await getTokenInfo(token);

          const baseStream = {
            id,
            sender,
            recipient,
            token,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            depositAmount,
            startTime: Number(startTime),
            endTime: Number(endTime),
            cliffEnd: Number(cliffEnd),
            withdrawn,
            withdrawable: withdrawable as bigint,
          };

          return {
            ...baseStream,
            status: getStreamStatus(baseStream),
          } as StreamInfo;
        })
      );

      streamDetails.sort((a, b) => {
        const statusOrder = { streaming: 0, scheduled: 1, completed: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return b.startTime - a.startTime;
      });

      setStreams(streamDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, [address, tab, getTokenInfo]);

  useEffect(() => {
    if (address && isContractDeployed) {
      loadStreams();
    }
  }, [address, tab, isContractDeployed, loadStreams]);

  const handleWithdraw = useCallback(async (streamId: bigint) => {
    if (!walletClient || !TOKEN_STREAM_ADDRESS) return;

    setWithdrawing(streamId);
    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'withdraw',
        args: [streamId],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });
      await loadStreams();
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setWithdrawing(null);
    }
  }, [walletClient, loadStreams]);

  const handleWithdrawAll = useCallback(async () => {
    if (!walletClient || !TOKEN_STREAM_ADDRESS) return;

    const withdrawableStreams = streams.filter(s => s.withdrawable > 0n);
    if (withdrawableStreams.length === 0) return;

    setWithdrawing(-1n);
    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'withdrawBatch',
        args: [withdrawableStreams.map(s => s.id)],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });
      await loadStreams();
    } catch (err) {
      console.error('Batch withdraw failed:', err);
    } finally {
      setWithdrawing(null);
    }
  }, [walletClient, streams, loadStreams]);

  const getProgress = (stream: StreamInfo) => {
    const now = Date.now() / 1000;
    if (now < stream.startTime) return 0;
    if (now >= stream.endTime) return 100;
    return Math.floor(((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100);
  };

  const formatAmount = (amount: bigint, decimals: number) => {
    return parseFloat(formatUnits(amount, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Date.now() / 1000;
    const remaining = endTime - now;
    if (remaining <= 0) return 'Complete';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${mins}m left`;
  };

  const StatusBadge = ({ status }: { status: StreamInfo['status'] }) => {
    const config = {
      scheduled: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', label: 'Scheduled' },
      streaming: { icon: Play, color: 'bg-green-500/20 text-green-400', label: 'Streaming' },
      completed: { icon: CheckCircle2, color: 'bg-blue-500/20 text-blue-400', label: 'Completed' },
    };
    const { icon: Icon, color, label } = config[status];
    return (
      <Badge className={`${color} border-0 gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const totalWithdrawable = streams.reduce((acc, s) => acc + s.withdrawable, 0n);
  const totalStreaming = streams.filter(s => s.status === 'streaming').length;

  return (
    <NetworkGuard requireConnection>
      <PageWrapper>
        <PageHeader
          title="Token Streams"
          description="Manage your token streams and vesting schedules"
          icon={<Waves className="h-6 w-6 md:h-8 md:w-8 text-cyan-500" />}
          action={
            <Link href="/streams/create">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 w-full sm:w-auto shadow-lg shadow-cyan-500/25">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Stream
                </Button>
              </motion.div>
            </Link>
          }
        />

        {/* Contract Not Deployed Warning */}
        <AnimatePresence>
          {!isContractDeployed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AnimatedCard className="border-amber-500/50 bg-amber-500/10 p-6">
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <AlertTriangle className="h-6 w-6 text-amber-400" />
                  </motion.div>
                  <div>
                    <h3 className="font-semibold text-amber-400">Contract Not Deployed</h3>
                    <p className="text-sm text-amber-300/80 mt-1">
                      The token streaming contract needs to be deployed to Monad before this feature can be used.
                    </p>
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        {isContractDeployed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard
              label="Active Streams"
              value={totalStreaming}
              icon={<Play className="h-5 w-5 text-white" />}
              gradient="from-green-500 to-emerald-600"
              delay={0}
            />
            <StatCard
              label="Total Streams"
              value={streams.length}
              icon={<Waves className="h-5 w-5 text-white" />}
              gradient="from-cyan-500 to-blue-600"
              delay={0.1}
            />
            <StatCard
              label="Withdrawable"
              value={`${streams.filter(s => s.withdrawable > 0n).length} streams`}
              icon={<Wallet className="h-5 w-5 text-white" />}
              gradient="from-purple-500 to-violet-600"
              delay={0.2}
            />
          </div>
        )}

        {/* Withdraw All Button */}
        <AnimatePresence>
          {isContractDeployed && tab === 'incoming' && totalWithdrawable > 0n && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AnimatedCard className="border-green-500/30 bg-green-500/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white/90">Claim All Available Tokens</p>
                    <p className="text-sm text-white/50">
                      {streams.filter(s => s.withdrawable > 0n).length} streams have withdrawable tokens
                    </p>
                  </div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={handleWithdrawAll}
                      disabled={withdrawing !== null}
                      className="bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/25"
                    >
                      {withdrawing === -1n ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="mr-2 h-4 w-4" />
                      )}
                      Withdraw All
                    </Button>
                  </motion.div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'incoming' | 'outgoing')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md glass-card">
              <TabsTrigger value="incoming" className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                Incoming
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Outgoing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="incoming" className="mt-6">
              {renderStreamsList('incoming')}
            </TabsContent>
            <TabsContent value="outgoing" className="mt-6">
              {renderStreamsList('outgoing')}
            </TabsContent>
          </Tabs>
        </motion.div>
      </PageWrapper>
    </NetworkGuard>
  );

  function renderStreamsList(type: 'incoming' | 'outgoing') {
    if (!isContractDeployed) {
      return (
        <EmptyState
          icon={<Waves className="h-8 w-8 text-white/20" />}
          title="Deploy the contract to view streams"
        />
      );
    }

    if (loading) {
      return (
        <AnimatedCard className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-cyan-400" />
            <span className="text-white/70">Loading streams...</span>
          </div>
        </AnimatedCard>
      );
    }

    if (error) {
      return (
        <AnimatedCard className="border-red-500/30 p-12 text-center">
          <p className="text-red-400">{error}</p>
        </AnimatedCard>
      );
    }

    if (streams.length === 0) {
      return (
        <EmptyState
          icon={<Waves className="h-8 w-8 text-white/20" />}
          title={`No ${type} streams found`}
          action={type === 'outgoing' ? (
            <Link href="/streams/create">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" className="border-white/[0.1] bg-white/[0.02]">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Stream
                </Button>
              </motion.div>
            </Link>
          ) : undefined}
        />
      );
    }

    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
          },
        }}
        className="space-y-4"
      >
        {streams.map((stream, idx) => (
          <motion.div
            key={stream.id.toString()}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            <Link href={`/streams/${stream.id}`}>
              <div className="glass-card rounded-2xl p-5 hover:border-cyan-500/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ rotate: 10, scale: 1.1 }}
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25"
                    >
                      <span className="text-white font-bold text-sm">
                        {stream.tokenSymbol.slice(0, 2)}
                      </span>
                    </motion.div>
                    <div>
                      <p className="font-semibold text-white/90">
                        {formatAmount(stream.depositAmount, stream.tokenDecimals)} {stream.tokenSymbol}
                      </p>
                      <p className="text-sm text-white/50">
                        {type === 'incoming' ? 'From' : 'To'}:{' '}
                        {(type === 'incoming' ? stream.sender : stream.recipient).slice(0, 6)}...
                        {(type === 'incoming' ? stream.sender : stream.recipient).slice(-4)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={stream.status} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">
                      {formatAmount(stream.withdrawn, stream.tokenDecimals)} withdrawn
                    </span>
                    <span className="text-white/50">
                      {formatTimeRemaining(stream.endTime)}
                    </span>
                  </div>
                  <Progress value={getProgress(stream)} className="h-2" />
                </div>

                {type === 'incoming' && stream.withdrawable > 0n && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 flex items-center justify-between pt-4 border-t border-white/[0.05]"
                  >
                    <div>
                      <p className="text-sm text-green-400">
                        {formatAmount(stream.withdrawable, stream.tokenDecimals)} {stream.tokenSymbol} available
                      </p>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleWithdraw(stream.id);
                        }}
                        disabled={withdrawing !== null}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        {withdrawing === stream.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Withdraw'
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    );
  }
}
