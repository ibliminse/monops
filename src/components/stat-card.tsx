'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ label, value, subValue, icon, trend, className }: StatCardProps) {
  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subValue && (
            <p className={cn(
              'text-xs mt-1',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              !trend && 'text-muted-foreground'
            )}>
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
