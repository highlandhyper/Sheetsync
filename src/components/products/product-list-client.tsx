

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import type { Product } from '@/lib/types';
import { Search, ListFilter, PackageOpen, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { getProducts } from '@/lib/data';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const MAX_ITEMS_TO_DISPLAY = 100; // Max items to render to prevent freezing

export function ProductListClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'>('name-asc');
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const products = await getProducts();
      setAllProducts(products || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast({
        title: "Error",
        description: "Could not load products. Please try again later.",
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
        console.warn(`ProductListClient: Displaying only the first ${MAX_ITEMS_TO_DISPLAY} of ${filteredAndSortedProducts.length} products to prevent freezing.`);
        return filteredAndSortedProducts.slice(0, MAX_ITEMS_TO_DISPLAY);
    }
    return filteredAndSortedProducts;
  }, [filteredAndSortedProducts]);

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
          <Button asChild>
            <Link href="/products/manage">Manage Products</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
      ) : itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {itemsToRender.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {allProducts.length > MAX_ITEMS_TO_DISPLAY && !searchTerm && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_ITEMS_TO_DISPLAY} of {allProducts.length} products. Use search to find others.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "Try adjusting your search." : "Your product catalog is empty."}
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
