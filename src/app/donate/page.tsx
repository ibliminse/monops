'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { PageWrapper, PageHeader, AnimatedCard } from '@/components/ui/page-wrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DONATION_WALLET, PLAN_LIMITS, isSupporter } from '@/lib/db/plan';
import { truncateAddress } from '@/lib/utils';
import {
  Heart,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  Gift,
  Users,
  CheckCircle2,
  Crown,
} from 'lucide-react';

export default function DonatePage() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  const isSupporterWallet = isSupporter(address);

  const copyAddress = () => {
    navigator.clipboard.writeText(DONATION_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const freeFeatures = [
    { feature: 'Batch operations', value: `${PLAN_LIMITS.free.maxBatchSize} items` },
    { feature: 'Export rows', value: `${PLAN_LIMITS.free.maxExportRows} rows` },
    { feature: 'Watched collections', value: `${PLAN_LIMITS.free.maxWatchedCollections}` },
    { feature: 'Stored wallets', value: `${PLAN_LIMITS.free.maxStoredWallets}` },
  ];

  const supporterFeatures = [
    { feature: 'Batch operations', value: `${PLAN_LIMITS.supporter.maxBatchSize} items`, highlight: true },
    { feature: 'Export rows', value: `${PLAN_LIMITS.supporter.maxExportRows} rows`, highlight: true },
    { feature: 'Watched collections', value: `${PLAN_LIMITS.supporter.maxWatchedCollections}`, highlight: true },
    { feature: 'Stored wallets', value: `${PLAN_LIMITS.supporter.maxStoredWallets}`, highlight: true },
  ];

  return (
    <PageWrapper>
      <PageHeader
        title="Support MonOps"
        description="Donate to unlock premium features"
        icon={
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Heart className="h-6 w-6 md:h-8 md:w-8 text-pink-500" />
          </motion.div>
        }
      />

      {/* Supporter Status */}
      {isSupporterWallet && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10"
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-3 rounded-xl bg-amber-500/20"
            >
              <Crown className="h-8 w-8 text-amber-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-amber-400">You're a Supporter!</h3>
              <p className="text-amber-300/70">
                Thank you for your donation. You have access to all premium features.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Donation Card */}
      <AnimatedCard delay={0.1}>
        <div className="p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <motion.div
              className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Gift className="h-10 w-10 text-pink-400" />
            </motion.div>
            <h3 className="text-2xl font-bold text-white">Make a Donation</h3>
            <p className="text-white/50 max-w-md mx-auto">
              Send any amount of MON to support development. Your wallet will be whitelisted for premium features.
            </p>
          </div>

          {/* Donation Address */}
          <div className="space-y-2">
            <div className="text-sm text-white/50 text-center">Donation Wallet</div>
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="flex items-center gap-2 p-4 bg-white/[0.03] rounded-xl border border-white/[0.08]"
            >
              <code className="flex-1 text-center text-purple-400 text-sm md:text-base break-all">
                {DONATION_WALLET}
              </code>
              <motion.button
                onClick={copyAddress}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5 text-white/50" />
                )}
              </motion.button>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={copyAddress}
                className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Address'}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="w-full sm:w-auto border-white/[0.1] bg-white/[0.02]"
                asChild
              >
                <a
                  href={`https://monadvision.com/address/${DONATION_WALLET}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Explorer
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </AnimatedCard>

      {/* How It Works */}
      <AnimatedCard delay={0.15}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            How It Works
          </h3>
          <div className="space-y-4">
            {[
              { step: 1, title: 'Make a donation', desc: 'Send any amount of MON to the donation wallet above' },
              { step: 2, title: 'Share your wallet', desc: 'DM us on Twitter/X with your wallet address and tx hash' },
              { step: 3, title: 'Get whitelisted', desc: 'We\'ll add your wallet to the supporter list within 24 hours' },
              { step: 4, title: 'Enjoy premium', desc: 'All premium features are unlocked for your wallet forever' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-medium text-white">{item.title}</h4>
                  <p className="text-sm text-white/50">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedCard>

      {/* Feature Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Free */}
        <AnimatedCard delay={0.2}>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Free</h3>
              <Badge variant="secondary" className="bg-white/[0.05]">Current</Badge>
            </div>
            <div className="space-y-2">
              {freeFeatures.map((item) => (
                <div key={item.feature} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-white/50">{item.feature}</span>
                  <span className="text-white/70">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Supporter */}
        <AnimatedCard delay={0.25}>
          <div className="p-5 space-y-4 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

            <div className="flex items-center justify-between relative">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                Supporter
              </h3>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Zap className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            </div>
            <div className="space-y-2 relative">
              {supporterFeatures.map((item) => (
                <div key={item.feature} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-white/50">{item.feature}</span>
                  <span className={item.highlight ? 'text-purple-400 font-medium' : 'text-white/70'}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Why Donate */}
      <AnimatedCard delay={0.3} hover={false}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Why Donate?
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Users, title: 'Support Development', desc: 'Help us build more features for the Monad ecosystem' },
              { icon: Zap, title: 'Unlock Limits', desc: 'Get higher batch sizes, exports, and more' },
              { icon: Gift, title: 'Lifetime Access', desc: 'Your wallet is whitelisted forever, no subscriptions' },
              { icon: CheckCircle2, title: 'Stay Open Source', desc: 'Donations help keep MonOps free and open source' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.05 }}
                className="flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-white/[0.05]">
                  <item.icon className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedCard>
    </PageWrapper>
  );
}
