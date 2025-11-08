
'use client';

import type { PropsWithChildren} from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase'; // auth might be undefined if Firebase init fails
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

const VIEWER_EMAIL = 'viewer@example.com'; // Simulated viewer email

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    if (!auth) {
      console.error(
        "AuthContext: Firebase Auth object is NOT available from '@/lib/firebase'. " +
        "This likely means Firebase failed to initialize due to missing or incorrect configuration in .env.local. " +
        "Please check server console logs from 'src/lib/firebase.ts' for specific errors. " +
        "User authentication will not function."
      );
      setUser(null);
      setRole(null);
      setLoading(false); // Ensure loading is false if auth is not available
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // SIMULATION: Assign role based on email
        // In a real app, this would come from custom claims in the ID token
        if (currentUser.email === VIEWER_EMAIL) {
          setRole('viewer');
        } else {
          setRole('admin'); // Default to admin for other authenticated users
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("AuthContext: Error in onAuthStateChanged listener:", error);
      setUser(null);
      setRole(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    if (loading || !auth) {
      const errorMessage = "Authentication service is not ready. Please try again in a moment.";
      console.error(`Login failed: ${errorMessage} (loading: ${loading}, auth: ${!!auth})`);
      return { success: false, error: errorMessage };
    }

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      // Role and user state will be set by onAuthStateChanged, but we determine it here for immediate use.
      let determinedRole: UserRole = null;
      if (userCredential.user) {
        if (userCredential.user.email === VIEWER_EMAIL) {
          determinedRole = 'viewer';
        } else {
          determinedRole = 'admin';
        }
      }
      // setLoading will be set to false by onAuthStateChanged
      return { success: true, role: determinedRole };
    } catch (error: any) {
      // onAuthStateChanged will keep loading as false. We don't need to set it here.
      setRole(null); // Clear role on login failure
      return { success: false, error: error.message };
    }
  }, [loading, auth]);

  const signup = useCallback(async (values: SignupFormValues) => {
    if (!auth) {
      console.error("Signup: Firebase Auth is not initialized. Cannot sign up.");
      return { success: false, error: "Authentication service is not available. Please try again later." };
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      // Role and user state will be set by onAuthStateChanged (likely to 'admin' by default after signup here)
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      setRole(null);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) {
      console.warn("Logout: Firebase Auth not initialized. Performing local logout and redirect.");
      setUser(null);
      setRole(null);
      setLoading(false);
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // User and role state change and loading=false will be handled by onAuthStateChanged
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      setLoading(false); // Explicitly set loading false on error
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
