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
import Fuse from 'fuse.js';

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
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // FUZZY SEARCH ENGINE: Optimized strictly for Product Identity per industrial directive
  const fuse = useMemo(() => new Fuse(allProducts, {
    keys: ['productName'],
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
    useExtendedSearch: true
  }), [allProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...allProducts];

    if (searchTerm.trim()) {
        const term = searchTerm.trim();
        const normalizedTerm = term.replace(/^0+/, '');
        
        // 1. PRIMARY: Exact Barcode Identification (Normalized)
        const exactBarcodeProducts = items.filter(p => {
            const itemBc = p.barcode.trim();
            return itemBc === term || itemBc.replace(/^0+/, '') === normalizedTerm;
        });

        if (exactBarcodeProducts.length > 0) {
            items = exactBarcodeProducts;
        } else {
            // 2. FALLBACK: Fuzzy Product Name Search
            items = fuse.search(term).map(r => r.item);
        }
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
  }, [allProducts, searchTerm, sortOrder, fuse]);

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
    setIsEditModalVisible(true);
  };
  
  const handleEditSuccess = useCallback((updatedProduct: Product) => {
    updateProduct(updatedProduct);
    setIsEditModalVisible(false);
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

    const idsToRemove = [...pendingDeleteIds];
    removeProducts(idsToRemove);
    setSelectedIds(new Set());
    
    toast({ title: 'Local Registry Updated', description: `Purging ${idsToRemove.length} entries from display. Finalizing cloud sync...` });

    try {
        const result = await bulkDeleteProductsAction(user?.email || 'Admin', idsToRemove);
        if (result.success) {
            toast({ title: 'Deletion Permanent', description: 'Registry core has been successfully updated.' });
            refreshData(); 
        } else {
            toast({ title: 'Registry Sync Blocked', description: 'Server refused write. Reverting local changes...', variant: 'destructive' });
            refreshData(); 
        }
    } catch (e) {
        toast({ title: 'Connection Failure', description: 'Registry link interrupted. Refreshing catalog...', variant: 'destructive' });
        refreshData();
    } finally {
        setPendingDeleteIds([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {selectedIds.size > 0 && isMultiSelectEnabled ? (
            <Card className="p-4 bg-primary/5 border-primary/20 animate-in slide-in-from-top-2 duration-300 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-8 text-xs font-black uppercase tracking-tighter">
                            {selectedIds.size === itemsToRender.length ? <CheckSquare className="mr-2 h-4 w-4 text-primary" /> : <Square className="mr-2 h-4 w-4" />}
                            {selectedIds.size === itemsToRender.length ? 'Release Selection' : 'Capture Visible'}
                        </Button>
                        <Badge variant="secondary" className="font-black text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-lg uppercase">{selectedIds.size} Identities Linked</Badge>
                    </div>
                    {role === 'admin' && (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="font-black uppercase tracking-[0.2em] text-[10px] rounded-xl px-8 shadow-xl shadow-destructive/20 h-11"
                            onClick={() => initiateDelete(Array.from(selectedIds))}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Purge Records
                        </Button>
                    )}
                </div>
            </Card>
        ) : (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:max-w-xl">
                    <div className="relative flex-grow group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" strokeWidth={3} />
                        <Input
                            type="search"
                            placeholder="SEARCH CATALOG (NAME OR SKU)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 w-full h-14 rounded-2xl bg-muted/20 border-white/5 font-black uppercase tracking-tight text-lg shadow-inner placeholder:text-muted-foreground/10"
                        />
                    </div>
                    <div className="flex border border-white/10 rounded-2xl p-1.5 bg-muted/20 shadow-sm shrink-0">
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            onClick={() => setViewMode('grid')}
                            className="h-11 w-11 rounded-xl"
                        >
                            <LayoutGrid className="h-5 w-5" />
                        </Button>
                        <Button 
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                            size="icon" 
                            onClick={() => setViewMode('table')}
                            className="h-11 w-11 rounded-xl"
                        >
                            <List className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                    <SelectTrigger className="w-full sm:w-[200px] h-14 rounded-2xl border-white/10 font-black uppercase tracking-widest text-[9px] bg-background/50 backdrop-blur-xl">
                    <ListFilter className="h-4 w-4 mr-3 text-primary/40" />
                    <SelectValue placeholder="SORT ORDER" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-white/10 shadow-3xl">
                    <SelectItem value="name-asc" className="text-[10px] font-black uppercase py-3">Identity (A-Z)</SelectItem>
                    <SelectItem value="name-desc" className="text-[10px] font-black uppercase py-3">Identity (Z-A)</SelectItem>
                    <SelectItem value="barcode-asc" className="text-[10px] font-black uppercase py-3">SKU Ascent</SelectItem>
                    <SelectItem value="barcode-desc" className="text-[10px] font-black uppercase py-3">SKU Descent</SelectItem>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-in fade-in duration-500 pb-20">
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
              <Card className="shadow-2xl border-white/10 overflow-hidden rounded-[2.5rem] animate-in slide-in-from-bottom-2 duration-500 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl mb-20">
                  <Table>
                      <TableHeader className="bg-muted/10 border-b border-white/5">
                          <TableRow className="hover:bg-transparent">
                              <TableHead className="w-16 text-center h-16 pl-8">
                                  <Checkbox checked={selectedIds.size === itemsToRender.length} onCheckedChange={handleSelectAll} />
                              </TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">Product Identity</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">SKU Barcode</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">Master Vendor</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40 text-right">Unit Cost</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40 text-center pr-8">Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {itemsToRender.map((product) => (
                              <TableRow key={product.id} className="group hover:bg-primary/[0.02] transition-colors cursor-pointer border-white/5 h-20" onClick={() => handleProductClick(product)}>
                                  <TableCell className="text-center pl-8" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox checked={selectedIds.has(product.id)} onCheckedChange={() => handleToggleSelect(product.id)} />
                                  </TableCell>
                                  <TableCell className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase">{product.productName}</TableCell>
                                  <TableCell className="font-mono text-[11px] font-black text-muted-foreground/50 tracking-tighter uppercase">{product.barcode}</TableCell>
                                  <TableCell>
                                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] uppercase font-black px-3 py-1 rounded-lg shadow-sm">
                                          {product.supplierName || 'NO VENDOR'}
                                      </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-black text-slate-700 dark:text-slate-300 tabular-nums">
                                      {product.costPrice ? `QAR ${product.costPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}
                                  </TableCell>
                                  <TableCell className="text-center pr-8">
                                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10">
                                              <Edit className="h-4 w-4" />
                                          </Button>
                                          {role === 'admin' && (
                                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); initiateDelete([product.id]); }}>
                                                  <Trash2 className="h-4 w-4" />
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
            <div className="py-12 flex justify-center border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/30 flex items-center gap-4">
                    <span className="w-8 h-px bg-current opacity-20" />
                    Displaying first {MAX_ITEMS_TO_DISPLAY} of {filteredAndSortedProducts.length.toLocaleString()} SKU nodes
                    <span className="w-8 h-px bg-current opacity-20" />
                </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-40 flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
          <div className="bg-muted/10 p-12 rounded-[3.5rem] mb-8 border-4 border-dashed border-white/5 shadow-inner">
            <PackageOpen className="h-20 w-20 text-muted-foreground/10" strokeWidth={1.5} />
          </div>
          <h3 className="text-3xl font-black uppercase tracking-tighter text-muted-foreground/20 leading-none">Zero Identity Nodes</h3>
          <p className="text-sm text-muted-foreground/40 mt-4 max-w-xs font-medium uppercase tracking-widest leading-relaxed">
            {searchTerm ? `No registry matches for "${searchTerm}".` : "The master industrial catalog is currently empty."}
          </p>
          {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] px-10 h-12 border-primary/20 text-primary hover:bg-primary/5 transition-all">
                Clear Identification Filter
            </Button>
          )}
        </div>
      )}

      <EditProductDialog
        product={editingProduct}
        allSuppliers={suppliers}
        isOpen={isEditModalVisible}
        onOpenChange={setIsEditModalVisible}
        onSuccess={handleEditSuccess}
      />

      <AuthorizeActionDialog 
        isOpen={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        onAuthorizationSuccess={handleAuthorizationSuccess}
        actionDescription={`Critical Directive: Deleting ${pendingDeleteIds.length} industrial SKU identities. This operation will purge all associated metadata and cannot be undone.`}
      />
    </div>
  );
}
