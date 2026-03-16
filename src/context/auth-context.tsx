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

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    setLoading(true);

    // Resilience: Fallback timeout to ensure app doesn't hang if SDK fails to respond
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("AuthContext: Safety timeout reached. Forcing loading state to false.");
        setLoading(false);
      }
    }, 10000);

    if (!auth) {
      console.error("AuthContext: Firebase Auth object is NOT available.");
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(safetyTimeout);
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.email === VIEWER_EMAIL) {
          setRole('viewer');
        } else {
          setRole('admin');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimeout);
      console.error("AuthContext: Error in onAuthStateChanged:", error);
      setUser(null);
      setRole(null);
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
