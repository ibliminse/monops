'use client';

import { useState, useEffect } from 'react';
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
  Waves,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Image },
  { href: '/snapshots', label: 'Snapshots', icon: Camera },
  { href: '/transfer', label: 'Transfer', icon: Send },
  { href: '/burn', label: 'Burn', icon: Flame },
  { href: '/lock', label: 'Token Lock', icon: Lock },
  { href: '/streams', label: 'Streams', icon: Waves },
];

const bottomItems = [
  { href: '/developer', label: 'Developer', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-xl bg-white/[0.05] border border-white/[0.1] backdrop-blur-xl"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-white/70" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/[0.05] bg-[#0a0a0f]/95 backdrop-blur-xl transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-white/[0.05]">
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-white font-bold">M</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                MonOps
              </span>
            </Link>
            {/* Close button - mobile only */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-white/50" />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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
    </>
  );
}
