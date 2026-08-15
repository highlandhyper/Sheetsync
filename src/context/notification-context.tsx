
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react';
import type { AppNotification, SpecialEntryRequest } from '@/lib/types';
import { useDataCache } from './data-cache-context';
import { useAuth } from './auth-context';
import { useGeneralSettings } from './general-settings-context';
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
  const prevNotificationsCountRef = useRef(0);

  const notifications = useMemo(() => {
    if (!role || !authUser?.email) return [];

    const list: AppNotification[] = [];
    const currentEmail = authUser.email.toLowerCase().trim();
    const threshold = subHours(new Date(), 48); 

    specialRequests.forEach((req: SpecialEntryRequest) => {
      const reqEmail = (req.userEmail || "").toLowerCase().trim();
      const reqDate = parseISO(req.requestedAt);
      
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
        }
      }

      if (role === 'viewer' && reqEmail === currentEmail) {
        if (req.status === 'approved' || req.status === 'rejected') {
          let title = '';
          let message = '';
          let link = undefined;

          if (req.type === 'inventory_edit') {
            title = req.status === 'approved' ? 'Edit Request Approved' : 'Edit Request Declined';
            message = req.status === 'approved' 
                ? `Your update for ${req.editDetails?.productName} has been applied to the catalog.`
                : `Your edit request for ${req.editDetails?.productName} was declined.`;
          } else {
            title = req.status === 'approved' ? 'Access Authorized' : 'Request Declined';
            message = req.status === 'approved' 
              ? `Your silent mode request for ${req.staffName} was granted. Use the code below to activate.`
              : `Your request for ${req.staffName} was declined by an administrator.`;
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

  // NATIVE BROWSER NOTIFICATION ENGINE
  useEffect(() => {
    if (!settings.isBrowserNotificationsEnabled || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    if (notifications.length > prevNotificationsCountRef.current) {
      const latest = notifications[0]; // Newest is at index 0
      if (!latest.isRead) {
        let body = latest.message;
        if (latest.metadata?.otp) {
            body = `KEY GRANTED: Your OTP is ${latest.metadata.otp}. ${latest.message}`;
        }

        try {
            new Notification(`SheetSync: ${latest.title}`, {
                body,
                icon: '/logo-pwa.jpg',
                tag: latest.id,
                requireInteraction: latest.type === 'request' || !!latest.metadata?.otp
            });
        } catch (e) {
            console.warn("Browser Notifications failed to fire.");
        }
      }
    }
    prevNotificationsCountRef.current = notifications.length;
  }, [notifications, settings.isBrowserNotificationsEnabled]);

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
      if (role === 'viewer' && reqEmail === currentEmail) return { ...req, isReadByUser: true };
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
