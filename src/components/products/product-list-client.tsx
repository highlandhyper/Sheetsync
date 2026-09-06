'use client';

import { useCallback, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import {
  CheckSquare,
  Edit,
  LayoutGrid,
  List,
  ListFilter,
  PackageOpen,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { ProductCard } from './product-card';
import { AddProductDialog } from './add-product-dialog';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataCache } from '@/context/data-cache-context';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditProductDialog } from './edit-product-dialog';
import { useMultiSelect } from '@/context/multi-select-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AuthorizeActionDialog } from '../inventory/authorize-action-dialog';
import { bulkDeleteProductsAction } from '@/app/actions';
import { Badge } from '../ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const MAX_ITEMS_TO_DISPLAY = 150;

export function ProductListClient() {
  const {
    products: allProducts,
    suppliers,
    updateProduct,
    removeProducts,
    refreshData,
  } = useDataCache();

  const { isMultiSelectEnabled } = useMultiSelect();
  const { role, user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<
    'name-asc' | 'name-desc' | 'barcode-asc' | 'barcode-desc'
  >('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const fuse = useMemo(
    () =>
      new Fuse(allProducts, {
        keys: ['productName'],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 2,
        useExtendedSearch: true,
      }),
    [allProducts],
  );

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...allProducts];

    if (searchTerm.trim()) {
      const term = searchTerm.trim();
      const normalizedTerm = term.replace(/^0+/, '');

      const exactBarcodeProducts = items.filter((product) => {
        const itemBarcode = product.barcode.trim();

        return (
          itemBarcode === term ||
          itemBarcode.replace(/^0+/, '') === normalizedTerm
        );
      });

      if (exactBarcodeProducts.length > 0) {
        items = exactBarcodeProducts;
      } else {
        items = fuse.search(term).map((result) => result.item);
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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const handleProductClick = (product: Product) => {
    if (isMultiSelectEnabled) {
      handleToggleSelect(product.id);
      return;
    }

    setEditingProduct(product);
    setIsEditModalVisible(true);
  };

  const handleEditSuccess = useCallback(
    (updatedProduct: Product) => {
      updateProduct(updatedProduct);
      setIsEditModalVisible(false);
    },
    [updateProduct],
  );

  const handleSelectAll = () => {
    if (selectedIds.size === itemsToRender.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(itemsToRender.map((product) => product.id)));
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

    toast({
      title: 'Products removed locally',
      description: `Removing ${idsToRemove.length} product${idsToRemove.length === 1 ? '' : 's'} from the cloud catalog...`,
    });

    try {
      const result = await bulkDeleteProductsAction(
        user?.email || 'Admin',
        idsToRemove,
      );

      if (result.success) {
        toast({
          title: 'Products deleted',
          description: 'The product catalog has been updated successfully.',
        });

        refreshData();
      } else {
        toast({
          title: 'Delete failed',
          description: 'The server rejected the delete request. Restoring catalog data...',
          variant: 'destructive',
        });

        refreshData();
      }
    } catch {
      toast({
        title: 'Connection problem',
        description: 'Could not complete the delete request. Refreshing catalog data...',
        variant: 'destructive',
      });

      refreshData();
    } finally {
      setPendingDeleteIds([]);
    }
  };

  const hasSearch = searchTerm.trim().length > 0;
  const isAllVisibleSelected =
    itemsToRender.length > 0 && selectedIds.size === itemsToRender.length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toolbar / selection bar */}
      <div>
        {selectedIds.size > 0 && isMultiSelectEnabled ? (
          <Card className="overflow-hidden rounded-2xl border-primary/20 bg-primary/[0.045] shadow-sm">
            <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-10 shrink-0 rounded-xl px-3 text-xs font-semibold"
                >
                  {isAllVisibleSelected ? (
                    <CheckSquare className="mr-2 h-4 w-4 text-primary" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}

                  <span className="hidden sm:inline">
                    {isAllVisibleSelected ? 'Clear visible' : 'Select visible'}
                  </span>

                  <span className="sm:hidden">
                    {isAllVisibleSelected ? 'Clear' : 'Select all'}
                  </span>
                </Button>

                <Badge
                  variant="secondary"
                  className="truncate rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary"
                >
                  {selectedIds.size} selected
                </Badge>
              </div>

              {role === 'admin' && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => initiateDelete(Array.from(selectedIds))}
                  className="h-10 w-full rounded-xl px-4 text-xs font-semibold shadow-sm sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-border/60 bg-card/70 shadow-sm backdrop-blur-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Search + view toggle */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="group relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />

                    <Input
                      type="search"
                      placeholder="Search product name or barcode..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-11 w-full rounded-xl border-border/60 bg-muted/15 pl-10 pr-10 text-sm font-medium shadow-none focus-visible:bg-background"
                    />

                    {hasSearch && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear search</span>
                      </Button>
                    )}
                  </div>

                  <div className="hidden shrink-0 items-center rounded-xl border border-border/60 bg-muted/20 p-1 sm:flex">
                    <Button
                      type="button"
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className="h-9 w-9 rounded-lg"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span className="sr-only">Grid view</span>
                    </Button>

                    <Button
                      type="button"
                      variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('table')}
                      className="h-9 w-9 rounded-lg"
                    >
                      <List className="h-4 w-4" />
                      <span className="sr-only">Table view</span>
                    </Button>
                  </div>
                </div>

                {/* Sort + Add */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center">
                  <Select
                    value={sortOrder}
                    onValueChange={(value) =>
                      setSortOrder(
                        value as
                          | 'name-asc'
                          | 'name-desc'
                          | 'barcode-asc'
                          | 'barcode-desc',
                      )
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-background/70 text-xs font-semibold shadow-none sm:w-[190px]">
                      <ListFilter className="mr-2 h-4 w-4 text-primary" />
                      <SelectValue placeholder="Sort products" />
                    </SelectTrigger>

                    <SelectContent className="rounded-xl border-border/60 shadow-xl">
                      <SelectItem value="name-asc">
                        Product name A–Z
                      </SelectItem>
                      <SelectItem value="name-desc">
                        Product name Z–A
                      </SelectItem>
                      <SelectItem value="barcode-asc">
                        Barcode ascending
                      </SelectItem>
                      <SelectItem value="barcode-desc">
                        Barcode descending
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <AddProductDialog />
                </div>
              </div>

              {/* Result summary */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground">
                  {hasSearch ? (
                    <>
                      <span className="font-semibold text-foreground">
                        {filteredAndSortedProducts.length.toLocaleString()}
                      </span>{' '}
                      result{filteredAndSortedProducts.length === 1 ? '' : 's'}
                      {' '}for “{searchTerm.trim()}”
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {allProducts.length.toLocaleString()}
                      </span>{' '}
                      product{allProducts.length === 1 ? '' : 's'} in catalog
                    </>
                  )}
                </p>

                <div className="flex items-center gap-2 sm:hidden">
                  <Button
                    type="button"
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 rounded-lg px-2.5 text-[11px] font-semibold"
                  >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                    Grid
                  </Button>

                  <Button
                    type="button"
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-8 rounded-lg px-2.5 text-[11px] font-semibold"
                  >
                    <List className="mr-1.5 h-3.5 w-3.5" />
                    Table
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {itemsToRender.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {itemsToRender.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  isMultiSelect={isMultiSelectEnabled}
                  isSelected={selectedIds.has(product.id)}
                  onSelect={() => handleToggleSelect(product.id)}
                  onDelete={
                    role === 'admin'
                      ? () => initiateDelete([product.id])
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="mb-16 overflow-hidden rounded-2xl border-border/60 bg-card/70 shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-muted/25">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-14 px-4 text-center">
                        <Checkbox
                          checked={isAllVisibleSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>

                      <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Product
                      </TableHead>

                      <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Barcode
                      </TableHead>

                      <TableHead className="h-12 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Supplier
                      </TableHead>

                      <TableHead className="h-12 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Cost
                      </TableHead>

                      <TableHead className="h-12 w-28 pr-4 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {itemsToRender.map((product) => (
                      <TableRow
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className="group h-[68px] cursor-pointer border-border/50 transition-colors hover:bg-primary/[0.025]"
                      >
                        <TableCell
                          className="px-4 text-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() =>
                              handleToggleSelect(product.id)
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {product.productName}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs font-medium text-muted-foreground">
                            {product.barcode}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className="max-w-[220px] truncate rounded-lg border-border/60 bg-muted/25 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                          >
                            {product.supplierName || 'No supplier'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {product.costPrice
                              ? `QAR ${product.costPrice.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : '—'}
                          </span>
                        </TableCell>

                        <TableCell
                          className="pr-4 text-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleProductClick(product)}
                              className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit product</span>
                            </Button>

                            {role === 'admin' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => initiateDelete([product.id])}
                                className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete product</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {filteredAndSortedProducts.length > MAX_ITEMS_TO_DISPLAY && (
            <div className="flex justify-center border-t border-border/50 py-8">
              <p className="text-center text-xs text-muted-foreground">
                Showing the first{' '}
                <span className="font-semibold text-foreground">
                  {MAX_ITEMS_TO_DISPLAY}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-foreground">
                  {filteredAndSortedProducts.length.toLocaleString()}
                </span>{' '}
                products. Refine your search to narrow the results.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/10 px-5 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <PackageOpen className="h-7 w-7" />
          </div>

          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">
            {hasSearch ? 'No products found' : 'No products yet'}
          </h3>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {hasSearch
              ? `No product matches “${searchTerm.trim()}”. Try the exact barcode or another product name.`
              : 'Your product catalog is empty. Add a product to get started.'}
          </p>

          {hasSearch && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearchTerm('')}
              className="mt-5 h-10 rounded-xl px-5 text-xs font-semibold"
            >
              Clear search
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
        actionDescription={`Deleting ${pendingDeleteIds.length} product${pendingDeleteIds.length === 1 ? '' : 's'} from the catalog. This action cannot be undone.`}
      />
    </div>
  );
}
