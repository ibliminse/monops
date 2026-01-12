'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import { createPublicClient, http } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';
import { monadMainnet, MONAD_CHAIN_ID } from '@/lib/chain';
import { getCurrentPlan, setCurrentPlan, getPlanLimits, type PlanType } from '@/lib/db/plan';
import { formatMon, truncateAddress } from '@/lib/utils';
import {
  Settings,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

export default function DeveloperPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  const wallets = useLiveQuery(() => db.wallets.toArray()) ?? [];
  const collections = useLiveQuery(() => db.collections.toArray()) ?? [];
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];
  const batches = useLiveQuery(() => db.batches.toArray()) ?? [];

  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [isLoadingBlock, setIsLoadingBlock] = useState(false);
  const [plan, setPlan] = useState<PlanType>('free');
  const limits = getPlanLimits();

  useEffect(() => {
    setPlan(getCurrentPlan());
  }, []);

  const fetchCurrentBlock = async () => {
    setIsLoadingBlock(true);
    try {
      const block = await client.getBlockNumber();
      setCurrentBlock(block);
    } catch (e) {
      console.error('Failed to fetch block:', e);
    }
    setIsLoadingBlock(false);
  };

  useEffect(() => {
    fetchCurrentBlock();
    const interval = setInterval(fetchCurrentBlock, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTogglePlan = () => {
    const newPlan = plan === 'free' ? 'pro' : 'free';
    setCurrentPlan(newPlan);
    setPlan(newPlan);
  };

  const handleClearDB = async (table: string) => {
    if (!confirm(`Are you sure you want to clear all ${table}?`)) return;

    switch (table) {
      case 'wallets':
        await db.wallets.clear();
        break;
      case 'collections':
        await db.collections.clear();
        break;
      case 'holdings':
        await db.holdings.clear();
        break;
      case 'batches':
        await db.batches.clear();
        break;
      case 'transfers':
        await db.transfers.clear();
        break;
      case 'all':
        await db.wallets.clear();
        await db.collections.clear();
        await db.holdings.clear();
        await db.batches.clear();
        await db.transfers.clear();
        await db.syncState.clear();
        break;
    }
  };

  const envVars = [
    { key: 'NEXT_PUBLIC_MONAD_RPC_URL', value: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'Not set' },
    { key: 'NEXT_PUBLIC_MONAD_WS_URL', value: process.env.NEXT_PUBLIC_MONAD_WS_URL || 'Not set' },
    { key: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', value: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? '****' : 'Not set' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Developer</h1>
          <p className="text-muted-foreground">
            Debug info, configuration, and database management
          </p>
        </div>
        <Badge variant="outline">
          <Settings className="mr-1 h-3 w-3" />
          Debug Mode
        </Badge>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Wallet Connected</Label>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>{isConnected ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Address</Label>
              <div className="mt-1 font-mono text-sm">
                {address ? truncateAddress(address, 6) : 'N/A'}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Chain ID</Label>
              <div className="flex items-center gap-2 mt-1">
                <span>{chainId ?? 'N/A'}</span>
                {chainId === MONAD_CHAIN_ID ? (
                  <Badge variant="success">Monad</Badge>
                ) : chainId ? (
                  <Badge variant="destructive">Wrong Chain</Badge>
                ) : null}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Balance</Label>
              <div className="mt-1">
                {balance ? `${formatMon(balance.value)} MON` : 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chain Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Chain Information</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCurrentBlock}
              disabled={isLoadingBlock}
            >
              {isLoadingBlock ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Network</Label>
              <div className="mt-1 font-medium">{monadMainnet.name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Chain ID</Label>
              <div className="mt-1 font-mono">{monadMainnet.id}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Currency</Label>
              <div className="mt-1">{monadMainnet.nativeCurrency.symbol}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Current Block</Label>
              <div className="mt-1 font-mono">
                {currentBlock?.toString() ?? 'Loading...'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envVars.map((env) => (
                <TableRow key={env.key}>
                  <TableCell className="font-mono text-sm">{env.key}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {env.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plan Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Settings</CardTitle>
          <CardDescription>
            Toggle between Free and Pro plans for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Current Plan</Label>
              <div className="mt-1">
                <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
                  {plan === 'pro' ? 'Pro' : 'Free'}
                </Badge>
              </div>
            </div>
            <Button onClick={handleTogglePlan} variant="outline">
              Switch to {plan === 'pro' ? 'Free' : 'Pro'}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Max Batch Size</div>
              <div className="font-medium">{limits.maxBatchSize}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max Export Rows</div>
              <div className="font-medium">{limits.maxExportRows}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max Collections</div>
              <div className="font-medium">{limits.maxWatchedCollections}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max Wallets</div>
              <div className="font-medium">{limits.maxStoredWallets}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Records</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Wallets</TableCell>
                <TableCell>{wallets.length}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearDB('wallets')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Collections</TableCell>
                <TableCell>{collections.length}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearDB('collections')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Holdings</TableCell>
                <TableCell>{holdings.length}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearDB('holdings')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Batches</TableCell>
                <TableCell>{batches.length}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearDB('batches')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-4">
            <Button
              variant="destructive"
              onClick={() => handleClearDB('all')}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
