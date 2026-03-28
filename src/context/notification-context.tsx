'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useCallback } from 'react';
import type { AppNotification, SpecialEntryRequest } from '@/lib/types';
import { useDataCache } from './data-cache-context';
import { useAuth } from './auth-context';
import { isAfter, subHours, parseISO } from 'date-fns';

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
  const { specialRequests, updateSpecialRequests } = useDataCache();
  const { user: authUser, role } = useAuth();

  const notifications = useMemo(() => {
    // Safety check: Don't process if user/role is missing
    if (!role || !authUser?.email) return [];

    const list: AppNotification[] = [];
    const currentEmail = authUser.email.toLowerCase().trim();
    // Show notifications from the last 48 hours to ensure visibility across shifts
    const threshold = subHours(new Date(), 48); 

    specialRequests.forEach((req: SpecialEntryRequest) => {
      const reqEmail = (req.userEmail || "").toLowerCase().trim();
      const reqDate = parseISO(req.requestedAt);
      
      // TTL Check: Filter out old records
      if (!isAfter(reqDate, threshold)) return;

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
      // We use case-insensitive matching for the email
      if (role === 'viewer' && reqEmail === currentEmail) {
        if (req.status === 'approved' || req.status === 'rejected') {
          list.push({
            id: `notif_${req.id}`,
            title: req.status === 'approved' ? 'Access Authorized' : 'Request Declined',
            message: req.status === 'approved' 
              ? `Your silent mode request for ${req.staffName} was granted. Use the code below to activate.`
              : `Your request for ${req.staffName} was declined by an administrator.`,
            timestamp: req.approvedAt || req.requestedAt,
            type: req.status === 'approved' ? 'success' : 'error',
            isRead: !!req.isReadByUser,
            link: req.status === 'approved' ? '/inventory/add' : undefined,
            metadata: {
                requestId: req.id,
                otp: req.otp,
                type: 'authorization'
            }
          });
        }
      }
    });

    // Return sorted by newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [specialRequests, role, authUser]);

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

  const addNotification = useCallback(() => {
    // This is currently handled by the data sync engine
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

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
