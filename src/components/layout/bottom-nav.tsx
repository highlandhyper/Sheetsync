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
      <div className="flex flex-col items-center justify-center gap-1.5 transition-all duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]">
        {/* MATERIAL 3 PILL INDICATOR */}
        <div className={cn(
            "flex items-center justify-center w-16 h-8 transition-all duration-500 rounded-2xl relative overflow-hidden",
            isActive 
              ? "bg-primary/20 text-primary scale-110 shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)]" 
              : "text-muted-foreground/40 group-hover:text-muted-foreground/60 group-hover:bg-muted/30"
        )}>
            {/* ACTIVE GLOW LAYER */}
            {isActive && (
              <div className="absolute inset-0 bg-primary/10 animate-pulse" />
            )}
            <Icon className={cn(
              "h-5 w-5 relative z-10 transition-transform duration-500",
              isActive ? "stroke-[2.5px]" : "stroke-[2px]"
            )} />
        </div>
        
        {/* INDUSTRIAL LABEL */}
        <span className={cn(
            "text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-500",
            isActive 
              ? "text-primary opacity-100 translate-y-0" 
              : "text-muted-foreground/30 opacity-0 -translate-y-1 h-0 overflow-hidden"
        )}>
          {label}
        </span>
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center py-2 outline-none focus:ring-0 active:scale-90 transition-transform group">
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className="flex-1 flex flex-col items-center justify-center py-2 outline-none focus:ring-0 active:scale-90 transition-transform group">
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-700">
      <div className="relative flex items-center h-20 bg-background/80 backdrop-blur-3xl border-t border-white/10 shadow-[0_-15px_50px_-15px_rgba(0,0,0,0.3)] overflow-hidden px-2">
        {/* ATMOSPHERIC BACKGROUND GRADIENT */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <NavItem 
          href={role === 'admin' ? '/dashboard' : '/products'} 
          icon={role === 'admin' ? LayoutDashboard : UserCheck} 
          label="Hub" 
          isActive={isHomeActive}
        />
        
        <NavItem 
          href="/products/list" 
          icon={Package} 
          label="Catalog" 
          isActive={isCatalogActive}
        />

        {/* ELEVATED ACTION HUB */}
        <div className="flex-1 flex justify-center px-2">
            <Link href="/inventory/add" className="relative group">
                {/* BUTTON RING GLOW */}
                <div className={cn(
                  "absolute inset-0 bg-primary/20 rounded-2xl blur-xl transition-all duration-700 opacity-0 group-hover:opacity-100",
                  isAddActive && "opacity-100 scale-125"
                )} />
                
                <div className={cn(
                    "relative h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl z-10",
                    "border-2 border-white/10",
                    isAddActive 
                        ? "bg-primary text-white scale-110 shadow-primary/40 -translate-y-2 border-primary/20" 
                        : "bg-card text-foreground hover:bg-primary/10 hover:text-primary active:scale-90"
                )}>
                    <Plus className="h-8 w-8" strokeWidth={3} />
                </div>
            </Link>
        </div>

        <NavItem 
          href="/inventory/lookup" 
          icon={Search} 
          label="Identify" 
          isActive={isLookupActive}
        />

        <NavItem 
          icon={MoreHorizontal} 
          label="System" 
          onClick={() => setOpenMobile(true)}
        />
      </div>
    </div>
  );
}
