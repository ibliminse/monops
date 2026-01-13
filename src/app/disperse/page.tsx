'use client';

import { useState, useCallback } from 'react';
import { useAccount, useBalance, useWalletClient } from 'wagmi';
import Papa from 'papaparse';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NetworkGuard } from '@/components/network-guard';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress, formatMon } from '@/lib/utils';
import {
  preflightDisperseMon,
  preflightDisperseERC20,
  executeDisperseMon,
  executeDisperseERC20,
  type DisperseItem,
  type PreflightResult,
} from '@/lib/batch-engine';
import {
  Coins,
  Upload,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export default function DispersePage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: walletClient } = useWalletClient();
  const limits = getPlanLimits();

  const [activeTab, setActiveTab] = useState<'mon' | 'erc20'>('mon');
  const [tokenAddress, setTokenAddress] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [items, setItems] = useState<DisperseItem[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<{ symbol: string; decimals: number } | null>(null);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{
    current: number;
    total: number;
    results: { index: number; status: 'success' | 'failed'; txHash?: string; error?: string }[];
  } | null>(null);

  const handleCSVParse = () => {
    const parsed = Papa.parse<string[]>(csvInput.trim(), {
      skipEmptyLines: true,
    });

    const newItems: DisperseItem[] = [];
    for (const row of parsed.data) {
      if (row.length >= 2) {
        const [to, amountStr] = row;
        try {
          // Parse amount based on token type
          const amount = activeTab === 'mon'
            ? parseEther(amountStr.trim()).toString()
            : parseUnits(amountStr.trim(), tokenMetadata?.decimals ?? 18).toString();

          newItems.push({
            to: to.trim(),
            amount,
          });
        } catch {
          // Skip invalid amounts
        }
      }
    }

    setItems(newItems.slice(0, limits.maxBatchSize));
    setPreflight(null);
  };

  const handleRunPreflight = async () => {
    if (!address || items.length === 0) return;

    setIsRunningPreflight(true);

    if (activeTab === 'mon') {
      const result = await preflightDisperseMon(items, address);
      setPreflight(result);
    } else {
      if (!tokenAddress) {
        setIsRunningPreflight(false);
        return;
      }
      const result = await preflightDisperseERC20(items, address, tokenAddress);
      setPreflight(result);
      setTokenMetadata({ symbol: result.tokenMetadata.tokenSymbol, decimals: result.tokenMetadata.tokenDecimals });
    }

    setIsRunningPreflight(false);
  };

  const handleExecute = useCallback(async () => {
    if (!address || !walletClient || items.length === 0) return;

    setIsExecuting(true);
    setExecutionProgress({ current: 0, total: items.length, results: [] });

    const callbacks = {
      onItemStart: (index: number) => {
        setExecutionProgress((prev) =>
          prev ? { ...prev, current: index + 1 } : null
        );
      },
      onItemComplete: (index: number, txHash: string) => {
        setExecutionProgress((prev) =>
          prev
            ? {
                ...prev,
                results: [...prev.results, { index, status: 'success' as const, txHash }],
              }
            : null
        );
      },
      onItemFailed: (index: number, error: string) => {
        setExecutionProgress((prev) =>
          prev
            ? {
                ...prev,
                results: [...prev.results, { index, status: 'failed' as const, error }],
              }
            : null
        );
      },
      onBatchComplete: () => {
        setIsExecuting(false);
      },
      onBatchFailed: () => {
        setIsExecuting(false);
      },
    };

    if (activeTab === 'mon') {
      await executeDisperseMon(items, address, walletClient, callbacks);
    } else {
      await executeDisperseERC20(items, address, tokenAddress, walletClient, callbacks);
    }
  }, [address, walletClient, items, activeTab, tokenAddress]);

  const totalAmount = items.reduce((sum, item) => sum + BigInt(item.amount), 0n);

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Disperse</h1>
            <p className="text-muted-foreground">
              Send MON or ERC-20 tokens to multiple recipients
            </p>
          </div>
          <Badge variant="secondary">
            Max {limits.maxBatchSize} items per batch
          </Badge>
        </div>

        {/* Token Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Token Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as 'mon' | 'erc20');
              setItems([]);
              setPreflight(null);
              setCsvInput('');
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mon">MON (Native)</TabsTrigger>
                <TabsTrigger value="erc20">ERC-20 Token</TabsTrigger>
              </TabsList>
              <TabsContent value="mon" className="mt-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">Your MON Balance</div>
                    <div className="text-2xl font-bold">
                      {balance ? formatEther(balance.value) : '0'} MON
                    </div>
                  </div>
                  <Coins className="h-10 w-10 text-muted-foreground" />
                </div>
              </TabsContent>
              <TabsContent value="erc20" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token-address">Token Contract Address</Label>
                  <Input
                    id="token-address"
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                  />
                </div>
                {tokenMetadata && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="font-medium">Token: {tokenMetadata.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      Decimals: {tokenMetadata.decimals}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* CSV Input */}
        <Card>
          <CardHeader>
            <CardTitle>Recipients List</CardTitle>
            <CardDescription>
              Paste CSV data: address,amount (amount in {activeTab === 'mon' ? 'MON' : 'tokens'})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`0x123...abc,1.5\n0x456...def,2.0`}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              className="font-mono text-sm h-32"
            />
            <div className="flex gap-2">
              <Button onClick={handleCSVParse} variant="secondary">
                <Upload className="mr-2 h-4 w-4" />
                Parse CSV
              </Button>
              {items.length > 0 && (
                <Button
                  onClick={handleRunPreflight}
                  disabled={isRunningPreflight || (activeTab === 'erc20' && !tokenAddress)}
                >
                  {isRunningPreflight ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  )}
                  Run Preflight Check
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parsed Items Preview */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recipients ({items.length})</span>
                <div className="text-sm font-normal">
                  Total: {activeTab === 'mon'
                    ? `${formatEther(totalAmount)} MON`
                    : `${formatUnits(totalAmount, tokenMetadata?.decimals ?? 18)} ${tokenMetadata?.symbol ?? 'tokens'}`
                  }
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 50).map((item, index) => {
                    const preflightItem = preflight?.itemResults.find((r) => r.index === index);
                    const execResult = executionProgress?.results.find((r) => r.index === index);
                    return (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <code className="text-sm">{truncateAddress(item.to)}</code>
                        </TableCell>
                        <TableCell>
                          {activeTab === 'mon'
                            ? `${formatEther(BigInt(item.amount))} MON`
                            : `${formatUnits(BigInt(item.amount), tokenMetadata?.decimals ?? 18)} ${tokenMetadata?.symbol ?? ''}`
                          }
                        </TableCell>
                        <TableCell>
                          {execResult ? (
                            execResult.status === 'success' ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <a
                                  href={`https://monadvision.com/tx/${execResult.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs text-destructive truncate max-w-[100px]">
                                  {execResult.error}
                                </span>
                              </div>
                            )
                          ) : preflightItem ? (
                            preflightItem.valid ? (
                              <Badge variant="success">Valid</Badge>
                            ) : (
                              <Badge variant="destructive">{preflightItem.error}</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {items.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing 50 of {items.length} items
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preflight Results */}
        {preflight && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {preflight.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Preflight Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Valid Items</div>
                  <div className="font-medium">
                    {preflight.itemResults.filter((r) => r.valid).length} / {items.length}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Amount</div>
                  <div className="font-medium">
                    {activeTab === 'mon'
                      ? `${formatEther(totalAmount)} MON`
                      : `${formatUnits(totalAmount, tokenMetadata?.decimals ?? 18)} ${tokenMetadata?.symbol ?? ''}`
                    }
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Est. Gas Cost</div>
                  <div className="font-medium">{formatMon(preflight.estimatedTotal)} MON</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Errors</div>
                  <div className="font-medium">{preflight.errors.length}</div>
                </div>
              </div>

              {preflight.errors.length > 0 && (
                <div className="space-y-2">
                  <Label>Errors</Label>
                  {preflight.errors.map((error, i) => (
                    <div key={i} className="text-sm text-destructive">
                      {error.index >= 0 ? `Item ${error.index + 1}: ` : ''}{error.message}
                    </div>
                  ))}
                </div>
              )}

              {preflight.valid && (
                <Button onClick={handleExecute} disabled={isExecuting} className="w-full">
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Coins className="mr-2 h-4 w-4" />
                      Execute Disperse
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Execution Progress */}
        {executionProgress && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={(executionProgress.results.length / executionProgress.total) * 100}
              />
              <div className="flex justify-between text-sm">
                <span>
                  {executionProgress.results.filter((r) => r.status === 'success').length} succeeded
                </span>
                <span>
                  {executionProgress.results.filter((r) => r.status === 'failed').length} failed
                </span>
                <span>
                  {executionProgress.total - executionProgress.results.length} remaining
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </NetworkGuard>
  );
}
