
'use client';

// This page is no longer used for desktop view as the lookup functionality
// has been moved to a component in the header.
// It can be kept for mobile-specific navigation or future use.
// For now, it will just show a message.

import { FileSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function InventoryLogLookupPage() {
  const router = useRouter();

  // On desktop, this page is redundant. We can redirect or show a message.
  // A redirect might be jarring if a user explicitly navigates here.
  // Let's show a message and guide them.
  useEffect(() => {
    // Optionally, redirect on desktop if preferred
    // if (window.innerWidth >= 768) {
    //   router.replace('/inventory');
    // }
  }, [router]);

  return (
    <div className="container mx-auto py-10 text-center">
      <FileSearch className="mx-auto h-16 w-16 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-primary">Barcode Lookup</h1>
      <p className="mt-2 text-muted-foreground">
        On desktop, this tool is now available in the header bar for quick access from any page.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        On mobile, you can continue to use this page for barcode lookups.
      </p>
      {/* You could re-integrate the <InventoryBarcodeLookupClient /> here for mobile-only */}
    </div>
  );
}
