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
  const adminPaths = [...allNavItems, ...accountNavItems]
    .filter(item => item.roles.includes('admin'))
    .map(item => item.href);
    
  const viewerPaths = [...allNavItems, ...accountNavItems]
    .filter(item => item.roles.includes('viewer'))
    .map(item => item.href);
    
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
  
  const [isInitialized, setIsInitialized] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem(PERMISSIONS_CACHE_KEY);
    }
    return false;
  });

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
          const newPermissions = {
              ...getDefaultPermissions(),
              ...response.data,
              viewerFeatures: response.data.viewerFeatures || []
          };
          setPermissions(newPermissions);
          localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(newPermissions));
        }
      } catch (err) {
        console.error("AccessControl: Sync failed.", err);
      } finally {
        setIsInitialized(true);
      }
    }

    loadPermissions();
  }, []);

  const setPermission = useCallback((roleToSet: 'viewer', path: string, isEnabled: boolean) => {
    if (role !== 'admin') {
      toast({
        title: "Permission Denied",
        description: "Only admins can change access control settings.",
        variant: "destructive",
      });
      return;
    }

    setPermissions(prevPermissions => {
      const currentPaths = prevPermissions[roleToSet] || [];
      const newPaths = isEnabled
        ? [...new Set([...currentPaths, path])] 
        : currentPaths.filter(p => p !== path); 

      let newDefaultPath = prevPermissions.viewerDefaultPath;
      if (!isEnabled && path === newDefaultPath) {
          newDefaultPath = newPaths.length > 0 ? newPaths[0] : '/inventory/add';
      }

      const updatedPermissions = { 
          ...prevPermissions, 
          [roleToSet]: newPaths,
          viewerDefaultPath: newDefaultPath
      };
      
      localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(updatedPermissions));
      
      setPermissionsAction(updatedPermissions).then(response => {
        if (response.success) {
          toast({ title: "Permissions Saved", description: `Access updated.` });
        }
      }).catch(console.error);

      return updatedPermissions;
    });
  }, [role, toast]);

  const setFeaturePermission = useCallback((feature: ViewerFeature, isEnabled: boolean) => {
    if (role !== 'admin') return;

    setPermissions(prev => {
        const currentFeatures = prev.viewerFeatures || [];
        const newFeatures = isEnabled
            ? [...new Set([...currentFeatures, feature])]
            : currentFeatures.filter(f => f !== feature);
        
        const updated = { ...prev, viewerFeatures: newFeatures };
        localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(updated));
        setPermissionsAction(updated).catch(console.error);
        toast({ title: "Action Permission Updated" });
        return updated;
    });
  }, [role, toast]);

  const setViewerDefaultPath = useCallback((path: string) => {
    if (role !== 'admin') return;

    setPermissions(prev => {
        const updated = { ...prev, viewerDefaultPath: path };
        localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(updated));
        setPermissionsAction(updated).catch(console.error);
        toast({ title: "Default Page Updated" });
        return updated;
    });
  }, [role, toast]);


  const isAllowed = useCallback((userRole: 'admin' | 'viewer', path: string): boolean => {
    if (userRole === 'admin') return true;
    if (!userRole) return false;
    const userPermissions = permissions[userRole] || [];
    return userPermissions.includes(path);
  }, [permissions]);

  const hasFeature = useCallback((feature: ViewerFeature): boolean => {
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
  if (context === undefined) {
    throw new Error('useAccessControl must be used within an AccessControlProvider');
  }
  return context;
}
