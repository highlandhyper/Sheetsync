

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import type { Supplier } from '@/lib/types';
import { Search, Building, Edit, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AddSupplierDialog } from './add-supplier-dialog';
import { EditSupplierDialog } from './edit-supplier-dialog';
import { SupplierCard } from './supplier-card';
import { getSuppliers } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

const MAX_SUPPLIERS_TO_DISPLAY = 250; 

export function SupplierListClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const { loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const suppliers = await getSuppliers();
      const sortedSuppliers = (suppliers || []).sort((a, b) => a.name.localeCompare(b.name));
      setAllSuppliers(sortedSuppliers);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      toast({
        title: "Error",
        description: "Could not load suppliers. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) {
      return allSuppliers;
    }
    return allSuppliers.filter((supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSuppliers, searchTerm]);
  
  const itemsToRender = useMemo(() => {
    if (filteredSuppliers.length > MAX_SUPPLIERS_TO_DISPLAY) {
        console.warn(`SupplierListClient: Displaying only the first ${MAX_SUPPLIERS_TO_DISPLAY} of ${filteredSuppliers.length} suppliers.`);
        return filteredSuppliers.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    return filteredSuppliers;
  }, [filteredSuppliers]);

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setEditingSupplier(null);
    fetchData(); // Refetch data on success
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <AddSupplierDialog onSupplierAdded={handleDialogSuccess} />
      </div>

      {isLoading ? (
         <div className="text-center py-10"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
      ) : itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {itemsToRender.map((supplier) => (
                <SupplierCard 
                    key={supplier.id} 
                    supplier={supplier} 
                    onEdit={() => handleEditSupplier(supplier)}
                />
            ))}
          </div>

          {allSuppliers.length > MAX_SUPPLIERS_TO_DISPLAY && !searchTerm && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_SUPPLIERS_TO_DISPLAY} of {allSuppliers.length} suppliers. Use search to find others.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No suppliers found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? `Try adjusting your search for "${searchTerm}" or ` : ''}
            Add a new supplier to get started.
          </p>
           {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
            Clear Search
          </Button>
          )}
        </div>
      )}
      {editingSupplier && (
        <EditSupplierDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          supplier={editingSupplier}
          onSupplierUpdated={handleDialogSuccess}
        />
      )}
    </div>
  );
}

    
