'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { 
    LayoutDashboard, 
    Package, 
    Plus, 
    Search, 
    MoreHorizontal, 
    UserCheck,
    LucideIcon
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { setOpenMobile } = useSidebar();

  const isHomeActive = pathname === '/dashboard' || (role === 'viewer' && pathname === '/products');
  const isCatalogActive = pathname === '/products/list';
  const isAddActive = pathname === '/inventory/add';
  const isLookupActive = pathname === '/inventory/lookup';

  const NavItem = ({ 
    href, 
    icon: Icon, 
    label, 
    isActive, 
    onClick 
  }: { 
    href?: string, 
    icon: LucideIcon, 
    label: string, 
    isActive?: boolean,
    onClick?: () => void
  }) => {
    const content = (
      <div className="flex flex-col items-center justify-center w-full h-full relative group pt-2">
        {/* ICON */}
        <div className={cn(
            "transition-all duration-300 ease-out",
            isActive ? "text-primary scale-110" : "text-muted-foreground/30 hover:text-muted-foreground/50"
        )}>
            <Icon className={cn(
              "h-6 w-6",
              isActive ? "stroke-[2.5px]" : "stroke-[2px]"
            )} />
        </div>
        
        {/* INTELLIGENCE DOT (Active Indicator) */}
        <div className={cn(
          "h-1 w-1 rounded-full bg-primary mt-1.5 transition-all duration-300",
          isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
        )} />
        
        {/* SCREEN READER LABEL */}
        <span className="sr-only">{label}</span>
      </div>
    );

    const commonClasses = "flex-1 h-full flex items-center justify-center outline-none active:scale-90 transition-transform";

    if (onClick) {
      return (
        <button onClick={onClick} className={commonClasses}>
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className={commonClasses}>
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-0 pb-0">
      {/* ELEVATED SHADOW LAYER */}
      <div className="absolute inset-x-0 top-0 h-10 -translate-y-full bg-gradient-to-t from-black/[0.03] to-transparent pointer-events-none dark:from-black/20" />
      
      {/* THE NAVIGATION CONTAINER */}
      <div className="relative flex items-center h-20 bg-background/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        
        {/* LEFT SLOT 1: HOME */}
        <NavItem 
          href={role === 'admin' ? '/dashboard' : '/products'} 
          icon={role === 'admin' ? LayoutDashboard : UserCheck} 
          label="Home" 
          isActive={isHomeActive}
        />
        
        {/* LEFT SLOT 2: CATALOG */}
        <NavItem 
          href="/products/list" 
          icon={Package} 
          label="Catalog" 
          isActive={isCatalogActive}
        />

        {/* CENTER SLOT: OVERLAPPING FAB */}
        <div className="flex-1 flex justify-center items-center h-full relative px-2">
            <Link 
                href="/inventory/add" 
                className={cn(
                    "absolute -top-6 h-16 w-16 rounded-full flex items-center justify-center transition-all duration-500",
                    "shadow-2xl border-4 border-background dark:border-zinc-950",
                    isAddActive 
                        ? "bg-primary text-primary-foreground scale-105 shadow-primary/40" 
                        : "bg-primary text-primary-foreground hover:scale-110 active:scale-95 shadow-primary/20"
                )}
            >
                <Plus className="h-9 w-9" strokeWidth={3} />
            </Link>
        </div>

        {/* RIGHT SLOT 1: LOOKUP */}
        <NavItem 
          href="/inventory/lookup" 
          icon={Search} 
          label="Lookup" 
          isActive={isLookupActive}
        />

        {/* RIGHT SLOT 2: MENU (MORE) */}
        <NavItem 
          icon={MoreHorizontal} 
          label="More" 
          onClick={() => setOpenMobile(true)}
        />
      </div>
    </div>
  );
}
