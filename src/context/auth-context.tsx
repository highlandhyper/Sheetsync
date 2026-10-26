'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  type UserCredential,
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

async function fetchTrustedRole(user: User): Promise<Role | null> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/auth/role', {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const result = await response.json();
  if (!result?.success || result.active !== true) return null;
  return result.role === 'admin' || result.role === 'viewer' ? result.role : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let disposed = false;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setRole(null);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const trustedRole = await fetchTrustedRole(currentUser);
        if (!disposed) setRole(trustedRole);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[AUTH] Trusted role lookup failed.');
        }
        if (!disposed) setRole(null);
      } finally {
        if (!disposed) setLoading(false);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (!auth) return { success: false, error: 'Auth service unavailable.' };

    try {
      const credential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      setUser(credential.user);
      setRole(null);
      const trustedRole = await fetchTrustedRole(credential.user);
      setRole(trustedRole);
      return { success: true, role: trustedRole };
    } catch (error: any) {
      const code = String(error?.code || '');
      let message = 'Unable to sign in. Please try again.';
      switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
          message = 'Invalid username or password. Please check your details and try again.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed sign-in attempts. Please wait a few minutes and try again.';
          break;
        case 'auth/network-request-failed':
          message = 'Network connection failed. Check your internet connection and try again.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled. Contact your administrator.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Sign-in is currently unavailable. Contact your administrator.';
          break;
        default:
          if (error instanceof Error && error.message.includes('Firebase Admin')) {
            message = 'Role service is not configured correctly. Contact your administrator.';
          }
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AUTH] Sign-in or role lookup failed:', code || 'role-lookup-error');
      }
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setRole(null);
    router.push('/login');
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
