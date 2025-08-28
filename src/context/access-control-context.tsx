
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren } from 'react';
import { allNavItems, accountNavItems } from '@/lib/nav-config';

type Role = 'admin' | 'viewer';
type Permissions = {
  [key in Role]: string[];
};

interface AccessControlContextType {
  permissions: Permissions;
  isInitialized: boolean;
  setPermission: (role: Role, path: string, isEnabled: boolean) => void;
  isAllowed: (role: Role, path: string) => boolean;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);

const PERMISSIONS_STORAGE_KEY = 'sheetSyncAccessPermissions';

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

  useEffect(() => {
    try {
      const storedPermissions = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (storedPermissions) {
        // Basic validation to ensure it's a plausible permissions object
        const parsed = JSON.parse(storedPermissions);
        if (parsed.admin && parsed.viewer) {
          setPermissions(parsed);
        } else {
          // If structure is wrong, fall back to default and save it
          localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(getDefaultPermissions()));
        }
      } else {
        // If nothing is stored, initialize with default permissions
        localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(getDefaultPermissions()));
      }
    } catch (error) {
      console.warn('Could not access localStorage for permissions. Using default permissions for this session.', error);
      setPermissions(getDefaultPermissions());
    }
    setIsInitialized(true);
  }, []);

  const setPermission = useCallback((role: Role, path: string, isEnabled: boolean) => {
    setPermissions(prevPermissions => {
      const currentPaths = prevPermissions[role] || [];
      let newPaths;
      if (isEnabled) {
        // Add path if it doesn't exist
        newPaths = currentPaths.includes(path) ? currentPaths : [...currentPaths, path];
      } else {
        // Remove path
        newPaths = currentPaths.filter(p => p !== path);
      }
      const updatedPermissions = { ...prevPermissions, [role]: newPaths };
      try {
        localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(updatedPermissions));
      } catch (error) {
        console.warn('Could not save permissions to localStorage.', error);
      }
      return updatedPermissions;
    });
  }, []);

  const isAllowed = useCallback((role: Role, path: string): boolean => {
    if (role === 'admin') return true; // Admins are always allowed
    if (!isInitialized) return false; // Don't allow anything until initialized

    // Check for exact path match
    if (permissions[role] && permissions[role].includes(path)) {
      return true;
    }
    
    // Check for parent route match (e.g. allow /products/manage if /products is allowed)
    // This is a simple check; more complex logic could be needed for deeper nesting
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    if (parentPath && permissions[role] && permissions[role].includes(parentPath)) {
        // This logic is tricky. For now, we'll stick to explicit paths.
        // A user story might be "if I allow /products, should sub-routes be allowed?"
        // Current implementation requires explicit sub-route permission.
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
