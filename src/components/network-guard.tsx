'use client';

import { useNetworkGuard } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { MONAD_CHAIN_ID } from '@/lib/chain';

interface NetworkGuardProps {
  children: React.ReactNode;
  requireConnection?: boolean;
}

export function NetworkGuard({ children, requireConnection = false }: NetworkGuardProps) {
  const { isConnected, isCorrectNetwork, switchToMonad } = useNetworkGuard();

  // If connection is required but user isn't connected
  if (requireConnection && !isConnected) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Wallet Required
          </CardTitle>
          <CardDescription>
            Please connect your wallet to use this feature.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // If connected but wrong network
  if (isConnected && !isCorrectNetwork) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Wrong Network
          </CardTitle>
          <CardDescription>
            This app only supports Monad Mainnet (Chain ID: {MONAD_CHAIN_ID}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={switchToMonad} className="w-full">
            Switch to Monad Mainnet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
