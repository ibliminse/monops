'use client';

import { useAccount, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { formatEther } from 'viem';
import { AnimatedGradient } from '@/components/ui/animated-gradient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { useNetworkGuard, useWalletSync } from '@/hooks';
import { db } from '@/lib/db';
import { getCurrentPlan, getPlanLimits } from '@/lib/db/plan';
import { cn } from '@/lib/utils';
import {
  Wallet,
  Image,
  Camera,
  Send,
  Coins,
  Flame,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// Smooth gradient stat card - now clickable
function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  gradient,
  href,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  href?: string;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.05] p-5 transition-all duration-500 hover:bg-white/[0.05] hover:border-white/[0.1] cursor-pointer">
      {/* Gradient glow on hover */}
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500",
        gradient
      )} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1 bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-white/40 mt-1">{subValue}</p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl bg-gradient-to-br opacity-80",
          gradient
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Smooth action card
function ActionCard({
  href,
  label,
  description,
  icon: Icon,
  gradient,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 h-full transition-all duration-500 hover:bg-white/[0.04] hover:border-white/[0.1] hover:translate-y-[-2px]">
        {/* Subtle gradient glow */}
        <div className={cn(
          "absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-all duration-500",
          gradient
        )} />

        <div className="relative">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
            "bg-gradient-to-br",
            gradient
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h3 className="font-semibold text-white/90">{label}</h3>
          <p className="text-sm text-white/40 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { isConnected } = useNetworkGuard();
  const { isLoading: isSyncing, progress, refresh } = useWalletSync();

  const collections = useLiveQuery(
    () => address ? db.collections.where('walletAddress').equals(address.toLowerCase()).toArray() : [],
    [address]
  ) ?? [];
  const holdings = useLiveQuery(
    () => address ? db.holdings.where('ownerAddress').equals(address.toLowerCase()).toArray() : [],
    [address]
  ) ?? [];
  const tokens = useLiveQuery(() =>
    address ? db.tokens.where('walletAddress').equals(address.toLowerCase()).toArray() : [],
    [address]
  ) ?? [];
  const batches = useLiveQuery(() =>
    db.batches.orderBy('createdAt').reverse().limit(5).toArray()
  ) ?? [];

  const plan = getCurrentPlan();
  const limits = getPlanLimits();

  const quickActions = [
    { href: '/inventory', label: 'View Inventory', description: 'Browse NFT holdings', icon: Image, gradient: 'from-purple-500/80 to-pink-400/80' },
    { href: '/snapshots', label: 'Take Snapshot', description: 'Export holder lists', icon: Camera, gradient: 'from-amber-500/80 to-orange-400/80' },
    { href: '/transfer', label: 'Transfer', description: 'Send NFTs, tokens, or MON', icon: Send, gradient: 'from-emerald-500/80 to-teal-400/80' },
    { href: '/burn', label: 'Burn', description: 'Permanently burn assets', icon: Flame, gradient: 'from-rose-500/80 to-red-400/80' },
    { href: '/lock', label: 'Token Lock', description: 'Lock tokens with vesting', icon: Lock, gradient: 'from-cyan-500/80 to-blue-400/80' },
  ];

  const totalHoldings = holdings.length;
  const successfulBatches = batches.filter((b) => b.status === 'completed').length;

  return (
    <AnimatedGradient className="min-h-[calc(100vh-4rem)]">
      <div className="space-y-8 py-2">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-white/40 mt-2">
              Monad NFT Operations Dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-white/[0.05] border-white/[0.1] text-white/70 hover:bg-white/[0.08]"
            >
              {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
            </Badge>
            {plan === 'free' && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500/90 to-violet-500/90 hover:from-purple-500 hover:to-violet-500 border-0 shadow-lg shadow-purple-500/20"
              >
                Upgrade
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Connection Banner */}
        {!isConnected && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20">
                <AlertCircle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white/90">Connect Your Wallet</h3>
                <p className="text-sm text-white/50">
                  Connect to Monad mainnet to access all features
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Banner */}
        {isSyncing && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
              <div className="flex-1">
                <p className="text-sm text-white/70">{progress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="MON Balance"
            value={balance ? parseFloat(formatEther(balance.value)).toFixed(2) : '0.00'}
            subValue="MON"
            icon={Coins}
            gradient="from-violet-500/80 to-purple-600/80"
            href="/transfer"
          />
          <StatCard
            label="NFTs Owned"
            value={totalHoldings}
            subValue={`Across ${collections.length} collections`}
            icon={Image}
            gradient="from-pink-500/80 to-rose-600/80"
            href="/inventory"
          />
          <StatCard
            label="Wallet"
            value={isConnected ? 'Connected' : 'Not Connected'}
            subValue={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined}
            icon={Wallet}
            gradient="from-blue-500/80 to-cyan-600/80"
          />
          <StatCard
            label="Batches"
            value={batches.length}
            subValue={`${successfulBatches} successful`}
            icon={Zap}
            gradient="from-emerald-500/80 to-teal-600/80"
            href="/transfer"
          />
        </div>

        {/* Token Portfolio */}
        {isConnected && tokens.length > 0 && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-white/[0.05]">
              <div>
                <h3 className="font-semibold text-white/90">Token Portfolio</h3>
                <p className="text-sm text-white/40">{tokens.length} tokens found</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white/80"
                onClick={refresh}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                Refresh
              </Button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {tokens.slice(0, 10).map((token) => (
                  <div
                    key={token.address}
                    className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center text-xs font-bold text-white/70">
                        {token.symbol.slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-white/70 truncate">{token.symbol}</span>
                    </div>
                    <div className="text-lg font-bold text-white/90 truncate">
                      {parseFloat(token.formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-white/30 truncate">{token.name}</div>
                  </div>
                ))}
              </div>
              {tokens.length > 10 && (
                <div className="mt-4 text-center">
                  <Button variant="ghost" size="sm" className="text-white/50 hover:text-white/80" asChild>
                    <Link href="/tokens">
                      View all {tokens.length} tokens <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white/90">Quick Actions</h2>
              <span className="text-sm text-white/30">
                Press <kbd className="px-2 py-1 bg-white/[0.05] rounded-lg text-xs border border-white/[0.1]">⌘K</kbd> for commands
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <ActionCard key={action.href} {...action} />
              ))}
            </div>
          </div>

          {/* Onboarding */}
          <div>
            <OnboardingChecklist />
          </div>
        </div>

        {/* Recent Batches */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-white/[0.05]">
            <div>
              <h3 className="font-semibold text-white/90">Recent Batches</h3>
              <p className="text-sm text-white/40">Your latest operations</p>
            </div>
            <Button variant="ghost" size="sm" className="text-white/50 hover:text-white/80" asChild>
              <Link href="/batches">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="p-6">
            {batches.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                  <Clock className="h-7 w-7 text-white/20" />
                </div>
                <p className="text-white/50">No batch operations yet</p>
                <p className="text-sm text-white/30 mt-1">
                  Start by transferring NFTs or dispersing tokens
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white/70"
                    asChild
                  >
                    <Link href="/transfer">
                      <Send className="mr-2 h-4 w-4" />
                      Transfer NFTs
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white/70"
                    asChild
                  >
                    <Link href="/transfer">
                      <Coins className="mr-2 h-4 w-4" />
                      Send Tokens
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        batch.status === 'completed' ? 'bg-emerald-500/10' :
                        batch.status === 'failed' ? 'bg-red-500/10' :
                        'bg-amber-500/10'
                      )}>
                        {batch.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : batch.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white/80">
                          {batch.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-white/40">
                          {batch.items.length} items · {new Date(batch.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        batch.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        batch.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      )}
                    >
                      {batch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan Limits - Subtle footer */}
        <div className="rounded-2xl bg-white/[0.01] border border-white/[0.03] p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-purple-400/60" />
              <div>
                <p className="text-sm font-medium text-white/60">Plan Limits</p>
                <p className="text-xs text-white/30">
                  {plan === 'free' ? 'Upgrade for higher limits' : 'Full access enabled'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <div>
                <span className="text-white/30">Batch: </span>
                <span className="text-white/60 font-medium">{limits.maxBatchSize}</span>
              </div>
              <div>
                <span className="text-white/30">Export: </span>
                <span className="text-white/60 font-medium">{limits.maxExportRows}</span>
              </div>
              <div>
                <span className="text-white/30">Collections: </span>
                <span className="text-white/60 font-medium">{limits.maxWatchedCollections}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedGradient>
  );
}
