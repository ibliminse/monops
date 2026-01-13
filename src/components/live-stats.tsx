'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, formatGwei } from 'viem';
import { monadMainnet } from '@/lib/chain';
import { Tooltip } from '@/components/ui/tooltip';
import { Activity, Fuel, Zap, Clock, DollarSign } from 'lucide-react';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

export function LiveStats() {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [blockTime, setBlockTime] = useState<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [monPrice, setMonPrice] = useState<number | null>(null);
  const [monChange24h, setMonChange24h] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Fetch chain stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [block, gas] = await Promise.all([
          client.getBlock(),
          client.getGasPrice(),
        ]);
        setBlockNumber(block.number);
        setGasPrice(gas);
        setIsLive(true);

        // Calculate block time (seconds since this block)
        const now = Math.floor(Date.now() / 1000);
        const blockTimestamp = Number(block.timestamp);
        setBlockTime(now - blockTimestamp);

        // Estimate TPS from transaction count in block and block time
        // Get previous block to calculate actual block interval
        if (block.number > 1n) {
          const prevBlock = await client.getBlock({ blockNumber: block.number - 1n });
          const interval = Number(block.timestamp - prevBlock.timestamp);
          if (interval > 0) {
            const txCount = block.transactions.length;
            setTps(Math.round((txCount / interval) * 10) / 10);
          }
        }
      } catch (e) {
        setIsLive(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch MON price from CoinGecko
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await res.json();
        if (data.monad?.usd) {
          setMonPrice(data.monad.usd);
          setMonChange24h(data.monad.usd_24h_change ?? null);
        }
      } catch (e) {
        // Price fetch failed, not critical
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Update price every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-5 text-sm">
      <Tooltip content={isLive ? 'Connected to Monad RPC' : 'RPC connection failed'}>
        <div className="flex items-center gap-2 cursor-default">
          <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-muted-foreground">
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </Tooltip>

      {monPrice && (
        <Tooltip content="MON price (24h change)">
          <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="font-mono">${monPrice.toFixed(4)}</span>
            {monChange24h !== null && (
              <span className={`font-mono text-xs ${monChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {monChange24h >= 0 ? '+' : ''}{monChange24h.toFixed(2)}%
              </span>
            )}
          </div>
        </Tooltip>
      )}

      {blockNumber && (
        <Tooltip content="Current Monad block number">
          <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
            <Activity className="h-3.5 w-3.5" />
            <span className="font-mono">{blockNumber.toLocaleString()}</span>
          </div>
        </Tooltip>
      )}

      {blockTime !== null && (
        <Tooltip content="Time since last block">
          <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">{blockTime < 60 ? `${blockTime}s` : `${Math.floor(blockTime / 60)}m`}</span>
          </div>
        </Tooltip>
      )}

      {tps !== null && (
        <Tooltip content="Transactions per second (estimated)">
          <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
            <Zap className="h-3.5 w-3.5" />
            <span className="font-mono">{tps} TPS</span>
          </div>
        </Tooltip>
      )}

      {gasPrice && (
        <Tooltip content="Current gas price on Monad">
          <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
            <Fuel className="h-3.5 w-3.5" />
            <span className="font-mono">{formatGwei(gasPrice)} gwei</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
