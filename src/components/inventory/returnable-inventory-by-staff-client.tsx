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
      <div className="space-y-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Card className="shadow-md">
          <Table><TableHeader><TableRow><TableHead>Identity</TableHead><TableHead>Barcode</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="w-36 text-center">Protocol</TableHead></TableRow></TableHeader>
          <TableBody>{Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell><TableCell><Skeleton className="h-9 w-24 mx-auto" /></TableCell></TableRow>))}</TableBody></Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0 space-y-4">
          {selectedItemIds.size > 0 && isMultiSelectEnabled && logCategory === 'normal' ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-sm font-black uppercase tracking-widest text-muted-foreground">{selectedItemIds.size} Linked Nodes</div>
                    <div className="flex items-center text-sm font-black text-primary border-l pl-4 uppercase tracking-tighter">
                        <Wallet className="mr-2 h-4 w-4" />
                        <span>Valuation: QAR {totalValueOfSelectedItems.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="font-bold rounded-lg" onClick={() => setIsBulkReturnOpen(true)}>Bulk Return</Button>
                    {canDelete && <Button variant="destructive" size="sm" className="font-bold rounded-lg" onClick={() => setIsBulkDeleteOpen(true)}>Bulk Purge</Button>}
                </div>
             </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                className="w-full sm:w-[300px] h-11 justify-between font-bold bg-background shadow-sm rounded-xl px-4"
                            >
                                <div className="flex items-center truncate">
                                    <User className="mr-2 h-4 w-4 text-primary/40 shrink-0" />
                                    <span className="truncate">{selectedStaffName || "Identify Personnel..."}</span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="start">
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
                    
                    <Tabs value={logCategory} onValueChange={(v: any) => setLogCategory(v)} className="w-full sm:w-auto">
                        <TabsList className="h-11 p-1 bg-muted/20 border rounded-xl grid grid-cols-2 w-full sm:w-[260px]">
                            <TabsTrigger value="normal" className="text-[9px] font-black uppercase tracking-widest rounded-lg data-[state=active]:shadow-sm">Normal Log</TabsTrigger>
                            <TabsTrigger value="diary" className="text-[9px] font-black uppercase tracking-widest rounded-lg data-[state=active]:shadow-sm">Diary Log</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    {selectedStaffName && (
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-none px-4 py-1.5 font-black uppercase text-[9px] tracking-widest hidden sm:flex">
                            <History className="mr-2 h-3 w-3" />
                            {totalItemsCount} TRACES
                        </Badge>
                    )}
                    <div className="flex items-center gap-2">
                        {canExport && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-11 rounded-xl px-4 font-bold border-white/5 bg-background shadow-sm" disabled={filteredItems.length === 0}>
                                        <FileText className="mr-2 h-4 w-4" /> Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl shadow-3xl">
                                    <DropdownMenuItem onClick={() => handleExportPDF('portrait')} className="font-bold text-xs uppercase py-2">Portrait</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportPDF('landscape')} className="font-bold text-xs uppercase py-2">Landscape</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {canPrint && (
                            <Button onClick={handlePrint} variant="outline" size="sm" className="h-11 rounded-xl px-4 font-bold border-white/5 bg-background shadow-sm" disabled={filteredItems.length === 0}>
                                <Printer className="mr-2 h-4 w-4" /> Print
                            </Button>
                        )}
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedStaffName && logCategory === 'normal' && filteredItems.length > 0 && (
        <Card className="p-6 shadow-md border-primary/10 bg-primary/5 rounded-2xl animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Wallet className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Active Asset Contribution</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Total value of inventory logged by this identity.</p>
                    </div>
                </div>
                <p className="text-3xl font-black text-primary tabular-nums">
                    QAR {totalValueForView.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
            </div>
        </Card>
      )}

      {!selectedStaffName ? (
         <div className="text-center py-32 flex flex-col items-center justify-center opacity-20 grayscale">
          <User className="h-16 w-16 mb-4" strokeWidth={1.5} />
          <h3 className="text-2xl font-black uppercase tracking-tighter">Personnel Selection Required</h3>
          <p className="text-[10px] font-medium uppercase tracking-[0.4em] mt-2">Identify staff member to initiate audit trace.</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <>
            <Card className="shadow-2xl border-white/5 overflow-hidden rounded-[2rem] hidden md:block bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl">
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
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-center pr-8">Protocol</TableHead>
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

            <div className="grid grid-cols-1 gap-4 md:hidden px-2">
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
                            <Card key={`mob-diary-${r.id}`} className="border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-xl overflow-hidden">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1 min-w-0">
                                            <h4 className="text-base font-black uppercase truncate text-slate-800 dark:text-white leading-tight">{r.productName}</h4>
                                            <p className="text-[10px] font-mono text-muted-foreground tracking-widest">{r.barcode}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[8px] font-black px-2 py-0.5">DIARY LOG</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground/40">Expiry Target</p>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">{format(parseISO(r.expiryDate), 'dd MMM yy')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground/40">Registry Sync</p>
                                            <p className="text-xs font-bold text-muted-foreground">{format(parseISO(r.timestamp), 'dd/MM/yy')}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        className="w-full h-11 font-black uppercase text-[10px] tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white border-none transition-all shadow-none"
                                        onClick={() => handleResolveDiary(r.id, r.productName)}
                                        disabled={isResolvingDiary === r.id}
                                    >
                                        {isResolvingDiary === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Check className="h-3.5 w-3.5 mr-2" />}
                                        Initialize Resolve
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    }
                })}
            </div>
        </>
      ) : (
        <div className="py-32 flex flex-col items-center justify-center text-center opacity-20 grayscale">
          <PackageOpen className="h-16 w-16 mb-4" strokeWidth={1} />
          <h3 className="text-xl font-black uppercase tracking-widest">Registry Nominal</h3>
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] mt-2">Zero active {logCategory} traces identified for this node.</p>
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