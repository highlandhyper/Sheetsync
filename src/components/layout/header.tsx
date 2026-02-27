'use client';

import { useState, useEffect } from 'react';
import { Zap, LogOut, UserCircle, Command, RefreshCw, Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/Avatar';
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

function LastSyncStatus() {
  const { lastSync, isSyncing, refreshData } = useDataCache();
  const [_, setForceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end justify-center mr-2 text-[10px] leading-tight text-muted-foreground uppercase tracking-wider font-medium">
        <span className={cn("transition-colors flex items-center gap-1", isSyncing ? "text-primary animate-pulse" : "text-green-500")}>
          {isSyncing ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Refreshing Data...</span>
              <span className="sm:hidden">Syncing...</span>
            </>
          ) : (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>Realtime Active</span>
            </>
          )}
        </span>
        <span className="opacity-60">
          {lastSync ? `Last: ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}` : 'Not Synced'}
        </span>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshData}
              disabled={isSyncing}
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-500",
                isSyncing ? "bg-primary/10 text-primary rotate-180" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}. Click to force refresh.` : 'Click to sync data now.'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}


export function Header({ className, onManualLock }: { className?: string; onManualLock?: () => void; }) {
  const { user, logout, loading, role } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { isSyncing } = useDataCache();

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-md px-4 md:px-6 gap-4 overflow-hidden">
        <div 
          className={cn(
            "absolute top-0 left-0 h-[2px] bg-primary transition-all duration-1000 ease-in-out",
            isSyncing ? "w-full opacity-100" : "w-0 opacity-0"
          )} 
        />

        <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          <div className="hidden md:flex flex-1 justify-center px-4">
             <div className="w-full max-w-sm">
                <HeaderBarcodeLookup />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LastSyncStatus />
            
            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="h-8 w-8 text-muted-foreground"
                aria-label="Open command palette"
            >
                <Command className="h-3.5 w-3.5" />
            </Button>

            <NotificationCenter />

            {role === 'admin' && onManualLock && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onManualLock}
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Lock session"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Lock Session</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {loading ? (
                <div className="h-8 w-8 rounded-full animate-pulse bg-muted" />
            ) : user ? (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm">
                        <AvatarImage src={`https://placehold.co/80x80.png?text=${getInitials(user.email)}`} alt={user.email || "User"} data-ai-hint="user avatar initials" />
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                        {user.displayName || user.email?.split('@')[0] || "User"}
                        </p>
                        {user.email && (
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                        )}
                    </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button asChild variant="outline" size="sm">
                    <Link href="/login">
                    <UserCircle className="mr-2 h-4 w-4" /> Login
                    </Link>
                </Button>
            )}
           </div>
        </div>
      </header>
      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
    </>
  );
}
