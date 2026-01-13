'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard,
  Wallet,
  Image,
  Camera,
  Send,
  Radio,
  Settings,
  Search,
  Command,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  shortcut?: string;
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/', shortcut: 'G D' },
  { id: 'wallets', label: 'Wallets', description: 'Manage wallet addresses', icon: Wallet, href: '/wallets', shortcut: 'G W' },
  { id: 'inventory', label: 'Inventory', description: 'View NFT holdings', icon: Image, href: '/inventory', shortcut: 'G I' },
  { id: 'snapshots', label: 'Snapshots', description: 'Export holder lists', icon: Camera, href: '/snapshots', shortcut: 'G S' },
  { id: 'transfer', label: 'Transfer', description: 'Send NFTs, tokens, or MON', icon: Send, href: '/transfer', shortcut: 'G T' },
  { id: 'monitor', label: 'Mint Monitor', description: 'Watch live mints', icon: Radio, href: '/mint-monitor', shortcut: 'G M' },
  { id: 'developer', label: 'Developer', description: 'Debug tools', icon: Settings, href: '/developer' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback((command: CommandItem) => {
    setOpen(false);
    setSearch('');
    if (command.href) {
      router.push(command.href);
    } else if (command.action) {
      command.action();
    }
  }, [router]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, selectedIndex, handleSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <>
      {/* Trigger hint */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white/10 rounded">
          <Command className="h-3 w-3 inline" />K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-[#0d0d12]/95 backdrop-blur-xl border-white/10">
          <div className="flex items-center gap-3 px-4 border-b border-white/10">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands..."
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-12 text-base"
              autoFocus
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No results found
              </div>
            ) : (
              filteredCommands.map((command, index) => {
                const Icon = command.icon;
                return (
                  <button
                    key={command.id}
                    onClick={() => handleSelect(command)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-purple-500/20 text-white'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{command.label}</div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {command.description}
                        </div>
                      )}
                    </div>
                    {command.shortcut && (
                      <kbd className="text-xs text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded">
                        {command.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-white/10 text-xs text-muted-foreground flex items-center gap-4">
            <span><kbd className="bg-white/10 px-1 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="bg-white/10 px-1 rounded">↵</kbd> Select</span>
            <span><kbd className="bg-white/10 px-1 rounded">Esc</kbd> Close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
