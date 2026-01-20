
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Supplier } from '@/lib/types';
import { Search, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AddSupplierDialog } from './add-supplier-dialog';
import { EditSupplierDialog } from './edit-supplier-dialog';
import { SupplierCard } from './supplier-card';
import { useDataCache } from '@/context/data-cache-context';

const MAX_SUPPLIERS_TO_DISPLAY = 250; 

export function SupplierListClient() {
  const { suppliers } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a,b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const filteredSuppliersToRender = useMemo(() => {
    let itemsToFilter = sortedSuppliers;
    if (searchTerm) {
      itemsToFilter = itemsToFilter.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return itemsToFilter;
  }, [sortedSuppliers, searchTerm]);
  
  const itemsToRender = useMemo(() => {
    if (filteredSuppliersToRender.length > MAX_SUPPLIERS_TO_DISPLAY) {
        console.warn(`SupplierListClient: Search for "${searchTerm}" found ${filteredSuppliersToRender.length} suppliers, displaying first ${MAX_SUPPLIERS_TO_DISPLAY}.`);
        return filteredSuppliersToRender.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    return filteredSuppliersToRender;
  }, [filteredSuppliersToRender, searchTerm]);


  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditDialogOpen(true);
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
        <AddSupplierDialog />
      </div>

      {itemsToRender.length > 0 ? (
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

          {sortedSuppliers.length > MAX_SUPPLIERS_TO_DISPLAY && !searchTerm && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_SUPPLIERS_TO_DISPLAY} of {sortedSuppliers.length} suppliers. Use search to find others.
            </p>
          )}
           {searchTerm && filteredSuppliersToRender.length === 0 && (
             <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-xl font-semibold">No suppliers found for "{searchTerm}"</h3>
            </div>
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
        />
      )}
    </div>
  );
}
