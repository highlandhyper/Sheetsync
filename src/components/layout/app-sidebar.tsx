
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, ClipboardPlus, ClipboardList, Undo, History, UserCheck, Edit3 as ManageProductsIcon, SearchCode, LayoutDashboard, Building } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/products/by-supplier', label: 'Return by Supplier', icon: Undo, roles: ['admin'] }, 
  { href: '/products', label: 'Return by Staff', icon: UserCheck, roles: ['admin', 'viewer'] },
  { href: '/inventory', label: 'View Inventory', icon: ClipboardList, roles: ['admin'] },
  { href: '/inventory/add', label: 'Log New Item', icon: ClipboardPlus, roles: ['admin'] },
  { href: '/inventory/lookup', label: 'Barcode Log Lookup', icon: SearchCode, roles: ['admin', 'viewer'] },
  { href: '/inventory/returns', label: 'Return Log', icon: History, roles: ['admin'] },
];

const accountNavItems = [
   { href: '/products/manage', label: 'Manage Products', icon: ManageProductsIcon, roles: ['admin'] }, 
   { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'viewer'] },
];

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, loading, role } = useAuth();
  const { state, isMobile, toggleSidebar } = useSidebar();


  const navItems = allNavItems.filter(item => item.roles.includes(role || ''));
  const filteredAccountNavItems = accountNavItems.filter(item => item.roles.includes(role || ''));

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const isNavItemActive = (itemHref: string, currentPathname: string): boolean => {
    if (currentPathname === itemHref) {
      return true;
    }
    if (itemHref !== '/' && currentPathname.startsWith(itemHref)) {
        if (itemHref === '/products' && (currentPathname.startsWith('/products/by-supplier') || currentPathname.startsWith('/products/manage'))) {
            return false;
        }
        if (itemHref === '/inventory' && (currentPathname.startsWith('/inventory/add') || currentPathname.startsWith('/inventory/lookup') || currentPathname.startsWith('/inventory/returns'))) {
            return false;
        }
        return true;
    }
    return false;
  };
  
  const isAccountNavItemActive = (itemHref: string, currentPathname: string): boolean => {
    if (itemHref === '/products/manage' && currentPathname.startsWith('/products/manage')) {
        return true;
    }
    return currentPathname === itemHref;
  };

  const getDefaultHomePage = () => {
    if (!user) return "/login";
    if (role === 'viewer') return "/products";
    return "/dashboard";
  }

  return (
    <Sidebar collapsible="icon" className={cn(className)}>
       <div
        className="relative flex h-16 shrink-0 items-center justify-between px-4 py-2 group-data-[state=collapsed]/sidebar:h-14 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:p-0"
      >
        <Link
          href={getDefaultHomePage()}
          className="flex items-center gap-2 font-poppins text-2xl font-bold text-primary pl-2.5"
          aria-label="Home"
        >
          <span className="whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:hidden">
            SheetSync
          </span>
        </Link>
      </div>
      <SidebarContent className="p-2">
        <SidebarMenu className="list-none space-y-1">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isNavItemActive(item.href, pathname)}
                tooltip={{ children: item.label, className: "group-data-[state=expanded]/sidebar:hidden" }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span className="whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      {user && !loading && (
        <SidebarFooter className="p-2">
           <SidebarMenu className="list-none space-y-1">
             {filteredAccountNavItems.map((item) => (
               <SidebarMenuItem key={item.href}>
                 <SidebarMenuButton
                   asChild
                   isActive={isAccountNavItemActive(item.href, pathname)}
                   tooltip={{ children: item.label, className: "group-data-[state=expanded]/sidebar:hidden" }}
                 >
                   <Link href={item.href}>
                     <item.icon />
                     <span className="whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:hidden">{item.label}</span>
                   </Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             ))}
           </SidebarMenu>
           <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border pt-4 group-data-[state=collapsed]/sidebar:flex-col group-data-[state=collapsed]/sidebar:gap-2 group-data-[state=collapsed]/sidebar:border-none group-data-[state=collapsed]/sidebar:p-0 group-data-[state=collapsed]/sidebar:pt-4">
               <Avatar className="h-9 w-9 group-data-[state=collapsed]/sidebar:h-8 group-data-[state=collapsed]/sidebar:w-8">
                  <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`} alt={user.email || "User"} data-ai-hint="user avatar initials" />
                 <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
               </Avatar>
               <div className="flex-1 overflow-hidden whitespace-nowrap transition-opacity duration-200 group-data-[state=collapsed]/sidebar:hidden">
                 <p className="truncate text-sm font-medium text-sidebar-foreground">{user.displayName || user.email?.split('@')[0] || "User"}</p>
                 {user.email && <p className="truncate text-xs text-sidebar-foreground/70">{user.email}</p>}
               </div>
           </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
