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
      <div className={cn(
        "flex flex-col items-center justify-center gap-1.5 transition-all duration-300",
        isActive ? "text-primary" : "text-muted-foreground/40"
      )}>
        <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className={cn("text-[8px] font-black uppercase tracking-widest", isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden")}>
          {label}
        </span>
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="flex-1 py-2 outline-none focus:ring-0 active:scale-90 transition-transform">
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className="flex-1 py-2 outline-none focus:ring-0 active:scale-90 transition-transform">
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-8 duration-700">
      <div className="relative flex items-center h-16 bg-background/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl px-2 overflow-hidden">
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

        {/* Minimal Action Button */}
        <div className="flex-1 flex justify-center">
            <Link href="/inventory/add">
                <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg",
                    isAddActive 
                        ? "bg-primary text-white scale-110 shadow-primary/30" 
                        : "bg-muted text-foreground hover:bg-primary hover:text-white"
                )}>
                    <Plus className="h-6 w-6" strokeWidth={3} />
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