
'use client';

import { useState } from 'react';
import { Zap, LogOut, UserCircle, Command } from 'lucide-react';
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
