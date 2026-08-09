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
    LucideIcon
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const isHomeActive = pathname === '/dashboard' || (role === 'viewer' && pathname === '/products');
  const isCatalogActive = pathname === '/products/list';
  const isAddActive = pathname === '/inventory/add';
  const isLookupActive = pathname === '/inventory/lookup';
  const isMoreActive = pathname === '/more';

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
        <Icon 
          className={cn(
            "h-[22px] w-[22px] transition-colors duration-200",
            isActive ? "text-[#008CFF]" : "text-gray-400 dark:text-gray-500"
          )} 
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span className="sr-only">{label}</span>
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-50 w-full flex justify-center pointer-events-auto">
      <div className="relative flex items-center h-[65px] w-full bg-white dark:bg-zinc-950 border-t border-black/[0.05] dark:border-white/[0.05] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-safe">
        
        {/* 1. HOME */}
        <NavItem 
          href={role === 'admin' ? '/dashboard' : '/products'} 
          icon={Home} 
          label="Home" 
          isActive={isHomeActive}
        />
        
        {/* 2. CATALOG */}
        <NavItem 
          href="/products/list" 
          icon={Package} 
          label="Catalog" 
          isActive={isCatalogActive}
        />

        {/* 3. CENTRAL PLUS BUTTON (OVERLAPPING) */}
        <div className="flex-1 flex justify-center items-center h-full relative pointer-events-none">
            <Link 
                href="/inventory/add" 
                className={cn(
                    "absolute -top-[22px] h-[52px] w-[52px] rounded-full flex items-center justify-center transition-all duration-300 pointer-events-auto",
                    "bg-[#008CFF] text-white shadow-[0_8px_20px_-4px_rgba(0,140,255,0.4)]",
                    "hover:scale-110 active:scale-90",
                    isAddActive && "ring-4 ring-white dark:ring-zinc-950 shadow-[0_0_20px_rgba(0,140,255,0.6)]"
                )}
            >
                <Plus className="h-[26px] w-[26px]" strokeWidth={3} />
            </Link>
        </div>

        {/* 4. SEARCH (LOOKUP) */}
        <NavItem 
          href="/inventory/lookup" 
          icon={Search} 
          label="Search" 
          isActive={isLookupActive}
        />

        {/* 5. MORE (SYSTEM HUB) */}
        <NavItem 
          href="/more" 
          icon={Menu} 
          label="More" 
          isActive={isMoreActive}
        />
      </div>
    </div>
  );
}
