
import { LoginForm } from '@/components/auth/login-form'; // Updated to use the new LoginForm
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md space-y-6">
      <Skeleton className="h-10 w-1/2" /> {/* Title */}
      <Skeleton className="h-6 w-3/4" /> {/* Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" /> {/* Button */}
      <Skeleton className="h-5 w-2/3 mx-auto" /> {/* Link */}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden login-background p-4">
      {/* Abstract background elements */}
      <div
        className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-primary/20 blur-3xl animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div
        className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-accent/20 blur-3xl animate-pulse"
        style={{ animationDuration: '10s', animationDelay: '2s' }}
      ></div>
       <div
        className="absolute top-1/4 right-1/4 h-1/3 w-1/3 rounded-3xl bg-secondary/20 blur-3xl animate-pulse"
        style={{ animationDuration: '12s', animationDelay: '4s' }}
      ></div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary font-poppins tracking-tight">
                SheetSync
            </h1>
            <p className="text-muted-foreground mt-2">Next-Gen Inventory Management</p>
        </div>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm /> {/* Updated to use the new LoginForm */}
        </Suspense>
      </div>
    </div>
  );
}
