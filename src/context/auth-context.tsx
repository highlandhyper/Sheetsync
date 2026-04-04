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
import { fetchAllDataAction, saveUserRegistryAction } from '@/app/actions';
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
  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ROLE_CACHE_KEY) as Role;
    }
    return null;
  });
  const [userRegistry, setUserRegistry] = useState<AppUser[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(REGISTRY_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  const refreshRegistry = useCallback(async () => {
    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data?.users) {
        setUserRegistry(response.data.users);
        localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(response.data.users));
        return response.data.users;
      }
    } catch (err) {
      console.warn("Auth: Registry sync failed.");
    }
    return userRegistry;
  }, [userRegistry]);

  const determineRole = useCallback((email: string | null, registry: AppUser[]): Role | null => {
    if (!email) return null;
    const lowerEmail = email.toLowerCase().trim();
    
    const matchedUser = registry.find(u => u.email.toLowerCase().trim() === lowerEmail);
    if (matchedUser) return matchedUser.role;

    // FALLBACK: If they exist in Firebase Auth but NOT in the registry yet,
    // they are likely an Admin (Owner) or the specific viewer@example.com account.
    if (lowerEmail === 'viewer@example.com') return 'viewer';
    return 'admin'; 
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Sync registry first to get latest roles
        const freshRegistry = await refreshRegistry();
        const determinedRole = determineRole(currentUser.email, freshRegistry);
        
        // AUTO-BOOTSTRAP: If registry is empty or missing current user, add them as admin
        if (determinedRole === 'admin' && !freshRegistry.some(u => u.email.toLowerCase() === currentUser.email?.toLowerCase())) {
            const newUser: AppUser = {
                email: currentUser.email!.toLowerCase(),
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            saveUserRegistryAction([...freshRegistry, newUser]).catch(console.error);
        }

        setRole(determinedRole);
        localStorage.setItem(ROLE_CACHE_KEY, determinedRole || '');
      } else {
        setRole(null);
        localStorage.removeItem(ROLE_CACHE_KEY);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshRegistry, determineRole]);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (!auth) return { success: false, error: "Auth service unavailable." };

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      // Post-login registry sync
      const freshRegistry = await refreshRegistry();
      const determinedRole = determineRole(userCredential.user.email, freshRegistry);
      
      setRole(determinedRole);
      localStorage.setItem(ROLE_CACHE_KEY, determinedRole || '');
      
      return { success: true, role: determinedRole };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [refreshRegistry, determineRole]);

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
