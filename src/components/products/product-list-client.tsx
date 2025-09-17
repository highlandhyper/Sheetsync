
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import { AddProductDialog } from './add-product-dialog';
import type { Product } from '@/lib/types';
import { Search, ListFilter, PackageOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface ProductListClientProps {
  initialProducts: Product[];
}

const MAX_ITEMS_TO_DISPLAY = 100; // Max items to render to prevent freezing

export function ProductListClient({ initialProducts }: ProductListClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'>('name-asc');

  useEffect(() => {
    if (initialProducts) {
        if (initialProducts.length > MAX_ITEMS_TO_DISPLAY) {
            console.warn(`ProductListClient: Displaying only the first ${MAX_ITEMS_TO_DISPLAY} of ${initialProducts.length} products to prevent freezing. Consider implementing pagination.`);
            setProducts(initialProducts.slice(0, MAX_ITEMS_TO_DISPLAY));
        } else {
            setProducts(initialProducts);
        }
    } else {
        setProducts([]);
    }
    setIsLoading(false);
  }, [initialProducts]);
  
  const filteredAndSortedProducts = useMemo(() => {
    let items = [...products];

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
  }, [products, searchTerm, sortOrder]);

  const itemsToRender = filteredAndSortedProducts; // Already sliced in useEffect

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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card className="w-full" key={index}>
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
      ) : itemsToRender.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {itemsToRender.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or add a new product.
          </p>
          {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
            Clear Search
          </Button>
          )}
        </div>
      )}
    </div>
  );
}
