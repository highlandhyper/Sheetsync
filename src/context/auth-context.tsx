'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type UserCredential
} from 'firebase/auth';
import type { LoginFormValues } from '@/lib/schemas';
import { fetchUserRegistryAction, saveUserRegistryAction } from '@/app/actions';
import type { Role, AppUser } from '@/lib/types';

interface AuthContextLoginResponse {
  success: boolean;
  error?: string;
  role?: Role | null;
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  userRegistry: AppUser[];
  login: (values: LoginFormValues) => Promise<AuthContextLoginResponse>;
  logout: () => Promise<void>;
  refreshRegistry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_CACHE_KEY = 'sheetSync_cached_role';
const REGISTRY_CACHE_KEY = 'sheetSync_user_registry';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userRegistry, setUserRegistry] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  // 1. Initial hydration from localStorage to prevent flash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedRole = localStorage.getItem(ROLE_CACHE_KEY);
      if (cachedRole) setRole(cachedRole as Role);
      
      const cachedRegistry = localStorage.getItem(REGISTRY_CACHE_KEY);
      if (cachedRegistry) setUserRegistry(JSON.parse(cachedRegistry));
    }
  }, []);

  const refreshRegistry = useCallback(async () => {
    try {
      // Use lightweight action for startup
      const response = await fetchUserRegistryAction();
      if (response.success && response.data) {
        setUserRegistry(response.data);
        localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(response.data));
        return response.data;
      }
    } catch (err) {
      console.warn("Auth: Registry sync failed.");
    }
    return userRegistry;
  }, [userRegistry]);

  const syncUserToRegistry = useCallback(async (currentUser: User, currentRegistry: AppUser[]) => {
    if (!currentUser.email) return;
    
    const lowerEmail = currentUser.email.toLowerCase().trim();
    const existingIndex = currentRegistry.findIndex(u => u.email.toLowerCase().trim() === lowerEmail);
    
    const updatedRegistry = [...currentRegistry];
    const now = new Date().toISOString();

    if (existingIndex > -1) {
        updatedRegistry[existingIndex] = {
            ...updatedRegistry[existingIndex],
            uid: currentUser.uid,
            lastLoginAt: now
        };
    } else {
        const newRole: Role = currentRegistry.length === 0 ? 'admin' : 'viewer';
        updatedRegistry.push({
            uid: currentUser.uid,
            email: lowerEmail,
            role: newRole,
            createdAt: now,
            lastLoginAt: now
        });
    }

    try {
        await saveUserRegistryAction(updatedRegistry);
        setUserRegistry(updatedRegistry);
        localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(updatedRegistry));
    } catch (e) {
        console.error("Failed to sync user to registry:", e);
    }
  }, []);

  const determineRole = useCallback((email: string | null, registry: AppUser[]): Role | null => {
    if (!email) return null;
    const lowerEmail = email.toLowerCase().trim();
    const matchedUser = registry.find(u => u.email.toLowerCase().trim() === lowerEmail);
    return matchedUser ? matchedUser.role : null;
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // FAIL-SAFE: If Firebase or networking is hanging, unblock the UI after 3.5s
    const safetyTimer = setTimeout(() => {
        setLoading(false);
    }, 3500);

    const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Optimized: Fetch registry ONLY (much faster than full data sync)
        const freshRegistry = await refreshRegistry();
        
        const determinedRole = determineRole(currentUser.email, freshRegistry);
        setRole(determinedRole);
        if (determinedRole) {
            localStorage.setItem(ROLE_CACHE_KEY, determinedRole);
        }

        // Run sync in background without blocking initial transition
        syncUserToRegistry(currentUser, freshRegistry);
      } else {
        setRole(null);
        localStorage.removeItem(ROLE_CACHE_KEY);
      }
      
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    return () => {
        unsubscribe();
        clearTimeout(safetyTimer);
    };
  }, [refreshRegistry, determineRole, syncUserToRegistry]);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (!auth) return { success: false, error: "Auth service unavailable." };

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const freshRegistry = await refreshRegistry();
      await syncUserToRegistry(userCredential.user, freshRegistry);
      const determinedRole = determineRole(userCredential.user.email, freshRegistry);
      setRole(determinedRole);
      return { success: true, role: determinedRole };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [refreshRegistry, determineRole, syncUserToRegistry]);

  const logout = useCallback(async () => {
    localStorage.removeItem(ROLE_CACHE_KEY);
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setRole(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, role, loading, userRegistry, login, logout, refreshRegistry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
