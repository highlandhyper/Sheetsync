'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren } from 'react';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import type { Permissions } from '@/lib/types';
import { getPermissionsAction, setPermissionsAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';


interface AccessControlContextType {
  permissions: Permissions;
  isInitialized: boolean;
  setPermission: (role: 'viewer', path: string, isEnabled: boolean) => void;
  setViewerDefaultPath: (path: string) => void;
  isAllowed: (role: 'admin' | 'viewer', path: string) => boolean;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);

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
    viewerDefaultPath: '/inventory/add',
  };
};

export function AccessControlProvider({ children }: PropsWithChildren) {
  const [permissions, setPermissions] = useState<Permissions>(getDefaultPermissions());
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { role } = useAuth();

  useEffect(() => {
    async function loadPermissions() {
      const response = await getPermissionsAction();
      if (response.success && response.data) {
        setPermissions(response.data);
      } else {
        console.log(response.message || "Using default permissions.");
        setPermissions(getDefaultPermissions());
      }
      setIsInitialized(true);
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

      // If the path being removed was the default path, reset it
      let newDefaultPath = prevPermissions.viewerDefaultPath;
      if (!isEnabled && path === newDefaultPath) {
          newDefaultPath = newPaths.length > 0 ? newPaths[0] : '/inventory/add';
      }

      const updatedPermissions = { 
          ...prevPermissions, 
          [roleToSet]: newPaths,
          viewerDefaultPath: newDefaultPath
      };
      
      setPermissionsAction(updatedPermissions).then(response => {
        if (response.success) {
          toast({ title: "Permissions Saved", description: `Access for 'viewer' role to ${path} has been updated.` });
        } else {
          toast({
            title: "Save Failed",
            description: response.message || "Could not save permissions to the server.",
            variant: "destructive",
          });
        }
      });

      return updatedPermissions;
    });
  }, [role, toast]);

  const setViewerDefaultPath = useCallback((path: string) => {
    if (role !== 'admin') {
      toast({
        title: "Permission Denied",
        description: "Only admins can set the default landing page.",
        variant: "destructive",
      });
      return;
    }

    setPermissions(prev => {
        const updated = { ...prev, viewerDefaultPath: path };
        setPermissionsAction(updated).then(response => {
            if (response.success) {
                toast({ title: "Default Page Updated", description: `Viewers will now land on ${path} by default.` });
            } else {
                toast({
                    title: "Save Failed",
                    description: response.message || "Could not save settings.",
                    variant: "destructive",
                });
            }
        });
        return updated;
    });
  }, [role, toast]);


  const isAllowed = useCallback((userRole: 'admin' | 'viewer', path: string): boolean => {
    if (userRole === 'admin') return true;
    if (!isInitialized) return false;

    const userPermissions = permissions[userRole] || [];
    return userPermissions.includes(path);
    
  }, [permissions, isInitialized]);


  return (
    <AccessControlContext.Provider value={{ permissions, isInitialized, setPermission, setViewerDefaultPath, isAllowed }}>
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
