'use client';

import type { PropsWithChildren} from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { LoginFormValues } from '@/lib/schemas';
import bcrypt from 'bcryptjs';

// --- MOCK USER DATA ---
// In a real app, this would come from a database or a secure source.
// For this app, we'll simulate two roles: 'admin' and 'viewer'.
const MOCK_USERS = {
  'admin@example.com': {
    email: 'admin@example.com',
    // It's crucial to store hashed passwords, not plain text.
    // This hash is for the password "admin". You can generate new ones.
    passwordHash: '$2a$10$wN.9.sA/AA4f9a5/F.aV.OLTzF.nL3v6/jA.qRz4sC1lR7.Gde/vG',
    role: 'admin',
    name: 'Admin User'
  },
  'viewer@example.com': {
    email: 'viewer@example.com',
    // This hash is for the password "viewer".
    passwordHash: '$2a$10$f.4bO9nBvHjE6pB3v.3fA.U5f5ZgXh3x2z1r8B1cE3xG7t3h6D/pW',
    role: 'viewer',
    name: 'Viewer User'
  }
};
type MockUser = { email: string; role: 'admin' | 'viewer'; name: string; };

type UserRole = 'admin' | 'viewer' | null;

interface AuthContextLoginResponse {
  success: boolean;
  error?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: MockUser | null;
  role: UserRole;
  loading: boolean;
  login: (values: LoginFormValues) => Promise<AuthContextLoginResponse>;
  signup: (values: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_SESSION_KEY = 'sheet_sync_user_session';


export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
        const storedSession = sessionStorage.getItem(USER_SESSION_KEY);
        if (storedSession) {
            const sessionUser = JSON.parse(storedSession);
            setUser(sessionUser);
            setRole(sessionUser.role);
        }
    } catch (e) {
        console.error("Could not parse user session from storage:", e);
        sessionStorage.removeItem(USER_SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (values: LoginFormValues): Promise<AuthContextLoginResponse> => {
    setLoading(true);
    const potentialUser = MOCK_USERS[values.email as keyof typeof MOCK_USERS];
    
    if (potentialUser) {
      const passwordMatch = await bcrypt.compare(values.password, potentialUser.passwordHash);
      if (passwordMatch) {
        const userToStore = {
          email: potentialUser.email,
          role: potentialUser.role,
          name: potentialUser.name
        };
        setUser(userToStore);
        setRole(potentialUser.role);
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userToStore));
        setLoading(false);
        return { success: true, role: potentialUser.role };
      }
    }

    setLoading(false);
    return { success: false, error: 'Invalid email or password.' };
  }, []);

  const signup = async (values: any) => {
    // Signup is disabled in this mock auth system.
    return { success: false, error: 'Signup is not available. Please use one of the provided mock accounts.' };
  };

  const logout = useCallback(async () => {
    setLoading(true);
    setUser(null);
    setRole(null);
    sessionStorage.removeItem(USER_SESSION_KEY);
    router.push('/login');
    // A small delay to ensure state is updated before other effects run
    await new Promise(resolve => setTimeout(resolve, 50));
    setLoading(false);
  }, [router]);

  // This effect handles redirection based on auth state
  useEffect(() => {
    if (loading) return;
    
    const isAuthPage = pathname === '/login' || pathname === '/signup';

    if (!user && !isAuthPage) {
      router.replace('/login');
    } else if (user && isAuthPage) {
      router.replace(role === 'admin' ? '/dashboard' : '/products');
    }

  }, [user, role, loading, pathname, router]);

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
