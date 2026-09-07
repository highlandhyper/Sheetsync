'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { InventoryItem, Product, ExpiryReminder } from '@/lib/types';
import { 
    Search, 
    PackageOpen, 
    User, 
    Loader2, 
    X, 
    ListFilter, 
    Eye, 
    Printer, 
    Undo2, 
    Pencil, 
    Trash2, 
    Wallet, 
    FileText, 
    ChevronDown,
    LayoutList,
    History,
    Check,
    Bell,
    Layers,
    ChevronsUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton'; 
import { ReturnableInventoryItemRow } from '@/components/inventory/returnable-inventory-item-row';
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseISO, isValid, format, isBefore, addDays } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { useDataCache } from '@/context/data-cache-context';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';
import { Checkbox } from '../ui/checkbox';
import { useMultiSelect } from '@/context/multi-select-context';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { generateInventoryPDF, type PDFOrientation } from '@/lib/pdf-reports';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const MAX_INVENTORY_ITEMS_TO_DISPLAY = 100;

export function ReturnableInventoryByStaffClient() {
  const { toast } = useToast();
  const { role, user } = useAuth();
  const { hasFeature } = useAccessControl();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { 
    inventoryItems: cachedItems, 
    products: cachedProducts,
    uniqueLocations,
    uniqueStaffNames: allStaffNames,
    expiryReminders,
    refreshData,
    resolveExpiryReminder
  } = useDataCache();

  const [selectedStaffName, setSelectedStaffName] = useState<string>('');
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [logCategory, setLogCategory] = useState<'normal' | 'diary'>('normal');
  const [isLoading, setIsLoading] = useState(true);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [shouldAutoFetchImage, setShouldAutoFetchImage] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);

  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [totalItemsCount, setTotalItemsCount] = useState(0);
  
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResolvingDiary, setIsResolvingDiary] = useState<string | null>(null);

  // Feature Flags
  const canExport = role === 'admin' || hasFeature('EXPORT_PDF');
  const canPrint = role === 'admin' || hasFeature('PRINT_RECORDS');
  const canReturn = role === 'admin' || hasFeature('PROCESS_RETURN');
  const canEdit = role === 'admin' || hasFeature('EDIT_INVENTORY');
  const canDelete = role === 'admin' || hasFeature('DELETE_INVENTORY');

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);

  const totalValueOfSelectedItems = useMemo(() => {
    if (selectedItemIds.size === 0 || logCategory === 'diary') return 0;
    let totalValue = 0;
    selectedItemIds.forEach(itemId => {
      const item = cachedItems.find(i => i.id === itemId);
      if (item) {
        const product = productsByBarcode.get(item.barcode);
        totalValue += (product?.costPrice ?? 0) * item.quantity;
      }
    });
    return totalValue;
  }, [selectedItemIds, cachedItems, productsByBarcode, logCategory]);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleOpenReturnDialog = (item: InventoryItem) => {
    if (!canReturn) return; 
    setSelectedItemForReturn(item);
    setIsReturnDialogOpen(true);
  };

  const handleOpenDetailsDialog = (item: InventoryItem, autoFetch = false) => {
    setSelectedItemForDetails(item);
    setShouldAutoFetchImage(autoFetch);
    setIsDetailsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    if (!canEdit) return; 
    setCurrentItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (item: InventoryItem) => {
    if (!canDelete) return;
    setSelectedItemForDeletion(item);
    setIsDeleteDialogOpen(true);
  };

  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedItemIds(new Set());
  }, []);

  const handleBulkSuccess = useCallback(() => {
      refreshData();
      setSelectedItemIds(new Set());
      setIsBulkReturnOpen(false);
      setIsBulkDeleteOpen(false);
  }, [refreshData]);

  const handleResolveDiary = async (id: string, name: string) => {
    setIsResolvingDiary(id);
    try {
        await resolveExpiryReminder(id);
        toast({ title: "Reminder Resolved", description: `"${name}" cleared from Diary registry.` });
        refreshData();
    } catch (e) {
        toast({ variant: "destructive", title: "Sync Error", description: "Registry core connection failure." });
    } finally {
        setIsResolvingDiary(null);
    }
  };

  const filteredItems = useMemo(() => {
    if (!selectedStaffName.trim()) return [];
    const lowerStaffName = selectedStaffName.toLowerCase();

    if (logCategory === 'normal') {
        const items = cachedItems
            .filter(item => item.quantity > 0 && item.staffName?.toLowerCase() === lowerStaffName)
            .sort((a, b) => {
                const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
                const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
                return dateB - dateA;
            });
        setTotalItemsCount(items.length);
        return items;
    } else {
        const reminders = expiryReminders
            .filter(r => r.status === 'pending' && r.staffName?.toLowerCase() === lowerStaffName)
            .sort((a, b) => {
                const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
                const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
                return dateB - dateA;
            });
        setTotalItemsCount(reminders.length);
        return reminders;
    }
  }, [cachedItems, expiryReminders, selectedStaffName, logCategory]);
  
  const totalValueForView = useMemo(() => {
    if (logCategory === 'diary') return 0;
    return (filteredItems as InventoryItem[]).reduce((total, item) => {
      const product = productsByBarcode.get(item.barcode);
      return total + ((product?.costPrice ?? 0) * item.quantity);
    }, 0);
  }, [filteredItems, productsByBarcode, logCategory]);

  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [selectedStaffName, logCategory]);

  const handlePrint = () => window.print();

  const handleExportPDF = (orientation: PDFOrientation) => {
    if (!selectedStaffName || filteredItems.length === 0) return;
    
    if (logCategory === 'normal') {
        const items = filteredItems as InventoryItem[];
        const cols = ['No.', 'Product Name', 'Barcode', 'Supplier', 'Qty', 'Unit Cost', 'Total Value', 'Expiry', 'Location'];
        const dataMapper = (item: InventoryItem, idx: number) => {
            const product = productsByBarcode.get(item.barcode);
            const cost = product?.costPrice ?? 0;
            return [
                (idx + 1).toString(), item.productName, item.barcode, item.supplierName || 'N/A',
                item.quantity.toString(), `QAR ${cost.toFixed(2)}`, `QAR ${(cost * item.quantity).toFixed(2)}`,
                item.expiryDate || 'N/A', item.location
            ];
        };
        generateInventoryPDF(`Staff Standard Logs: ${selectedStaffName}`, items, cols, (item) => dataMapper(item, items.indexOf(item)), totalValueForView, orientation);
    } else {
        const items = filteredItems as ExpiryReminder[];
        const cols = ['No.', 'Product Name', 'Barcode', 'Supplier', 'Expiry Date', 'Status'];
        const dataMapper = (r: ExpiryReminder, idx: number) => [
            (idx + 1).toString(), r.productName, r.barcode, r.supplierName || 'N/A',
            r.expiryDate, 'PENDING'
        ];
        generateInventoryPDF(`Staff Diary Logs: ${selectedStaffName}`, items, cols, (item) => dataMapper(item, items.indexOf(item)), undefined, orientation);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleSelectRow = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-none space-y-3 overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:space-y-4 sm:px-4 md:px-5 md:pb-8 lg:px-4 xl:px-5 2xl:px-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid gap-3 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden rounded-2xl border-0 shadow-none ring-1 ring-border/50">
              <CardContent className="space-y-3 p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                </div>
                <Skeleton className="h-10 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="hidden overflow-hidden rounded-2xl border-0 shadow-none ring-1 ring-border/50 md:block">
          <Table><TableHeader><TableRow><TableHead>Identity</TableHead><TableHead>Barcode</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="w-36 text-center">Protocol</TableHead></TableRow></TableHeader>
          <TableBody>{Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right"><Skeleton className="ml-auto h-5 w-1/2" /></TableCell><TableCell><Skeleton className="mx-auto h-9 w-24" /></TableCell></TableRow>))}</TableBody></Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-none space-y-3 overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] animate-in fade-in duration-300 sm:space-y-4 sm:px-4 md:px-5 md:pb-8 lg:px-4 xl:px-5 2xl:px-6">
      <Card className="filters-card-noprint w-full min-w-0 overflow-hidden rounded-2xl border-0 bg-muted/20 p-2.5 shadow-none ring-1 ring-border/50 sm:p-3">
        <CardContent className="min-w-0 space-y-3 p-0">
          {selectedItemIds.size > 0 && isMultiSelectEnabled && logCategory === 'normal' ? (
             <div className="grid min-w-0 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
               <div className="min-w-0 rounded-xl bg-background/70 px-3 py-2.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {selectedItemIds.size} selected
                      </p>
                      <span className="shrink-0 text-[10px] font-semibold text-primary">Bulk mode</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 truncate text-xs font-bold tabular-nums text-foreground">
                        QAR {totalValueOfSelectedItems.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10 min-w-0 rounded-xl px-3 text-[10px] font-semibold" onClick={() => setIsBulkReturnOpen(true)}>Bulk Return</Button>
                    {canDelete && <Button variant="destructive" size="sm" className="h-10 min-w-0 rounded-xl px-3 text-[10px] font-semibold" onClick={() => setIsBulkDeleteOpen(true)}>Bulk Purge</Button>}
                </div>
             </div>
          ) : (
            <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,280px)_minmax(0,240px)]">
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                className="h-11 w-full min-w-0 justify-between rounded-xl border-border/60 bg-background px-3 text-xs font-semibold shadow-none"
                            >
                                <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                                    <User className="mr-2 h-4 w-4 text-primary/40 shrink-0" />
                                    <span className="truncate">{selectedStaffName || "Identify Personnel..."}</span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-border/60 p-0 shadow-xl" align="start">
                            <Command>
                                <CommandInput placeholder="Search personnel..." />
                                <CommandList className="max-h-72">
                                    <CommandEmpty className="py-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center">Zero registry matches</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            value="__EMPTY__"
                                            onSelect={() => {
                                                setSelectedStaffName('');
                                                setStaffPopoverOpen(false);
                                            }}
                                            className="font-medium italic text-xs py-2.5"
                                        >
                                            <X className="mr-2 h-4 w-4 opacity-40" /> Clear Identification
                                        </CommandItem>
                                        {allStaffNames.map(name => (
                                            <CommandItem
                                                key={name}
                                                value={name}
                                                onSelect={() => {
                                                    setSelectedStaffName(name);
                                                    setStaffPopoverOpen(false);
                                                }}
                                                className="font-black uppercase text-xs py-2.5 cursor-pointer"
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", selectedStaffName === name ? "opacity-100" : "opacity-0")} />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    <Tabs value={logCategory} onValueChange={(v: any) => setLogCategory(v)} className="w-full min-w-0">
                        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border-0 bg-background/70 p-1">
                            <TabsTrigger value="normal" className="min-w-0 rounded-lg px-2 text-[9px] font-bold uppercase tracking-[0.1em] data-[state=active]:bg-background data-[state=active]:shadow-sm">Normal Log</TabsTrigger>
                            <TabsTrigger value="diary" className="min-w-0 rounded-lg px-2 text-[9px] font-bold uppercase tracking-[0.1em] data-[state=active]:bg-background data-[state=active]:shadow-sm">Diary Log</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-2 lg:justify-end">
                    {selectedStaffName && (
                        <Badge variant="secondary" className="max-w-[110px] shrink-0 truncate rounded-lg border-0 bg-primary/10 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-primary">
                            {totalItemsCount} TRACES
                        </Badge>
                    )}
                    <div className="flex shrink-0 items-center gap-1.5">
                        {canExport && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-10 rounded-xl border-border/60 bg-background px-2.5 text-xs font-semibold shadow-none sm:h-11 sm:px-3" disabled={filteredItems.length === 0}>
                                        <FileText className="h-4 w-4 shrink-0 sm:mr-2" /> <span className="hidden sm:inline">Export</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl shadow-3xl">
                                    <DropdownMenuItem onClick={() => handleExportPDF('portrait')} className="font-bold text-xs uppercase py-2">Portrait</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportPDF('landscape')} className="font-bold text-xs uppercase py-2">Landscape</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {canPrint && (
                            <Button onClick={handlePrint} variant="outline" size="sm" className="h-10 rounded-xl border-border/60 bg-background px-2.5 text-xs font-semibold shadow-none sm:h-11 sm:px-3" disabled={filteredItems.length === 0}>
                                <Printer className="h-4 w-4 shrink-0 sm:mr-2" /> <span className="hidden sm:inline">Print</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedStaffName && logCategory === 'normal' && filteredItems.length > 0 && (
        <Card className="w-full min-w-0 overflow-hidden rounded-2xl border-0 bg-primary/[0.06] shadow-none ring-1 ring-primary/10 animate-in zoom-in-95 duration-300">
            <CardContent className="min-w-0 p-3 sm:p-4">
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:h-11 sm:w-11">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>

                  <div className="min-w-0">
                      <h3 className="text-[13px] font-bold leading-tight text-foreground sm:text-sm">Active contribution</h3>
                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">
                        Inventory value logged by this staff member
                      </p>
                  </div>

                  <div className="col-span-2 min-w-0 border-t border-primary/10 pt-2 min-[420px]:col-span-1 min-[420px]:border-0 min-[420px]:pt-0 min-[420px]:text-right">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70">Total value</p>
                    <p className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-bold leading-none tabular-nums text-primary sm:text-2xl">
                      QAR {totalValueForView.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
              </div>
            </CardContent>
        </Card>
      )}

      {!selectedStaffName ? (
         <div className="flex min-h-[260px] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[340px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground sm:h-16 sm:w-16">
            <User className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.7} />
          </div>
          <h3 className="mt-4 text-base font-bold tracking-tight text-foreground sm:text-lg">Select a staff member</h3>
          <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground sm:text-xs">
            Choose a staff member above to view normal inventory logs or Diary reminders.
          </p>
        </div>
      ) : filteredItems.length > 0 ? (
        <>
            <Card className="hidden overflow-hidden rounded-2xl border-0 bg-card shadow-none ring-1 ring-border/50 md:block">
                <Table>
                    <TableHeader className="bg-muted/10 border-b border-white/5">
                        <TableRow className="h-14 hover:bg-transparent">
                            {logCategory === 'normal' && isMultiSelectEnabled && (
                                <TableHead className="w-12 text-center pl-6">
                                    <Checkbox checked={selectedItemIds.size === filteredItems.length} onCheckedChange={handleSelectAll} />
                                </TableHead>
                            )}
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] pl-8">Identity Node</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em]">Barcode</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-right">Volume</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-right">Valuation</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em]">Zone</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em]">Expiry</TableHead>
                            <TableHead className="w-[128px] min-w-[128px] max-w-[128px] text-center text-[10px] font-black uppercase tracking-[0.2em]">Protocol</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.map((item) => {
                            if (logCategory === 'normal') {
                                const inv = item as InventoryItem;
                                return (
                                    <ReturnableInventoryItemRow
                                        key={inv.id}
                                        item={inv}
                                        onInitiateReturn={canReturn ? handleOpenReturnDialog : undefined}
                                        onViewDetails={handleOpenDetailsDialog}
                                        onEditItem={canEdit ? handleOpenEditDialog : undefined}
                                        isProcessing={selectedItemForReturn?.id === inv.id && isReturnDialogOpen}
                                        isSelected={selectedItemIds.has(inv.id)}
                                        onSelectRow={isMultiSelectEnabled ? handleSelectRow : undefined}
                                        showCheckbox={isMultiSelectEnabled}
                                        costPrice={productsByBarcode.get(inv.barcode)?.costPrice}
                                        showCost={true}
                                    />
                                );
                            } else {
                                const r = item as ExpiryReminder;
                                const isCritical = isBefore(parseISO(r.expiryDate), addDays(new Date(), 30));
                                return (
                                    <TableRow key={r.id} className="group hover:bg-primary/[0.02] border-white/5 h-16">
                                        <TableCell className="pl-8 font-black text-sm uppercase text-slate-700 dark:text-slate-300">{r.productName}</TableCell>
                                        <TableCell className="font-mono text-[11px] text-muted-foreground/50 tracking-tighter uppercase">{r.barcode}</TableCell>
                                        <TableCell className="text-right font-black text-primary/40">---</TableCell>
                                        <TableCell className="text-right font-black text-slate-400">N/A</TableCell>
                                        <TableCell className="text-xs font-bold text-muted-foreground uppercase">{r.supplierName || 'System'}</TableCell>
                                        <TableCell className={cn("text-xs font-bold", isCritical ? "text-orange-500 animate-pulse" : "text-slate-400")}>
                                            {format(parseISO(r.expiryDate), 'PP')}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-9 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest text-primary hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={() => handleResolveDiary(r.id, r.productName)}
                                                disabled={isResolvingDiary === r.id}
                                            >
                                                {isResolvingDiary === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
                                                Resolve
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            }
                        })}
                    </TableBody>
                </Table>
            </Card>

            <div className="grid min-w-0 grid-cols-1 gap-3 md:hidden">
                {filteredItems.map((item) => {
                    if (logCategory === 'normal') {
                        const inv = item as InventoryItem;
                        return (
                            <InventoryItemCardMobile
                                key={`mob-${inv.id}`}
                                item={inv}
                                product={productsByBarcode.get(inv.barcode)}
                                onDetails={() => handleOpenDetailsDialog(inv)}
                                onViewImage={() => handleOpenDetailsDialog(inv, true)}
                                onEdit={canEdit ? () => handleOpenEditDialog(inv) : undefined}
                                onReturn={canReturn ? () => handleOpenReturnDialog(inv) : undefined}
                                isSelected={isMultiSelectEnabled && selectedItemIds.has(inv.id)}
                                onSelect={isMultiSelectEnabled ? () => handleSelectRow(inv.id) : undefined}
                                context="staff"
                            />
                        );
                    } else {
                        const r = item as ExpiryReminder;
                        return (
                            <Card key={`mob-diary-${r.id}`} className="w-full min-w-0 overflow-hidden rounded-2xl border-0 bg-card shadow-none ring-1 ring-border/50">
                                <CardContent className="min-w-0 space-y-3 p-3">
                                    <div className="flex min-w-0 items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="line-clamp-2 break-words [overflow-wrap:anywhere] text-[13px] font-bold leading-tight text-foreground sm:text-sm">{r.productName}</h4>
                                            <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{r.barcode}</p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0 rounded-lg border-0 bg-primary/10 px-2 py-1 text-[8px] font-bold text-primary">DIARY</Badge>
                                    </div>

                                    <div className="grid min-w-0 grid-cols-2 gap-2 max-[340px]:grid-cols-1">
                                        <div className="min-w-0 rounded-xl bg-muted/40 px-2.5 py-2">
                                            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Expiry</p>
                                            <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{format(parseISO(r.expiryDate), 'dd MMM yy')}</p>
                                        </div>
                                        <div className="min-w-0 rounded-xl bg-muted/40 px-2.5 py-2">
                                            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Logged</p>
                                            <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{format(parseISO(r.timestamp), 'dd/MM/yy')}</p>
                                        </div>
                                    </div>

                                    <Button 
                                        className="h-10 w-full rounded-xl border-0 bg-primary/10 text-[10px] font-semibold text-primary shadow-none hover:bg-primary hover:text-primary-foreground"
                                        onClick={() => handleResolveDiary(r.id, r.productName)}
                                        disabled={isResolvingDiary === r.id}
                                    >
                                        {isResolvingDiary === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                        Resolve reminder
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    }
                })}
            </div>
        </>
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center px-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <PackageOpen className="h-6 w-6" strokeWidth={1.7} />
          </div>
          <h3 className="mt-4 text-base font-bold tracking-tight text-foreground">No active {logCategory} logs</h3>
          <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground">
            There are no active records for {selectedStaffName} in this view.
          </p>
        </div>
      )}
      
      <ReturnQuantityDialog key={`ret-${selectedItemForReturn?.id || 'none'}`} item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />
      <InventoryItemDetailsDialog key={`det-${selectedItemForDetails?.id || 'none'}`} item={selectedItemForDetails} isOpen={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} autoFetchImage={shouldAutoFetchImage} onStartEdit={canEdit ? handleOpenEditDialog : undefined} />
      <EditInventoryItemDialog key={`edt-${currentItemToEdit?.id || 'none'}`} item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />
      <DeleteConfirmationDialog key={`del-${selectedItemForDeletion?.id || 'none'}`} item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={handleActionSuccess} />
      <BulkReturnDialog isOpen={isBulkReturnOpen} onOpenChange={setIsBulkReturnOpen} itemIds={Array.from(selectedItemIds)} onSuccess={handleBulkSuccess} itemCount={selectedItemIds.size} />
      <BulkDeleteDialog isOpen={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen} itemIds={Array.from(selectedItemIds)} onSuccess={handleBulkSuccess} itemCount={selectedItemIds.size} />
    </div>
  );
}

export default ReturnableInventoryByStaffClient;
