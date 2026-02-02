'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, type Address, erc20Abi, parseAbi, isAddress } from 'viem';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { getPublicClient } from '@/lib/chain/client';
import { TOKEN_STREAM_ADDRESS } from '@/lib/contracts';
import {
  Waves,
  ArrowLeft,
  Plus,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  User,
  Calendar,
  Clock,
  Trash2,
  Info,
  Play,
  ExternalLink,
} from 'lucide-react';

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

interface BatchRecipient {
  address: string;
  amount: string;
  isValid: boolean;
  error?: string;
}

interface PreflightWarning {
  type: 'fee_on_transfer' | 'low_balance' | 'invalid_recipient' | 'zero_amount';
  message: string;
  severity: 'error' | 'warning';
}

// Stream contract ABI
const STREAM_ABI = parseAbi([
  'function createStream(address recipient, address token, uint256 amount, uint256 startTime, uint256 endTime, uint256 cliffDuration) returns (uint256 streamId)',
  'function createStreamBatch(address[] recipients, address token, uint256[] amounts, uint256 startTime, uint256 endTime, uint256 cliffDuration) returns (uint256[] streamIds)',
]);

export default function CreateStreamPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Token State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');

  // Single Stream State
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('12:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('12:00');
  const [cliffMonths, setCliffMonths] = useState('0');

  // Batch State
  const [batchRecipients, setBatchRecipients] = useState<BatchRecipient[]>([]);
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchStartTime, setBatchStartTime] = useState('12:00');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchEndTime, setBatchEndTime] = useState('12:00');
  const [batchCliffMonths, setBatchCliffMonths] = useState('0');

  // Preflight / Dry-Run
  const [showDryRun, setShowDryRun] = useState(false);
  const [preflightWarnings, setPreflightWarnings] = useState<PreflightWarning[]>([]);
  const [checkingPreflight, setCheckingPreflight] = useState(false);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txHash?: string;
    streamIds?: string[];
    error?: string;
  } | null>(null);

  // Contract check
  const isContractDeployed = TOKEN_STREAM_ADDRESS !== null;

  // Load tokens
  useEffect(() => {
    if (address && tokens.length === 0 && !loadingTokens) {
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
  }, [address, tokens.length, loadingTokens]);

  const selectedTokenData = tokens.find((t) => t.address === selectedToken);

  // Parse CSV file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('address') ? 1 : 0;

      const recipients: BatchRecipient[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const addr = parts[0];
          const amt = parts[1];

          let isValid = true;
          let error: string | undefined;

          if (!isAddress(addr)) {
            isValid = false;
            error = 'Invalid address';
          } else if (addr.toLowerCase() === address?.toLowerCase()) {
            isValid = false;
            error = 'Cannot stream to self';
          } else if (!amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
            isValid = false;
            error = 'Invalid amount';
          }

          recipients.push({ address: addr, amount: amt, isValid, error });
        }
      }

      setBatchRecipients(recipients);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [address]);

  // Add manual batch recipient
  const addBatchRecipient = () => {
    setBatchRecipients([...batchRecipients, { address: '', amount: '', isValid: false }]);
  };

  // Update batch recipient
  const updateBatchRecipient = (index: number, field: 'address' | 'amount', value: string) => {
    const updated = [...batchRecipients];
    updated[index][field] = value;

    // Validate
    const addr = updated[index].address;
    const amt = updated[index].amount;

    if (!addr || !isAddress(addr)) {
      updated[index].isValid = false;
      updated[index].error = addr ? 'Invalid address' : undefined;
    } else if (addr.toLowerCase() === address?.toLowerCase()) {
      updated[index].isValid = false;
      updated[index].error = 'Cannot stream to self';
    } else if (!amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
      updated[index].isValid = false;
      updated[index].error = amt ? 'Invalid amount' : undefined;
    } else {
      updated[index].isValid = true;
      updated[index].error = undefined;
    }

    setBatchRecipients(updated);
  };

  // Remove batch recipient
  const removeBatchRecipient = (index: number) => {
    setBatchRecipients(batchRecipients.filter((_, i) => i !== index));
  };

  // Calculate total batch amount
  const totalBatchAmount = batchRecipients.reduce((acc, r) => {
    if (r.isValid && r.amount) {
      return acc + parseFloat(r.amount);
    }
    return acc;
  }, 0);

  // Run preflight checks
  const runPreflightCheck = useCallback(async () => {
    if (!selectedTokenData || !TOKEN_STREAM_ADDRESS) return;

    setCheckingPreflight(true);
    setPreflightWarnings([]);

    const warnings: PreflightWarning[] = [];

    try {
      const client = getPublicClient();

      // Check if token might be fee-on-transfer
      // We detect this by checking if the token has unusual transfer behavior
      // This is a heuristic check
      try {
        const code = await client.getCode({ address: selectedToken as Address });
        if (code && code.length > 1000) {
          // Complex contract - might have fees
          // Check for common fee-on-transfer patterns in bytecode
          const codeStr = code.toLowerCase();
          if (codeStr.includes('fee') || codeStr.includes('tax') || codeStr.includes('reflect')) {
            warnings.push({
              type: 'fee_on_transfer',
              message: `${selectedTokenData.symbol} may be a fee-on-transfer token. The actual received amount may be less than expected.`,
              severity: 'warning',
            });
          }
        }
      } catch {
        // Ignore code check errors
      }

      // Check balance
      const requiredAmount = mode === 'single'
        ? parseFloat(amount || '0')
        : totalBatchAmount;
      const availableBalance = parseFloat(selectedTokenData.formattedBalance);

      if (requiredAmount > availableBalance) {
        warnings.push({
          type: 'low_balance',
          message: `Insufficient balance. You have ${availableBalance.toFixed(4)} ${selectedTokenData.symbol} but need ${requiredAmount.toFixed(4)}.`,
          severity: 'error',
        });
      }

      // Check recipients in batch mode
      if (mode === 'batch') {
        const invalidRecipients = batchRecipients.filter(r => !r.isValid);
        if (invalidRecipients.length > 0) {
          warnings.push({
            type: 'invalid_recipient',
            message: `${invalidRecipients.length} recipient(s) have invalid addresses or amounts.`,
            severity: 'error',
          });
        }

        const zeroAmounts = batchRecipients.filter(r => r.isValid && parseFloat(r.amount) === 0);
        if (zeroAmounts.length > 0) {
          warnings.push({
            type: 'zero_amount',
            message: `${zeroAmounts.length} recipient(s) have zero amounts.`,
            severity: 'error',
          });
        }
      } else {
        // Single mode checks
        if (recipient && !isAddress(recipient)) {
          warnings.push({
            type: 'invalid_recipient',
            message: 'Recipient address is invalid.',
            severity: 'error',
          });
        }
        if (recipient && recipient.toLowerCase() === address?.toLowerCase()) {
          warnings.push({
            type: 'invalid_recipient',
            message: 'Cannot create a stream to yourself.',
            severity: 'error',
          });
        }
      }

      setPreflightWarnings(warnings);
      setShowDryRun(true);
    } catch (err) {
      console.error('Preflight check failed:', err);
    } finally {
      setCheckingPreflight(false);
    }
  }, [selectedToken, selectedTokenData, mode, amount, totalBatchAmount, batchRecipients, recipient, address]);

  // Get timestamp from date and time inputs
  const getTimestamp = (date: string, time: string) => {
    if (!date) return 0;
    const dateTime = new Date(`${date}T${time || '12:00'}`);
    return Math.floor(dateTime.getTime() / 1000);
  };

  // Create single stream
  const handleCreateSingleStream = useCallback(async () => {
    if (!walletClient || !selectedTokenData || !TOKEN_STREAM_ADDRESS) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const amountWei = parseUnits(amount, selectedTokenData.decimals);
      const start = getTimestamp(startDate, startTime);
      const end = getTimestamp(endDate, endTime);
      const cliffDuration = parseInt(cliffMonths) * 30 * 24 * 60 * 60;

      // Approve tokens
      const approveHash = await walletClient.writeContract({
        address: selectedToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [TOKEN_STREAM_ADDRESS, amountWei],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash: approveHash });

      // Create stream
      const createHash = await walletClient.writeContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'createStream',
        args: [
          recipient as Address,
          selectedToken as Address,
          amountWei,
          BigInt(start),
          BigInt(end),
          BigInt(cliffDuration),
        ],
      });

      const receipt = await client.waitForTransactionReceipt({ hash: createHash });

      setResult({
        success: true,
        txHash: createHash,
        streamIds: ['View on explorer'],
      });

      // Clear form
      setRecipient('');
      setAmount('');
      setConfirmDialogOpen(false);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Stream creation failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [walletClient, selectedToken, selectedTokenData, recipient, amount, startDate, startTime, endDate, endTime, cliffMonths]);

  // Create batch streams
  const handleCreateBatchStreams = useCallback(async () => {
    if (!walletClient || !selectedTokenData || !TOKEN_STREAM_ADDRESS) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const validRecipients = batchRecipients.filter(r => r.isValid);
      const addresses = validRecipients.map(r => r.address as Address);
      const amounts = validRecipients.map(r => parseUnits(r.amount, selectedTokenData.decimals));
      const totalAmount = amounts.reduce((a, b) => a + b, 0n);

      const start = getTimestamp(batchStartDate, batchStartTime);
      const end = getTimestamp(batchEndDate, batchEndTime);
      const cliffDuration = parseInt(batchCliffMonths) * 30 * 24 * 60 * 60;

      // Approve total tokens
      const approveHash = await walletClient.writeContract({
        address: selectedToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [TOKEN_STREAM_ADDRESS, totalAmount],
      });

      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash: approveHash });

      // Create batch streams
      const createHash = await walletClient.writeContract({
        address: TOKEN_STREAM_ADDRESS,
        abi: STREAM_ABI,
        functionName: 'createStreamBatch',
        args: [
          addresses,
          selectedToken as Address,
          amounts,
          BigInt(start),
          BigInt(end),
          BigInt(cliffDuration),
        ],
      });

      await client.waitForTransactionReceipt({ hash: createHash });

      setResult({
        success: true,
        txHash: createHash,
        streamIds: [`${validRecipients.length} streams created`],
      });

      setBatchRecipients([]);
      setConfirmDialogOpen(false);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Batch stream creation failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [walletClient, selectedToken, selectedTokenData, batchRecipients, batchStartDate, batchStartTime, batchEndDate, batchEndTime, batchCliffMonths]);

  // Form validation
  const isSingleFormValid = selectedToken && recipient && amount && startDate && endDate &&
    isAddress(recipient) && recipient.toLowerCase() !== address?.toLowerCase() &&
    parseFloat(amount) > 0 && getTimestamp(startDate, startTime) >= Date.now() / 1000 &&
    getTimestamp(endDate, endTime) > getTimestamp(startDate, startTime);

  const isBatchFormValid = selectedToken && batchRecipients.length > 0 &&
    batchRecipients.some(r => r.isValid) && batchStartDate && batchEndDate &&
    getTimestamp(batchStartDate, batchStartTime) >= Date.now() / 1000 &&
    getTimestamp(batchEndDate, batchEndTime) > getTimestamp(batchStartDate, batchStartTime);

  // Get min date (now)
  const getMinDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Has errors in preflight
  const hasPreflightErrors = preflightWarnings.some(w => w.severity === 'error');

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/streams" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Streams
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Plus className="h-8 w-8 text-cyan-500" />
            Create Stream
          </h1>
          <p className="text-muted-foreground">
            Set up a new token stream with linear vesting
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
            <CardContent>
              <p className="text-sm text-amber-300/80">
                Deploy <code className="bg-white/10 px-1 rounded">contracts/TokenStream.sol</code> to Monad first.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Mode Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'batch')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Single Stream
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Batch (CSV)
            </TabsTrigger>
          </TabsList>

          {/* Single Stream */}
          <TabsContent value="single" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Stream Details</CardTitle>
                <CardDescription>
                  Create a stream to a single recipient
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading tokens...
                  </div>
                ) : (
                  <>
                    {/* Token Selection */}
                    <div className="space-y-2">
                      <Label>Token</Label>
                      <Select value={selectedToken} onValueChange={setSelectedToken}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select token to stream" />
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

                    {/* Recipient */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Recipient Address
                      </Label>
                      <Input
                        placeholder="0x..."
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </div>

                    {/* Amount */}
                    {selectedTokenData && (
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
                    )}

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Start Date
                        </Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          min={getMinDate()}
                        />
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || getMinDate()}
                        />
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Cliff */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Cliff Period
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
                        No tokens can be withdrawn until the cliff period ends
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={runPreflightCheck}
                        disabled={!isSingleFormValid || checkingPreflight || !isContractDeployed}
                        variant="outline"
                        className="flex-1"
                      >
                        {checkingPreflight ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Info className="mr-2 h-4 w-4" />
                        )}
                        Dry Run
                      </Button>
                      <Button
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={!isSingleFormValid || !isContractDeployed}
                        className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Create Stream
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Streams */}
          <TabsContent value="batch" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Stream</CardTitle>
                <CardDescription>
                  Create multiple streams from a CSV file or manual entry
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading tokens...
                  </div>
                ) : (
                  <>
                    {/* Token Selection */}
                    <div className="space-y-2">
                      <Label>Token (same for all streams)</Label>
                      <Select value={selectedToken} onValueChange={setSelectedToken}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select token to stream" />
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

                    {/* CSV Upload */}
                    <div className="space-y-2">
                      <Label>Upload Recipients (CSV)</Label>
                      <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-white/20 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload or drag & drop
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            CSV format: address,amount
                          </p>
                        </label>
                      </div>
                    </div>

                    {/* Recipients Table */}
                    {batchRecipients.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Recipients ({batchRecipients.length})</Label>
                          <div className="text-sm">
                            Total: <span className="font-bold">{totalBatchAmount.toFixed(4)}</span> {selectedTokenData?.symbol || 'tokens'}
                          </div>
                        </div>
                        <div className="border rounded-lg max-h-64 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batchRecipients.map((r, i) => (
                                <TableRow key={i}>
                                  <TableCell>
                                    <Input
                                      value={r.address}
                                      onChange={(e) => updateBatchRecipient(i, 'address', e.target.value)}
                                      placeholder="0x..."
                                      className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={r.amount}
                                      onChange={(e) => updateBatchRecipient(i, 'amount', e.target.value)}
                                      placeholder="0.0"
                                      className="h-8 w-24"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {r.isValid ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : r.error ? (
                                      <span className="text-xs text-destructive">{r.error}</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeBatchRecipient(i)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <Button variant="outline" size="sm" onClick={addBatchRecipient}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Row
                        </Button>
                      </div>
                    )}

                    {batchRecipients.length === 0 && (
                      <Button variant="outline" onClick={addBatchRecipient} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Recipients Manually
                      </Button>
                    )}

                    {/* Schedule (shared) */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Start Date
                        </Label>
                        <Input
                          type="date"
                          value={batchStartDate}
                          onChange={(e) => setBatchStartDate(e.target.value)}
                          min={getMinDate()}
                        />
                        <Input
                          type="time"
                          value={batchStartTime}
                          onChange={(e) => setBatchStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={batchEndDate}
                          onChange={(e) => setBatchEndDate(e.target.value)}
                          min={batchStartDate || getMinDate()}
                        />
                        <Input
                          type="time"
                          value={batchEndTime}
                          onChange={(e) => setBatchEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Cliff */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Cliff Period (all streams)
                      </Label>
                      <Select value={batchCliffMonths} onValueChange={setBatchCliffMonths}>
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
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={runPreflightCheck}
                        disabled={!isBatchFormValid || checkingPreflight || !isContractDeployed}
                        variant="outline"
                        className="flex-1"
                      >
                        {checkingPreflight ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Info className="mr-2 h-4 w-4" />
                        )}
                        Dry Run
                      </Button>
                      <Button
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={!isBatchFormValid || !isContractDeployed}
                        className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Create {batchRecipients.filter(r => r.isValid).length} Streams
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dry Run Results */}
        {showDryRun && (
          <Card className={hasPreflightErrors ? 'border-destructive' : 'border-green-500/30'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {hasPreflightErrors ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                Preflight Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preflightWarnings.length === 0 ? (
                <p className="text-green-400">All checks passed. Ready to create stream(s).</p>
              ) : (
                preflightWarnings.map((warning, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      warning.severity === 'error' ? 'bg-destructive/10' : 'bg-yellow-500/10'
                    }`}
                  >
                    <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                      warning.severity === 'error' ? 'text-destructive' : 'text-yellow-500'
                    }`} />
                    <p className="text-sm">{warning.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

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
                  <p className="font-medium">
                    {result.success ? 'Stream(s) Created!' : 'Creation Failed'}
                  </p>
                  {result.txHash && (
                    <a
                      href={`https://monadvision.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-500 hover:underline flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {result.error && (
                    <p className="text-sm text-destructive">{result.error}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Stream Creation</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                {mode === 'single' ? (
                  <>
                    <p>You are about to create a stream:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>{amount}</strong> {selectedTokenData?.symbol}</li>
                      <li>To: {recipient?.slice(0, 10)}...{recipient?.slice(-8)}</li>
                      <li>Duration: {startDate} to {endDate}</li>
                      {parseInt(cliffMonths) > 0 && <li>Cliff: {cliffMonths} month(s)</li>}
                    </ul>
                  </>
                ) : (
                  <>
                    <p>You are about to create {batchRecipients.filter(r => r.isValid).length} streams:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Total: <strong>{totalBatchAmount.toFixed(4)}</strong> {selectedTokenData?.symbol}</li>
                      <li>Duration: {batchStartDate} to {batchEndDate}</li>
                      {parseInt(batchCliffMonths) > 0 && <li>Cliff: {batchCliffMonths} month(s)</li>}
                    </ul>
                  </>
                )}
                <p className="text-amber-400 mt-4">
                  Streams cannot be cancelled once created.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={mode === 'single' ? handleCreateSingleStream : handleCreateBatchStreams}
                disabled={isExecuting}
                className="bg-gradient-to-r from-cyan-500 to-blue-500"
              >
                {isExecuting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </NetworkGuard>
  );
}
