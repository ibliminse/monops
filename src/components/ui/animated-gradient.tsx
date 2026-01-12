'use client';

import { cn } from '@/lib/utils';

interface AnimatedGradientProps {
  className?: string;
  children?: React.ReactNode;
}

export function AnimatedGradient({ className, children }: AnimatedGradientProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-purple-600/30 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-fuchsia-600/20 blur-[80px] animate-pulse delay-500" />
      </div>
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function GlowingOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute rounded-full bg-gradient-to-r from-purple-500 to-violet-500 blur-[100px] opacity-30 animate-pulse',
        className
      )}
    />
  );
}
