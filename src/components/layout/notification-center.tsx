'use client';

import * as React from 'react';
import { Bell, BellDot, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, AlertCircle, MessageSquare, Key, X, PackagePlus } from 'lucide-react';
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
import { Badge } from '../ui/badge';

const NotificationIcon = ({ type }: { type: AppNotification['type'] }) => {
  switch (type) {
    case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'request': return <MessageSquare className="h-4 w-4 text-primary" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

interface NotificationCenterProps {
  onOpenProductRequest?: (barcode: string, requestId?: string) => void;
}

export function NotificationCenter({ onOpenProductRequest }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    
    if (n.type === 'request' && n.metadata?.type === 'add_product_request' && n.metadata.barcode) {
      onOpenProductRequest?.(n.metadata.barcode, n.metadata.requestId);
    }
    
    // Close panel if redirecting to add inventory
    if (n.link === '/inventory/add') {
        setIsOpen(false);
    }
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
      <PopoverContent className="w-80 p-0 shadow-2xl animate-fade-in border-none overflow-hidden" align="end">
        <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="font-black text-xs uppercase tracking-widest">
              Security Logs
            </h3>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                onClick={clearAll}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <React.Fragment key={n.id}>
                  <div 
                    className={cn(
                      "p-4 transition-all relative group cursor-pointer border-b last:border-0",
                      !n.isRead ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {!n.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0 bg-background p-1.5 rounded-full shadow-sm border">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <p className={cn("text-sm font-bold leading-tight", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                          {n.message}
                        </p>
                        
                        {/* PROMINENT OTP BADGE FOR AUTHORIZATIONS */}
                        {n.metadata?.otp && (
                            <div className="mt-3 py-2.5 px-4 bg-white border-2 border-primary/20 rounded-xl flex items-center justify-between group/otp hover:border-primary/40 transition-all shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="bg-primary/10 p-1 rounded-md">
                                        <Key className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Activation OTP</span>
                                </div>
                                <span className="font-mono text-xl font-black text-primary tracking-[0.2em]">{n.metadata.otp}</span>
                            </div>
                        )}

                        {/* PRODUCT REQUEST CONTEXT */}
                        {n.metadata?.type === 'add_product_request' && (
                            <div className="mt-2 py-2 px-3 bg-orange-500/5 border border-orange-500/10 rounded-lg flex items-center gap-2">
                                <PackagePlus className="h-3 w-3 text-orange-600" />
                                <span className="text-[10px] font-bold text-orange-700 truncate">SKU: {n.metadata.barcode}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-tighter">
                                {formatDistanceToNow(parseISO(n.timestamp), { addSuffix: true })}
                            </span>
                            
                            {n.metadata?.type === 'add_product_request' ? (
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary">
                                    Review Barcode
                                </Badge>
                            ) : n.link && (
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary">
                                    Go to Action
                                </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <div className="bg-muted p-5 rounded-full mb-4 shadow-inner">
                <Bell className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No Active Alerts</p>
              <p className="text-xs text-muted-foreground/60 mt-2 font-medium">Logs and authorization codes will appear here.</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-3 bg-muted/20 border-t flex justify-center">
          <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all" onClick={() => setIsOpen(false)}>
            Dismiss Panel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
