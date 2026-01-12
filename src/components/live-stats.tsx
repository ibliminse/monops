'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, formatGwei } from 'viem';
import { monadMainnet } from '@/lib/chain';
import { Activity, Fuel, Clock, Zap } from 'lucide-react';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

export function LiveStats() {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [block, gas] = await Promise.all([
          client.getBlockNumber(),
          client.getGasPrice(),
        ]);
        setBlockNumber(block);
        setGasPrice(gas);
        setIsLive(true);
      } catch (e) {
        setIsLive(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-muted-foreground">
          {isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      {blockNumber && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span className="font-mono">{blockNumber.toLocaleString()}</span>
        </div>
      )}

      {gasPrice && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Fuel className="h-3.5 w-3.5" />
          <span className="font-mono">{formatGwei(gasPrice)} gwei</span>
        </div>
      )}
    </div>
  );
}
