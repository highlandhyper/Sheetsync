
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import { AddProductDialog } from './add-product-dialog';
import type { Product } from '@/lib/types';
import { Search, ListFilter, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDataCache } from '@/context/data-cache-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { EditProductDialog } from './edit-product-dialog';

const MAX_ITEMS_TO_DISPLAY = 100;


function ProductListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-full sm:w-[180px]" /> {/* Sort Select */}
            <Skeleton className="h-10 w-44" /> {/* Add Product Button */}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card className="w-full" key={index}>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
                 <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
    </div>
  );
}


export function ProductListClient() {
  const { products: allProducts, suppliers, updateProduct } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'>('name-asc');
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...allProducts];

    if (searchTerm) {
      items = items.filter(
        (product) =>
          product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.supplierName && product.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
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
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };
  
  const handleEditSuccess = useCallback((updatedProduct: Product) => {
    updateProduct(updatedProduct);
    setIsEditDialogOpen(false);
  }, [updateProduct]);

  return (
    <div className="space-y-6">
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

      {itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {itemsToRender.map((product) => (
              <ProductCard key={product.id} product={product} onClick={() => handleProductClick(product)} />
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
    </div>
  );
}
