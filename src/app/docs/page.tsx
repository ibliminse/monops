'use client';

import { motion } from 'framer-motion';
import { PageWrapper, PageHeader, AnimatedCard } from '@/components/ui/page-wrapper';
import {
  BookOpen,
  Github,
  Shield,
  Lock,
  Eye,
  Code,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Unlock,
  Users,
  Zap,
} from 'lucide-react';

const GITHUB_REPO = 'https://github.com/ibliminse/monops';
const STREAM_CONTRACT = '0x45060bA620768a20c792E60fbc6161344cA22a12';
const LOCK_CONTRACT = '0xC4Ca03a135B6dE0Dba430e28de5fe9C10cA99CB0';

export default function DocsPage() {
  const securityFeatures = [
    {
      icon: Unlock,
      title: 'You Control Your Keys',
      description: 'MonOps never has access to your private keys. All transactions are signed by your wallet.',
    },
    {
      icon: Eye,
      title: 'Fully Transparent',
      description: 'All smart contract code is open source and verified on-chain. Anyone can audit it.',
    },
    {
      icon: Lock,
      title: 'Non-Custodial',
      description: 'Your tokens stay in your wallet until you explicitly approve a transaction.',
    },
    {
      icon: Users,
      title: 'No Admin Keys',
      description: 'Smart contracts have no owner functions that could drain funds or pause withdrawals.',
    },
  ];

  const contracts = [
    {
      name: 'TokenStream',
      address: STREAM_CONTRACT,
      description: 'Handles token streaming with linear vesting. Streams are immutable once created and cannot be cancelled.',
      features: ['Linear vesting', 'Immutable streams', 'Claimable anytime', 'No admin functions'],
    },
    {
      name: 'TokenLock',
      address: LOCK_CONTRACT,
      description: 'Time-locks tokens with optional vesting schedules and cliff periods.',
      features: ['Simple time locks', 'Vesting schedules', 'Cliff periods', 'No admin functions'],
    },
  ];

  return (
    <PageWrapper>
      <PageHeader
        title="Documentation"
        description="Open source, transparent, and verifiable"
        icon={<BookOpen className="h-6 w-6 md:h-8 md:w-8 text-purple-500" />}
      />

      {/* Trust Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 border-green-500/30 bg-green-500/10"
      >
        <div className="flex items-start gap-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="p-3 rounded-xl bg-green-500/20"
          >
            <Shield className="h-6 w-6 text-green-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-green-400">100% Open Source</h3>
            <p className="text-green-300/70 mt-1">
              MonOps is fully open source. Every line of code - frontend and smart contracts - is publicly available for review.
              We believe in transparency and want you to verify exactly what you're interacting with.
            </p>
            <motion.a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              <Github className="h-5 w-5" />
              View on GitHub
              <ExternalLink className="h-4 w-4" />
            </motion.a>
          </div>
        </div>
      </motion.div>

      {/* Security Features */}
      <div className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-semibold text-white flex items-center gap-2"
        >
          <Shield className="h-5 w-5 text-purple-500" />
          Security Principles
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-4">
          {securityFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              whileHover={{ y: -2 }}
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <feature.icon className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-white/50 mt-1">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Smart Contracts */}
      <div className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-semibold text-white flex items-center gap-2"
        >
          <FileCode className="h-5 w-5 text-cyan-500" />
          Verified Smart Contracts
        </motion.h2>
        <div className="space-y-4">
          {contracts.map((contract, index) => (
            <AnimatedCard key={contract.name} delay={0.15 + index * 0.1}>
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{contract.name}</h3>
                    <p className="text-sm text-white/50 mt-1">{contract.description}</p>
                  </div>
                  <motion.a
                    href={`https://monadvision.com/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-white/50" />
                  </motion.a>
                </div>

                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <div className="text-xs text-white/40 mb-1">Contract Address</div>
                  <code className="text-sm text-cyan-400 break-all">{contract.address}</code>
                </div>

                <div className="flex flex-wrap gap-2">
                  {contract.features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/[0.05] rounded-lg text-white/70"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <motion.a
                    href={`${GITHUB_REPO}/blob/main/contracts/${contract.name}.sol`}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white/[0.05] rounded-lg text-white/70 hover:bg-white/[0.1] transition-colors"
                  >
                    <Code className="h-4 w-4" />
                    View Source
                  </motion.a>
                  <motion.a
                    href={`https://monadvision.com/address/${contract.address}#code`}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white/[0.05] rounded-lg text-white/70 hover:bg-white/[0.1] transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Verify On-Chain
                  </motion.a>
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-semibold text-white flex items-center gap-2"
        >
          <Zap className="h-5 w-5 text-amber-500" />
          How It Works
        </motion.h2>
        <AnimatedCard delay={0.2}>
          <div className="p-5 md:p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">1</div>
                <div>
                  <h4 className="font-semibold text-white">Connect Your Wallet</h4>
                  <p className="text-sm text-white/50">Your wallet (MetaMask, WalletConnect, etc.) handles all signing. We never see your keys.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">2</div>
                <div>
                  <h4 className="font-semibold text-white">Approve Tokens</h4>
                  <p className="text-sm text-white/50">You approve the exact amount of tokens you want to stream or lock. No unlimited approvals.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
                <div>
                  <h4 className="font-semibold text-white">Tokens Move to Contract</h4>
                  <p className="text-sm text-white/50">Tokens are held in the verified smart contract - not our wallets. The code determines who can withdraw.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">4</div>
                <div>
                  <h4 className="font-semibold text-white">Claim Anytime</h4>
                  <p className="text-sm text-white/50">Recipients can claim vested tokens anytime. No one can prevent withdrawals - not even us.</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-5 border-amber-500/30 bg-amber-500/10"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-400">Disclaimer</h3>
            <p className="text-sm text-amber-300/70 mt-1">
              While our contracts are open source and designed with security in mind, they have not been formally audited by a third-party security firm.
              Always do your own research and never invest more than you can afford to lose. Smart contracts carry inherent risks.
            </p>
          </div>
        </div>
      </motion.div>

      {/* FAQ */}
      <div className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-semibold text-white"
        >
          Frequently Asked Questions
        </motion.h2>
        <div className="space-y-3">
          {[
            {
              q: 'Can MonOps access my funds?',
              a: 'No. MonOps is a frontend interface. Your funds are controlled by smart contracts on Monad. We have no admin keys or backdoors.',
            },
            {
              q: 'What if the MonOps website goes down?',
              a: 'Your funds are safe on-chain. You can interact with the contracts directly through any block explorer or by running your own frontend.',
            },
            {
              q: 'Can someone cancel my stream and take my tokens?',
              a: 'No. Streams are immutable once created and cannot be cancelled by anyone. Tokens vest linearly and the recipient can withdraw vested amounts at any time.',
            },
            {
              q: 'Are the contracts audited?',
              a: 'Not yet. The contracts are open source and follow best practices, but have not been formally audited. Use at your own risk.',
            },
            {
              q: 'How do I verify the contract code?',
              a: 'Click "Verify On-Chain" above to see the verified source code on MonadVision. Compare it with our GitHub to confirm they match.',
            },
          ].map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="glass-card rounded-xl p-4"
            >
              <h4 className="font-medium text-white">{faq.q}</h4>
              <p className="text-sm text-white/50 mt-1">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
