'use client';

import * as React from 'react';
import { 
    Bell, 
    BellDot, 
    CheckCheck, 
    Trash2, 
    Info, 
    CheckCircle2, 
    AlertTriangle, 
    AlertCircle, 
    MessageSquare, 
    Key, 
    X, 
    PackagePlus,
    ShieldCheck,
    ChevronRight,
    ArrowRight
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
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/context/notification-context';
import type { AppNotification } from '@/lib/types';
import { Badge } from '../ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    
    if (n.type === 'request' && n.metadata?.type === 'add_product_request' && n.metadata.barcode) {
      onOpenProductRequest?.(n.metadata.barcode, n.metadata.requestId);
      setIsOpen(false);
    }
  };

  const HeaderActions = () => (
    <div className="flex gap-2">
      {notifications.length > 0 && (
        <>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10 rounded-lg"
            onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
            title="Mark all as read"
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10 rounded-lg"
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
            title="Clear all"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );

  const NotificationList = () => (
    <ScrollArea className={cn("flex-1", isMobile ? "h-full" : "h-[450px]")}>
      {notifications.length > 0 ? (
        <div className="flex flex-col p-2 space-y-2">
          {notifications.map((n) => (
            <div 
              key={n.id} 
              className={cn(
                "group relative p-4 transition-all duration-300 rounded-2xl border cursor-pointer",
                !n.isRead 
                  ? "bg-primary/[0.03] border-primary/10 shadow-sm" 
                  : "bg-card hover:bg-muted/30 border-white/5 shadow-none"
              )}
              onClick={() => handleNotificationClick(n)}
            >
              <div className="flex gap-4">
                <div className="mt-1 shrink-0 bg-background p-2 rounded-xl shadow-sm border border-white/10">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-black uppercase tracking-tight leading-none", !n.isRead ? "text-slate-900 dark:text-white" : "text-muted-foreground")}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2">
                    {n.message}
                  </p>
                  
                  {/* OTP SPECIAL COMPONENT */}
                  {n.metadata?.otp && (
                      <div className="mt-3 py-3 px-4 bg-background border-2 border-primary/10 rounded-2xl flex items-center justify-between shadow-inner">
                          <div className="flex items-center gap-2">
                              <Key className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[9px] font-black uppercase text-primary tracking-widest">Entry OTP</span>
                          </div>
                          <span className="font-mono text-xl font-black text-primary tracking-[0.3em] leading-none">{n.metadata.otp}</span>
                      </div>
                  )}

                  {/* PRODUCT REQUEST CONTEXT */}
                  {n.metadata?.type === 'add_product_request' && (
                      <div className="mt-2 py-2.5 px-3 bg-orange-500/5 border border-orange-500/10 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <PackagePlus className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                            <span className="text-[10px] font-bold text-orange-700 truncate">SKU: {n.metadata.barcode}</span>
                          </div>
                          <ArrowRight className="h-3 w-3 text-orange-400" />
                      </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] text-muted-foreground/40 font-black uppercase tracking-tighter">
                          {formatDistanceToNow(parseISO(n.timestamp), { addSuffix: true })}
                      </span>
                      
                      {n.metadata?.type === 'add_product_request' ? (
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-orange-500/10 border-orange-500/20 text-orange-600">
                              Review Barcode
                          </Badge>
                      ) : n.link && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-primary tracking-widest">
                              Open Action <ChevronRight className="h-2.5 w-2.5" />
                          </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
          <div className="bg-muted/20 p-8 rounded-3xl mb-4 shadow-inner border-2 border-dashed border-white/5">
            <ShieldCheck className="h-12 w-12 text-muted-foreground/10" strokeWidth={1} />
          </div>
          <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-widest">No Security Alerts</p>
          <p className="text-[10px] text-muted-foreground/40 mt-2 font-medium uppercase tracking-tight">System state: Nominal</p>
        </div>
      )}
    </ScrollArea>
  );

  const Trigger = (
    <Button
      variant="outline"
      size="icon"
      className="relative h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground rounded-xl border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all duration-300"
    >
      {unreadCount > 0 ? (
        <>
          <BellDot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" strokeWidth={2.5} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </>
      ) : (
        <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {Trigger}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-[32px] p-0 border-none bg-background overflow-hidden flex flex-col">
          <div className="w-12 h-1.5 bg-muted/40 rounded-full mx-auto mt-4 mb-2 shrink-0" />
          <SheetHeader className="px-6 py-4 flex flex-row items-center justify-between border-b bg-primary text-primary-foreground shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Bell className="h-5 w-5" />
              </div>
              <SheetTitle className="text-lg font-black uppercase tracking-tighter text-white">Security Logs</SheetTitle>
            </div>
            <HeaderActions />
          </SheetHeader>
          <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-zinc-950 pb-safe">
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
      <PopoverContent className="w-[380px] p-0 shadow-2xl border-white/10 overflow-hidden rounded-3xl" align="end" sideOffset={12}>
        <div className="flex items-center justify-between p-5 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="font-black text-sm uppercase tracking-widest">
              Security Hub
            </h3>
          </div>
          <HeaderActions />
        </div>
        <NotificationList />
        <div className="p-3 bg-muted/20 border-t flex justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all" 
            onClick={() => setIsOpen(false)}
          >
            Collapse Hub
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
