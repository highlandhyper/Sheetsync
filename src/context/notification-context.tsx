'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react';
import type { AppNotification, SpecialEntryRequest } from '@/lib/types';
import { useDataCache } from './data-cache-context';
import { useAuth } from './auth-context';
import { useGeneralSettings } from './general-settings-context';
import { useToast } from '@/hooks/use-toast';
import { isAfter, subHours, parseISO } from 'date-fns';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { specialRequests, updateSpecialRequests } = useDataCache();
  const { user: authUser, role } = useAuth();
  const { settings } = useGeneralSettings();
  const { toast } = useToast();
  const prevApprovedIdsRef = useRef<Set<string>>(new Set());
  const isInitialSyncRef = useRef(true);

  const notifications = useMemo(() => {
    if (!role || !authUser?.email) return [];

    const list: AppNotification[] = [];
    const currentEmail = authUser.email.toLowerCase().trim();
    const threshold = subHours(new Date(), 48); 

    specialRequests.forEach((req: SpecialEntryRequest) => {
      const reqEmail = (req.userEmail || "").toLowerCase().trim();
      const reqDate = parseISO(req.requestedAt);
      const isGlobal = req.staffName === "ALL PERSONNEL (GLOBAL)";
      
      if (!isAfter(reqDate, threshold)) return;

      if (role === 'admin') {
        if (req.status === 'pending' && !req.isDismissedByAdmin) {
          if (req.type === 'product_add') {
            list.push({
              id: `notif_${req.id}`,
              title: 'Product Addition Requested',
              message: `${req.staffName} is requesting a new product for barcode: ${req.reason}`,
              timestamp: req.requestedAt,
              type: 'request',
              isRead: false,
              metadata: {
                barcode: req.reason,
                requestId: req.id,
                type: 'add_product_request'
              }
            });
          } else if (req.type === 'inventory_edit') {
            list.push({
              id: `notif_${req.id}`,
              title: 'Inventory Edit Requested',
              message: `${req.staffName} wants to update ${req.editDetails?.productName}.`,
              timestamp: req.requestedAt,
              type: 'request',
              isRead: false,
              link: '/dashboard',
              metadata: {
                requestId: req.id,
                type: 'edit_request'
              }
            });
          } else {
            list.push({
              id: `notif_${req.id}`,
              title: 'Access Request',
              message: `${req.staffName} is requesting silent entry authorization.`,
              timestamp: req.requestedAt,
              type: 'request',
              isRead: false,
              link: '/dashboard'
            });
          }
        } else if (isGlobal && req.status === 'approved' && !req.isDismissedByAdmin) {
            list.push({
                id: `notif_${req.id}`,
                title: 'Global Silent Mode Active',
                message: `AUTHORIZATION GRANTED. KEY: ${req.otp || '----'}`,
                timestamp: req.approvedAt || req.requestedAt,
                type: 'success',
                isRead: false,
                metadata: {
                    requestId: req.id,
                    otp: req.otp,
                    type: 'authorization'
                }
            });
        }
      }

      if (role === 'viewer' && (reqEmail === currentEmail || isGlobal)) {
        if (req.status === 'approved' || req.status === 'rejected') {
          let title = '';
          let message = '';
          let link = undefined;

          if (req.type === 'inventory_edit') {
            title = req.status === 'approved' ? 'Edit Request Approved' : 'Edit Request Declined';
            message = req.status === 'approved' 
                ? `Update for ${req.editDetails?.productName} has been applied.`
                : `Edit request for ${req.editDetails?.productName} was declined.`;
          } else {
            title = isGlobal ? 'System-Wide Authorization' : (req.status === 'approved' ? 'Access Authorized' : 'Request Declined');
            message = req.status === 'approved' 
              ? `AUTHORIZATION GRANTED. KEY: ${req.otp || '----'}`
              : `Your request for ${req.staffName} was declined.`;
            link = req.status === 'approved' ? '/inventory/add' : undefined;
          }

          list.push({
            id: `notif_${req.id}`,
            title,
            message,
            timestamp: req.approvedAt || req.requestedAt,
            type: req.status === 'approved' ? 'success' : 'error',
            isRead: !!req.isReadByUser,
            link,
            metadata: {
                requestId: req.id,
                otp: req.otp,
                type: 'authorization'
            }
          });
        }
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [specialRequests, role, authUser]);

  // NATIVE PUSH & IN-APP TOAST DISPATCHER
  useEffect(() => {
    if (!authUser?.email) return;

    // Detect new authorization alerts
    const newNotifications = notifications.filter(n => {
        const isAuth = n.metadata?.type === 'authorization';
        const isNew = !prevApprovedIdsRef.current.has(n.id);
        return isAuth && isNew && !n.isRead;
    });

    if (newNotifications.length > 0 && !isInitialSyncRef.current) {
        newNotifications.forEach(n => {
            // Trigger in-app toast for visibility
            toast({
                title: n.title,
                description: n.message,
            });

            // Trigger native push if enabled
            if (settings.isBrowserNotificationsEnabled && typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    try {
                        new Notification(`SheetSync: ${n.title}`, {
                            body: n.message,
                            icon: '/logo-pwa.jpg',
                            tag: n.id,
                            requireInteraction: true
                        });
                    } catch (e) {
                        console.warn("Browser Notifications failed to fire.");
                    }
                }
            }
        });
    }

    // Update historical approved set
    const currentNotifIds = new Set(notifications.map(n => n.id));
    prevApprovedIdsRef.current = currentNotifIds;
    isInitialSyncRef.current = false;
    
  }, [notifications, settings.isBrowserNotificationsEnabled, authUser, toast]);

  const requestPermission = useCallback(async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const requestId = id.startsWith('notif_') ? id.replace('notif_', '') : id;
    const updated = specialRequests.map(req => {
      if (req.id !== requestId) return req;
      if (role === 'admin') return { ...req, isDismissedByAdmin: true };
      return { ...req, isReadByUser: true };
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests, role]);

  const markAllAsRead = useCallback(async () => {
    const currentEmail = authUser?.email?.toLowerCase().trim();
    const updated = specialRequests.map(req => {
      const reqEmail = (req.userEmail || "").toLowerCase().trim();
      if (role === 'admin' && req.status === 'pending') return { ...req, isDismissedByAdmin: true };
      if (role === 'viewer' && (reqEmail === currentEmail || req.staffName === "ALL PERSONNEL (GLOBAL)")) return { ...req, isReadByUser: true };
      return req;
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests, role, authUser]);

  const clearAll = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const addNotification = useCallback(() => {}, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification,
    requestPermission
  }), [notifications, unreadCount, markAsRead, markAllAsRead, clearAll, addNotification, requestPermission]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
