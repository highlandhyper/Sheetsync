
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
import { useAccessControl } from '@/context/access-control-context';
import { allNavItems, accountNavItems, type NavItem } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, loading, role } = useAuth();
  const { isAllowed } = useAccessControl();
  const { setOpenMobile, isMobile } = useSidebar(); // Get the function to close the mobile sidebar and isMobile state

  const navItems = allNavItems.filter(item => {
    if (item.mobileOnly && !isMobile) return false;
    return role && isAllowed(role, item.href)
  });

  const filteredAccountNavItems = accountNavItems.filter(item => role && isAllowed(role, item.href));


  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const isNavItemActive = (item: NavItem, currentPathname: string): boolean => {
    if (item.exact) {
      return currentPathname === item.href;
    }
    return currentPathname.startsWith(item.href);
  };

  const getDefaultHomePage = () => {
    if (!user) return "/login";
    if (role === 'viewer') return "/products";
    return "/dashboard";
  }

  return (
    <Sidebar collapsible="icon" className={cn(className)}>
       <div
        className="relative flex h-16 shrink-0 items-center justify-center px-4 py-2 group-data-[state=collapsed]/sidebar:h-14 group-data-[state=collapsed]/sidebar:p-0"
      >
        <Link
          href={getDefaultHomePage()}
          className="flex items-center gap-2 font-poppins text-2xl font-bold text-primary"
          aria-label="Home"
          onClick={() => setOpenMobile(false)}
        >
          <Image src={`/logo.png?v=${new Date().getTime()}`} alt="SheetSync Logo" width={28} height={28} className="h-7 w-7" />
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
                isActive={isNavItemActive(item, pathname)}
                tooltip={{ children: item.label, className: "group-data-[state=expanded]/sidebar:hidden" }}
              >
                <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
                   isActive={isNavItemActive(item, pathname)}
                   tooltip={{ children: item.label, className: "group-data-[state=expanded]/sidebar:hidden" }}
                 >
                   <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
                 {user.email && <p className="truncate text-xs text-muted-foreground/70">{user.email}</p>}
               </div>
           </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
