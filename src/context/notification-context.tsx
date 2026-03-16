'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { AppNotification } from '@/lib/types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'sheetSyncNotifications';

export function NotificationProvider({ children }: PropsWithChildren) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const cleanupOldNotifications = useCallback((list: AppNotification[]) => {
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000;
    
    return list.filter(n => {
      // If never opened, keep it indefinitely (or until manual clear)
      if (!n.openedAt) return true;
      
      // If opened, check if 24 hours have passed since opening
      const openedAtTime = new Date(n.openedAt).getTime();
      return (now - openedAtTime) < TTL_MS;
    });
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(cleanupOldNotifications(parsed));
      }
    } catch (e) {
      console.warn('NotificationContext: Could not load notifications from storage.');
    }
    setIsInitialized(true);
  }, [cleanupOldNotifications]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    }
  }, [notifications, isInitialized]);

  // Periodic cleanup every 15 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications(prev => cleanupOldNotifications(prev));
    }, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [cleanupOldNotifications]);

  const addNotification = useCallback((payload: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotification: AppNotification = {
      ...payload,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true, openedAt: n.openedAt || new Date().toISOString() } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, openedAt: n.openedAt || now })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.isRead).length
  , [notifications]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll
  }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll]);

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
