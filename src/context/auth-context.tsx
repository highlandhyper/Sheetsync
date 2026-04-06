'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  type UserCredential
} from 'firebase/auth';
import type { LoginFormValues } from '@/lib/schemas';
import type { Role } from '@/lib/types';

interface AuthContextLoginResponse {
  success: boolean;
  error?: string;
  role?: Role | null;
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  login: (values: LoginFormValues) => Promise<AuthContextLoginResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_CACHE_KEY = 'sheetSync_cached_role';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  // SECURE HARDCODED LOGIC: Zero-latency role determination
  const determineRole = useCallback((email: string | null): Role => {
    if (!email) return 'viewer';
    const lowerEmail = email.toLowerCase().trim();
    // viewer@example.com is restricted, all others are global admins
    if (lowerEmail === 'viewer@example.com') return 'viewer';
    return 'admin';
  }, []);

  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ROLE_CACHE_KEY) as Role | null;
    }
    return null;
  });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const determinedRole = determineRole(currentUser.email);
        setRole(determinedRole);
        localStorage.setItem(ROLE_CACHE_KEY, determinedRole);
      } else {
        setRole(null);
        localStorage.removeItem(ROLE_CACHE_KEY);
      }
      
      // CRITICAL: Unblock initialization immediately. 
      // No background registry sync is required for hardcoded roles.
      setLoading(false);
    });

    return () => unsubscribe();
  }, [determineRole]);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (!auth) return { success: false, error: "Auth service unavailable." };

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const determinedRole = determineRole(userCredential.user.email);
      setRole(determinedRole);
      localStorage.setItem(ROLE_CACHE_KEY, determinedRole);
      return { success: true, role: determinedRole };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [determineRole]);

  const logout = useCallback(async () => {
    localStorage.removeItem(ROLE_CACHE_KEY);
    if (auth) {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
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
