'use client';

import { useState, useEffect } from 'react';
import { LogOut, Command, RefreshCw, Lock, CloudOff, Wifi, WifiOff, BellOff, ShieldCheck as ShieldIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from './command-palette';
import { HeaderBarcodeLookup } from '../inventory/header-barcode-lookup';
import { NotificationCenter } from './notification-center';
import { useDataCache } from '@/context/data-cache-context';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { CreateProductFromInventoryDialog } from '../products/create-product-from-inventory-dialog';
import { useSpecialEntry } from '@/context/special-entry-context';

function LastSyncStatus() {
  const { lastSync, isSyncing, pendingActions, isOnline } = useDataCache();
  const [_, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-6">
      {pendingActions.length > 0 && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="secondary" className={cn("flex items-center gap-1.5 cursor-help px-2.5 py-1 font-black text-[9px] uppercase tracking-widest rounded-full transition-all duration-500", isOnline ? "bg-primary/10 text-primary border-primary/20 animate-pulse" : "bg-destructive/10 text-destructive border-destructive/20")}>
                        <CloudOff className="h-3 w-3" />
                        {pendingActions.length} PENDING
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="font-bold">{pendingActions.length} records in transmission queue.</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      )}

      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
            <span className="text-[8px] opacity-30 font-black uppercase tracking-widest hidden xs:inline mt-1">
              SYNCED {lastSync ? formatDistanceToNow(new Date(lastSync), { addSuffix: true }) : 'NEVER'}
            </span>
        </div>
      </div>
    </div>
  );
}


export function Header({ className, onManualLock }: { className?: string; onManualLock?: () => void; }) {
  const { user, logout, loading, role } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { isSyncing, suppliers, addProduct, refreshData, isOnline } = useDataCache();
  const { approveRequest, activeSessions } = useSpecialEntry();
  
  const [isRequestProductDialogOpen, setIsRequestProductDialogOpen] = useState(false);
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

  const handleOpenProductRequest = (barcode: string, requestId?: string) => {
    setRequestedBarcode(barcode);
    setActiveRequestId(requestId || null);
    setIsRequestProductDialogOpen(true);
  };

  const handleProductCreateSuccess = (p: any) => {
    addProduct(p);
    
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
      <header className={cn(
        "sticky top-0 z-30 flex h-16 sm:h-20 items-center border-b border-white/5 bg-background/60 backdrop-blur-2xl px-4 sm:px-8 transition-all duration-300",
        className
      )}>
        {/* LEFT: Placeholder to balance the centered search */}
        <div className="flex-1 hidden md:flex items-center">
            {/* Optional sidebar trigger or breadcrumbs could go here */}
        </div>
        
        {/* CENTER: SEARCH TERMINAL */}
        <div className="flex-1 flex justify-center max-w-xl px-4">
            <div className="w-full">
                <HeaderBarcodeLookup />
            </div>
        </div>

        {/* RIGHT: SYSTEM ACTIONS */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <LastSyncStatus />
            
            <div className="h-6 w-px bg-white/10 mx-1 hidden xs:block" />

            <div className="flex items-center gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleForceSync}
                                disabled={!isOnline || isSyncing}
                                className={cn(
                                    "h-9 w-9 rounded-xl border transition-all",
                                    isSyncing 
                                        ? "bg-amber-500/20 text-amber-600 border-amber-500/30 animate-pulse" 
                                        : !isOnline 
                                            ? "bg-destructive/20 text-destructive border-destructive/30" 
                                            : "bg-green-500/20 text-green-600 border-green-500/30"
                                )}
                                aria-label="Force registry sync"
                            >
                                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="font-bold">
                                {isSyncing ? "Syncing..." : !isOnline ? "Working Offline" : "System Online (Force Sync)"}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="h-9 w-9 text-muted-foreground rounded-xl border-white/5 bg-muted/10 hover:bg-primary/5 transition-all"
                    aria-label="Open command palette"
                >
                    <Command className="h-4 w-4" />
                </Button>

                {role === 'admin' && activeSessions.length > 0 && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link href="/dashboard">
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-green-600 bg-green-500/5 border-green-500/10 relative group transition-colors">
                                        <BellOff className="h-4 w-4" />
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 text-[8px] text-white items-center justify-center font-black">
                                                {activeSessions.length}
                                            </span>
                                        </span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-bold">{activeSessions.length} active silent grants</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <NotificationCenter onOpenProductRequest={handleOpenProductRequest} />

                {role === 'admin' && onManualLock && (
                <TooltipProvider>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                        variant="outline"
                        size="icon"
                        onClick={onManualLock}
                        className="h-9 w-9 text-muted-foreground rounded-xl border-white/5 bg-muted/10 hover:text-destructive transition-all"
                        >
                        <Lock className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p className="font-bold">Lock Registry Terminal</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                )}
            </div>
            
            {loading ? (
                <div className="h-9 w-9 rounded-xl animate-pulse bg-muted/20" />
            ) : user ? (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-xl p-0 hover:bg-transparent">
                    <Avatar className="h-9 w-9 shadow-none rounded-xl border border-white/10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                        <AvatarImage src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`} alt={user.email || "User"} className="rounded-xl" />
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black uppercase text-[10px]">{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 rounded-2xl border-white/10 shadow-2xl p-2 bg-background/95 backdrop-blur-2xl" align="end" forceMount>
                    <DropdownMenuLabel className="p-4">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight leading-none text-slate-900 dark:text-white">
                        {user.displayName || user.email?.split('@')[0] || "User"}
                        </p>
                        {user.email && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {user.email}
                        </p>
                        )}
                    </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={handleForceSync} disabled={!isOnline || isSyncing} className="rounded-xl p-3 text-primary focus:text-primary focus:bg-primary/10 font-black uppercase tracking-widest text-[9px] cursor-pointer">
                    <RefreshCw className={cn("mr-3 h-4 w-4", isSyncing && "animate-spin")} />
                    <span>Force Registry Sync</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={logout} className="rounded-xl p-3 text-destructive focus:text-destructive focus:bg-destructive/10 font-black uppercase tracking-widest text-[9px] cursor-pointer">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Terminate Session</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
           </div>
        </div>
      </header>
      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
      
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
