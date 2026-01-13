'use client';

import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export function Tooltip({ content, children, position = 'bottom', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 px-2.5 py-1.5 text-xs font-medium",
            "bg-[#1a1a24] border border-white/[0.1] rounded-lg shadow-xl",
            "text-white/80 whitespace-nowrap z-50",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            className
          )}
        >
          {content}
          {/* Arrow */}
          <div className={cn(
            "absolute left-1/2 -translate-x-1/2",
            position === 'top' ? 'top-full -mt-px' : 'bottom-full -mb-px'
          )}>
            <div className={cn(
              "border-4 border-transparent",
              position === 'top' ? 'border-t-[#1a1a24]' : 'border-b-[#1a1a24]'
            )} />
          </div>
        </div>
      )}
    </div>
  );
}
