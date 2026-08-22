'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import { AddProductDialog } from './add-product-dialog';
import type { Product } from '@/lib/types';
import { Search, ListFilter, PackageOpen, Trash2, ShieldCheck, CheckSquare, Square, LayoutGrid, List, Barcode, Building, DollarSign, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDataCache } from '@/context/data-cache-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditProductDialog } from './edit-product-dialog';
import { useMultiSelect } from '@/context/multi-select-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AuthorizeActionDialog } from '../inventory/authorize-action-dialog';
import { bulkDeleteProductsAction, deleteProductAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const MAX_ITEMS_TO_DISPLAY = 150;

export function ProductListClient() {
  const { products: allProducts, suppliers, updateProduct, removeProducts, refreshData } = useDataCache();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { role, user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'>('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
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
            <Card className="p-4 bg-primary/5 border-primary/20 animate-in slide-in-from-top-2 duration-300 rounded-2xl">
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
                            className="font-black uppercase tracking-widest text-[10px] rounded-xl px-6"
                            onClick={() => initiateDelete(Array.from(selectedIds))}
                        >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Selected
                        </Button>
                    )}
                </div>
            </Card>
        ) : (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:max-w-md">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search products, barcodes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full h-11 rounded-xl bg-muted/20 border-white/5"
                        />
                    </div>
                    <div className="flex border border-white/10 rounded-xl p-1 bg-muted/20">
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            onClick={() => setViewMode('grid')}
                            className="h-9 w-9 rounded-lg"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            onClick={() => setViewMode('table')}
                            className="h-9 w-9 rounded-lg"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                    <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl border-white/10">
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
          {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
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
          ) : (
              <Card className="shadow-none border-white/10 overflow-hidden rounded-[1.5rem] animate-in slide-in-from-bottom-2 duration-500">
                  <Table>
                      <TableHeader className="bg-muted/50">
                          <TableRow>
                              <TableHead className="w-12 text-center">
                                  <Checkbox checked={selectedIds.size === itemsToRender.length} onCheckedChange={handleSelectAll} />
                              </TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest">Product Identity</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest">SKU Barcode</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest">Master Vendor</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-right">Unit Cost</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {itemsToRender.map((product) => (
                              <TableRow key={product.id} className="group hover:bg-primary/[0.02] transition-colors cursor-pointer" onClick={() => handleProductClick(product)}>
                                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox checked={selectedIds.has(product.id)} onCheckedChange={() => handleToggleSelect(product.id)} />
                                  </TableCell>
                                  <TableCell className="font-bold text-sm tracking-tight">{product.productName}</TableCell>
                                  <TableCell className="font-mono text-[11px] text-muted-foreground/60">{product.barcode}</TableCell>
                                  <TableCell>
                                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[9px] uppercase font-black px-2 py-0">
                                          {product.supplierName || 'No Vendor'}
                                      </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-black text-slate-700 dark:text-slate-300">
                                      {product.costPrice ? `QAR ${product.costPrice.toFixed(2)}` : '---'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/5">
                                              <Edit className="h-3.5 w-3.5" />
                                          </Button>
                                          {role === 'admin' && (
                                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={(e) => { e.stopPropagation(); initiateDelete([product.id]); }}>
                                                  <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                          )}
                                      </div>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </Card>
          )}
          
          {filteredAndSortedProducts.length > MAX_ITEMS_TO_DISPLAY && (
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 text-center mt-8">
              Displaying first {MAX_ITEMS_TO_DISPLAY} of {filteredAndSortedProducts.length} SKU records.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-20 flex flex-col items-center justify-center">
          <div className="bg-muted/10 p-8 rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
            <PackageOpen className="h-16 w-16 text-muted-foreground/20" strokeWidth={1} />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tighter">Zero Catalog Records</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs font-medium">
            {searchTerm ? `No SKU matches identified for "${searchTerm}".` : "The master registry is currently empty."}
          </p>
          {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-8 rounded-xl font-bold px-8">
                Clear Identification Filter
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
        actionDescription={`Deleting ${pendingDeleteIds.length} catalog record(s) from the registry core. This action cannot be reversed.`}
      />
    </div>
  );
}
