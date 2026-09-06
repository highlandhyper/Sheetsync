'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import {
  Eye,
  Home,
  LucideIcon,
  Menu,
  Package,
  Plus,
  SearchCode,
  UserCheck,
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  if (!role) return null;

  const isAdmin = role === 'admin';

  const NavItem = ({
    href,
    icon: Icon,
    label,
    active,
    primary = false,
  }: {
    href: string;
    icon: LucideIcon;
    label: string;
    active?: boolean;
    primary?: boolean;
  }) => {
    if (primary) {
      return (
        <Link
          href={href}
          aria-label={label}
          className="relative flex flex-1 items-center justify-center"
        >
          <div className="absolute -top-5 flex flex-col items-center">
            <div
              className={cn(
                'flex h-13 w-13 items-center justify-center rounded-2xl border-4 border-background bg-primary text-primary-foreground shadow-md transition-transform active:scale-95',
                active && 'ring-4 ring-primary/10',
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </div>

            <span
              className={cn(
                'mt-1 text-[10px] font-semibold',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </div>
        </Link>
      );
    }

    return (
      <Link
        href={href}
        aria-label={label}
        className="flex h-full flex-1 items-center justify-center active:scale-95"
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/60',
            )}
          >
            <Icon
              className="h-[19px] w-[19px]"
              strokeWidth={active ? 2.4 : 2}
            />
          </div>

          <span
            className={cn(
              'text-[10px] font-medium leading-none',
              active ? 'text-primary' : 'text-muted-foreground/65',
            )}
          >
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
    >
      <div className="px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)]">
        <div
          className="
            mx-auto flex h-[66px] w-full max-w-lg items-center
            rounded-2xl border border-border/60
            bg-background/95
            shadow-[0_-4px_18px_rgba(0,0,0,0.06)]
            backdrop-blur-xl
          "
        >
          <NavItem
            href={isAdmin ? '/dashboard' : '/expiry-watch/add'}
            icon={isAdmin ? Home : Eye}
            label={isAdmin ? 'Home' : 'Diary'}
            active={
              isAdmin
                ? pathname === '/dashboard'
                : pathname.startsWith('/expiry-watch')
            }
          />

          <NavItem
            href={isAdmin ? '/products/list' : '/inventory/lookup'}
            icon={isAdmin ? Package : SearchCode}
            label={isAdmin ? 'Catalog' : 'Lookup'}
            active={
              isAdmin
                ? pathname === '/products/list'
                : pathname === '/inventory/lookup'
            }
          />

          <NavItem
            href="/inventory/add"
            icon={Plus}
            label="Add"
            primary
            active={pathname === '/inventory/add'}
          />

          <NavItem
            href={isAdmin ? '/expiry-watch/add' : '/products'}
            icon={isAdmin ? Eye : UserCheck}
            label={isAdmin ? 'Diary' : 'Returns'}
            active={
              isAdmin
                ? pathname.startsWith('/expiry-watch')
                : pathname === '/products'
            }
          />

          <NavItem
            href="/more"
            icon={Menu}
            label="More"
            active={pathname === '/more'}
          />
        </div>
      </div>
    </nav>
  );
}
