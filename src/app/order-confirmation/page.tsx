import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function OrderConfirmationPage() {
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
      <CheckCircle className="h-20 w-20 text-green-500 mb-6" />
      <h1 className="text-5xl font-headline font-bold">Thank You for Your Order!</h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Your order has been successfully placed. We've sent a confirmation to your email.
        (This is a simulation, no actual order was processed or email sent.)
      </p>
      <Button asChild className="mt-8 text-lg h-12 px-8" size="lg">
        <Link href="/">Continue Shopping</Link>
      </Button>
    </div>
  );
}
