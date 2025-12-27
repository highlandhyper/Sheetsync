
'use client';

import { useState } from 'react';
import { Zap, LogOut, UserCircle, RotateCw, Command, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { CommandPalette } from './command-palette';
import { useDataCache } from '@/context/data-cache-context';
import { HeaderBarcodeLookup } from '../inventory/header-barcode-lookup';

export function Header({ className }: { className?: string }) {
  const { user, logout, loading } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const { refreshData, isSyncing } = useDataCache();


  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const handleSyncConfirm = () => {
    setIsSyncDialogOpen(false);
    refreshData();
  };

  return (
    <>
      <header className={cn("sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 gap-4", className)}>
        <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
        </div>
        
        {/* Desktop: Right-aligned search bar and action buttons */}
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          <div className="hidden md:block w-full max-w-sm">
             <HeaderBarcodeLookup />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="text-muted-foreground"
            aria-label="Open command palette"
          >
            <Zap className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSyncDialogOpen(true)}
            disabled={isSyncing}
            className="text-muted-foreground"
            aria-label="Sync Data"
          >
              <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
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
      </header>
      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
      
      <AlertDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                Confirm Data Sync
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to manually sync all data with Google Sheets? This will update all local data with the latest from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncConfirm}>
              <RotateCw className="mr-2 h-4 w-4" /> Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
