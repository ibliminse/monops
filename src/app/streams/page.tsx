'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatUnits, type Address, parseAbi } from 'viem';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { getPublicClient } from '@/lib/chain/client';
import {
  Waves,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  ExternalLink,
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

// TODO: Deploy this contract and update the address
const STREAM_CONTRACT_ADDRESS: Address = '0x45060bA620768a20c792E60fbc6161344cA22a12'; // Will be set after deployment

// Token metadata cache
const tokenCache: Record<string, { symbol: string; decimals: number }> = {};

export default function StreamsPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if contract is deployed
  const isContractDeployed = STREAM_CONTRACT_ADDRESS !== null;

  // Fetch token metadata
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

  // Determine stream status
  const getStreamStatus = (stream: Omit<StreamInfo, 'status'>) => {
    const now = Date.now() / 1000;
    if (now < stream.startTime) return 'scheduled';
    if (stream.withdrawn >= stream.depositAmount) return 'completed';
    if (now >= stream.endTime) return 'completed';
    return 'streaming';
  };

  // Load streams
  const loadStreams = useCallback(async () => {
    if (!address || !STREAM_CONTRACT_ADDRESS) return;

    setLoading(true);
    setError(null);

    try {
      const client = getPublicClient();

      // Get stream IDs based on tab
      const streamIds = await client.readContract({
        address: STREAM_CONTRACT_ADDRESS,
        abi: STREAM_ABI,
        functionName: tab === 'incoming' ? 'getRecipientStreams' : 'getSenderStreams',
        args: [address],
      }) as bigint[];

      // Fetch details for each stream
      const streamDetails = await Promise.all(
        streamIds.map(async (id) => {
          const [streamData, withdrawable] = await Promise.all([
            client.readContract({
              address: STREAM_CONTRACT_ADDRESS,
              abi: STREAM_ABI,
              functionName: 'getStream',
              args: [id],
            }),
            client.readContract({
              address: STREAM_CONTRACT_ADDRESS,
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

      // Sort by status and start time
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

  // Withdraw from a stream
  const handleWithdraw = useCallback(async (streamId: bigint) => {
    if (!walletClient || !STREAM_CONTRACT_ADDRESS) return;

    setWithdrawing(streamId);
    try {
      const hash = await walletClient.writeContract({
        address: STREAM_CONTRACT_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'withdraw',
        args: [streamId],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });

      // Reload streams
      await loadStreams();
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setWithdrawing(null);
    }
  }, [walletClient, loadStreams]);

  // Withdraw all from multiple streams
  const handleWithdrawAll = useCallback(async () => {
    if (!walletClient || !STREAM_CONTRACT_ADDRESS) return;

    const withdrawableStreams = streams.filter(s => s.withdrawable > 0n);
    if (withdrawableStreams.length === 0) return;

    setWithdrawing(-1n); // Indicate batch withdrawal
    try {
      const hash = await walletClient.writeContract({
        address: STREAM_CONTRACT_ADDRESS,
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

  // Calculate progress percentage
  const getProgress = (stream: StreamInfo) => {
    const now = Date.now() / 1000;
    if (now < stream.startTime) return 0;
    if (now >= stream.endTime) return 100;
    return Math.floor(((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100);
  };

  // Format amounts
  const formatAmount = (amount: bigint, decimals: number) => {
    return parseFloat(formatUnits(amount, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  };

  // Format time remaining
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

  // Status badge
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

  // Calculate totals
  const totalWithdrawable = streams.reduce((acc, s) => acc + s.withdrawable, 0n);
  const totalStreaming = streams.filter(s => s.status === 'streaming').length;

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Waves className="h-8 w-8 text-cyan-500" />
              Token Streams
            </h1>
            <p className="text-muted-foreground">
              Manage your token streams and vesting schedules
            </p>
          </div>
          <Link href="/streams/create">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500">
              <Plus className="mr-2 h-4 w-4" />
              Create Stream
            </Button>
          </Link>
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
                The token streaming contract needs to be deployed to Monad before this feature can be used.
              </p>
              <div className="p-4 bg-black/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">To deploy the contract:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Check <code className="bg-white/10 px-1 rounded">contracts/TokenStream.sol</code> in the repo</li>
                  <li>Deploy using Foundry to Monad mainnet</li>
                  <li>Update <code className="bg-white/10 px-1 rounded">STREAM_CONTRACT_ADDRESS</code> in this file</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {isContractDeployed && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Streams</p>
                    <p className="text-2xl font-bold">{totalStreaming}</p>
                  </div>
                  <Play className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Streams</p>
                    <p className="text-2xl font-bold">{streams.length}</p>
                  </div>
                  <Waves className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Withdrawable</p>
                    <p className="text-2xl font-bold">{streams.filter(s => s.withdrawable > 0n).length} streams</p>
                  </div>
                  <Wallet className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Withdraw All Button */}
        {isContractDeployed && tab === 'incoming' && totalWithdrawable > 0n && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Claim All Available Tokens</p>
                  <p className="text-sm text-muted-foreground">
                    {streams.filter(s => s.withdrawable > 0n).length} streams have withdrawable tokens
                  </p>
                </div>
                <Button
                  onClick={handleWithdrawAll}
                  disabled={withdrawing !== null}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {withdrawing === -1n ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-4 w-4" />
                  )}
                  Withdraw All
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'incoming' | 'outgoing')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
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
      </div>
    </NetworkGuard>
  );

  function renderStreamsList(type: 'incoming' | 'outgoing') {
    if (!isContractDeployed) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Deploy the contract to view streams
          </CardContent>
        </Card>
      );
    }

    if (loading) {
      return (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading streams...
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      );
    }

    if (streams.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Waves className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No {type} streams found
            </p>
            {type === 'outgoing' && (
              <Link href="/streams/create">
                <Button variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Stream
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {streams.map((stream) => (
          <Link key={stream.id.toString()} href={`/streams/${stream.id}`}>
            <Card className="hover:border-cyan-500/30 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {stream.tokenSymbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {formatAmount(stream.depositAmount, stream.tokenDecimals)} {stream.tokenSymbol}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {type === 'incoming' ? 'From' : 'To'}:{' '}
                        {(type === 'incoming' ? stream.sender : stream.recipient).slice(0, 6)}...
                        {(type === 'incoming' ? stream.sender : stream.recipient).slice(-4)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={stream.status} />
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatAmount(stream.withdrawn, stream.tokenDecimals)} withdrawn
                    </span>
                    <span className="text-muted-foreground">
                      {formatTimeRemaining(stream.endTime)}
                    </span>
                  </div>
                  <Progress value={getProgress(stream)} className="h-2" />
                </div>

                {/* Withdrawable + Actions */}
                {type === 'incoming' && stream.withdrawable > 0n && (
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/[0.05]">
                    <div>
                      <p className="text-sm text-green-400">
                        {formatAmount(stream.withdrawable, stream.tokenDecimals)} {stream.tokenSymbol} available
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        handleWithdraw(stream.id);
                      }}
                      disabled={withdrawing !== null}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {withdrawing === stream.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Withdraw'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    );
  }
}
