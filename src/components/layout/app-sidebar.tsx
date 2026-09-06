'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { useSpecialEntry } from '@/context/special-entry-context';

import {
  allNavItems,
  accountNavItems,
  type NavItem,
} from '@/lib/nav-config';
import { cn } from '@/lib/utils';

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  const { user, loading, role, logout } = useAuth();
  const { isAllowed } = useAccessControl();
  const { pendingRequests } = useSpecialEntry();
  const { setOpenMobile, isMobile } = useSidebar();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pendingCount = pendingRequests.length;

  const navItems = useMemo(
    () =>
      allNavItems.filter((item) => {
        if (item.mobileOnly && !isMobile) return false;

        return Boolean(role && isAllowed(role, item.href));
      }),
    [role, isAllowed, isMobile],
  );

  const filteredAccountNavItems = useMemo(
    () =>
      accountNavItems.filter((item) =>
        Boolean(role && isAllowed(role, item.href)),
      ),
    [role, isAllowed],
  );

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';

    const parts = email.split('@')[0].split(/[._-]/);

    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return email.substring(0, 2).toUpperCase();
  };

  const isNavItemActive = (
    item: NavItem,
    currentPathname: string,
  ): boolean => {
    if (item.exact) {
      return currentPathname === item.href;
    }

    return currentPathname.startsWith(item.href);
  };

  const getDefaultHomePage = () => {
    if (!user) return '/login';
    if (role === 'viewer') return '/products';

    return '/dashboard';
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        'border-r border-sidebar-border/70 bg-sidebar',
        className,
      )}
    >
      {/* Brand */}
      <div
        className="
          flex h-[68px] shrink-0 items-center border-b border-sidebar-border/60 px-3
          group-data-[state=collapsed]/sidebar:justify-center
          group-data-[state=collapsed]/sidebar:px-2
        "
      >
        <Link
          href={getDefaultHomePage()}
          aria-label="SheetSync home"
          onClick={() => setOpenMobile(false)}
          className="
            flex min-w-0 items-center gap-3 rounded-xl px-2 py-2
            transition-colors hover:bg-sidebar-accent/60
            group-data-[state=collapsed]/sidebar:px-0
          "
        >
          {mounted && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border/60 bg-background shadow-sm">
              <Image
                src="/logo-pwa.jpg"
                alt="SheetSync Logo"
                width={36}
                height={36}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          )}

          <div className="min-w-0 group-data-[state=collapsed]/sidebar:hidden">
            <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              SheetSync
            </p>
            <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Inventory System
            </p>
          </div>
        </Link>
      </div>

      {/* Main navigation */}
      <SidebarContent className="px-2 py-3">
        <SidebarMenu className="list-none space-y-1">
          {navItems.map((item) => {
            const active = isNavItemActive(item, pathname);

            return (
              <SidebarMenuItem
                key={`${item.href}-${item.label}`}
                className="relative"
              >
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={{
                    children:
                      item.href === '/approvals' && pendingCount > 0
                        ? `${item.label} (${pendingCount} pending)`
                        : item.label,
                    className:
                      'group-data-[state=expanded]/sidebar:hidden',
                  }}
                  className={cn(
                    `
                      h-10 rounded-xl px-3 text-sm font-medium
                      transition-colors
                      group-data-[state=collapsed]/sidebar:h-10
                      group-data-[state=collapsed]/sidebar:w-10
                      group-data-[state=collapsed]/sidebar:justify-center
                      group-data-[state=collapsed]/sidebar:px-0
                    `,
                    active
                      ? 'bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/15 hover:text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpenMobile(false)}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active
                          ? 'text-sidebar-primary'
                          : 'text-muted-foreground',
                      )}
                    />

                    <span className="min-w-0 flex-1 truncate group-data-[state=collapsed]/sidebar:hidden">
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>

                {item.href === '/approvals' && pendingCount > 0 && (
                  <SidebarMenuBadge
                    className={cn(
                      `
                        min-w-5 rounded-full bg-destructive px-1.5
                        text-[9px] font-bold text-destructive-foreground
                      `,
                      `
                        group-data-[state=collapsed]/sidebar:right-0
                        group-data-[state=collapsed]/sidebar:top-0
                        group-data-[state=collapsed]/sidebar:flex
                        group-data-[state=collapsed]/sidebar:h-4
                        group-data-[state=collapsed]/sidebar:min-w-4
                        group-data-[state=collapsed]/sidebar:px-1
                        group-data-[state=collapsed]/sidebar:text-[8px]
                      `,
                    )}
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      {user && !loading && (
        <SidebarFooter className="border-t border-sidebar-border/60 px-2 pb-3 pt-2">
          <SidebarMenu className="mb-2 list-none space-y-1">
            {filteredAccountNavItems.map((item) => {
              const active = isNavItemActive(item, pathname);

              return (
                <SidebarMenuItem
                  key={`${item.href}-${item.label}-account`}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={{
                      children: item.label,
                      className:
                        'group-data-[state=expanded]/sidebar:hidden',
                    }}
                    className={cn(
                      `
                        h-10 rounded-xl px-3 text-sm font-medium
                        group-data-[state=collapsed]/sidebar:h-10
                        group-data-[state=collapsed]/sidebar:w-10
                        group-data-[state=collapsed]/sidebar:justify-center
                        group-data-[state=collapsed]/sidebar:px-0
                      `,
                      active
                        ? 'bg-sidebar-primary/10 text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <item.icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active
                            ? 'text-sidebar-primary'
                            : 'text-muted-foreground',
                        )}
                      />

                      <span className="min-w-0 flex-1 truncate group-data-[state=collapsed]/sidebar:hidden">
                        {item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            {/* Mobile sign out */}
            <SidebarMenuItem className="lg:hidden">
              <SidebarMenuButton
                onClick={() => {
                  logout();
                  setOpenMobile(false);
                }}
                className="
                  h-10 rounded-xl px-3 text-destructive
                  hover:bg-destructive/10 hover:text-destructive
                  focus:bg-destructive/10 focus:text-destructive
                "
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate text-sm font-medium group-data-[state=collapsed]/sidebar:hidden">
                  Sign out
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* User identity */}
          <div
            className="
              flex min-w-0 items-center gap-3 rounded-xl bg-sidebar-accent/40 p-2.5
              group-data-[state=collapsed]/sidebar:justify-center
              group-data-[state=collapsed]/sidebar:bg-transparent
              group-data-[state=collapsed]/sidebar:p-1
            "
          >
            <Avatar className="h-9 w-9 shrink-0 rounded-xl border border-sidebar-border/60">
              <AvatarImage
                src={`https://placehold.co/100x100.png?text=${getInitials(
                  user.email,
                )}`}
                alt={user.email || 'User'}
                className="rounded-xl"
              />

              <AvatarFallback className="rounded-xl bg-sidebar-primary/10 text-[10px] font-bold text-sidebar-primary">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                {user.displayName ||
                  user.email?.split('@')[0] ||
                  'User'}
              </p>

              {user.email && (
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
