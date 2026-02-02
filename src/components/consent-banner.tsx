'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'monops_analytics_consent';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    window.dispatchEvent(new Event('monops-consent-updated'));
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    window.dispatchEvent(new Event('monops-consent-updated'));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[90] md:ml-64 p-4"
        >
          <div className="glass-card rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/95 backdrop-blur-xl p-5 max-w-2xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center shrink-0">
                <Cookie className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70 leading-relaxed">
                  We use Google Analytics to understand how MonOps is used. No personal data is collected.{' '}
                  <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                    Privacy Policy
                  </Link>
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <Button
                    size="sm"
                    onClick={handleAccept}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDecline}
                    className="text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
