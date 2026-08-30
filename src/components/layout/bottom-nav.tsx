'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { 
    Home, 
    Package, 
    Plus, 
    Search, 
    Menu,
    Settings,
    UserCheck,
    LucideIcon
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  if (!role) return null;

  const NavItem = ({ 
    href, 
    icon: Icon, 
    label, 
    isActive 
  }: { 
    href: string, 
    icon: LucideIcon, 
    label: string, 
    isActive?: boolean
  }) => {
    return (
      <Link 
        href={href} 
        className="flex items-center justify-center flex-1 h-full transition-all active:scale-90 outline-none"
      >
        <div className="relative flex flex-col items-center justify-center h-full w-full">
            <Icon 
                className={cn(
                    "h-[22px] w-[22px] transition-all duration-300",
                    isActive ? "text-primary scale-110" : "text-muted-foreground/40"
                )} 
                strokeWidth={isActive ? 2.5 : 2}
            />
            {isActive && (
                <div className="absolute bottom-1 h-1 w-1 rounded-full bg-primary animate-in fade-in zoom-in duration-300" />
            )}
        </div>
        <span className="sr-only">{label}</span>
      </Link>
    );
  };

  const isAdmin = role === 'admin';

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full flex justify-center pointer-events-auto pb-safe">
      <div className="relative flex items-center h-[64px] w-full bg-background/80 dark:bg-zinc-950/80 border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] backdrop-blur-3xl">
        
        {/* SLOT 1: DYNAMIC HOME */}
        <NavItem 
          href={isAdmin ? '/dashboard' : '/products'} 
          icon={isAdmin ? Home : UserCheck} 
          label={isAdmin ? "Home" : "Returns"} 
          isActive={isAdmin ? pathname === '/dashboard' : pathname === '/products'}
        />
        
        {/* SLOT 2: CATALOG */}
        <NavItem 
            href="/products/list" 
            icon={Package} 
            label="Catalog" 
            isActive={pathname === '/products/list'}
        />

        {/* SLOT 3: PRIMARY LOG ACTION */}
        <NavItem 
          href="/inventory/add" 
          icon={Plus} 
          label="Log Item" 
          isActive={pathname === '/inventory/add'}
        />

        {/* SLOT 4: SEARCH / SETTINGS */}
        <NavItem 
          href={isAdmin ? "/inventory/lookup" : "/settings"} 
          icon={isAdmin ? Search : Settings} 
          label={isAdmin ? "Search" : "Settings"} 
          isActive={isAdmin ? pathname === '/inventory/lookup' : pathname === '/settings'}
        />

        {/* SLOT 5: NAVIGATION HUB */}
        <NavItem 
          href="/more" 
          icon={Menu} 
          label="More" 
          isActive={pathname === '/more'}
        />
      </div>
    </div>
  );
}