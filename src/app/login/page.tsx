import { LoginForm } from '@/components/auth/login-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md space-y-6">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-6 w-3/4" />
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
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-5 w-2/3 mx-auto" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden login-mesh-bg p-4">
      {/* Atmospheric elements scaled for mobile */}
      <div
        className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-primary/10 blur-[80px] sm:blur-[120px] animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div
        className="absolute bottom-[-10%] right-[-5%] h-[40%] w-[40%] rounded-full bg-accent/15 blur-[80px] sm:blur-[120px] animate-pulse"
        style={{ animationDuration: '10s', animationDelay: '2s' }}
      ></div>

      <div className="relative z-10 w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black text-primary font-poppins tracking-tighter uppercase">
                SheetSync
            </h1>
            <p className="text-muted-foreground font-medium tracking-tight text-sm sm:text-base">Next-Gen Inventory Management</p>
        </div>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}