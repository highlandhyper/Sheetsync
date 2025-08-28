
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Supplier } from '@/lib/types';
import { Search, Building, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddSupplierDialog } from './add-supplier-dialog';
import { EditSupplierDialog } from './edit-supplier-dialog';

interface SupplierListClientProps {
  initialSuppliers: Supplier[];
}

const MAX_SUPPLIERS_TO_DISPLAY = 250; 

export function SupplierListClient({ initialSuppliers }: SupplierListClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliersToDisplay, setSuppliersToDisplay] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [totalUniqueSuppliers, setTotalUniqueSuppliers] = useState(0);

  useEffect(() => {
    if (initialSuppliers) {
      const sortedSuppliers = [...initialSuppliers].sort((a, b) => a.name.localeCompare(b.name));
      setTotalUniqueSuppliers(sortedSuppliers.length);

      if (sortedSuppliers.length > MAX_SUPPLIERS_TO_DISPLAY && !searchTerm) {
        console.warn(`SupplierListClient: Displaying only the first ${MAX_SUPPLIERS_TO_DISPLAY} of ${sortedSuppliers.length} suppliers. Consider implementing pagination or a server-side search for better performance with large supplier lists.`);
        setSuppliersToDisplay(sortedSuppliers.slice(0, MAX_SUPPLIERS_TO_DISPLAY));
      } else {
        setSuppliersToDisplay(sortedSuppliers);
      }
    } else {
      setSuppliersToDisplay([]);
      setTotalUniqueSuppliers(0);
    }
    setIsLoading(false);
  }, [initialSuppliers, searchTerm]); // Re-evaluate when searchTerm changes to apply filtering to full list if needed

  const filteredSuppliersToRender = useMemo(() => {
    let itemsToFilter = initialSuppliers || []; // Start with the full initial list for filtering
    if (searchTerm) {
      itemsToFilter = itemsToFilter.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // Slice *after* filtering if still over the display limit,
    // or if no search term and initial list was over limit (already handled by useEffect)
    if (!searchTerm && itemsToFilter.length > MAX_SUPPLIERS_TO_DISPLAY) {
        return itemsToFilter.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    if (searchTerm && itemsToFilter.length > MAX_SUPPLIERS_TO_DISPLAY) {
        // If searching and results are still too many, we might still want to slice.
        // Or, for search, you might want to show all results if it's a specific search.
        // For now, let's keep the slice to prevent freezing on broad searches.
        console.log(`SupplierListClient: Search for "${searchTerm}" found ${itemsToFilter.length} suppliers, displaying first ${MAX_SUPPLIERS_TO_DISPLAY}.`);
        return itemsToFilter.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    return itemsToFilter;
  }, [initialSuppliers, searchTerm]);
  
  const itemsToRender = searchTerm ? filteredSuppliersToRender : suppliersToDisplay;

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditDialogOpen(true);
  };

  const handleSupplierUpdated = () => {
    setEditingSupplier(null);
    // Data revalidation happens via server action, list should update.
  };

  const handleSupplierAdded = (newSupplier: Supplier) => {
    // Optimistically add to the list or rely on revalidation.
    // For simplicity, relying on revalidation from server action.
  }

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
        <AddSupplierDialog onSupplierAdded={handleSupplierAdded} />
      </div>

      {isLoading ? (
         <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>ID (Sheet-derived)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
         </Card>
      ) : itemsToRender.length > 0 ? (
        <>
          <Card className="shadow-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>ID (Sheet-derived)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsToRender.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{supplier.id}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditSupplier(supplier)}
                        className="mr-2"
                        aria-label={`Edit supplier ${supplier.name}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {totalUniqueSuppliers > MAX_SUPPLIERS_TO_DISPLAY && !searchTerm && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_SUPPLIERS_TO_DISPLAY} of {totalUniqueSuppliers} suppliers. Use search to find others.
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
          onSupplierUpdated={handleSupplierUpdated}
        />
      )}
    </div>
  );
}
