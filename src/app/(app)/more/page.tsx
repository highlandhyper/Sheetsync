'use client';

import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { useDataCache } from '@/context/data-cache-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { NotificationCenter } from '@/components/layout/notification-center';
import { CommandPalette } from '@/components/layout/command-palette';
import {
  ShieldCheck,
  Undo,
  UserCheck,
  ClipboardList,
  FileText,
  Settings,
  Edit3,
  ChevronRight,
  LayoutDashboard,
  LucideIcon,
  ClipboardPlus,
  SearchCode,
  LogOut,
  RefreshCw,
  Command,
  Lock,
  CloudOff,
  ShieldAlert,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { OfflineQueueTerminal } from '@/components/inventory/offline-queue-terminal';

interface HubItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  role: 'admin' | 'viewer' | 'both';
  colorClass?: string;
  bgClass?: string;
}

const HUB_SECTIONS: { title: string; items: HubItem[] }[] = [
  {
    title: 'Operations',
    items: [
      {
        href: '/dashboard',
        label: 'Mission Control',
        icon: LayoutDashboard,
        description: 'Live registry metrics & analytics',
        role: 'admin',
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-50 dark:bg-blue-500/10',
      },
      {
        href: '/approvals',
        label: 'Approval Center',
        icon: ShieldCheck,
        description: 'Verify & authorize staff requests',
        role: 'admin',
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-500/10',
      },
      {
        href: '/expiry-watch',
        label: 'Diary Reminder',
        icon: Activity,
        description: 'Diary replacement protocol',
        role: 'both',
        colorClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-500/10',
      },
      {
        href: '/inventory',
        label: 'Global Inventory',
        icon: ClipboardList,
        description: 'Master log of all units in stock',
        role: 'admin',
        colorClass: 'text-slate-600 dark:text-slate-400',
        bgClass: 'bg-slate-100 dark:bg-slate-500/10',
      },
      {
        href: '/inventory/add',
        label: 'Log New Item',
        icon: ClipboardPlus,
        description: 'Standard SKU logging',
        role: 'both',
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-500/10',
      },
      {
        href: '/inventory/lookup',
        label: 'Barcode Lookup',
        icon: SearchCode,
        description: 'Trace log & audit history',
        role: 'both',
        colorClass: 'text-indigo-600 dark:text-indigo-400',
        bgClass: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        href: '/products',
        label: 'Return by Staff',
        icon: UserCheck,
        description: 'Individual return tracking',
        role: 'both',
        colorClass: 'text-orange-600 dark:text-orange-400',
        bgClass: 'bg-orange-50 dark:bg-orange-500/10',
      },
      {
        href: '/products/by-supplier',
        label: 'Return by Supplier',
        icon: Undo,
        description: 'Bulk vendor processing',
        role: 'admin',
        colorClass: 'text-orange-700 dark:text-orange-500',
        bgClass: 'bg-orange-50 dark:bg-orange-500/10',
      },
    ],
  },
  {
    title: 'Management',
    items: [
      {
        href: '/products/manage',
        label: 'Manage Products',
        icon: Edit3,
        description: 'Update registry definitions',
        role: 'admin',
        colorClass: 'text-sky-600 dark:text-sky-400',
        bgClass: 'bg-sky-50 dark:bg-sky-500/10',
      },
      {
        href: '/audit-log',
        label: 'Security Audit',
        icon: FileText,
        description: 'Complete action history',
        role: 'admin',
        colorClass: 'text-zinc-600 dark:text-zinc-400',
        bgClass: 'bg-zinc-100 dark:bg-zinc-500/10',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Interface & security config',
        role: 'both',
        colorClass: 'text-violet-600 dark:text-violet-400',
        bgClass: 'bg-violet-50 dark:bg-violet-500/10',
      },
    ],
  },
];

function HubRow({ item }: { item: HubItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03] active:bg-neutral-100 dark:active:bg-white/[0.05]"
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
        item.bgClass || "bg-neutral-100 dark:bg-white/5"
      )}>
        <Icon className={cn("h-4 w-4", item.colorClass || "text-neutral-600 dark:text-neutral-300")} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-black dark:text-white">{item.label}</p>
        <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
          {item.description}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" strokeWidth={1.75} />
    </Link>
  );
}

