
'use client';

import { Barcode, LogOut, UserCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Header({ className, show = true }: { className?: string, show?: boolean }) {
  const { user, logout, loading } = useAuth();

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className={cn(
      "sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 transition-transform duration-300",
      !show && "-translate-y-full",
      className
    )}>
       <SidebarTrigger className="md:hidden" />
      <div className="flex-1" />
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
    </header>
  );
}
