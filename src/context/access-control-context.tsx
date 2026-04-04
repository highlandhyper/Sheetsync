
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useRef } from 'react';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import type { Permissions, ViewerFeature } from '@/lib/types';
import { getPermissionsAction, setPermissionsAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';

interface AccessControlContextType {
  permissions: Permissions;
  isInitialized: boolean;
  setPermission: (role: 'viewer', path: string, isEnabled: boolean) => void;
  setFeaturePermission: (feature: ViewerFeature, isEnabled: boolean) => void;
  setViewerDefaultPath: (path: string) => void;
  isAllowed: (role: 'admin' | 'viewer', path: string) => boolean;
  hasFeature: (feature: ViewerFeature) => boolean;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);
const PERMISSIONS_CACHE_KEY = 'sheetSync_permissions_cache';

const getDefaultPermissions = (): Permissions => {
  const adminPaths = [...allNavItems, ...accountNavItems].filter(i => i.roles.includes('admin')).map(i => i.href);
  const viewerPaths = [...allNavItems, ...accountNavItems].filter(i => i.roles.includes('viewer')).map(i => i.href);
  return {
    admin: [...new Set(adminPaths)],
    viewer: [...new Set(viewerPaths)],
    viewerFeatures: [],
    viewerDefaultPath: '/inventory/add',
  };
};

export function AccessControlProvider({ children }: PropsWithChildren) {
  const [permissions, setPermissions] = useState<Permissions>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PERMISSIONS_CACHE_KEY);
      return saved ? JSON.parse(saved) : getDefaultPermissions();
    }
    return getDefaultPermissions();
  });
  
  const [isInitialized, setIsInitialized] = useState(true);
  const { toast } = useToast();
  const { role } = useAuth();
  const fetchLockRef = useRef(false);

  useEffect(() => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;

    async function loadPermissions() {
      try {
        const response = await getPermissionsAction();
        if (response.success && response.data) {
          const newPermissions = { ...getDefaultPermissions(), ...response.data };
          setPermissions(newPermissions);
          localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(newPermissions));
        }
      } catch (err) {
        console.warn("AccessControl: Background sync failed.");
      }
    }
    loadPermissions();
  }, []);

  const setPermission = useCallback((roleToSet: 'viewer', path: string, isEnabled: boolean) => {
    if (role !== 'admin') return;
    setPermissions(prev => {
      const current = prev[roleToSet] || [];
      const updated = isEnabled ? [...new Set([...current, path])] : current.filter(p => p !== path);
      const newState = { ...prev, [roleToSet]: updated };
      localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(newState));
      setPermissionsAction(newState).catch(console.error);
      return newState;
    });
  }, [role]);

  const setFeaturePermission = useCallback((feature: ViewerFeature, isEnabled: boolean) => {
    if (role !== 'admin') return;
    setPermissions(prev => {
      const current = prev.viewerFeatures || [];
      const updated = isEnabled ? [...new Set([...current, feature])] : current.filter(f => f !== feature);
      const newState = { ...prev, viewerFeatures: updated };
      localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(newState));
      setPermissionsAction(newState).catch(console.error);
      return newState;
    });
  }, [role]);

  const setViewerDefaultPath = useCallback((path: string) => {
    if (role !== 'admin') return;
    setPermissions(prev => {
      const newState = { ...prev, viewerDefaultPath: path };
      localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(newState));
      setPermissionsAction(newState).catch(console.error);
      return newState;
    });
  }, [role]);

  const isAllowed = useCallback((userRole: 'admin' | 'viewer', path: string) => {
    if (userRole === 'admin') return true;
    return (permissions.viewer || []).includes(path);
  }, [permissions]);

  const hasFeature = useCallback((feature: ViewerFeature) => {
    if (role === 'admin') return true;
    return (permissions.viewerFeatures || []).includes(feature);
  }, [permissions, role]);

  return (
    <AccessControlContext.Provider value={{ permissions, isInitialized, setPermission, setFeaturePermission, setViewerDefaultPath, isAllowed, hasFeature }}>
      {children}
    </AccessControlContext.Provider>
  );
}

export function useAccessControl() {
  const context = useContext(AccessControlContext);
  if (context === undefined) throw new Error('useAccessControl must be used within AccessControlProvider');
  return context;
}
