'use client';

import { motion } from 'framer-motion';
import { PageWrapper, PageHeader, AnimatedCard } from '@/components/ui/page-wrapper';
import { FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
  const sections = [
    {
      title: 'Acceptance of Terms',
      content:
        'By accessing or using MonOps, you agree to be bound by these Terms of Service. If you do not agree, do not use the application.',
    },
    {
      title: 'What MonOps Is',
      content:
        'MonOps is a client-side web interface for performing batch operations on the Monad blockchain (Chain ID 143). It is a tool, not a custodian, exchange, broker, or financial advisor. MonOps does not hold, transmit, or have access to your funds at any time.',
    },
    {
      title: 'Non-Custodial Design',
      content:
        'MonOps never has access to your private keys. Every transaction requires your explicit signature through your connected wallet. You are solely responsible for the security of your wallet, private keys, and seed phrases.',
    },
    {
      title: 'Smart Contract Risks',
      content:
        'MonOps deploys and interacts with smart contracts on the Monad blockchain. These contracts are open source but have NOT been formally audited by a third-party security firm. Blockchain transactions are irreversible. Tokens sent, burned, locked, or streamed through these contracts cannot be recovered by MonOps or anyone else. You use these contracts at your own risk.',
    },
    {
      title: 'No Warranties',
      content:
        'MonOps is provided "as is" and "as available" without warranty of any kind, express or implied. We do not guarantee that the application will be error-free, uninterrupted, or free of vulnerabilities. We are not responsible for: lost or locked funds, failed transactions, smart contract bugs, RPC or API downtime, third-party service failures, or incorrect data from external sources.',
    },
    {
      title: 'Supported Network',
      content:
        'MonOps is designed exclusively for the Monad mainnet (Chain ID 143). Using the application with other networks or chains is unsupported and may result in lost funds.',
    },
    {
      title: 'Donations',
      content:
        'Donations are voluntary and non-refundable. A donation of at least 1 MON unlocks premium features for the donating wallet address permanently (lifetime, no subscription). Donation verification is performed on-chain. Feature limits are enforced client-side.',
    },
    {
      title: 'Limitation of Liability',
      content:
        'To the maximum extent permitted by applicable law, MonOps and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or digital assets, arising from your use of the application.',
    },
    {
      title: 'Changes to Terms',
      content:
        'We may update these terms at any time. Changes will be reflected on this page with an updated date. Continued use of MonOps after changes constitutes acceptance of the revised terms.',
    },
  ];

  return (
    <PageWrapper>
      <PageHeader
        title="Terms of Service"
        description="Rules and conditions for using MonOps"
        icon={<FileText className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
        }}
        className="space-y-6"
      >
        {/* Warning Banner */}
        <AnimatedCard delay={0}>
          <div className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-400/80 leading-relaxed">
              MonOps interacts with real blockchain contracts handling real assets.
              Please read these terms carefully. Smart contracts are unaudited and
              blockchain transactions are irreversible.
            </p>
          </div>
        </AnimatedCard>

        {/* Sections */}
        {sections.map((section, index) => (
          <AnimatedCard key={section.title} delay={0.04 * (index + 1)}>
            <div className="p-5">
              <h3 className="font-semibold text-white/90 text-lg mb-3">
                {index + 1}. {section.title}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">{section.content}</p>
            </div>
          </AnimatedCard>
        ))}

        {/* Footer */}
        <AnimatedCard delay={0.5}>
          <div className="p-5">
            <p className="text-sm text-white/50">
              See also our{' '}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                Privacy Policy
              </Link>
              . Last updated February 2026.
            </p>
          </div>
        </AnimatedCard>
      </motion.div>
    </PageWrapper>
  );
}
