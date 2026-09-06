'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Barcode,
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CircleDollarSign,
  Loader2,
  Package,
  PlusCircle,
  Save,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { saveProductAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface QuickProductEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickProductEditDialog({
  isOpen,
  onOpenChange,
}: QuickProductEditDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { products, suppliers, updateProduct, refreshData } = useDataCache();

  const [isActionPending, startActionTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
  });

  const supplierNameValue = watch('supplierName');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setMatchedProduct(null);
      reset();
      setSupplierSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen, reset]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);

    const termLower = term.toLowerCase().trim();

    if (!termLower) {
      setMatchedProduct(null);
      return;
    }

    const match = products.find(
      (product) =>
        product.barcode.toLowerCase() === termLower ||
        product.productName.toLowerCase().includes(termLower),
    );

    if (match) {
      setMatchedProduct(match);
      reset({
        barcode: match.barcode,
        productName: match.productName,
        supplierName: match.supplierName || '',
        costPrice: match.costPrice,
      });
    } else {
      setMatchedProduct(null);
    }
  };

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  const onFormSubmit = (data: AddProductFormValues) => {
    if (!matchedProduct || !user?.email) return;

    const updatedProduct: Product = {
      ...matchedProduct,
      productName: data.productName,
      supplierName: data.supplierName,
      costPrice: data.costPrice,
    };

    updateProduct(updatedProduct);
    onOpenChange(false);

    toast({
      title: 'Product updated',
      description: `${data.productName} was updated locally. Syncing with the cloud...`,
    });

    startActionTransition(async () => {
      const formData = new FormData();

      formData.append('barcode', data.barcode);
      formData.append('productName', data.productName);
      formData.append('supplierName', data.supplierName);
      formData.append('userEmail', user.email!);
      formData.append('uniqueId', matchedProduct.uniqueId || '');
      formData.append('editMode', 'edit');

      if (data.costPrice !== undefined) {
        formData.append('costPrice', String(data.costPrice));
      }

      try {
        const res = await saveProductAction(undefined, formData);

        if (!res.success) {
          toast({
            variant: 'destructive',
            title: 'Cloud sync failed',
            description: res.message || 'The product update could not be saved.',
          });

          refreshData();
        }
      } catch {
        refreshData();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex max-h-[92dvh] w-[calc(100vw-1rem)] flex-col gap-0
          overflow-hidden rounded-2xl border border-border/60
          bg-background p-0 shadow-2xl
          sm:max-w-lg sm:rounded-3xl
        "
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

          <DialogHeader className="relative text-left">
            <div className="flex items-start gap-3 pr-10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl">
                  Quick Product Edit
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-5 sm:text-sm">
                  Find a product and update its name, supplier, or cost price.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 h-9 w-9 rounded-xl text-muted-foreground hover:bg-background/80 hover:text-foreground sm:right-4 sm:top-4"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-4 sm:p-6">
            {/* Product search */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="quick-product-search"
                  className="text-xs font-semibold text-foreground"
                >
                  Find product
                </Label>

                <Badge
                  variant="outline"
                  className="border-border/60 bg-muted/30 text-[10px] font-medium text-muted-foreground"
                >
                  Barcode or name
                </Badge>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  id="quick-product-search"
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder="Scan barcode or search product..."
                  className="
                    h-12 rounded-xl border-border/60 bg-muted/20
                    pl-10 pr-10 text-sm font-medium shadow-none
                    focus-visible:bg-background
                  "
                />

                {searchTerm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSearch('')}
                    className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear search</span>
                  </Button>
                )}
              </div>
            </section>

            {matchedProduct ? (
              <form
                onSubmit={handleSubmit(onFormSubmit)}
                className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                {/* Matched product identity */}
                <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Barcode className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Product found
                        </p>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>

                      <p className="mt-1 truncate font-mono text-sm font-bold text-foreground">
                        {matchedProduct.barcode}
                      </p>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {matchedProduct.productName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Product name */}
                <div className="space-y-2">
                  <Label
                    htmlFor="quick-product-name"
                    className="text-xs font-semibold text-foreground"
                  >
                    Product name
                  </Label>

                  <div className="relative">
                    <Package className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="quick-product-name"
                      {...register('productName')}
                      className={cn(
                        'h-11 rounded-xl border-border/60 bg-background pl-10 font-medium shadow-none',
                        errors.productName && 'border-destructive focus-visible:ring-destructive/20',
                      )}
                    />
                  </div>

                  {errors.productName?.message && (
                    <p className="text-xs text-destructive">
                      {String(errors.productName.message)}
                    </p>
                  )}
                </div>

                {/* Supplier */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Supplier
                  </Label>

                  <Popover
                    open={supplierComboboxOpen}
                    onOpenChange={setSupplierComboboxOpen}
                    modal
                  >
                    <PopoverTrigger asChild>
                      <Button
                        ref={supplierTriggerRef}
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierComboboxOpen}
                        className={cn(
                          `
                            h-11 w-full justify-between rounded-xl
                            border-border/60 bg-background px-3
                            text-sm font-medium shadow-none
                          `,
                          !supplierNameValue && 'text-muted-foreground',
                          errors.supplierName && 'border-destructive',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Building2 className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">
                            {supplierNameValue || 'Select supplier'}
                          </span>
                        </div>

                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] overflow-hidden rounded-2xl border-border/60 p-0 shadow-xl"
                      align="start"
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search or enter supplier..."
                          value={supplierSearch}
                          onValueChange={setSupplierSearch}
                          className="h-11"
                        />

                        <CommandList className="max-h-[260px]">
                          <CommandEmpty>
                            {supplierSearch ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-11 w-full justify-start rounded-none px-4 text-xs font-semibold"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setValue('supplierName', supplierSearch, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                  setSupplierComboboxOpen(false);
                                }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                                Use “{supplierSearch}”
                              </Button>
                            ) : (
                              <div className="p-5 text-center text-xs text-muted-foreground">
                                Start typing to find a supplier.
                              </div>
                            )}
                          </CommandEmpty>

                          <CommandGroup>
                            {sortedSuppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.name}
                                onSelect={() => {
                                  setValue('supplierName', supplier.name, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  });
                                  setSupplierComboboxOpen(false);
                                }}
                                className="h-10 rounded-lg text-xs font-medium"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    supplierNameValue?.toLowerCase() ===
                                      supplier.name.toLowerCase()
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                <span className="truncate">{supplier.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {errors.supplierName?.message && (
                    <p className="text-xs text-destructive">
                      {String(errors.supplierName.message)}
                    </p>
                  )}
                </div>

                {/* Cost price */}
                <div className="space-y-2">
                  <Label
                    htmlFor="quick-product-cost"
                    className="text-xs font-semibold text-foreground"
                  >
                    Cost price
                  </Label>

                  <div className="relative">
                    <CircleDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />

                    <Input
                      id="quick-product-cost"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      {...register('costPrice')}
                      className={cn(
                        'h-11 rounded-xl border-border/60 bg-background pl-10 pr-14 font-semibold shadow-none',
                        errors.costPrice && 'border-destructive focus-visible:ring-destructive/20',
                      )}
                    />

                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                      QAR
                    </span>
                  </div>

                  {errors.costPrice?.message && (
                    <p className="text-xs text-destructive">
                      {String(errors.costPrice.message)}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="border-t border-border/50 pt-4">
                  <Button
                    type="submit"
                    disabled={isActionPending}
                    className="
                      h-12 w-full rounded-xl font-semibold shadow-sm
                      transition-all active:scale-[0.99]
                    "
                  >
                    {isActionPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}

                    Save Product Changes
                  </Button>
                </div>
              </form>
            ) : searchTerm ? (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 px-5 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                    <Search className="h-5 w-5" />
                  </div>

                  <h4 className="mt-4 text-sm font-bold text-foreground">
                    No product found
                  </h4>

                  <p className="mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">
                    No product matches “{searchTerm}”. Try the exact barcode or another product name.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-5 py-9 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Barcode className="h-5 w-5" />
                </div>

                <p className="mt-4 text-sm font-semibold text-foreground">
                  Search to begin
                </p>

                <p className="mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">
                  Scan a barcode or enter a product name to load its editable details.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-4 py-3 sm:px-6">
          <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">
            Changes sync to the product catalog
          </p>

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="ml-auto h-9 rounded-xl px-4 text-xs font-semibold text-muted-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
