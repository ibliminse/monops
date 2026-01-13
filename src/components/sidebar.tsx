'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
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
  BookOpen,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'from-purple-500 to-violet-500' },
  { href: '/inventory', label: 'Inventory', icon: Image, color: 'from-pink-500 to-rose-500' },
  { href: '/snapshots', label: 'Snapshots', icon: Camera, color: 'from-amber-500 to-orange-500' },
  { href: '/transfer', label: 'Transfer', icon: Send, color: 'from-emerald-500 to-teal-500' },
  { href: '/burn', label: 'Burn', icon: Flame, color: 'from-red-500 to-rose-500' },
  { href: '/lock', label: 'Token Lock', icon: Lock, color: 'from-cyan-500 to-blue-500' },
  { href: '/streams', label: 'Streams', icon: Waves, color: 'from-violet-500 to-purple-500' },
];

const bottomItems = [
  { href: '/docs', label: 'Docs', icon: BookOpen, color: 'from-green-500 to-emerald-500' },
  { href: '/developer', label: 'Developer', icon: Settings, color: 'from-gray-500 to-slate-500' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2.5 rounded-xl glass-card"
        aria-label="Open menu"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Menu className="h-5 w-5 text-white/70" />
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -256 : 0),
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/[0.05] bg-[#0a0a0f]/95 backdrop-blur-xl",
          "md:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-white/[0.05]">
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-white font-bold">M</span>
              </motion.div>
              <motion.span
                className="font-bold text-xl bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
                whileHover={{ scale: 1.02 }}
              >
                MonOps
              </motion.span>
            </Link>
            {/* Close button - mobile only */}
            <motion.button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
              aria-label="Close menu"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-5 w-5 text-white/50" />
            </motion.button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const isHovered = hoveredItem === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onHoverStart={() => setHoveredItem(item.href)}
                    onHoverEnd={() => setHoveredItem(null)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden',
                      isActive
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/80'
                    )}
                  >
                    {/* Active/Hover background */}
                    <AnimatePresence>
                      {(isActive || isHovered) && (
                        <motion.div
                          layoutId="navBackground"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className={cn(
                            "absolute inset-0 rounded-xl",
                            isActive
                              ? `bg-gradient-to-r ${item.color} opacity-20`
                              : "bg-white/[0.05]"
                          )}
                        />
                      )}
                    </AnimatePresence>

                    {/* Glow effect for active */}
                    {isActive && (
                      <motion.div
                        className={cn(
                          "absolute -left-20 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full blur-2xl opacity-30",
                          `bg-gradient-to-r ${item.color}`
                        )}
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}

                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="relative z-10"
                    >
                      <Icon className={cn(
                        "h-5 w-5 transition-colors",
                        isActive ? 'text-white' : ''
                      )} />
                    </motion.div>

                    <span className="relative z-10">{item.label}</span>

                    {isActive && (
                      <motion.div
                        className="ml-auto relative z-10"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full bg-gradient-to-r",
                          item.color
                        )} />
                      </motion.div>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Navigation */}
          <div className="px-3 py-4 border-t border-white/[0.05]">
            {bottomItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          {/* Version badge */}
          <div className="px-4 py-3 border-t border-white/[0.05]">
            <motion.div
              className="flex items-center justify-between text-xs text-white/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <span>MonOps</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.05]">v0.1.0</span>
            </motion.div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
