'use client';

import { useEffect, useState } from 'react';
import {
  BellOff,
  CloudOff,
  Command,
  Lock,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { useSpecialEntry } from '@/context/special-entry-context';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

import { CommandPalette } from './command-palette';
import { HeaderBarcodeLookup } from '../inventory/header-barcode-lookup';
import { NotificationCenter } from './notification-center';
import { CreateProductFromInventoryDialog } from '../products/create-product-from-inventory-dialog';

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function LastSyncStatus() {
  const { lastSync, pendingActions, isOnline } = useDataCache();
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {pendingActions.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold 2xl:flex',
                  isOnline
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-destructive/20 bg-destructive/10 text-destructive',
                )}
              >
                <CloudOff className="h-3 w-3" />
                {pendingActions.length} pending
              </Badge>
            </TooltipTrigger>

            <TooltipContent>
              <p>{pendingActions.length} record{pendingActions.length === 1 ? '' : 's'} waiting to sync.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <div className="hidden 2xl:block text-right">
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
          Last sync
        </p>
        <p className="mt-0.5 text-[10px] font-semibold text-foreground">
          {lastSync
            ? formatDistanceToNow(new Date(lastSync), { addSuffix: true })
            : 'Never'}
        </p>
      </div>
    </div>
  );
}

export function Header({
  className,
  onManualLock,
}: {
  className?: string;
  onManualLock?: () => void;
}) {
  const { user, logout, loading, role } = useAuth();
  const {
    isSyncing,
    suppliers,
    addProduct,
    refreshData,
    isOnline,
  } = useDataCache();
  const { approveRequest, activeSessions } = useSpecialEntry();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRequestProductDialogOpen, setIsRequestProductDialogOpen] =
    useState(false);
  const [requestedBarcode, setRequestedBarcode] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';

    const parts = email.split('@')[0].split(/[._-]/);

    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return email.substring(0, 2).toUpperCase();
  };

  const handleOpenProductRequest = (
    barcode: string,
    requestId?: string,
  ) => {
    setRequestedBarcode(barcode);
    setActiveRequestId(requestId || null);
    setIsRequestProductDialogOpen(true);
  };

  const handleProductCreateSuccess = (product: any) => {
    addProduct(product);

    if (activeRequestId) {
      approveRequest(activeRequestId);
      setActiveRequestId(null);
    }

    refreshData();
  };

  const handleForceSync = () => {
    if (isOnline && !isSyncing) {
      refreshData();
    }
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 hidden h-[68px] items-center overflow-visible border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl md:flex lg:px-5 xl:px-6 2xl:px-8',
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <div className="hidden 2xl:flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isOnline
                  ? isSyncing
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
                  : 'bg-destructive',
              )}
            />

            <span className="text-xs font-medium text-muted-foreground">
              {isSyncing ? 'Syncing' : isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-[1.6] px-2 lg:px-3 xl:px-4"><div className="mx-auto w-full max-w-[720px]">
          <div className="w-full min-w-0">
            <HeaderBarcodeLookup />
          </div>
        </div></div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 lg:gap-2 xl:gap-3">
          <LastSyncStatus />

          <div className="hidden h-6 w-px bg-border/60 xl:block" />

          <div className="flex shrink-0 items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleForceSync}
                    disabled={!isOnline || isSyncing}
                    className={cn(
                      'h-9 w-9 rounded-xl border border-transparent transition-colors',
                      isSyncing
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : !isOnline
                          ? 'bg-destructive/10 text-destructive'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    aria-label="Sync now"
                  >
                    <RefreshCw
                      className={cn(
                        'h-4 w-4',
                        isSyncing && 'animate-spin',
                      )}
                    />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>
                  <p>
                    {isSyncing
                      ? 'Syncing...'
                      : !isOnline
                        ? 'Currently offline'
                        : 'Sync now'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="hidden h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground xl:inline-flex"
                    aria-label="Open command palette"
                  >
                    <Command className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>
                  <p>Command palette · Alt + K</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {role === 'admin' && activeSessions.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/dashboard">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hidden h-9 w-9 rounded-xl text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 xl:inline-flex"
                      >
                        <BellOff className="h-4 w-4" />

                        <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-white">
                          {activeSessions.length}
                        </span>
                      </Button>
                    </Link>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>
                      {activeSessions.length} active access grant
                      {activeSessions.length === 1 ? '' : 's'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <NotificationCenter
              onOpenProductRequest={handleOpenProductRequest}
            />

            {role === 'admin' && onManualLock && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onManualLock}
                      className="hidden h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:inline-flex"
                      aria-label="Lock session"
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>Lock session</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="hidden h-6 w-px bg-border/60 xl:block" />

          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-xl bg-muted/40" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 max-w-[190px] gap-2 rounded-xl p-1.5 pr-1.5 hover:bg-muted 2xl:pr-2"
                >
                  <Avatar className="h-8 w-8 rounded-xl border border-border/60">
                    <AvatarImage
                      src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`}
                      alt={user.email || 'User'}
                      className="rounded-xl"
                    />

                    <AvatarFallback className="rounded-xl bg-primary/10 text-[10px] font-bold uppercase text-primary">
                      {getInitials(user.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="hidden max-w-[140px] min-w-0 text-left 2xl:block">
                    <p className="truncate text-xs font-semibold leading-none text-foreground">
                      {user.displayName ||
                        user.email?.split('@')[0] ||
                        'User'}
                    </p>

                    <p className="mt-1 text-[9px] capitalize text-muted-foreground">
                      {role || 'user'}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                forceMount
                className="w-72 rounded-2xl border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl"
              >
                <DropdownMenuLabel className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl border border-border/60">
                      <AvatarImage
                        src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`}
                        alt={user.email || 'User'}
                      />

                      <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                        {getInitials(user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.displayName ||
                          user.email?.split('@')[0] ||
                          'User'}
                      </p>

                      {user.email && (
                        <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleForceSync}
                  disabled={!isOnline || isSyncing}
                  className="cursor-pointer rounded-xl px-3 py-2.5 text-xs font-medium"
                >
                  <RefreshCw
                    className={cn(
                      'mr-3 h-4 w-4 text-primary',
                      isSyncing && 'animate-spin',
                    )}
                  />
                  Sync data now
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer rounded-xl px-3 py-2.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />

      {requestedBarcode && (
        <CreateProductFromInventoryDialog
          isOpen={isRequestProductDialogOpen}
          onOpenChange={setIsRequestProductDialogOpen}
          barcode={requestedBarcode}
          allSuppliers={suppliers}
          onSuccess={handleProductCreateSuccess}
        />
      )}
    </>
  );
}
