

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
  };
};

export function AccessControlProvider({ children }: PropsWithChildren) {
  const [permissions, setPermissions] = useState<Permissions>(getDefaultPermissions());
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { role } = useAuth(); // We need the user's role to decide if we should save changes

  useEffect(() => {
    async function loadPermissions() {
      const response = await getPermissionsAction();
      if (response.success && response.data) {
        setPermissions(response.data);
      } else {
        // This is expected on first run. The default permissions will be used
        // and saved on the first change by an admin.
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
        ? [...new Set([...currentPaths, path])] // Add path if it doesn't exist
        : currentPaths.filter(p => p !== path); // Remove path

      const updatedPermissions = { ...prevPermissions, [roleToSet]: newPaths };
      
      // Asynchronously save to the backend without waiting
      setPermissionsAction(updatedPermissions).then(response => {
        if (response.success) {
          toast({ title: "Permissions Saved", description: `Access for 'viewer' role to ${path} has been updated.` });
        } else {
          toast({
            title: "Save Failed",
            description: response.message || "Could not save permissions to the server.",
            variant: "destructive",
          });
          // Note: We are not reverting the state optimistically. The UI reflects the change instantly.
        }
      });

      return updatedPermissions;
    });
  }, [role, toast]);


  const isAllowed = useCallback((userRole: 'admin' | 'viewer', path: string): boolean => {
    if (userRole === 'admin') return true; 
    if (!isInitialized) return false; 

    // Check for exact path match
    if (permissions[userRole] && permissions[userRole].includes(path)) {
      return true;
    }
    
    return false;
  }, [permissions, isInitialized]);


  return (
    <AccessControlContext.Provider value={{ permissions, isInitialized, setPermission, isAllowed }}>
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
