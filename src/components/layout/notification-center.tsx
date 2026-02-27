'use client';

import * as React from 'react';
import { Bell, BellDot, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, AlertCircle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/context/notification-context';
import type { AppNotification } from '@/lib/types';

const NotificationIcon = ({ type }: { type: AppNotification['type'] }) => {
  switch (type) {
    case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'request': return <MessageSquare className="h-4 w-4 text-primary" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleNotificationClick = (id: string) => {
    markAsRead(id);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground transition-all duration-300"
          aria-label="Notifications"
        >
          {unreadCount > 0 ? (
            <>
              <BellDot className="h-4 w-4 text-primary animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl animate-fade-in" align="end">
        <div className="flex items-center justify-between p-4 bg-muted/30">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </h3>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-80">
          {notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <React.Fragment key={n.id}>
                  <div 
                    className={cn(
                      "p-4 transition-colors relative group cursor-pointer",
                      !n.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleNotificationClick(n.id)}
                  >
                    {!n.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <p className={cn("text-sm font-semibold leading-none", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-medium">
                          {formatDistanceToNow(parseISO(n.timestamp), { addSuffix: true })}
                        </p>
                        {n.link && (
                          <Link 
                            href={n.link} 
                            className="inline-block mt-2 text-xs font-bold text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(n.id);
                            }}
                          >
                            View Details
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/60 mt-1">No new notifications at the moment.</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-2 bg-muted/10">
          <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground hover:text-primary transition-colors h-8" onClick={() => setIsOpen(false)}>
            Close Panel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
