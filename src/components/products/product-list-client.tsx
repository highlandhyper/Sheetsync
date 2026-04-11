
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import { AddProductDialog } from './add-product-dialog';
import type { Product } from '@/lib/types';
import { Search, ListFilter, PackageOpen, Trash2, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDataCache } from '@/context/data-cache-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { EditProductDialog } from './edit-product-dialog';
import { useMultiSelect } from '@/context/multi-select-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AuthorizeActionDialog } from '../inventory/authorize-action-dialog';
import { bulkDeleteProductsAction, deleteProductAction } from '@/app/actions';

const MAX_ITEMS_TO_DISPLAY = 100;

export function ProductListClient() {
  const { products: allProducts, suppliers, updateProduct, removeProducts, refreshData } = useDataCache();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { role, user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'>('name-asc');
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...allProducts];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(
        (product) =>
          product.productName.toLowerCase().includes(lower) ||
          product.barcode.toLowerCase().includes(lower) ||
          (product.supplierName && product.supplierName.toLowerCase().includes(lower))
      );
    }

    items.sort((a, b) => {
      switch (sortOrder) {
        case 'name-asc':
          return a.productName.localeCompare(b.productName);
        case 'name-desc':
          return b.productName.localeCompare(a.productName);
        case 'barcode-asc':
          return a.barcode.localeCompare(b.barcode);
        case 'barcode-desc':
          return b.barcode.localeCompare(a.barcode);
        default:
          return 0;
      }
    });
    return items;
  }, [allProducts, searchTerm, sortOrder]);

  const itemsToRender = useMemo(() => {
    if (filteredAndSortedProducts.length > MAX_ITEMS_TO_DISPLAY) {
        return filteredAndSortedProducts.slice(0, MAX_ITEMS_TO_DISPLAY);
    }
    return filteredAndSortedProducts;
  }, [filteredAndSortedProducts]);

  const handleProductClick = (product: Product) => {
    if (isMultiSelectEnabled) {
        handleToggleSelect(product.id);
        return;
    }
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };
  
  const handleEditSuccess = useCallback((updatedProduct: Product) => {
    updateProduct(updatedProduct);
    setIsEditDialogOpen(false);
  }, [updateProduct]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === itemsToRender.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(itemsToRender.map(p => p.id)));
    }
  };

  const initiateDelete = (ids: string[]) => {
    if (role !== 'admin') return;
    setPendingDeleteIds(ids);
    setIsAuthDialogOpen(true);
  };

  const handleAuthorizationSuccess = async () => {
    setIsAuthDialogOpen(false);
    if (pendingDeleteIds.length === 0) return;

    // --- OPTIMISTIC UI UPDATE ---
    const idsToRemove = [...pendingDeleteIds];
    removeProducts(idsToRemove);
    setSelectedIds(new Set());
    
    toast({ title: 'Update Applied Locally', description: `Removing ${idsToRemove.length} products from your view. Syncing with sheet...` });

    try {
        const result = await bulkDeleteProductsAction(user?.email || 'Admin', idsToRemove);
        if (result.success) {
            toast({ title: 'Deletion Successful', description: 'Catalog has been permanently updated.' });
            refreshData(); 
        } else {
            toast({ title: 'Sync Error', description: 'Could not complete deletion on server. Reverting local view...', variant: 'destructive' });
            refreshData(); 
        }
    } catch (e) {
        toast({ title: 'Connection Error', description: 'An unexpected error occurred. Refreshing catalog...', variant: 'destructive' });
        refreshData();
    } finally {
        setPendingDeleteIds([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {selectedIds.size > 0 && isMultiSelectEnabled ? (
            <Card className="p-4 bg-primary/5 border-primary/20 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-8 text-xs font-black uppercase">
                            {selectedIds.size === itemsToRender.length ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
                            {selectedIds.size === itemsToRender.length ? 'Deselect All' : 'Select All Visible'}
                        </Button>
                        <span className="text-sm font-bold text-primary">{selectedIds.size} Products Selected</span>
                    </div>
                    {role === 'admin' && (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="font-black uppercase tracking-widest text-[10px]"
                            onClick={() => initiateDelete(Array.from(selectedIds))}
                        >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Selected
                        </Button>
                    )}
                </div>
            </Card>
        ) : (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search products, barcodes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                    <ListFilter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="barcode-asc">Barcode (Asc)</SelectItem>
                    <SelectItem value="barcode-desc">Barcode (Desc)</SelectItem>
                    </SelectContent>
                </Select>
                <AddProductDialog />
                </div>
            </div>
        )}
      </div>

      {itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {itemsToRender.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={() => handleProductClick(product)}
                isMultiSelect={isMultiSelectEnabled}
                isSelected={selectedIds.has(product.id)}
                onSelect={() => handleToggleSelect(product.id)}
                onDelete={role === 'admin' ? () => initiateDelete([product.id]) : undefined}
              />
            ))}
          </div>
          {filteredAndSortedProducts.length > MAX_ITEMS_TO_DISPLAY && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_ITEMS_TO_DISPLAY} of {filteredAndSortedProducts.length} products. Use search to find others.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "Try adjusting your search." : "Add a new product to see it here."}
          </p>
          {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
            Clear Search
          </Button>
          )}
        </div>
      )}

      <EditProductDialog
        product={editingProduct}
        allSuppliers={suppliers}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />

      <AuthorizeActionDialog 
        isOpen={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        onAuthorizationSuccess={handleAuthorizationSuccess}
        actionDescription={`Deleting ${pendingDeleteIds.length} product(s) from the global registry. This action cannot be undone.`}
      />
    </div>
  );
}
