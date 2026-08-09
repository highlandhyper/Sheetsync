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
    UserCheck,
    Settings,
    LayoutDashboard,
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
                    isActive ? "text-[#008CFF] scale-110" : "text-gray-400 dark:text-gray-500"
                )} 
                strokeWidth={isActive ? 2.5 : 2}
            />
            {isActive && (
                <div className="absolute bottom-1 h-1 w-1 rounded-full bg-[#008CFF] animate-in fade-in zoom-in duration-300" />
            )}
        </div>
        <span className="sr-only">{label}</span>
      </Link>
    );
  };

  const isAdmin = role === 'admin';

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full flex justify-center pointer-events-auto px-4 pb-6">
      <div className="relative flex items-center h-[58px] w-full max-w-[340px] bg-white/95 dark:bg-zinc-950/95 border border-black/[0.05] dark:border-white/[0.05] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] rounded-[20px] backdrop-blur-xl">
        
        {/* SLOT 1: HOME / PRIMARY ACTION */}
        <NavItem 
          href={isAdmin ? '/dashboard' : '/products'} 
          icon={isAdmin ? LayoutDashboard : UserCheck} 
          label="Home" 
          isActive={isAdmin ? pathname === '/dashboard' : pathname === '/products'}
        />
        
        {/* SLOT 2: CATALOG (ADMIN) / LOOKUP (VIEWER) */}
        <NavItem 
            href={isAdmin ? "/products/list" : "/inventory/lookup"} 
            icon={isAdmin ? Package : Search} 
            label={isAdmin ? "Catalog" : "Lookup"} 
            isActive={isAdmin ? pathname === '/products/list' : pathname === '/inventory/lookup'}
        />

        {/* SLOT 3: CENTRAL ACTION HUB (OVERLAPPING FAB) */}
        <div className="flex-1 flex justify-center items-center h-full relative pointer-events-none">
            <Link 
                href="/inventory/add" 
                className={cn(
                    "absolute -top-[24px] h-[52px] w-[52px] rounded-full flex items-center justify-center transition-all duration-300 pointer-events-auto",
                    "bg-[#008CFF] text-white shadow-[0_8px_20px_-4px_rgba(0,140,255,0.4)]",
                    "hover:scale-110 active:scale-95",
                    pathname === '/inventory/add' && "ring-4 ring-white dark:ring-zinc-950 shadow-[0_0_20px_rgba(0,140,255,0.6)]"
                )}
            >
                <Plus className="h-[26px] w-[26px]" strokeWidth={3} />
            </Link>
        </div>

        {/* SLOT 4: LOOKUP (ADMIN) / SETTINGS (VIEWER) */}
        <NavItem 
          href={isAdmin ? "/inventory/lookup" : "/settings"} 
          icon={isAdmin ? Search : Settings} 
          label={isAdmin ? "Search" : "Settings"} 
          isActive={isAdmin ? pathname === '/inventory/lookup' : pathname === '/settings'}
        />

        {/* SLOT 5: SYSTEM HUB (MORE) */}
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
