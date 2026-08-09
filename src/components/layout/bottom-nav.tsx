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
      <div className="flex flex-col items-center justify-center gap-1 transition-all duration-300">
        {/* ACTIVE PILL INDICATOR (Material 3 Style) */}
        <div className={cn(
            "flex items-center justify-center w-14 h-8 transition-all duration-300 rounded-2xl",
            isActive ? "bg-primary/15 text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
        )}>
            <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
        </div>
        <span className={cn(
            "text-[9px] font-black uppercase tracking-widest transition-all duration-300",
            isActive ? "text-primary opacity-100 translate-y-0" : "text-muted-foreground/40 opacity-0 -translate-y-1 h-0 overflow-hidden"
        )}>
          {label}
        </span>
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center py-2 outline-none focus:ring-0 active:scale-95 transition-transform group">
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className="flex-1 flex flex-col items-center justify-center py-2 outline-none focus:ring-0 active:scale-95 transition-transform group">
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-2 duration-700">
      {/* FLUSH CONTAINER - No margins, flush with bottom/sides */}
      <div className="relative flex items-center h-16 bg-background/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
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

        {/* PROMINENT CENTER ACTION HUB */}
        <div className="flex-1 flex justify-center pb-1">
            <Link href="/inventory/add">
                <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl",
                    isAddActive 
                        ? "bg-primary text-white scale-110 shadow-primary/30" 
                        : "bg-muted text-foreground hover:bg-primary hover:text-white"
                )}>
                    <Plus className="h-7 w-7" strokeWidth={3} />
                </div>
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
          label="More" 
          onClick={() => setOpenMobile(true)}
        />
      </div>
    </div>
  );
}
