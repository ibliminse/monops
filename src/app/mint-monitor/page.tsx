'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { truncateAddress } from '@/lib/utils';
import {
  createMintMonitor,
  getRecentMints,
  type MintEvent,
} from '@/features/mint-monitor';
import {
  Radio,
  Play,
  Square,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function MintMonitorPage() {
  const collections = useLiveQuery(() => db.collections.toArray()) ?? [];

  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [customAddress, setCustomAddress] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [mints, setMints] = useState<MintEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  const collectionAddress = selectedCollection || customAddress;
  const selectedCollectionData = collections.find((c) => c.address === selectedCollection);

  const handleLoadHistory = async () => {
    if (!collectionAddress) return;

    setIsLoadingHistory(true);
    const recentMints = await getRecentMints(collectionAddress);
    setMints(recentMints.reverse()); // Most recent first
    setIsLoadingHistory(false);
  };

  const handleStartMonitoring = useCallback(() => {
    if (!collectionAddress || isMonitoring) return;

    const monitor = createMintMonitor(collectionAddress, (event) => {
      setMints((prev) => [event, ...prev].slice(0, 100)); // Keep last 100
    });

    setUnsubscribe(() => monitor.unsubscribe);
    setIsMonitoring(true);
  }, [collectionAddress, isMonitoring]);

  const handleStopMonitoring = useCallback(() => {
    if (unsubscribe) {
      unsubscribe();
      setUnsubscribe(null);
    }
    setIsMonitoring(false);
  }, [unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [unsubscribe]);

  // Reset when collection changes
  useEffect(() => {
    handleStopMonitoring();
    setMints([]);
  }, [collectionAddress, handleStopMonitoring]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mint Monitor</h1>
          <p className="text-muted-foreground">
            Watch live mints for NFT collections
          </p>
        </div>
        {isMonitoring && (
          <Badge variant="success" className="animate-pulse">
            <Radio className="mr-1 h-3 w-3" />
            Live
          </Badge>
        )}
      </div>

      {/* Collection Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Collection</CardTitle>
          <CardDescription>
            Choose a watched collection or enter a custom address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Watched Collection</Label>
              <Select
                value={selectedCollection}
                onValueChange={(v) => {
                  setSelectedCollection(v);
                  setCustomAddress('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select collection" />
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

          <div className="flex gap-2">
            {!isMonitoring ? (
              <Button
                onClick={handleStartMonitoring}
                disabled={!collectionAddress}
              >
                <Play className="mr-2 h-4 w-4" />
                Start Monitoring
              </Button>
            ) : (
              <Button onClick={handleStopMonitoring} variant="destructive">
                <Square className="mr-2 h-4 w-4" />
                Stop Monitoring
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleLoadHistory}
              disabled={!collectionAddress || isLoadingHistory}
            >
              {isLoadingHistory ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load Recent Mints
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mints Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Mints
              {selectedCollectionData && ` - ${selectedCollectionData.name}`}
            </span>
            <Badge variant="secondary">{mints.length} events</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No mints detected yet.</p>
              <p className="text-sm">
                {isMonitoring
                  ? 'Waiting for new mints...'
                  : 'Start monitoring or load recent mints.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token ID</TableHead>
                  <TableHead>Minter</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mints.map((mint, index) => (
                  <TableRow key={`${mint.txHash}-${mint.tokenId}-${index}`}>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        #{mint.tokenId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm">{truncateAddress(mint.minter)}</code>
                        <a
                          href={`https://explorer.monad.xyz/address/${mint.minter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mint.blockNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(mint.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://explorer.monad.xyz/tx/${mint.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
