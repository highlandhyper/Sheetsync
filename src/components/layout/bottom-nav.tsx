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
    UserCheck
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
    icon: any, 
    label: string, 
    isActive?: boolean,
    onClick?: () => void
  }) => {
    const content = (
      <div className="flex flex-col items-center justify-center h-full relative px-2 transition-all duration-300">
        {/* ICON HUB */}
        <div className={cn(
            "flex items-center justify-center transition-all duration-500 ease-out",
            isActive ? "text-primary scale-110 -translate-y-1" : "text-muted-foreground/40 hover:text-muted-foreground/60"
        )}>
            <Icon className={cn(
              "h-5 w-5",
              isActive ? "stroke-[2.5px]" : "stroke-[2px]"
            )} />
        </div>
        
        {/* MINIMALIST LABEL */}
        <span className={cn(
            "text-[9px] font-black uppercase tracking-widest mt-1.5 transition-all duration-500",
            isActive ? "opacity-100 translate-y-0 text-primary" : "opacity-0 -translate-y-1 text-muted-foreground/20"
        )}>
          {label}
        </span>

        {/* ACTIVE INDICATOR LINE */}
        <div className={cn(
          "absolute bottom-2 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-primary transition-all duration-500 ease-in-out",
          isActive ? "w-4 opacity-100" : "w-0 opacity-0"
        )} />
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="flex-1 h-full flex flex-col items-center justify-center outline-none focus:ring-0 active:scale-90 transition-transform">
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className="flex-1 h-full flex flex-col items-center justify-center outline-none focus:ring-0 active:scale-90 transition-transform">
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-700">
      {/* SEAMLESS EDGE-TO-EDGE SURFACE */}
      <div className="relative flex items-center h-[72px] bg-background/80 backdrop-blur-3xl border-t border-white/5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
        
        <NavItem 
          href={role === 'admin' ? '/dashboard' : '/products'} 
          icon={role === 'admin' ? LayoutDashboard : UserCheck} 
          label="Home" 
          isActive={isHomeActive}
        />
        
        <NavItem 
          href="/products/list" 
          icon={Package} 
          label="Catalog" 
          isActive={isCatalogActive}
        />

        {/* PRIMARY ACTION HUB */}
        <div className="flex-1 flex justify-center items-center h-full">
            <Link href="/inventory/add" className="relative">
                <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                    "shadow-2xl border border-white/10",
                    isAddActive 
                        ? "bg-primary text-white scale-105 shadow-primary/20" 
                        : "bg-muted/10 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90"
                )}>
                    <Plus className="h-8 w-8" strokeWidth={3} />
                </div>
                {/* SUBTLE GLOW */}
                {isAddActive && (
                    <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl animate-pulse" />
                )}
            </Link>
        </div>

        <NavItem 
          href="/inventory/lookup" 
          icon={Search} 
          label="Lookup" 
          isActive={isLookupActive}
        />

        <NavItem 
          icon={MoreHorizontal} 
          label="Menu" 
          onClick={() => setOpenMobile(true)}
        />
      </div>
    </div>
  );
}
