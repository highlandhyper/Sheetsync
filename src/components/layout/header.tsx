'use client';

import { useState, useEffect } from 'react';
import { LogOut, UserCircle, Command, RefreshCw, Lock, CloudOff, Wifi, WifiOff, BellOff, ShieldCheck } from 'lucide-react';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
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
  const { lastSync, isSyncing, refreshData, pendingActions, isOnline } = useDataCache();
  const [_, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {!isOnline && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="destructive" className="flex items-center gap-1.5 cursor-help px-3 py-1 animate-pulse font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-full shadow-lg">
                        <WifiOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden xs:inline">System Offline</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Internet connection lost. Working in offline mode.</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      )}

      {pendingActions.length > 0 && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="secondary" className={cn("flex items-center gap-1.5 cursor-help px-3 py-1 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-full shadow-md transition-all duration-500", isOnline ? "animate-bounce bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-muted-foreground/10")}>
                        <CloudOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {pendingActions.length} <span className="hidden xs:inline">Local Logs</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{pendingActions.length} logs waiting to sync from this device.</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      )}

      <div className="flex flex-col items-end justify-center mr-1 sm:mr-2">
        <span className={cn(
            "text-[10px] sm:text-[12px] font-black uppercase tracking-[0.1em] flex items-center gap-2 transition-all duration-500 leading-none", 
            isSyncing ? "text-primary animate-pulse drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : (isOnline ? "text-green-500" : "text-destructive/80")
        )}>
          {isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 sm:h-4.5 sm:w-4.5 animate-spin" strokeWidth={3} />
              <span className="hidden sm:inline">Syncing Cloud...</span>
            </>
          ) : isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500/80" strokeWidth={3} />
              <span className="hidden xs:inline">Registry Active</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
              <span className="hidden xs:inline">Disconnected</span>
            </>
          )}
        </span>
        <span className="text-[7px] sm:text-[9px] opacity-40 font-bold uppercase tracking-tighter whitespace-nowrap hidden xs:inline leading-none mt-1.5">
          {lastSync ? `Updated ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}` : 'Registry Not Synced'}
        </span>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isSyncing || !isOnline}
              className={cn(
                "h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl transition-all duration-500 border-white/10 shadow-sm",
                isSyncing ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.3)] ring-2 ring-primary/20" : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              )}
            >
              <RefreshCw className={cn("h-5 w-5 sm:h-6 sm:w-6", isSyncing && "animate-spin")} strokeWidth={2.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!isOnline ? 'Cannot sync while offline.' : lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}. Click to force refresh.` : 'Click to sync data now.'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}


export function Header({ className, onManualLock }: { className?: string; onManualLock?: () => void; }) {
  const { user, logout, loading, role } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { isSyncing, suppliers, addProduct, refreshData } = useDataCache();
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
    
    // Resolve the special request if it was triggered by a notification
    if (activeRequestId) {
        approveRequest(activeRequestId);
        setActiveRequestId(null);
    }
    
    refreshData();
  };

  return (
    <>
      <header className={cn(
        "sticky top-0 z-30 flex h-16 sm:h-20 items-center justify-between border-b border-white/5 bg-background/60 backdrop-blur-2xl px-3 sm:px-6 md:px-10 gap-2 sm:gap-4 transition-all duration-300",
        className
      )}>
        <div 
          className={cn(
            "absolute top-0 left-0 h-[2px] sm:h-[3px] bg-primary transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(var(--primary),0.5)]",
            isSyncing ? "w-full opacity-100" : "w-0 opacity-0"
          )} 
        />

        <div className="flex items-center gap-2 sm:gap-4">
            <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10 md:hidden" />
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-4 md:gap-6">
          <div className="hidden md:flex flex-1 justify-center px-4 max-w-xl">
             <div className="w-full">
                <HeaderBarcodeLookup />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <LastSyncStatus />
            
            <div className="h-6 sm:h-8 w-px bg-white/5 mx-1 sm:mx-2 hidden xs:block" />

            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground rounded-lg sm:rounded-2xl border-white/10 hover:border-primary/30 transition-all hover:bg-primary/5"
                aria-label="Open command palette"
            >
                <Command className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>

            {role === 'admin' && activeSessions.length > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/dashboard">
                                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-2xl text-green-600 bg-green-500/5 border-green-500/10 relative group hover:bg-green-500/10 transition-colors">
                                    <BellOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:scale-110 transition-transform" />
                                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 text-[8px] text-white items-center justify-center font-black">
                                            {activeSessions.length}
                                        </span>
                                    </span>
                                </Button>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{activeSessions.length} active silent mode sessions</p>
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
                      className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground rounded-lg sm:rounded-2xl border-white/10 hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive transition-all"
                      aria-label="Lock session"
                    >
                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Lock Session</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {loading ? (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-2xl animate-pulse bg-muted/20" />
            ) : user ? (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-2xl p-0 hover:bg-transparent">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-white/5 shadow-2xl rounded-lg sm:rounded-2xl">
                        <AvatarImage src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`} alt={user.email || "User"} data-ai-hint="user avatar initials" className="rounded-lg sm:rounded-2xl" />
                        <AvatarFallback className="rounded-lg sm:rounded-2xl bg-primary/20 text-primary font-black uppercase text-[10px] sm:text-xs">{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 rounded-[1.25rem] sm:rounded-[1.5rem] border-white/5 shadow-2xl p-2" align="end" forceMount>
                    <DropdownMenuLabel className="p-4">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight leading-none">
                        {user.displayName || user.email?.split('@')[0] || "User"}
                        </p>
                        {user.email && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            {user.email}
                        </p>
                        )}
                    </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={logout} className="rounded-xl p-3 text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors font-black uppercase tracking-widest text-[10px]">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Terminate Session</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button asChild variant="outline" size="sm" className="rounded-lg sm:rounded-xl h-8 sm:h-10 font-black uppercase tracking-widest text-[9px] sm:text-[10px] px-2 sm:px-4">
                    <Link href="/login">
                    <UserCircle className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Sign In
                    </Link>
                </Button>
            )}
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
