'use client';

import { motion } from 'framer-motion';
import { PageWrapper, PageHeader, AnimatedCard } from '@/components/ui/page-wrapper';
import { Shield, Database, EyeOff, Globe, Link2, Trash2 } from 'lucide-react';

const GITHUB_REPO = 'https://github.com/ibliminse/monops';

export default function PrivacyPage() {
  const sections = [
    {
      icon: Globe,
      title: 'What We Collect',
      items: [
        'Google Analytics tracks page views, device type, and browser info — only if you accept the cookie consent banner.',
        'No personally identifiable information (PII) is collected. No email, no name, no account.',
        'Your wallet address is visible on the blockchain as part of normal EVM operation — we do not collect or store it on any server.',
      ],
    },
    {
      icon: Database,
      title: 'What We Store Locally',
      items: [
        'IndexedDB stores your NFT holdings, collection data, batch history, and sync state — all in your browser only.',
        'localStorage stores supporter status (donation verification) and cookie consent preference.',
        'No data is sent to any MonOps server. There is no MonOps server database.',
      ],
    },
    {
      icon: EyeOff,
      title: 'What We Do NOT Collect',
      items: [
        'Private keys, seed phrases, or passwords — never, under any circumstances.',
        'Transaction contents or wallet balances on our servers.',
        'Cross-site tracking, advertising profiles, or behavioral data.',
        'We do not sell, share, or monetize any data.',
      ],
    },
    {
      icon: Link2,
      title: 'Third-Party Services',
      items: [
        'Google Analytics — page-level usage metrics, gated on your consent.',
        'Moralis API — fetches NFT metadata for your connected wallet.',
        'Etherscan V2 API — fallback data source for NFT transfer history.',
        'WalletConnect / RainbowKit — wallet connection protocol.',
        'Each third-party service operates under its own privacy policy.',
      ],
    },
    {
      icon: Shield,
      title: 'Smart Contracts & On-Chain Data',
      items: [
        'All blockchain transactions are public and permanent by nature.',
        'Contract interactions occur directly between your wallet and the Monad blockchain.',
        'MonOps has no admin control over deployed contracts and cannot access, freeze, or move your funds.',
      ],
    },
    {
      icon: Trash2,
      title: 'Your Rights',
      items: [
        'Clear your browser\'s IndexedDB and localStorage at any time to remove all local MonOps data.',
        'Decline analytics via the cookie consent banner to prevent Google Analytics from loading.',
        'There is no account to delete because MonOps does not create user accounts.',
      ],
    },
  ];

  return (
    <PageWrapper>
      <PageHeader
        title="Privacy Policy"
        description="How MonOps handles your data"
        icon={<Shield className="h-6 w-6 md:h-8 md:w-8 text-blue-500" />}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
        }}
        className="space-y-6"
      >
        {/* Summary */}
        <AnimatedCard delay={0}>
          <div className="p-5">
            <p className="text-white/70 leading-relaxed">
              MonOps is a client-side tool. Your data lives in your browser, your keys stay in your wallet,
              and we have no server database. This policy explains what little data touches third parties and
              what stays entirely on your device.
            </p>
          </div>
        </AnimatedCard>

        {/* Sections */}
        {sections.map((section, index) => (
          <AnimatedCard key={section.title} delay={0.05 * (index + 1)}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center">
                  <section.icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white/90 text-lg">{section.title}</h3>
              </div>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-blue-400 mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedCard>
        ))}

        {/* Contact */}
        <AnimatedCard delay={0.4}>
          <div className="p-5">
            <p className="text-sm text-white/50">
              Questions about this policy? Open an issue on{' '}
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                GitHub
              </a>
              . Last updated February 2026.
            </p>
          </div>
        </AnimatedCard>
      </motion.div>
    </PageWrapper>
  );
}
