
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This page is intentionally disabled to make user creation an admin-only task
// from the Firebase console, creating a more closed-system application.
export default function SignupDisabledPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg mt-4">Redirecting to login...</p>
    </div>
  );
}
