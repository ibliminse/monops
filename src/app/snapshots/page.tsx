'use client';

import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
import { db } from '@/lib/db';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress } from '@/lib/utils';
import {
  exportSnapshotCSV,
  type HolderSnapshot,
  type SnapshotProgress,
} from '@/features/snapshots';
import {
  Camera,
  Download,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';

export default function SnapshotsPage() {
  const collections = useLiveQuery(() => db.collections.toArray()) ?? [];
  const limits = getPlanLimits();

  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [customAddress, setCustomAddress] = useState('');
  const [excludeZero, setExcludeZero] = useState(true);
  const [excludeContracts, setExcludeContracts] = useState(false);
  const [includeTokenIds, setIncludeTokenIds] = useState(true);

  const [isBuilding, setIsBuilding] = useState(false);
  const [progress, setProgress] = useState<SnapshotProgress | null>(null);
  const [snapshot, setSnapshot] = useState<HolderSnapshot[] | null>(null);
  const [snapshotName, setSnapshotName] = useState('');

  const handleBuildSnapshot = useCallback(async () => {
    const address = selectedCollection || customAddress;
    if (!address) return;

    setIsBuilding(true);
    setProgress({ stage: 'fetching', currentBlock: 0n, targetBlock: 0n, holdersFound: 0 });
    setSnapshot(null);

    // Set snapshot name
    const watchedCollection = collections.find((c) => c.address.toLowerCase() === address.toLowerCase());
    if (watchedCollection) {
      setSnapshotName(watchedCollection.name);
    } else {
      setSnapshotName(`Collection-${truncateAddress(address)}`);
    }

    try {
      // Use API to fetch holders via Moralis
      const response = await fetch(`/api/snapshot?collection=${address}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to build snapshot');
      }

      setProgress({ stage: 'processing', currentBlock: 0n, targetBlock: 0n, holdersFound: data.totalHolders });

      // Filter results based on options
      let holders: HolderSnapshot[] = data.holders;

      // Exclude contracts if requested (this would require additional API calls)
      // For now, we skip this as it's slow and Moralis already filters most

      // Map to expected format
      holders = holders.map((h: { address: string; count: number; tokenIds: string[] }) => ({
        address: h.address,
        count: h.count,
        tokenIds: includeTokenIds ? h.tokenIds : [],
      }));

      setSnapshot(holders);
      setProgress({ stage: 'complete', currentBlock: 0n, targetBlock: 0n, holdersFound: holders.length });
    } catch (error) {
      console.error('Snapshot error:', error);
      setProgress({
        stage: 'error',
        currentBlock: 0n,
        targetBlock: 0n,
        holdersFound: 0,
        error: error instanceof Error ? error.message : 'Failed to build snapshot',
      });
    }

    setIsBuilding(false);
  }, [selectedCollection, customAddress, collections, includeTokenIds]);

  const handleExport = () => {
    if (!snapshot) return;
    exportSnapshotCSV(snapshot, snapshotName, includeTokenIds);
  };

  const collectionAddress = selectedCollection || customAddress;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holder Snapshots</h1>
          <p className="text-muted-foreground">
            Build and export holder lists for NFT collections
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot Configuration</CardTitle>
          <CardDescription>
            Select a collection and configure snapshot options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Watched Collection</Label>
              <Select value={selectedCollection} onValueChange={(v) => {
                setSelectedCollection(v);
                setCustomAddress('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a watched collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.address}>
                      {c.name} ({truncateAddress(c.address)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Or Custom Address</Label>
              <Input
                placeholder="0x..."
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value);
                  setSelectedCollection('');
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={excludeZero}
                onChange={(e) => setExcludeZero(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Exclude zero/burn addresses</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={excludeContracts}
                onChange={(e) => setExcludeContracts(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Exclude contracts (slower)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeTokenIds}
                onChange={(e) => setIncludeTokenIds(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Include token IDs</span>
            </label>
          </div>

          <Button
            onClick={handleBuildSnapshot}
            disabled={!collectionAddress || isBuilding}
            className="w-full md:w-auto"
          >
            {isBuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building Snapshot...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Build Snapshot
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {progress && progress.stage !== 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{progress.stage}</span>
              <span>{progress.holdersFound} holders found</span>
            </div>
            {progress.stage === 'fetching' && (
              <Progress
                value={
                  Number(
                    ((progress.currentBlock - (progress.targetBlock - BigInt(500000))) * 100n) /
                      BigInt(500000)
                  )
                }
              />
            )}
            {progress.error && (
              <p className="text-sm text-destructive">{progress.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {snapshot && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Snapshot Results</CardTitle>
              <CardDescription>
                {snapshot.length} unique holders found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Export limit: {limits.maxExportRows} rows
              </Badge>
              <Button onClick={handleExport} size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {snapshot.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No holders found for this collection.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    {includeTokenIds && <TableHead>Token IDs</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.slice(0, 100).map((holder, index) => (
                    <TableRow key={holder.address}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {truncateAddress(holder.address, 8)}
                          </code>
                          <a
                            href={`https://monadvision.com/address/${holder.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {holder.count}
                      </TableCell>
                      {includeTokenIds && (
                        <TableCell>
                          <div className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {holder.tokenIds.slice(0, 5).join(', ')}
                            {holder.tokenIds.length > 5 && ` +${holder.tokenIds.length - 5} more`}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {snapshot.length > 100 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing 100 of {snapshot.length} holders. Export CSV for full list.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
