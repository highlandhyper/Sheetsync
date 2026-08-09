'use client';

import { useState, useEffect } from 'react';
import { LogOut, Command, RefreshCw, Lock, CloudOff, Wifi, WifiOff, BellOff } from 'lucide-react';
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
      {pendingActions.length > 0 && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="secondary" className={cn("flex items-center gap-1.5 cursor-help px-2 py-0.5 font-black text-[9px] uppercase tracking-widest rounded-2xl transition-all duration-500", isOnline ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-muted-foreground/10")}>
                        <CloudOff className="h-3 w-3" />
                        {pendingActions.length} <span className="hidden xs:inline">Pending</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{pendingActions.length} records waiting to sync.</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      )}

      <div className="flex items-center gap-2 mr-1">
        {isSyncing ? (
            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
        ) : isOnline ? (
            <Wifi className="h-4 w-4 text-green-500/50" />
        ) : (
            <WifiOff className="h-4 w-4 text-destructive/50" />
        )}
        <span className="text-[9px] opacity-30 font-black uppercase tracking-widest hidden xs:inline whitespace-nowrap">
          {lastSync ? `${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}` : 'OFFLINE'}
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
                "h-8 w-8 sm:h-9 sm:w-9 rounded-xl transition-all border-white/5 shadow-none",
                isSyncing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Force Sync</p>
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
    
    if (activeRequestId) {
        approveRequest(activeRequestId);
        setActiveRequestId(null);
    }
    
    refreshData();
  };

  return (
    <>
      <header className={cn(
        "sticky top-0 z-30 flex h-16 sm:h-20 items-center justify-between border-b border-white/5 bg-background/60 backdrop-blur-2xl px-4 sm:px-8 gap-4 transition-all duration-300",
        className
      )}>
        <div className="flex items-center gap-4">
            {/* Redundant hamburger button removed for cleaner desktop look */}
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <div className="hidden md:flex flex-1 justify-center px-4 max-w-xl">
             <div className="w-full">
                <HeaderBarcodeLookup />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LastSyncStatus />
            
            <div className="h-6 w-px bg-white/5 mx-1 hidden xs:block" />

            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground rounded-xl border-white/5 hover:bg-primary/5 transition-all"
                aria-label="Open command palette"
            >
                <Command className="h-3.5 w-3.5" />
            </Button>

            {role === 'admin' && activeSessions.length > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/dashboard">
                                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-green-600 bg-green-500/5 border-green-500/10 relative group transition-colors">
                                    <BellOff className="h-3.5 w-3.5" />
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 text-[7px] text-white items-center justify-center font-black">
                                            {activeSessions.length}
                                        </span>
                                    </span>
                                </Button>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{activeSessions.length} active silent grants</p>
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
                      className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground rounded-xl border-white/5 hover:text-destructive transition-all"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Lock Registry</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {loading ? (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl animate-pulse bg-muted/20" />
            ) : user ? (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl p-0 hover:bg-transparent">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shadow-none rounded-xl border border-white/5">
                        <AvatarImage src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`} alt={user.email || "User"} className="rounded-xl" />
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black uppercase text-[10px]">{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 rounded-2xl border-white/5 shadow-2xl p-2" align="end" forceMount>
                    <DropdownMenuLabel className="p-4">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight leading-none">
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
                    <DropdownMenuItem onClick={logout} className="rounded-xl p-3 text-destructive focus:text-destructive focus:bg-destructive/10 font-black uppercase tracking-widest text-[9px]">
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