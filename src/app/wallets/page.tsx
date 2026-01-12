'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { db } from '@/lib/db';
import { getPlanLimits } from '@/lib/db/plan';
import { truncateAddress, isValidAddress } from '@/lib/utils';
import {
  addWallet,
  updateWallet,
  removeWallet,
  setConnectedWallet,
} from '@/features/wallet-library';
import { Plus, Trash2, Edit2, Check, X, Wallet, ExternalLink } from 'lucide-react';

export default function WalletsPage() {
  const { address: connectedAddress } = useAccount();
  const wallets = useLiveQuery(() => db.wallets.orderBy('addedAt').toArray()) ?? [];
  const limits = getPlanLimits();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Sync connected wallet
  useState(() => {
    if (connectedAddress) {
      setConnectedWallet(connectedAddress);
    }
  });

  const handleAddWallet = async () => {
    setAddError(null);

    if (!newAddress) {
      setAddError('Address is required');
      return;
    }

    const result = await addWallet({
      address: newAddress,
      label: newLabel,
    });

    if ('code' in result) {
      setAddError(result.message);
      return;
    }

    setNewAddress('');
    setNewLabel('');
    setIsAddDialogOpen(false);
  };

  const handleUpdateLabel = async (id: number) => {
    await updateWallet(id, { label: editLabel });
    setEditingId(null);
    setEditLabel('');
  };

  const handleRemoveWallet = async (id: number) => {
    await removeWallet(id);
  };

  const startEdit = (id: number, currentLabel: string) => {
    setEditingId(id);
    setEditLabel(currentLabel);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet Library</h1>
          <p className="text-muted-foreground">
            Manage wallet addresses for tracking and batch operations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={wallets.length >= limits.maxStoredWallets}>
              <Plus className="mr-2 h-4 w-4" />
              Add Wallet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Wallet</DialogTitle>
              <DialogDescription>
                Add a wallet address to track its NFT holdings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  placeholder="My Wallet"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              {addError && (
                <p className="text-sm text-destructive">{addError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddWallet}>Add Wallet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Stored Wallets</span>
            <Badge variant="secondary">
              {wallets.length} / {limits.maxStoredWallets}
            </Badge>
          </CardTitle>
          <CardDescription>
            {connectedAddress && (
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Connected: {truncateAddress(connectedAddress)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No wallets added yet.</p>
              <p className="text-sm">Add a wallet to start tracking NFT holdings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      {editingId === wallet.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="h-8 w-40"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleUpdateLabel(wallet.id!)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">{wallet.label}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {truncateAddress(wallet.address, 6)}
                      </code>
                      <a
                        href={`https://explorer.monad.xyz/address/${wallet.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {wallet.isConnected ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Badge variant="secondary">Watching</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(wallet.addedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(wallet.id!, wallet.label)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveWallet(wallet.id!)}
                          disabled={wallet.isConnected}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
