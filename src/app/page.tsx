'use client';

import { useAccount, useBalance } from 'wagmi';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { formatEther } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { useNetworkGuard, useWalletSync } from '@/hooks';
import { db } from '@/lib/db';
import { getCurrentPlan, getPlanLimits } from '@/lib/db/plan';
import { cn } from '@/lib/utils';
import {
  motion,
  AnimatePresence,
  StaggerContainer,
  StaggerItem,
  AnimatedCounter,
  GlowCard,
  FadeIn,
} from '@/components/ui/motion';
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
  Waves,
} from 'lucide-react';

// Animated stat card with glassmorphism
function StatCard({
  label,
  value,
  numericValue,
  subValue,
  icon: Icon,
  gradient,
  href,
  index = 0,
}: {
  label: string;
  value: string | number;
  numericValue?: number;
  subValue?: string;
  icon: React.ElementType;
  gradient: string;
  href?: string;
  index?: number;
}) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      whileHover={{
        y: -4,
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl glass-card p-5 cursor-pointer"
    >
      {/* Animated gradient glow */}
      <motion.div
        className={cn(
          "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-all duration-700",
          gradient
        )}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 animate-shimmer" />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-white/50 font-medium tracking-wide uppercase text-xs">{label}</p>
          <div className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent tabular-nums">
            {numericValue !== undefined ? (
              <AnimatedCounter value={numericValue} decimals={typeof value === 'string' && value.includes('.') ? 2 : 0} />
            ) : (
              value
            )}
          </div>
          {subValue && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="text-xs text-white/40 mt-1"
            >
              {subValue}
            </motion.p>
          )}
        </div>
        <motion.div
          whileHover={{ rotate: 12, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className={cn(
            "p-3 rounded-xl bg-gradient-to-br shadow-lg",
            gradient
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </motion.div>
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Animated action card
function ActionCard({
  href,
  label,
  description,
  icon: Icon,
  gradient,
  index = 0,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  index?: number;
}) {
  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          delay: 0.3 + index * 0.08,
          ease: [0.25, 0.4, 0.25, 1],
        }}
        whileHover={{
          y: -6,
          scale: 1.03,
          transition: { duration: 0.2 }
        }}
        whileTap={{ scale: 0.97 }}
        className="group relative overflow-hidden rounded-2xl glass-card p-4 md:p-5 h-full cursor-pointer"
      >
        {/* Background glow */}
        <motion.div
          className={cn(
            "absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-500",
            gradient
          )}
        />

        <div className="relative">
          <motion.div
            whileHover={{ scale: 1.15, rotate: -5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-lg",
              "bg-gradient-to-br",
              gradient
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </motion.div>
          <h3 className="font-semibold text-white/90 group-hover:text-white transition-colors">{label}</h3>
          <p className="text-xs md:text-sm text-white/40 mt-0.5 group-hover:text-white/60 transition-colors">{description}</p>
        </div>

        {/* Arrow indicator */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute top-4 right-4 text-white/40"
        >
          <ArrowRight className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </Link>
  );
}

// Animated background orbs
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, -50, 0],
          scale: [1.1, 1, 1.1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"
        animate={{
          x: [0, 40, 0],
          y: [0, -20, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
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

  const plan = getCurrentPlan(address);
  const limits = getPlanLimits(address);

  const quickActions = [
    { href: '/inventory', label: 'Inventory', description: 'Browse NFT holdings', icon: Image, gradient: 'from-purple-500 to-pink-500' },
    { href: '/snapshots', label: 'Snapshots', description: 'Export holder lists', icon: Camera, gradient: 'from-amber-500 to-orange-500' },
    { href: '/transfer', label: 'Transfer', description: 'Send NFTs & tokens', icon: Send, gradient: 'from-emerald-500 to-teal-500' },
    { href: '/burn', label: 'Burn', description: 'Burn assets', icon: Flame, gradient: 'from-rose-500 to-red-500' },
    { href: '/lock', label: 'Token Lock', description: 'Lock with vesting', icon: Lock, gradient: 'from-cyan-500 to-blue-500' },
    { href: '/streams', label: 'Streams', description: 'Token streaming', icon: Waves, gradient: 'from-violet-500 to-purple-500' },
  ];

  const totalHoldings = holdings.length;
  const successfulBatches = batches.filter((b) => b.status === 'completed').length;
  const balanceValue = balance ? parseFloat(formatEther(balance.value)) : 0;

  return (
    <>
      <BackgroundOrbs />
      <div className="space-y-6 md:space-y-8 py-2 pt-12 md:pt-2">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
        >
          <div>
            <motion.h1
              className="text-3xl md:text-5xl font-bold tracking-tight"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                Dashboard
              </span>
            </motion.h1>
            <motion.p
              className="text-white/40 mt-2 text-sm md:text-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Monad NFT Operations Dashboard
            </motion.p>
          </div>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Badge
              variant="secondary"
              className="bg-white/[0.05] border-white/[0.1] text-white/70 hover:bg-white/[0.08] backdrop-blur-sm"
            >
              {plan === 'supporter' ? 'Supporter' : 'Free'}
            </Badge>
            {plan === 'free' && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 border-0 shadow-lg shadow-purple-500/25"
                  asChild
                >
                  <a href="/donate">
                    Donate
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Connection Banner */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-5 md:p-6"
            >
              <motion.div
                className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <div className="relative flex items-center gap-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20"
                >
                  <AlertCircle className="h-6 w-6 text-amber-400" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white/90">Connect Your Wallet</h3>
                  <p className="text-sm text-white/50">
                    Connect to Monad mainnet to access all features
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Status Banner */}
        <AnimatePresence>
          {isSyncing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 p-4"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm text-white/70">{progress}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="MON Balance"
            value={balanceValue.toFixed(2)}
            numericValue={balanceValue}
            subValue="MON"
            icon={Coins}
            gradient="from-violet-500 to-purple-600"
            href="/transfer"
            index={0}
          />
          <StatCard
            label="NFTs Owned"
            value={totalHoldings}
            numericValue={totalHoldings}
            subValue={`Across ${collections.length} collections`}
            icon={Image}
            gradient="from-pink-500 to-rose-600"
            href="/inventory"
            index={1}
          />
          <StatCard
            label="Wallet"
            value={isConnected ? 'Connected' : 'Not Connected'}
            subValue={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined}
            icon={Wallet}
            gradient="from-blue-500 to-cyan-600"
            index={2}
          />
          <StatCard
            label="Batches"
            value={batches.length}
            numericValue={batches.length}
            subValue={`${successfulBatches} successful`}
            icon={Zap}
            gradient="from-emerald-500 to-teal-600"
            href="/transfer"
            index={3}
          />
        </div>

        {/* Token Portfolio */}
        <AnimatePresence>
          {isConnected && tokens.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-2xl glass-card overflow-hidden"
            >
              <div className="p-4 md:p-5 flex items-center justify-between border-b border-white/[0.05]">
                <div>
                  <h3 className="font-semibold text-white/90">Token Portfolio</h3>
                  <p className="text-xs md:text-sm text-white/40">{tokens.length} tokens found</p>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                </motion.div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {tokens.slice(0, 10).map((token, idx) => (
                    <motion.div
                      key={token.address}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + idx * 0.05 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      className="p-3 md:p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center text-xs font-bold text-white/70">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <span className="text-xs md:text-sm font-medium text-white/70 truncate">{token.symbol}</span>
                      </div>
                      <div className="text-base md:text-lg font-bold text-white/90 truncate tabular-nums">
                        {parseFloat(token.formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-white/30 truncate">{token.name}</div>
                    </motion.div>
                  ))}
                </div>
                {tokens.length > 10 && (
                  <motion.div
                    className="mt-4 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <Button variant="ghost" size="sm" className="text-white/50 hover:text-white/80" asChild>
                      <Link href="/tokens">
                        View all {tokens.length} tokens <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-4">
            <motion.div
              className="flex items-center justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-base md:text-lg font-semibold text-white/90">Quick Actions</h2>
              <span className="text-xs text-white/30 hidden sm:block">
                Press <kbd className="px-2 py-1 bg-white/[0.05] rounded-lg text-xs border border-white/[0.1]">⌘K</kbd> for commands
              </span>
            </motion.div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
              {quickActions.map((action, idx) => (
                <ActionCard key={action.href} {...action} index={idx} />
              ))}
            </div>
          </div>

          {/* Onboarding */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <OnboardingChecklist />
          </motion.div>
        </div>

        {/* Recent Batches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl glass-card overflow-hidden"
        >
          <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/[0.05]">
            <div>
              <h3 className="font-semibold text-white/90 text-sm md:text-base">Recent Batches</h3>
              <p className="text-xs md:text-sm text-white/40">Your latest operations</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" size="sm" className="text-white/50 hover:text-white/80" asChild>
                <Link href="/batches">
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          <div className="p-4 md:p-6">
            {batches.length === 0 ? (
              <motion.div
                className="text-center py-8 md:py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] flex items-center justify-center"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Clock className="h-7 w-7 text-white/20" />
                </motion.div>
                <p className="text-white/50">No batch operations yet</p>
                <p className="text-sm text-white/30 mt-1">
                  Start by transferring NFTs or dispersing tokens
                </p>
                <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch, idx) => (
                  <motion.div
                    key={batch.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + idx * 0.1 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        className={cn(
                          "p-2 rounded-lg",
                          batch.status === 'completed' ? 'bg-emerald-500/10' :
                          batch.status === 'failed' ? 'bg-red-500/10' :
                          'bg-amber-500/10'
                        )}
                        whileHover={{ rotate: 10 }}
                      >
                        {batch.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : batch.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-400" />
                        )}
                      </motion.div>
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
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Plan Limits - Subtle footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="rounded-2xl bg-white/[0.01] border border-white/[0.03] p-4 md:p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5 text-purple-400/60" />
              </motion.div>
              <div>
                <p className="text-xs md:text-sm font-medium text-white/60">Plan Limits</p>
                <p className="text-xs text-white/30">
                  {plan === 'free' ? 'Upgrade for higher limits' : 'Full access enabled'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-8 text-xs md:text-sm flex-wrap">
              <div>
                <span className="text-white/30">Batch: </span>
                <span className="text-white/60 font-medium tabular-nums">{limits.maxBatchSize}</span>
              </div>
              <div>
                <span className="text-white/30">Export: </span>
                <span className="text-white/60 font-medium tabular-nums">{limits.maxExportRows}</span>
              </div>
              <div>
                <span className="text-white/30">Collections: </span>
                <span className="text-white/60 font-medium tabular-nums">{limits.maxWatchedCollections}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
