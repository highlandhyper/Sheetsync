'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 

  useEffect(() => {
    // This effect will run when loading status or user changes
    if (!loading) {
      if (user) {
        // User is logged in, redirect based on role
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          router.replace('/products'); // Default for viewers
        } else {
          // Fallback if role is not set but user exists
          router.replace('/login');
        }
      } else {
        // No user, redirect to login
        router.replace('/login');
      }
    }
  }, [user, loading, role, router]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg">Loading SheetSync...</p>
    </div>
  );
}
