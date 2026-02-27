
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (role === 'admin') {
          router.replace('/dashboard'); // Admin users go to dashboard
        } else if (role === 'viewer') {
          router.replace('/inventory/add'); // Viewer users now go to Log New Item page first
        } else {
          router.replace('/login'); // Fallback if role is somehow null for an authenticated user
        }
      } else {
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
