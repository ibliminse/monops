'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWalletClient } from 'wagmi';
import { formatUnits, type Address, parseAbi } from 'viem';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NetworkGuard } from '@/components/network-guard';
import { getPublicClient } from '@/lib/chain/client';
import { TOKEN_STREAM_ADDRESS } from '@/lib/contracts';
import {
  Waves,
  ArrowLeft,
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Wallet,
  Copy,
  CheckCheck,
  User,
  Calendar,
  TrendingUp,
  Timer,
} from 'lucide-react';

// Stream contract ABI
const STREAM_ABI = parseAbi([
  'function getStream(uint256 streamId) view returns (address sender, address recipient, address token, uint256 depositAmount, uint256 startTime, uint256 endTime, uint256 cliffEnd, uint256 withdrawn)',
  'function getWithdrawableAmount(uint256 streamId) view returns (uint256)',
  'function withdraw(uint256 streamId) returns (uint256)',
  'function getStreamRate(uint256 streamId) view returns (uint256)',
]);

interface StreamDetail {
  id: bigint;
  sender: Address;
  recipient: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenName: string;
  depositAmount: bigint;
  startTime: number;
  endTime: number;
  cliffEnd: number;
  withdrawn: bigint;
  withdrawable: bigint;
  ratePerSecond: bigint;
  status: 'scheduled' | 'streaming' | 'in_cliff' | 'completed';
}

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const streamId = params.id as string;

  const [stream, setStream] = useState<StreamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [currentWithdrawable, setCurrentWithdrawable] = useState<bigint>(0n);

  // Check if contract is deployed
  const isContractDeployed = TOKEN_STREAM_ADDRESS !== null;

  // Copy to clipboard
  const copyAddress = (addr: string, type: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // Load stream details
  const loadStream = useCallback(async () => {
    if (!streamId || !TOKEN_STREAM_ADDRESS) return;

    setLoading(true);
    setError(null);

    try {
      const client = getPublicClient();

      const [streamData, withdrawable, rate] = await Promise.all([
        client.readContract({
          address: TOKEN_STREAM_ADDRESS,
          abi: STREAM_ABI,
          functionName: 'getStream',
          args: [BigInt(streamId)],
        }),
        client.readContract({
          address: TOKEN_STREAM_ADDRESS,
          abi: STREAM_ABI,
          functionName: 'getWithdrawableAmount',
          args: [BigInt(streamId)],
        }),
        client.readContract({
          address: TOKEN_STREAM_ADDRESS,
          abi: STREAM_ABI,
          functionName: 'getStreamRate',
          args: [BigInt(streamId)],
        }),
      ]);

      const [sender, recipient, token, depositAmount, startTime, endTime, cliffEnd, withdrawn] =
        streamData as [Address, Address, Address, bigint, bigint, bigint, bigint, bigint];

      // Get token info
      const [symbol, name, decimals] = await Promise.all([
        client.readContract({
          address: token,
          abi: parseAbi(['function symbol() view returns (string)']),
          functionName: 'symbol',
        }),
        client.readContract({
          address: token,
          abi: parseAbi(['function name() view returns (string)']),
          functionName: 'name',
        }).catch(() => 'Unknown Token'),
        client.readContract({
          address: token,
          abi: parseAbi(['function decimals() view returns (uint8)']),
          functionName: 'decimals',
        }),
      ]);

      // Determine status
      const now = Date.now() / 1000;
      let status: StreamDetail['status'];
      if (now < Number(startTime)) {
        status = 'scheduled';
      } else if (Number(cliffEnd) > 0 && now < Number(cliffEnd)) {
        status = 'in_cliff';
      } else if (withdrawn >= depositAmount || now >= Number(endTime)) {
        status = 'completed';
      } else {
        status = 'streaming';
      }

      setStream({
        id: BigInt(streamId),
        sender,
        recipient,
        token,
        tokenSymbol: symbol as string,
        tokenName: name as string,
        tokenDecimals: decimals as number,
        depositAmount,
        startTime: Number(startTime),
        endTime: Number(endTime),
        cliffEnd: Number(cliffEnd),
        withdrawn,
        withdrawable: withdrawable as bigint,
        ratePerSecond: rate as bigint,
        status,
      });

      setCurrentWithdrawable(withdrawable as bigint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    if (isContractDeployed) {
      loadStream();
    } else {
      setLoading(false);
    }
  }, [isContractDeployed, loadStream]);

  // Update withdrawable amount in real-time
  useEffect(() => {
    if (!stream || stream.status !== 'streaming' || !TOKEN_STREAM_ADDRESS) return;

    const interval = setInterval(async () => {
      try {
        const client = getPublicClient();
        const withdrawable = await client.readContract({
          address: TOKEN_STREAM_ADDRESS,
          abi: STREAM_ABI,
          functionName: 'getWithdrawableAmount',
          args: [stream.id],
        });
        setCurrentWithdrawable(withdrawable as bigint);
      } catch (err) {
        console.error('Failed to update withdrawable:', err);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [stream]);

  // Withdraw tokens
  const handleWithdraw = useCallback(async () => {
    if (!walletClient || !stream || !TOKEN_STREAM_ADDRESS) return;

    setWithdrawing(true);
    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'withdraw',
        args: [stream.id],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });

      // Reload stream data
      await loadStream();
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setWithdrawing(false);
    }
  }, [walletClient, stream, loadStream]);

  // Format amounts
  const formatAmount = (amount: bigint, decimals: number) => {
    return parseFloat(formatUnits(amount, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate progress
  const getProgress = () => {
    if (!stream) return 0;
    const now = Date.now() / 1000;
    if (now < stream.startTime) return 0;
    if (now >= stream.endTime) return 100;
    return ((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100;
  };

  // Calculate time until next event
  const getTimeUntil = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = timestamp - now;
    if (diff <= 0) return 'Now';

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Status badge
  const StatusBadge = ({ status }: { status: StreamDetail['status'] }) => {
    const config = {
      scheduled: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', label: 'Scheduled' },
      in_cliff: { icon: Timer, color: 'bg-orange-500/20 text-orange-400', label: 'In Cliff' },
      streaming: { icon: Play, color: 'bg-green-500/20 text-green-400', label: 'Streaming' },
      completed: { icon: CheckCircle2, color: 'bg-blue-500/20 text-blue-400', label: 'Completed' },
    };
    const { icon: Icon, color, label } = config[status];
    return (
      <Badge className={`${color} border-0 gap-1 text-base px-3 py-1`}>
        <Icon className="h-4 w-4" />
        {label}
      </Badge>
    );
  };

  // Can user withdraw
  const canWithdraw = stream && address &&
    stream.recipient.toLowerCase() === address.toLowerCase() &&
    currentWithdrawable > 0n;

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/streams" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Streams
        </Link>

        {/* Contract Not Deployed Warning */}
        {!isContractDeployed && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Contract Not Deployed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-300/80">
                The token streaming contract needs to be deployed first.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading stream details...
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-12 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Stream Details */}
        {stream && (
          <>
            {/* Header Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {stream.tokenSymbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        {formatAmount(stream.depositAmount, stream.tokenDecimals)} {stream.tokenSymbol}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {stream.tokenName}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={stream.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {formatAmount(stream.withdrawn, stream.tokenDecimals)} / {formatAmount(stream.depositAmount, stream.tokenDecimals)} withdrawn
                    </span>
                    <span>{getProgress().toFixed(1)}% complete</span>
                  </div>
                  <Progress value={getProgress()} className="h-3" />
                </div>

                {/* Withdraw Section */}
                {canWithdraw && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-green-400">Available to Withdraw</p>
                        <p className="text-2xl font-bold">
                          {formatAmount(currentWithdrawable, stream.tokenDecimals)} {stream.tokenSymbol}
                        </p>
                      </div>
                      <Button
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {withdrawing ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <Wallet className="mr-2 h-5 w-5" />
                        )}
                        Withdraw
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Parties */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Parties
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Sender</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white/5 px-2 py-1 rounded">
                        {stream.sender.slice(0, 10)}...{stream.sender.slice(-8)}
                      </code>
                      <button
                        onClick={() => copyAddress(stream.sender, 'sender')}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {copied === 'sender' ? (
                          <CheckCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={`https://monadvision.com/address/${stream.sender}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {address && stream.sender.toLowerCase() === address.toLowerCase() && (
                      <Badge variant="outline" className="mt-1">You</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Recipient</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white/5 px-2 py-1 rounded">
                        {stream.recipient.slice(0, 10)}...{stream.recipient.slice(-8)}
                      </code>
                      <button
                        onClick={() => copyAddress(stream.recipient, 'recipient')}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {copied === 'recipient' ? (
                          <CheckCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={`https://monadvision.com/address/${stream.recipient}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {address && stream.recipient.toLowerCase() === address.toLowerCase() && (
                      <Badge variant="outline" className="mt-1">You</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Start</p>
                      <p className="font-medium">{formatDate(stream.startTime)}</p>
                      {stream.status === 'scheduled' && (
                        <p className="text-xs text-yellow-400">in {getTimeUntil(stream.startTime)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">End</p>
                      <p className="font-medium">{formatDate(stream.endTime)}</p>
                      {stream.status === 'streaming' && (
                        <p className="text-xs text-green-400">{getTimeUntil(stream.endTime)} remaining</p>
                      )}
                    </div>
                  </div>
                  {stream.cliffEnd > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Cliff End</p>
                      <p className="font-medium">{formatDate(stream.cliffEnd)}</p>
                      {stream.status === 'in_cliff' && (
                        <p className="text-xs text-orange-400">{getTimeUntil(stream.cliffEnd)} until cliff ends</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Token Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5" />
                    Token
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span>{stream.tokenName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Symbol</span>
                    <span>{stream.tokenSymbol}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contract</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-white/5 px-2 py-1 rounded">
                        {stream.token.slice(0, 6)}...{stream.token.slice(-4)}
                      </code>
                      <a
                        href={`https://monadvision.com/address/${stream.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stream Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Streaming Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Second</span>
                    <span>{formatAmount(stream.ratePerSecond, stream.tokenDecimals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Hour</span>
                    <span>{formatAmount(stream.ratePerSecond * 3600n, stream.tokenDecimals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Day</span>
                    <span>{formatAmount(stream.ratePerSecond * 86400n, stream.tokenDecimals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>
                      {Math.ceil((stream.endTime - stream.startTime) / 86400)} days
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </NetworkGuard>
  );
}
