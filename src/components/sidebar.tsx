'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Wallet,
  Image,
  Camera,
  Send,
  Flame,
  Lock,
  Settings,
  LayoutDashboard,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Image },
  { href: '/snapshots', label: 'Snapshots', icon: Camera },
  { href: '/transfer', label: 'Transfer', icon: Send },
  { href: '/burn', label: 'Burn', icon: Flame },
  { href: '/lock', label: 'Token Lock', icon: Lock },
];

const bottomItems = [
  { href: '/developer', label: 'Developer', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/[0.05] bg-[#0a0a0f]/95 backdrop-blur-xl">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <Link href="/" className="flex h-16 items-center gap-3 px-6 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-white font-bold">M</span>
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            MonOps
          </span>
        </Link>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'bg-purple-500/15 text-purple-300 shadow-sm'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? 'text-purple-400' : ''
                )} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 py-4 border-t border-white/[0.05]">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'bg-purple-500/15 text-purple-300'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
