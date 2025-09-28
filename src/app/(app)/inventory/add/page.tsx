
'use client';

import { AddInventoryItemStepperForm } from '@/components/inventory/add-inventory-item-stepper-form';
import { Suspense, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUniqueLocations, getUniqueStaffNames } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function AddInventoryFormSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-10 w-1/2" /> {/* Title */}
      <Skeleton className="h-6 w-3/4" /> {/* Description */}
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="flex justify-end">
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}


export default function AddInventoryItemPage() { 
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [uniqueStaffNames, setUniqueStaffNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [locations, staffNames] = await Promise.all([
          getUniqueLocations(),
          getUniqueStaffNames()
        ]);
        setUniqueLocations(locations || []);
        setUniqueStaffNames(staffNames || []);
      } catch (error) {
        console.error("Failed to fetch unique data:", error);
        toast({
          title: "Error",
          description: "Could not load required data for the form.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast]);
  
  if (isLoading) {
    return (
       <div className="container mx-auto py-2">
         <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Loading form data...</p>
          </div>
       </div>
    );
  }

  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<AddInventoryFormSkeleton />}>
        <AddInventoryItemStepperForm
          uniqueLocations={uniqueLocations} 
          uniqueStaffNames={uniqueStaffNames}
        />
      </Suspense>
    </div>
  );
}
