'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { 
    Home, 
    MessageSquare, 
    Plus, 
    Cloud, 
    Settings,
    LucideIcon
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const isHomeActive = pathname === '/dashboard' || (role === 'viewer' && pathname === '/products');
  const isApprovalsActive = pathname === '/approvals';
  const isAddActive = pathname === '/inventory/add';
  const isLookupActive = pathname === '/inventory/lookup';
  const isSettingsActive = pathname === '/settings';

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
    <div className="md:hidden fixed bottom-[20px] left-1/2 -translate-x-1/2 z-50 w-full px-6 flex justify-center pointer-events-none">
      <div className="relative flex items-center h-[55px] w-full max-w-[330px] bg-white dark:bg-zinc-900 border border-black/[0.03] dark:border-white/[0.05] rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] pointer-events-auto">
        
        {/* 1. HOME */}
        <NavItem 
          href={role === 'admin' ? '/dashboard' : '/products'} 
          icon={Home} 
          label="Home" 
          isActive={isHomeActive}
        />
        
        {/* 2. MESSAGES (Approvals) */}
        <NavItem 
          href="/approvals" 
          icon={MessageSquare} 
          label="Approvals" 
          isActive={isApprovalsActive}
        />

        {/* 3. CENTRAL PLUS BUTTON (OVERLAPPING) */}
        <div className="flex-1 flex justify-center items-center h-full relative">
            <Link 
                href="/inventory/add" 
                className={cn(
                    "absolute -top-[24px] h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all duration-300",
                    "bg-[#008CFF] text-white shadow-[0_8px_20px_-4px_rgba(0,140,255,0.4)]",
                    "hover:scale-110 active:scale-90"
                )}
            >
                <Plus className="h-[24px] w-[24px]" strokeWidth={3} />
            </Link>
        </div>

        {/* 4. CLOUD (Status/Lookup) */}
        <NavItem 
          href="/inventory/lookup" 
          icon={Cloud} 
          label="Lookup" 
          isActive={isLookupActive}
        />

        {/* 5. SETTINGS */}
        <NavItem 
          href="/settings" 
          icon={Settings} 
          label="Settings" 
          isActive={isSettingsActive}
        />
      </div>
    </div>
  );
}
