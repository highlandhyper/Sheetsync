'use client';

import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { useDataCache } from '@/context/data-cache-context';
import { Card, CardContent } from '@/components/ui/card';
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
  Fingerprint,
  Activity,
  LogOut,
  RefreshCw,
  Command,
  Lock,
  CloudOff,
  ShieldAlert,
  Wifi,
  WifiOff,
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
  variant?: 'default' | 'primary' | 'security';
}

const HUB_SECTIONS: { title: string; index: string; items: HubItem[] }[] = [
  {
    title: 'Operations',
    index: '01',
    items: [
      {
        href: '/dashboard',
        label: 'Mission Control',
        icon: LayoutDashboard,
        description: 'Live registry metrics & analytics.',
        role: 'admin',
        variant: 'primary',
      },
      {
        href: '/approvals',
        label: 'Approval Center',
        icon: ShieldCheck,
        description: 'Verify & authorize staff requests.',
        role: 'admin',
        variant: 'security',
      },
      {
        href: '/expiry-watch',
        label: 'Diary Reminder',
        icon: Activity,
        description: 'Systematic diary replacement protocol.',
        role: 'both',
        variant: 'primary',
      },
      {
        href: '/inventory',
        label: 'Global Inventory',
        icon: ClipboardList,
        description: 'Master log of all units in stock.',
        role: 'admin',
      },
      {
        href: '/inventory/add',
        label: 'Log New Item',
        icon: ClipboardPlus,
        description: 'Standard industrial SKU logging.',
        role: 'both',
        variant: 'primary',
      },
      {
        href: '/inventory/lookup',
        label: 'Barcode Lookup',
        icon: SearchCode,
        description: 'Trace specific log & audit history.',
        role: 'both',
      },
      {
        href: '/products',
        label: 'Return by Staff',
        icon: UserCheck,
        description: 'Individual return & audit tracking.',
        role: 'both',
      },
      {
        href: '/products/by-supplier',
        label: 'Return by Supplier',
        icon: Undo,
        description: 'Bulk vendor processing protocol.',
        role: 'admin',
      },
    ],
  },
  {
    title: 'Management',
    index: '02',
    items: [
      {
        href: '/products/manage',
        label: 'Manage Products',
        icon: Edit3,
        description: 'Update master registry definitions.',
        role: 'admin',
      },
      {
        href: '/audit-log',
        label: 'Security Audit',
        icon: FileText,
        description: 'Complete terminal action history.',
        role: 'admin',
      },
    ],
  },
  {
    title: 'System',
    index: '03',
    items: [
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Interface & security configuration.',
        role: 'both',
      },
    ],
  },
];

