'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { LiveStats } from '@/components/live-stats';
import { CommandPalette } from '@/components/command-palette';

export function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/[0.05] bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-end px-6">
        {/* Right side - all items */}
        <div className="flex items-center gap-4">
          <LiveStats />
          <div className="w-px h-6 bg-white/[0.1]" />
          <CommandPalette />
          <ConnectButton
            chainStatus="icon"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
            showBalance={false}
          />
        </div>
      </div>
    </header>
  );
}
