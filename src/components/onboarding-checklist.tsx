'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Wallet,
  Image,
  Camera,
  Send,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  completed: boolean;
}

export function OnboardingChecklist() {
  const { isConnected } = useAccount();
  const collections = useLiveQuery(() => db.collections.toArray()) ?? [];
  const batches = useLiveQuery(() => db.batches.toArray()) ?? [];

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('monops_onboarding_dismissed');
    if (isDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('monops_onboarding_dismissed', 'true');
    setDismissed(true);
  };

  const items: ChecklistItem[] = [
    {
      id: 'connect',
      label: 'Connect Wallet',
      description: 'Connect to Monad mainnet',
      href: '#',
      icon: Wallet,
      completed: isConnected,
    },
    {
      id: 'collection',
      label: 'View Inventory',
      description: 'Browse your NFT holdings',
      href: '/inventory',
      icon: Image,
      completed: collections.length > 0,
    },
    {
      id: 'snapshot',
      label: 'Take a Snapshot',
      description: 'Export holder data',
      href: '/snapshots',
      icon: Camera,
      completed: false,
    },
    {
      id: 'batch',
      label: 'Run a Batch',
      description: 'Transfer or disperse tokens',
      href: '/transfer',
      icon: Send,
      completed: batches.length > 0,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  if (dismissed || completedCount === items.length) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.05]">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl" />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400/80" />
            <h3 className="font-semibold text-white/90">Getting Started</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/30 hover:text-white/60 hover:bg-white/[0.05]"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <Progress value={progress} className="h-1.5 flex-1 bg-white/[0.05]" />
          <span className="text-xs text-white/40">
            {completedCount}/{items.length}
          </span>
        </div>

        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-xl transition-all duration-300 cursor-pointer",
                  item.completed
                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'hover:bg-white/[0.05]'
                )}
              >
                {item.completed ? (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-white/20" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium",
                    item.completed ? 'text-emerald-400/80' : 'text-white/70'
                  )}>
                    {item.label}
                  </div>
                  <div className="text-xs text-white/30 truncate">
                    {item.description}
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1",
                  item.completed ? 'text-emerald-400/50' : 'text-white/30'
                )} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
