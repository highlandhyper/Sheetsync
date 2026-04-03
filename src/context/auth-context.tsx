'use client';

import type { PropsWithChildren} from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type UserCredential
} from 'firebase/auth';
import type { LoginFormValues, SignupFormValues } from '@/lib/schemas';

type UserRole = 'admin' | 'viewer' | null;

interface AuthContextLoginResponse {
  success: boolean;
  error?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  login: (values: LoginFormValues) => Promise<AuthContextLoginResponse>;
  signup: (values: SignupFormValues) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VIEWER_EMAIL = 'viewer@example.com';
const ROLE_CACHE_KEY = 'sheetSync_cached_role';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ROLE_CACHE_KEY) as UserRole;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 8000);

    if (!auth) {
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(safetyTimeout);
      setUser(currentUser);
      if (currentUser) {
        const determinedRole = currentUser.email === VIEWER_EMAIL ? 'viewer' : 'admin';
        setRole(determinedRole);
        localStorage.setItem(ROLE_CACHE_KEY, determinedRole);
      } else {
        setRole(null);
        localStorage.removeItem(ROLE_CACHE_KEY);
      }
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimeout);
      setUser(null);
      setRole(null);
      localStorage.removeItem(ROLE_CACHE_KEY);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (!auth) return { success: false, error: "Authentication service not initialized." };

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      let determinedRole: UserRole = null;
      if (userCredential.user) {
        determinedRole = userCredential.user.email === VIEWER_EMAIL ? 'viewer' : 'admin';
        setRole(determinedRole);
        localStorage.setItem(ROLE_CACHE_KEY, determinedRole);
      }
      return { success: true, role: determinedRole };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  const signup = useCallback(async (values: SignupFormValues) => {
    if (!auth) return { success: false, error: "Authentication service not initialized." };
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(ROLE_CACHE_KEY);
    if (!auth) {
      setUser(null);
      setRole(null);
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      setLoading(false);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, signup, logout }}>
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