export default function SystemHubPage() {
  const { role, user, logout } = useAuth();
  const { isAllowed } = useAccessControl();
  const { isOnline, isSyncing, lastSync, pendingActions, refreshData } = useDataCache();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setForceUpdate(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!role || !user) return null;

  // isAllowed only accepts "admin" | "viewer"
  const accessRole: 'admin' | 'viewer' = role === 'admin' ? 'admin' : 'viewer';

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const handleManualLock = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sheetSync_isLocked', 'true');
      window.location.reload();
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg min-h-[100dvh] bg-background dark:bg-[#0a0a0f] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-neutral-200/60 dark:border-white/5 bg-background/90 dark:bg-[#0a0a0f]/90 backdrop-blur-md px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-black dark:text-white">System Hub</h1>
            <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              Quick access to operations
            </p>
          </div>
          <span className="text-[12px] text-neutral-400 dark:text-neutral-500 font-mono">v5.0.0</span>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-5">
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0 rounded-full border border-border/50">
              <AvatarImage
                src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`}
                alt={user.email || 'User'}
              />
              <AvatarFallback className="rounded-full bg-neutral-200 dark:bg-white/10 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-black dark:text-white">
                {user.displayName || user.email?.split('@')[0] || 'Personnel'}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-md border-0 bg-primary/10 px-1.5 py-0 text-[10px] font-bold text-primary capitalize tracking-tight"
                >
                  {role}
                </Badge>
                <span
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-bold uppercase tracking-tight',
                    isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  )}
                >
                  {isOnline ? <Wifi className="h-3 w-3" strokeWidth={2.5} /> : <WifiOff className="h-3 w-3" strokeWidth={2.5} />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Last sync</p>
              <p className="mt-0.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                {lastSync
                  ? formatDistanceToNow(new Date(lastSync), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500">
              Quick controls
            </p>
            {pendingActions.length > 0 && (
              <button
                type="button"
                onClick={() => setIsQueueOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight"
              >
                <CloudOff className="h-3 w-3" strokeWidth={2.5} />
                {pendingActions.length} pending
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              onClick={() => isOnline && !isSyncing && refreshData()}
              disabled={!isOnline || isSyncing}
              className={cn(
                "h-14 flex-col gap-1 rounded-xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 px-1 text-[10px] font-bold uppercase tracking-tight shadow-none transition-all",
                isOnline && !isSyncing ? "text-blue-600 dark:text-blue-400" : "text-neutral-400"
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} strokeWidth={2.5} />
              Sync
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="h-14 flex-col gap-1 rounded-xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 px-1 text-[10px] font-bold uppercase tracking-tight shadow-none text-neutral-600 dark:text-neutral-300"
            >
              <Command className="h-4 w-4" strokeWidth={2.5} />
              Cmd
            </Button>

            <div className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 text-[10px] font-bold uppercase tracking-tight text-neutral-600 dark:text-neutral-300">
              <NotificationCenter />
              <span>Alerts</span>
            </div>

            {role === 'admin' ? (
              <Button
                variant="outline"
                onClick={handleManualLock}
                className="h-14 flex-col gap-1 rounded-xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 px-1 text-[10px] font-bold uppercase tracking-tight shadow-none text-red-600 dark:text-red-400"
              >
                <Lock className="h-4 w-4" strokeWidth={2.5} />
                Lock
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => logout()}
                className="h-14 flex-col gap-1 rounded-xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 px-1 text-[10px] font-bold uppercase tracking-tight shadow-none text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.5} />
                Exit
              </Button>
            )}
          </div>
        </div>

        {HUB_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            const roleMatch = item.role === 'both' || item.role === role;
            const accessMatch = isAllowed(accessRole, item.href);
            return roleMatch && accessMatch;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-2">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
                {section.title}
              </p>
              <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 divide-y divide-neutral-100 dark:divide-white/5 shadow-sm">
                {visibleItems.map((item) => (
                  <HubRow key={item.href} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        {role === 'admin' && (
          <Button
            variant="outline"
            onClick={() => logout()}
            className="h-12 w-full rounded-2xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 text-[13px] font-bold text-red-600 dark:text-red-400 shadow-none hover:bg-red-50 dark:hover:bg-red-500/5 transition-all"
          >
            <LogOut className="mr-2 h-4 w-4" strokeWidth={2.5} />
            Secure Sign Out
          </Button>
        )}

        <p className="pb-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-300 dark:text-neutral-700">
          SheetSync Secure Node
        </p>
      </div>

      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

      <Dialog open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl">
          <DialogHeader className="border-b border-neutral-100 dark:border-white/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
                <ShieldAlert className="h-5 w-5 text-amber-500 dark:text-amber-400" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-black dark:text-white uppercase tracking-tight">
                  Transmission Buffer
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Queued registry actions waiting for synchronization.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-4">
            <OfflineQueueTerminal />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
