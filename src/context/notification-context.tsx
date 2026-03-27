'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useCallback } from 'react';
import type { AppNotification, SpecialEntryRequest } from '@/lib/types';
import { useDataCache } from './data-cache-context';
import { useAuth } from './auth-context';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { specialRequests, updateSpecialRequests, role } = useDataCache();
  const { user: authUser } = useAuth();

  // DERIVE notifications from shared sheet state (specialRequests)
  const notifications = useMemo(() => {
    if (!role || !authUser?.email) return [];

    const list: AppNotification[] = [];

    specialRequests.forEach((req: SpecialEntryRequest) => {
      // ADMIN VIEW: See pending requests that aren't dismissed
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

      // VIEWER VIEW: See their own approved/rejected status
      if (role === 'viewer' && req.userEmail === authUser.email) {
        if ((req.status === 'approved' || req.status === 'rejected') && !req.isReadByUser) {
          list.push({
            id: `notif_${req.id}`,
            title: req.status === 'approved' ? 'Access Authorized' : 'Request Declined',
            message: req.status === 'approved' 
              ? `Your silent mode request was granted. Use OTP: ${req.otp || 'N/A'}`
              : `Your request for ${req.staffName} was declined by an administrator.`,
            timestamp: req.approvedAt || req.requestedAt,
            type: req.status === 'approved' ? 'success' : 'error',
            isRead: false,
            link: req.status === 'approved' ? '/inventory/add' : undefined
          });
        }
      }
    });

    // Sort by timestamp descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [specialRequests, role, authUser]);

  const markAsRead = useCallback(async (id: string) => {
    // Strip the prefix to get the original request ID
    const requestId = id.replace('notif_', '');
    const updated = specialRequests.map(req => {
      if (req.id !== requestId) return req;
      if (role === 'admin') return { ...req, isDismissedByAdmin: true };
      return { ...req, isReadByUser: true };
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests, role]);

  const markAllAsRead = useCallback(async () => {
    const updated = specialRequests.map(req => {
      if (role === 'admin' && req.status === 'pending') return { ...req, isDismissedByAdmin: true };
      if (role === 'viewer' && req.userEmail === authUser?.email) return { ...req, isReadByUser: true };
      return req;
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests, role, authUser]);

  const clearAll = useCallback(async () => {
    // In this derived architecture, "clear all" is same as "mark all as read"
    await markAllAsRead();
  }, [markAllAsRead]);

  // Legacy method for local-only transient alerts if needed
  const addNotification = useCallback(() => {
    // Non-persistent notifications are ignored in this version to prioritize sync
  }, []);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification
  }), [notifications, unreadCount, markAsRead, markAllAsRead, clearAll, addNotification]);

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