function HubCard({ item }: { item: HubItem }) {
  const tone =
    item.variant === 'security'
      ? 'bg-destructive/10 text-destructive'
      : item.variant === 'primary'
        ? 'bg-primary/10 text-primary'
        : 'bg-muted text-muted-foreground';

  return (
    <Link href={item.href} className="block min-w-0">
      <div className="group flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-all active:scale-[0.98]">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              tone
            )}
          >
            <item.icon className="h-4 w-4" strokeWidth={2.2} />
          </div>

          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
        </div>

        <div className="mt-3 min-w-0">
          <h3 className="line-clamp-2 text-[12px] font-semibold leading-4 tracking-tight text-foreground">
            {item.label}
          </h3>
          <p className="mt-1 line-clamp-2 text-[9px] leading-3.5 text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function SystemHubPage() {
  const { role, user, logout } = useAuth();
  const { isAllowed } = useAccessControl();
  const {
    isOnline,
    isSyncing,
    lastSync,
    pendingActions,
    refreshData,
  } = useDataCache();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setForceUpdate(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!role || !user) return null;

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
    <div className="mx-auto w-full min-w-0 max-w-[480px] space-y-4 overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-foreground">
            System Hub
          </h1>
          <p className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground">
            Quick access to SheetSync operations
          </p>
        </div>

        <Badge
          variant="outline"
          className="shrink-0 rounded-lg border-border/60 bg-background px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          v5.0.0
        </Badge>
      </header>

      {/* Account + connection status */}
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0 rounded-xl">
              <AvatarImage
                src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`}
                alt={user.email || 'User'}
              />
              <AvatarFallback className="rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {user.displayName ||
                  user.email?.split('@')[0] ||
                  'Personnel'}
              </p>

              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="rounded-md border-0 px-1.5 py-0 text-[7px] font-semibold uppercase tracking-[0.06em]"
                >
                  <Fingerprint className="mr-1 h-2.5 w-2.5" />
                  {role}
                </Badge>

                <span
                  className={cn(
                    'flex items-center gap-1 text-[8px] font-medium',
                    isOnline
                      ? 'text-emerald-600'
                      : 'text-destructive'
                  )}
                >
                  {isOnline ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Last sync
              </p>
              <p className="mt-0.5 max-w-[92px] truncate text-[8px] font-medium text-foreground">
                {lastSync
                  ? formatDistanceToNow(new Date(lastSync), {
                      addSuffix: true,
                    })
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick controls */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Quick controls
          </h2>

          {pendingActions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsQueueOpen(true)}
              className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[8px] font-semibold text-destructive"
            >
              <CloudOff className="h-3 w-3" />
              {pendingActions.length} pending
            </button>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-4 gap-2">
          <Button
            variant="outline"
            onClick={() => isOnline && !isSyncing && refreshData()}
            disabled={!isOnline || isSyncing}
            className="h-14 min-w-0 flex-col gap-1 rounded-xl border-border/60 px-1 text-[8px] font-semibold shadow-none"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                isSyncing && 'animate-spin',
                isOnline ? 'text-primary' : 'text-destructive'
              )}
            />
            Sync
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="h-14 min-w-0 flex-col gap-1 rounded-xl border-border/60 px-1 text-[8px] font-semibold shadow-none"
          >
            <Command className="h-4 w-4 text-primary" />
            Command
          </Button>

          <div className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-background text-[8px] font-semibold">
            <NotificationCenter />
            <span className="text-muted-foreground">Alerts</span>
          </div>

          {role === 'admin' ? (
            <Button
              variant="outline"
              onClick={handleManualLock}
              className="h-14 min-w-0 flex-col gap-1 rounded-xl border-border/60 px-1 text-[8px] font-semibold shadow-none"
            >
              <Lock className="h-4 w-4 text-destructive" />
              Lock
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => logout()}
              className="h-14 min-w-0 flex-col gap-1 rounded-xl border-border/60 px-1 text-[8px] font-semibold text-destructive shadow-none"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </section>

      {/* Navigation */}
      <div className="space-y-5">
        {HUB_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            const roleMatch =
              item.role === 'both' || item.role === role;
            const accessMatch = isAllowed(role, item.href);

            return roleMatch && accessMatch;
          });

          if (visibleItems.length === 0) return null;

          return (
            <section key={section.title} className="space-y-2.5">
              <div className="flex min-w-0 items-center gap-2 px-0.5">
                <span className="text-[9px] font-bold tabular-nums text-primary/60">
                  {section.index}
                </span>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {section.title}
                </h2>
                <div className="h-px min-w-0 flex-1 bg-border/60" />
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2.5 max-[340px]:grid-cols-1">
                {visibleItems.map((item) => (
                  <HubCard key={item.href} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Logout */}
      {role === 'admin' && (
        <Button
          variant="outline"
          onClick={() => logout()}
          className="h-11 w-full rounded-xl border-destructive/20 bg-destructive/[0.03] text-[10px] font-semibold text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      )}

      <p className="pb-1 text-center text-[8px] font-medium uppercase tracking-[0.12em] text-muted-foreground/40">
        SheetSync secure mobile hub
      </p>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />

      <Dialog open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-muted/20 p-4 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-semibold tracking-tight">
                  Pending sync
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                  Review queued inventory actions waiting to upload.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto p-3">
            <OfflineQueueTerminal />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
