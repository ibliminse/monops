'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NetworkGuard } from '@/components/network-guard';
import { db } from '@/lib/db';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress, formatMon } from '@/lib/utils';
import {
  preflightNFTTransfers,
  executeNFTTransfers,
  type NFTTransferItem,
  type PreflightResult,
} from '@/lib/batch-engine';
import {
  Send,
  Upload,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export default function TransferPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const collections = useLiveQuery(() => db.collections.toArray()) ?? [];
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];
  const limits = getPlanLimits();

  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [csvInput, setCsvInput] = useState('');
  const [items, setItems] = useState<NFTTransferItem[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{
    current: number;
    total: number;
    results: { index: number; status: 'success' | 'failed'; txHash?: string; error?: string }[];
  } | null>(null);

  const selectedCollectionData = collections.find((c) => c.address === selectedCollection);
  const myHoldings = holdings.filter(
    (h) =>
      h.collectionAddress === selectedCollection &&
      h.ownerAddress === address?.toLowerCase()
  );

  const handleCSVParse = () => {
    if (!selectedCollection || !selectedCollectionData) return;

    const parsed = Papa.parse<string[]>(csvInput.trim(), {
      skipEmptyLines: true,
    });

    const newItems: NFTTransferItem[] = [];
    for (const row of parsed.data) {
      if (row.length >= 2) {
        const [to, tokenId, amount] = row;
        newItems.push({
          to: to.trim(),
          tokenId: tokenId.trim(),
          amount: selectedCollectionData.type === 'ERC1155' ? parseInt(amount || '1') : undefined,
          collectionAddress: selectedCollection,
          collectionType: selectedCollectionData.type,
        });
      }
    }

    // Apply plan limits
    setItems(newItems.slice(0, limits.maxBatchSize));
    setPreflight(null);
  };

  const handleRunPreflight = async () => {
    if (!address || items.length === 0) return;

    setIsRunningPreflight(true);
    const result = await preflightNFTTransfers(items, address);
    setPreflight(result);
    setIsRunningPreflight(false);
  };

  const handleExecute = useCallback(async () => {
    if (!address || !walletClient || items.length === 0) return;

    setIsExecuting(true);
    setExecutionProgress({ current: 0, total: items.length, results: [] });

    await executeNFTTransfers(items, address, walletClient, {
      onItemStart: (index) => {
        setExecutionProgress((prev) =>
          prev ? { ...prev, current: index + 1 } : null
        );
      },
      onItemComplete: (index, txHash) => {
        setExecutionProgress((prev) =>
          prev
            ? {
                ...prev,
                results: [...prev.results, { index, status: 'success', txHash }],
              }
            : null
        );
      },
      onItemFailed: (index, error) => {
        setExecutionProgress((prev) =>
          prev
            ? {
                ...prev,
                results: [...prev.results, { index, status: 'failed', error }],
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
    });
  }, [address, walletClient, items]);

  return (
    <NetworkGuard requireConnection>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mass Transfer</h1>
            <p className="text-muted-foreground">
              Batch transfer NFTs to multiple recipients
            </p>
          </div>
          <Badge variant="secondary">
            Max {limits.maxBatchSize} items per batch
          </Badge>
        </div>

        {/* Collection Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Collection</CardTitle>
            <CardDescription>
              Choose a collection you own NFTs from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Collection</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((c) => (
                      <SelectItem key={c.id} value={c.address}>
                        {c.name} ({c.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCollection && (
                <div className="space-y-2">
                  <Label>Your Holdings</Label>
                  <div className="text-sm text-muted-foreground">
                    {myHoldings.length} NFTs owned
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CSV Input */}
        {selectedCollection && (
          <Card>
            <CardHeader>
              <CardTitle>Transfer List</CardTitle>
              <CardDescription>
                Paste CSV data: recipient,tokenId{selectedCollectionData?.type === 'ERC1155' ? ',amount' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`0x123...abc,1${selectedCollectionData?.type === 'ERC1155' ? ',1' : ''}\n0x456...def,2${selectedCollectionData?.type === 'ERC1155' ? ',5' : ''}`}
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
                    disabled={isRunningPreflight}
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
        )}

        {/* Parsed Items Preview */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Transfer Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Token ID</TableHead>
                    {selectedCollectionData?.type === 'ERC1155' && (
                      <TableHead>Amount</TableHead>
                    )}
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
                        <TableCell>#{item.tokenId}</TableCell>
                        {selectedCollectionData?.type === 'ERC1155' && (
                          <TableCell>{item.amount}</TableCell>
                        )}
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
                  <div className="text-muted-foreground">Estimated Gas</div>
                  <div className="font-medium">{preflight.estimatedGas.toString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Estimated Cost</div>
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
                      <Send className="mr-2 h-4 w-4" />
                      Execute Transfers
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
