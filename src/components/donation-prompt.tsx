'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDonationPrompt } from '@/hooks/use-donation-prompt';
import { useSupporterStatus } from '@/hooks/use-supporter-status';
import { Heart, X, Sparkles, Crown, Zap } from 'lucide-react';

export function DonationPrompt() {
  const router = useRouter();
  const { shouldShow, dismissPrompt, markAsSupporter, trackAction } = useDonationPrompt();
  const { isSupporter } = useSupporterStatus();

  // Mark as supporter if they already are
  useEffect(() => {
    if (isSupporter) {
      markAsSupporter();
    }
  }, [isSupporter, markAsSupporter]);

  // Track page views as actions
  useEffect(() => {
    trackAction();
  }, []);

  if (isSupporter) return null;

  return (
    <AnimatePresence>
      {shouldShow && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={dismissPrompt}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-md bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
              {/* Glow effect */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />

              {/* Close button */}
              <button
                onClick={dismissPrompt}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors z-10"
              >
                <X className="h-4 w-4 text-white/50" />
              </button>

              {/* Content */}
              <div className="relative p-6 text-center">
                {/* Icon */}
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Heart className="h-8 w-8 text-pink-400" />
                </motion.div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white mb-2">
                  Enjoying MonOps?
                </h2>
                <p className="text-white/50 text-sm mb-6">
                  Support development and unlock premium features with a small donation.
                </p>

                {/* Benefits */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: Zap, label: '1000 batch', color: 'text-amber-400' },
                    { icon: Sparkles, label: '10k export', color: 'text-purple-400' },
                    { icon: Crown, label: 'Forever', color: 'text-pink-400' },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
                      <div className="text-xs text-white/60">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      dismissPrompt();
                      router.push('/donate');
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-medium"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Donate Now
                  </Button>
                  <button
                    onClick={dismissPrompt}
                    className="w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
