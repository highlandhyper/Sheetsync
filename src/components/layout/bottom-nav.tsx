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
    ClipboardPlus, 
    SearchCode, 
    Menu, 
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
        "flex flex-col items-center justify-center gap-1 transition-all duration-300",
        isActive ? "text-primary scale-110" : "text-muted-foreground/60"
      )}>
        <div className={cn(
          "p-1 rounded-xl transition-all duration-300",
          isActive ? "bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : ""
        )}>
          <Icon className={cn("h-5 w-5", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-tighter", isActive ? "opacity-100" : "opacity-60")}>
          {label}
        </span>
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="flex-1 py-2 outline-none focus:ring-0">
          {content}
        </button>
      );
    }

    return (
      <Link href={href || '#'} className="flex-1 py-2 outline-none focus:ring-0">
        {content}
      </Link>
    );
  };

  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-8 duration-700">
      <div className="relative flex items-center h-16 bg-background/80 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-2xl px-2 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />
        
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

        {/* Central Action Button */}
        <div className="flex-1 -mt-8 flex justify-center">
            <Link href="/inventory/add" className="group">
                <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl",
                    isAddActive 
                        ? "bg-primary text-white scale-110 shadow-primary/40 rotate-90" 
                        : "bg-primary/90 text-white hover:bg-primary group-active:scale-90"
                )}>
                    <ClipboardPlus className="h-6 w-6" strokeWidth={3} />
                </div>
            </Link>
        </div>

        <NavItem 
          href="/inventory/lookup" 
          icon={SearchCode} 
          label="Lookup" 
          isActive={isLookupActive}
        />

        <NavItem 
          icon={Menu} 
          label="More" 
          onClick={() => setOpenMobile(true)}
        />
      </div>
    </div>
  );
}
