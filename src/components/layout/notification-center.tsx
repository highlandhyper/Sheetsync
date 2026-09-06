'use client';

import * as React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellDot,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Info,
  Key,
  MessageSquare,
  PackagePlus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

import { useNotifications } from '@/context/notification-context';
import { useAuth } from '@/context/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AppNotification } from '@/lib/types';

const NotificationIcon = ({
  type,
}: {
  type: AppNotification['type'];
}) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;

    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;

    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;

    case 'request':
      return <MessageSquare className="h-4 w-4 text-primary" />;

    default:
      return <Info className="h-4 w-4 text-sky-500" />;
  }
};

interface NotificationCenterProps {
  onOpenProductRequest?: (
    barcode: string,
    requestId?: string,
  ) => void;
}

export function NotificationCenter({
  onOpenProductRequest,
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();

  const { role } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);

    if (
      notification.type === 'request' &&
      notification.metadata?.type === 'add_product_request' &&
      notification.metadata.barcode
    ) {
      onOpenProductRequest?.(
        notification.metadata.barcode,
        notification.metadata.requestId,
      );

      setIsOpen(false);
    }
  };

  const HeaderActions = () => (
    <div className="flex items-center gap-1">
      {notifications.length > 0 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              markAllAsRead();
            }}
            title="Mark all as read"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="sr-only">Mark all as read</span>
          </Button>

          {role === 'admin' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                clearAll();
              }}
              title="Clear all notifications"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Clear all notifications</span>
            </Button>
          )}
        </>
      )}
    </div>
  );

  const NotificationList = () => (
    <ScrollArea
      className={cn(
        'flex-1',
        isMobile ? 'h-full' : 'h-[460px]',
      )}
    >
      {notifications.length > 0 ? (
        <div className="space-y-1.5 p-2">
          {notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              onClick={() =>
                handleNotificationClick(notification)
              }
              className={cn(
                `
                  group relative block w-full rounded-2xl border
                  p-3.5 text-left transition-colors
                  focus:outline-none focus-visible:ring-2
                  focus-visible:ring-primary/30
                `,
                !notification.isRead
                  ? 'border-primary/15 bg-primary/[0.045] hover:bg-primary/[0.07]'
                  : 'border-transparent bg-transparent hover:border-border/50 hover:bg-muted/30',
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    `
                      mt-0.5 flex h-9 w-9 shrink-0 items-center
                      justify-center rounded-xl border
                    `,
                    !notification.isRead
                      ? 'border-primary/15 bg-background'
                      : 'border-border/50 bg-muted/30',
                  )}
                >
                  <NotificationIcon type={notification.type} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm leading-5',
                        !notification.isRead
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground/80',
                      )}
                    >
                      {notification.title}
                    </p>

                    {!notification.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {notification.message}
                  </p>

                  {notification.metadata?.otp && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Entry OTP
                        </span>
                      </div>

                      <span className="font-mono text-base font-bold tracking-[0.22em] text-primary">
                        {notification.metadata.otp}
                      </span>
                    </div>
                  )}

                  {notification.metadata?.type ===
                    'add_product_request' && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <PackagePlus className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />

                        <span className="truncate text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Barcode: {notification.metadata.barcode}
                        </span>
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(
                        parseISO(notification.timestamp),
                        { addSuffix: true },
                      )}
                    </span>

                    {notification.metadata?.type ===
                    'add_product_request' ? (
                      <Badge
                        variant="outline"
                        className="rounded-lg border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300"
                      >
                        Review
                      </Badge>
                    ) : (
                      notification.link && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-primary">
                          Open
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <p className="mt-4 text-sm font-semibold text-foreground">
            You're all caught up
          </p>

          <p className="mt-1 max-w-[240px] text-xs leading-5 text-muted-foreground">
            New alerts, requests, and system updates will appear here.
          </p>
        </div>
      )}
    </ScrollArea>
  );

  const Trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="
        relative h-9 w-9 rounded-xl
        text-muted-foreground
        hover:bg-muted hover:text-foreground
      "
      aria-label="Notifications"
    >
      {unreadCount > 0 ? (
        <>
          <BellDot
            className="h-4 w-4 text-primary"
            strokeWidth={2.3}
          />

          <span
            className="
              absolute -right-1 -top-1 flex h-[18px] min-w-[18px]
              items-center justify-center rounded-full
              bg-destructive px-1 text-[9px] font-bold
              text-destructive-foreground ring-2 ring-background
            "
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </>
      ) : (
        <Bell className="h-4 w-4" strokeWidth={2} />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {Trigger}
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="
            flex h-[82dvh] flex-col overflow-hidden
            rounded-t-3xl border-x border-t border-border/60
            bg-background p-0
          "
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20" />

          <SheetHeader className="shrink-0 border-b border-border/60 px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>

                <div className="min-w-0 text-left">
                  <SheetTitle className="text-base font-bold tracking-tight">
                    Notifications
                  </SheetTitle>

                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : 'No unread notifications'}
                  </p>
                </div>
              </div>

              <HeaderActions />
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <NotificationList />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {Trigger}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="
          w-[390px] overflow-hidden rounded-2xl
          border-border/60 bg-background p-0 shadow-xl
        "
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Notifications
              </h3>

              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${
                      unreadCount === 1 ? '' : 's'
                    }`
                  : 'No unread notifications'}
              </p>
            </div>
          </div>

          <HeaderActions />
        </div>

        <NotificationList />

        <div className="border-t border-border/60 bg-muted/15 p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full rounded-xl text-xs font-medium text-muted-foreground"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
