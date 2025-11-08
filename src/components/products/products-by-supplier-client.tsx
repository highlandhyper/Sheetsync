// This file should ideally be deleted or left empty if the system doesn't support deletion through this XML.
// For now, to ensure no conflicts, I'll leave its content as it was before the last change,
// assuming the new file at src/components/inventory/returnable-inventory-by-supplier-client.tsx
// will take precedence.
// If this file is indeed orphaned and no longer used, it can be manually removed later.

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card'; // Kept original product card import for this placeholder
import type { Product, Supplier } from '@/lib/types';
import { Search, PackageOpen, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';


interface ProductsBySupplierClientProps {
  initialProducts: Product[];
  allSuppliers: Supplier[]; // Keep for consistency with original, though might not be fully used here
}

export function ProductsBySupplierClient({ initialProducts, allSuppliers }: ProductsBySupplierClientProps) {
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setProducts(initialProducts);
    setIsLoading(false);
  }, [initialProducts]);

  const filteredProducts = useMemo(() => {
    if (!supplierSearchTerm.trim()) {
      return []; // Show no products if no supplier is searched
    }
    return products.filter(product =>
      product.supplierName?.toLowerCase().includes(supplierSearchTerm.toLowerCase())
    );
  }, [products, supplierSearchTerm]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg shadow bg-card mb-6">
            <Skeleton className="h-10 w-full md:max-w-lg" />
            <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="w-full">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-16 w-16 rounded-md mr-4" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Skeleton className="h-4 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:max-w-lg">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Enter supplier name to see their products..."
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                className="pl-10 w-full"
                aria-label="Search products by supplier name"
              />
            </div>
            {supplierSearchTerm && (
              <Button variant="ghost" onClick={() => setSupplierSearchTerm('')}>
                Clear Search
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {supplierSearchTerm.trim() && filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : supplierSearchTerm.trim() ? (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No products found for this supplier</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different supplier name or check if products are cataloged.
          </p>
        </div>
      ) : (
         <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Search Products by Supplier</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a supplier's name in the search bar above to view their products.
          </p>
        </div>
      )}
    </div>
  );
}
