'use client';

import { useState, useEffect, useRef } from 'react';
import { formatGwei } from 'viem';
import { getPublicClient } from '@/lib/chain';
import { Tooltip } from '@/components/ui/tooltip';
import { Activity, Fuel, Zap, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const client = getPublicClient();

export function LiveStats() {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

        // Estimate TPS from transaction count in block
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

  return (
    <div ref={containerRef} className="relative">
      {/* Mobile: Compact pill that expands */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs"
        whileTap={{ scale: 0.97 }}
      >
        <div className={cn(
          "h-1.5 w-1.5 rounded-full",
          isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
        )} />
        <span className="text-white/60 font-medium">
          {isLive ? 'Live' : 'Offline'}
        </span>
        <ChevronDown className={cn(
          "h-3 w-3 text-white/40 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </motion.button>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="md:hidden absolute right-0 top-full mt-2 p-3 rounded-xl bg-[#12121a] border border-white/[0.1] shadow-xl shadow-black/50 min-w-[180px] z-50"
          >
            <div className="space-y-2.5">
              {blockNumber && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="text-xs">Block</span>
                  </div>
                  <span className="font-mono text-xs text-white/80">{blockNumber.toLocaleString()}</span>
                </div>
              )}
              {tps !== null && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs">TPS</span>
                  </div>
                  <span className="font-mono text-xs text-white/80">{tps}</span>
                </div>
              )}
              {gasPrice && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50">
                    <Fuel className="h-3.5 w-3.5" />
                    <span className="text-xs">Gas</span>
                  </div>
                  <span className="font-mono text-xs text-white/80">{formatGwei(gasPrice)} gwei</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop: Full inline stats */}
      <div className="hidden md:flex items-center gap-4 text-sm">
        <Tooltip content={isLive ? 'Connected to Monad RPC' : 'RPC connection failed'}>
          <div className="flex items-center gap-2 cursor-default">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            )} />
            <span className="text-white/50">{isLive ? 'Live' : 'Offline'}</span>
          </div>
        </Tooltip>

        {blockNumber && (
          <Tooltip content="Current block">
            <div className="flex items-center gap-1.5 text-white/40 cursor-default">
              <Activity className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{blockNumber.toLocaleString()}</span>
            </div>
          </Tooltip>
        )}

        {tps !== null && (
          <Tooltip content="Transactions per second">
            <div className="flex items-center gap-1.5 text-white/40 cursor-default">
              <Zap className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{tps} TPS</span>
            </div>
          </Tooltip>
        )}

        {gasPrice && (
          <Tooltip content="Gas price">
            <div className="flex items-center gap-1.5 text-white/40 cursor-default">
              <Fuel className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{formatGwei(gasPrice)}</span>
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
