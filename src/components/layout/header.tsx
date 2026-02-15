
'use client';

import { useState, useEffect } from 'react';
import { Zap, LogOut, UserCircle, Command, RefreshCw } from 'lucide-react';
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
import { useDataCache } from '@/context/data-cache-context';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// New component for sync status
function LastSyncStatus() {
  const { lastSync, isSyncing, isCacheReady, refreshData } = useDataCache();
  // State to force re-render for the relative time display
  const [_, setForceUpdate] = useState(0);

  useEffect(() => {
    // Set up an interval to update the component every 30 seconds
    const timer = setInterval(() => {
      setForceUpdate(Date.now());
    }, 30000); // 30 seconds

    // Clean up the interval on component unmount
    return () => clearInterval(timer);
  }, []); // Empty dependency array ensures this runs only once on mount

  if (isSyncing) {
     return (
        <Button variant="ghost" size="sm" disabled className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing...</span>
        </Button>
     );
  }

  if (!isCacheReady) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={refreshData} className="hidden md:flex items-center gap-1.5 text-xs text-yellow-600 mr-2">
                        <RefreshCw className="h-3 w-3" />
                        <span>Sync now</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Data has not been synced yet. Click to sync.</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-2"
          >
            <RefreshCw className="h-3 w-3" />
            <span>
              {lastSync ? `Synced ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}` : 'Sync now'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}. Click to refresh.` : 'Click to sync data now.'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


export function Header({ className }: { className?: string }) {
  const { user, logout, loading } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 gap-4">
        <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
        </div>
        
        {/* Container for search and actions, aligned right */}
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          {/* Search bar takes up available space */}
          <div className="hidden md:flex flex-1 justify-center px-4">
             <div className="w-full max-w-sm">
                <HeaderBarcodeLookup />
            </div>
          </div>

          {/* Action buttons have fixed size */}
          <div className="flex items-center gap-2">
            <LastSyncStatus />
            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="text-muted-foreground"
                aria-label="Open command palette"
            >
                <Zap className="h-4 w-4" />
            </Button>
            
            {loading ? (
                <Button variant="ghost" className="relative h-8 w-8 rounded-full animate-pulse bg-muted" disabled />
            ) : user ? (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
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
                    <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button asChild variant="outline">
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
