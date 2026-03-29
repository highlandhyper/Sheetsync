'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { InventoryItem } from '@/lib/types';
import { Search, PackageOpen, FilterX, Eye, Undo2, Tag, Printer, CalendarIcon, Trash2, Building, Wallet, FileText, ChevronDown, Barcode, ChevronsUpDown, Check } from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { useMultiSelect } from '@/context/multi-select-context';
import { CreateProductFromInventoryDialog } from '../products/create-product-from-inventory-dialog';
import { useDataCache } from '@/context/data-cache-context';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';
import { InventoryItemGroupDetailsDialog, type GroupedInventoryItem } from './inventory-item-group-details-dialog';
import { InventoryItemDetailsDialog } from './inventory-item-details-dialog';
import { generateInventoryPDF, type PDFOrientation } from '@/lib/pdf-reports';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


const ALL_SUPPLIERS_VALUE = "___ALL_SUPPLIERS___";

type DashboardFilterType = {
  type: 'damaged' | 'expiringSoon' | 'otherSuppliers' | 'customExpiry' | 'specificSupplier';
  suppliers?: string[];
  customExpiryFrom?: string;
  customExpiryTo?: string;
} | null;

export function InventoryListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useAuth();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { 
      inventoryItems: cachedItems,
      products: cachedProducts,
      suppliers,
      uniqueLocations: uniqueDbLocations,
      addProduct: addProductToCache, 
      refreshData: onDataNeeded,
  } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilterType>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedInventoryItem | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [shouldAutoFetchImage, setShouldAutoFetchImage] = useState(false);

  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [barcodeToCreate, setBarcodeToCreate] = useState<string | null>(null);

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredItemsBySearchAndSupplierAndDate = useMemo(() => {
    let items = cachedItems;

    if (activeDashboardFilter) {
       switch(activeDashboardFilter.type) {
        case 'damaged': items = items.filter(item => item.itemType === 'Damage'); break;
        case 'expiringSoon': {
            const today = startOfDay(new Date());
            const threshold = startOfDay(addDays(today, 7));
            items = items.filter(item => {
                if (item.itemType === 'Expiry' && item.expiryDate) {
                    try {
                        const expiry = startOfDay(parseISO(item.expiryDate));
                        return isValid(expiry) && !isBefore(expiry, today) && isBefore(expiry, threshold);
                    } catch { return false; }
                }
                return false;
            });
            break;
        }
        case 'otherSuppliers': case 'specificSupplier': {
            if (activeDashboardFilter.suppliers) {
                const lowerCaseSuppliers = activeDashboardFilter.suppliers.map(s => s.toLowerCase());
                items = items.filter(item => item.supplierName && lowerCaseSuppliers.includes(item.supplierName.toLowerCase()));
            }
            break;
        }
        case 'customExpiry': {
            if (activeDashboardFilter.customExpiryFrom && activeDashboardFilter.customExpiryTo) {
                try {
                    const from = startOfDay(parseISO(activeDashboardFilter.customExpiryFrom));
                    const to = startOfDay(parseISO(activeDashboardFilter.customExpiryTo));
                    if (isValid(from) && isValid(to)) {
                        items = items.filter(item => {
                            if (item.itemType === 'Expiry' && item.expiryDate) {
                                try {
                                    const expiry = startOfDay(parseISO(item.expiryDate));
                                    return isValid(expiry) && !isBefore(expiry, from) && !isAfter(expiry, to);
                                } catch { return false; }
                            }
                            return false;
                        });
                    }
                } catch { }
            }
            break;
        }
       }
    }

    if (debouncedSearch) {
        const lowerSearchTerm = debouncedSearch.toLowerCase();
        items = items.filter(item =>
            item.productName.toLowerCase().includes(lowerSearchTerm) ||
            item.barcode.toLowerCase().includes(lowerSearchTerm) ||
            item.staffName.toLowerCase().includes(lowerSearchTerm) ||
            item.location.toLowerCase().includes(lowerSearchTerm) ||
            (item.supplierName && item.supplierName.toLowerCase().includes(lowerSearchTerm))
        );
    }

    if (selectedSupplier) {
        items = items.filter(item => item.supplierName === selectedSupplier);
    }

    if (selectedDateRange?.from && selectedDateRange.to) {
        const fromDate = startOfDay(selectedDateRange.from);
        const toDate = startOfDay(selectedDateRange.to);
        items = items.filter(item => {
            if (item.itemType === 'Expiry' && item.expiryDate) {
                try {
                    const expiry = startOfDay(parseISO(item.expiryDate));
                    return isValid(expiry) && !isBefore(expiry, fromDate) && !isAfter(expiry, toDate);
                } catch { return false; }
            }
            return false;
        });
    }

    if (typeFilter !== 'all') {
      const today = startOfDay(new Date());
      items = items.filter(item => {
        if (typeFilter === 'damage') return item.itemType === 'Damage';
        if (typeFilter === 'expiry') return item.itemType === 'Expiry';
        if (typeFilter === 'expired') {
          if (item.itemType !== 'Expiry' || !item.expiryDate) return false;
          try {
            const expiry = startOfDay(parseISO(item.expiryDate));
            return isValid(expiry) && isBefore(expiry, today);
          } catch { return false; }
        }
        return true;
      });
    }

    return items;
  }, [cachedItems, activeDashboardFilter, debouncedSearch, selectedSupplier, selectedDateRange, typeFilter]);
  
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { individualItems: InventoryItem[]; totalQuantity: number }>();

    for (const item of filteredItemsBySearchAndSupplierAndDate) {
        if (item.quantity <= 0) continue; 
        if (!groups.has(item.barcode)) {
            groups.set(item.barcode, { individualItems: [], totalQuantity: 0 });
        }
        const group = groups.get(item.barcode)!;
        group.individualItems.push(item);
        group.totalQuantity += item.quantity;
    }

    const result: GroupedInventoryItem[] = [];
    for (const [barcode, groupData] of groups.entries()) {
        groupData.individualItems.sort((a, b) => {
            const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });
        result.push({ mainItem: groupData.individualItems[0], individualItems: groupData.individualItems, totalQuantity: groupData.totalQuantity });
    }

    result.sort((a, b) => {
        const dateA = a.mainItem.timestamp ? parseISO(a.mainItem.timestamp).getTime() : 0;
        const dateB = b.mainItem.timestamp ? parseISO(b.mainItem.timestamp).getTime() : 0;
        return dateB - dateA;
    });

    return result;
  }, [filteredItemsBySearchAndSupplierAndDate]);

  useEffect(() => {
    if (isGroupDetailsOpen && selectedGroup) {
        const matchingGroup = groupedItems.find(g => g.mainItem.barcode === selectedGroup.mainItem.barcode);
        if (matchingGroup) setSelectedGroup(matchingGroup);
        else { setIsGroupDetailsOpen(false); setSelectedGroup(null); }
    }
  }, [groupedItems, isGroupDetailsOpen, selectedGroup]);

  const totalValueOfSelectedItems = useMemo(() => {
    if (selectedBarcodes.size === 0) return 0;
    let totalValue = 0;
    groupedItems.forEach(group => {
      if (selectedBarcodes.has(group.mainItem.barcode)) {
        totalValue += (productsByBarcode.get(group.mainItem.barcode)?.costPrice ?? 0) * group.totalQuantity;
      }
    });
    return totalValue;
  }, [selectedBarcodes, groupedItems, productsByBarcode]);
  
  const getItemsForBulkAction = (): string[] => {
    if (selectedBarcodes.size === 0) return [];
    const itemIds: string[] = [];
    groupedItems.forEach(group => {
        if(selectedBarcodes.has(group.mainItem.barcode)) group.individualItems.forEach(item => itemIds.push(item.id));
    });
    return itemIds;
  };

  useEffect(() => {
    const filterTypeFromQuery = searchParams.get('filterType');
    const suppliersFromQuery = searchParams.get('suppliers');
    const fromDateQuery = searchParams.get('from');
    const toDateQuery = searchParams.get('to');

    let newPotentialFilter: DashboardFilterType = null;
    if (filterTypeFromQuery === 'specificSupplier' && suppliersFromQuery) {
      newPotentialFilter = { type: 'specificSupplier', suppliers: [decodeURIComponent(suppliersFromQuery)] };
    } else if (filterTypeFromQuery === 'customExpiry' && fromDateQuery && toDateQuery) {
      newPotentialFilter = { type: 'customExpiry', customExpiryFrom: fromDateQuery, customExpiryTo: toDateQuery };
    } else if (filterTypeFromQuery === 'damaged') {
      newPotentialFilter = { type: 'damaged' };
    } else if (filterTypeFromQuery === 'expiringSoon') {
      newPotentialFilter = { type: 'expiringSoon' };
    } else if (filterTypeFromQuery === 'otherSuppliers' && suppliersFromQuery) {
      newPotentialFilter = { type: 'otherSuppliers', suppliers: decodeURIComponent(suppliersFromQuery).split(',') };
    }

    if (JSON.stringify(newPotentialFilter) !== JSON.stringify(activeDashboardFilter)) {
      setActiveDashboardFilter(newPotentialFilter);
      if (newPotentialFilter) {
        setSearchTerm(''); setSelectedSupplier(''); setSelectedDateRange(undefined);
        if (newPotentialFilter.type === 'specificSupplier' && newPotentialFilter.suppliers?.length) {
            setSelectedSupplier(newPotentialFilter.suppliers[0]);
        }
      }
    } 
  }, [searchParams, activeDashboardFilter]);

  useEffect(() => {
    if (!isMultiSelectEnabled) setSelectedBarcodes(new Set());
  }, [isMultiSelectEnabled]);

  const clearFilters = () => {
    setSearchTerm(''); setSelectedSupplier(''); setSelectedDateRange(undefined); setIsDatePopoverOpen(false); setTypeFilter('all');
    if (activeDashboardFilter) { setActiveDashboardFilter(null); router.replace('/inventory'); }
  }

  const handleSupplierChange = (value: string) => {
    setSelectedSupplier(value === ALL_SUPPLIERS_VALUE ? '' : value);
    if (activeDashboardFilter) { setActiveDashboardFilter(null); router.replace('/inventory'); }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if(activeDashboardFilter) { setActiveDashboardFilter(null); router.replace('/inventory'); }
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setSelectedDateRange(range);
    if (range?.from && range?.to) setIsDatePopoverOpen(false);
    if (activeDashboardFilter) { setActiveDashboardFilter(null); router.replace('/inventory'); }
  }

  const handleOpenGroupDetails = (group: GroupedInventoryItem) => { setSelectedGroup(group); setIsGroupDetailsOpen(true); };
  const handleOpenDetailsDialog = (item: InventoryItem, autoFetch = false) => { 
    setSelectedItemForDetails(item); 
    setShouldAutoFetchImage(autoFetch);
    setIsDetailsDialogOpen(true); 
  };
  const handleOpenReturnDialog = (item: InventoryItem) => { if (role === 'viewer') return; setSelectedItemForReturn(item); setIsReturnDialogOpen(true); };
  const handleOpenEditDialog = (item: InventoryItem) => { if (role === 'viewer') return; setCurrentItemToEdit(item); setIsEditDialogOpen(true); };
  const handleOpenDeleteDialog = (item: InventoryItem) => { if (role !== 'admin') return; setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); };

  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false); 
    setIsEditDialogOpen(false); 
    setIsDeleteDialogOpen(false);
    setSelectedBarcodes(new Set());
  }, []);

  const handleExportPDF = (orientation: PDFOrientation) => {
    const cols = ['No.', 'Product Name', 'Barcode', 'Supplier', 'Qty', 'Unit Cost', 'Total Value', 'Expiry', 'Location'];
    const dataMapper = (group: GroupedInventoryItem, idx: number) => {
        const product = productsByBarcode.get(group.mainItem.barcode);
        const cost = product?.costPrice ?? 0;
        const hasMultipleLocs = new Set(group.individualItems.map(i => i.location)).size > 1;
        return [
            (idx + 1).toString(), group.mainItem.productName, group.mainItem.barcode,
            group.mainItem.supplierName || 'N/A', group.totalQuantity.toString(),
            `QAR ${cost.toFixed(2)}`, `QAR ${(cost * group.totalQuantity).toFixed(2)}`,
            group.mainItem.expiryDate || 'N/A', hasMultipleLocs ? "Multiple" : group.mainItem.location
        ];
    };
    let totalVal = 0; groupedItems.forEach(g => totalVal += (productsByBarcode.get(g.mainItem.barcode)?.costPrice ?? 0) * g.totalQuantity);
    generateInventoryPDF('Current Inventory Summary', groupedItems, cols, (g) => dataMapper(g, groupedItems.indexOf(g)), totalVal, orientation);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0">
          {selectedBarcodes.size > 0 && role === 'admin' && isMultiSelectEnabled ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-sm font-medium text-muted-foreground">{selectedBarcodes.size} products selected</div>
                    <div className="flex items-center text-sm font-semibold text-primary border-l pl-4">
                        <Wallet className="mr-2 h-4 w-4" />
                        <span>Selected Value: QAR {totalValueOfSelectedItems.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBulkReturnOpen(true)}>Return All Selected</Button>
                    <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>Delete All Selected</Button>
                </div>
             </div>
          ) : (
          <div className="flex flex-col gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search records..." value={searchTerm} onChange={handleSearchChange} className="pl-10 w-full" />
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierComboboxOpen}
                    className="w-full sm:w-auto sm:min-w-40 flex-1 justify-between text-left font-normal"
                  >
                    <div className="flex items-center truncate">
                      <Building className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      {selectedSupplier ? selectedSupplier : "All Suppliers"}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search supplier..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value={ALL_SUPPLIERS_VALUE}
                          onSelect={() => {
                            handleSupplierChange(ALL_SUPPLIERS_VALUE);
                            setSupplierComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !selectedSupplier ? "opacity-100" : "opacity-0"
                            )}
                          />
                          All Suppliers
                        </CommandItem>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            onSelect={() => {
                              handleSupplierChange(s.name);
                              setSupplierComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSupplier === s.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-40 flex-1">
                 <div className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Type" /></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="expiry">Expiry</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal sm:min-w-48 flex-1", !selectedDateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDateRange?.from ? (selectedDateRange.to ? <>{format(selectedDateRange.from, "LLL dd")} - {format(selectedDateRange.to, "LLL dd")}</> : format(selectedDateRange.from, "LLL dd")) : <span>Expiry Range</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={selectedDateRange} onSelect={handleDateRangeSelect} numberOfMonths={1} />
                </PopoverContent>
              </Popover>

              <div className="flex gap-2 flex-wrap">
                 {(searchTerm || selectedSupplier || activeDashboardFilter || selectedDateRange || typeFilter !== 'all') && (
                    <Button variant="ghost" onClick={clearFilters}><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
                  )}
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 sm:flex-none" disabled={groupedItems.length === 0}><FileText className="mr-2 h-4 w-4" /> Export <ChevronDown className="ml-1 h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportPDF('portrait')}>Portrait</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportPDF('landscape')}>Landscape</DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                   <Button onClick={() => window.print()} variant="outline" size="sm" disabled={groupedItems.length === 0}><Printer className="mr-2 h-4 w-4" /> Print</Button>
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {groupedItems.length > 0 ? (
        <>
            <Card className="shadow-md hidden md:block overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                <TableRow>
                    {role === 'admin' && isMultiSelectEnabled && (
                    <TableHead className="w-12 text-center noprint">
                        <Checkbox checked={selectedBarcodes.size > 0 && selectedBarcodes.size === groupedItems.length} onCheckedChange={(checked) => checked ? setSelectedBarcodes(new Set(groupedItems.map(g => g.mainItem.barcode))) : setSelectedBarcodes(new Set())} />
                    </TableHead>
                    )}
                    <TableHead>Product Name</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right font-semibold">Total Value</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="w-[160px] text-right noprint">Last Logged</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {groupedItems.map((group) => {
                    const { mainItem, totalQuantity, individualItems } = group;
                    const product = productsByBarcode.get(mainItem.barcode);
                    const cost = product?.costPrice;
                    const hasMultipleExpiry = new Set(individualItems.map(i => i.expiryDate)).size > 1;
                    const hasMultipleLocs = new Set(individualItems.map(i => i.location)).size > 1;

                    return (
                    <TableRow key={`row-${mainItem.barcode}`} data-state={selectedBarcodes.has(mainItem.barcode) ? "selected" : ""} className="group">
                        {role === 'admin' && isMultiSelectEnabled && (
                        <TableCell className="text-center noprint">
                            <Checkbox checked={selectedBarcodes.has(mainItem.barcode)} onCheckedChange={() => setSelectedBarcodes(prev => { const n = new Set(prev); if (n.has(mainItem.barcode)) n.delete(mainItem.barcode); else n.add(mainItem.barcode); return n; })} />
                        </TableCell>
                        )}
                        <TableCell className="font-medium p-0">
                            <div className="group/name relative h-12 flex items-center px-4 cursor-help overflow-hidden">
                                <span className="group-hover/name:hidden transition-all duration-300 truncate">
                                    {mainItem.productName}
                                </span>
                                <span className="hidden group-hover/name:flex items-center gap-2 font-mono text-xs text-primary animate-in fade-in slide-in-from-left-2 duration-300">
                                    <Barcode className="h-3 w-3" /> {mainItem.barcode}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{mainItem.supplierName || 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold">{totalQuantity}</TableCell>
                        <TableCell className="text-right">{cost ? `QAR ${cost.toFixed(2)}` : 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold">{cost ? `QAR ${(cost * totalQuantity).toFixed(2)}` : 'N/A'}</TableCell>
                        <TableCell>{hasMultipleLocs ? "Multiple" : mainItem.location}</TableCell>
                        <TableCell className={mainItem.expiryDate && isBefore(startOfDay(parseISO(mainItem.expiryDate)), startOfDay(new Date())) ? "text-destructive font-bold" : ""}>
                            {hasMultipleExpiry ? "Multiple" : (mainItem.expiryDate ? format(parseISO(mainItem.expiryDate), 'PP') : 'N/A')}
                        </TableCell>
                        <TableCell className="text-right noprint">
                           <div className="relative h-8 flex items-center justify-end">
                                <span className="text-xs text-muted-foreground group-hover:hidden transition-all duration-200 whitespace-nowrap">
                                    {mainItem.timestamp ? format(parseISO(mainItem.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}
                                </span>

                                <div className="hidden group-hover:flex justify-end items-center gap-1 transition-all duration-200">
                                    {individualItems.length === 1 ? (
                                        <>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(mainItem)} className="h-8 w-8 text-muted-foreground hover:text-primary"><Eye className="h-4 w-4" /></Button>
                                            {role !== 'viewer' && <Button variant="ghost" size="icon" onClick={() => handleOpenReturnDialog(mainItem)} disabled={mainItem.quantity <= 0} className="h-8 w-8 text-muted-foreground hover:text-primary"><Undo2 className="h-4 w-4" /></Button>}
                                            {role === 'admin' && <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(mainItem)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                                        </>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => handleOpenGroupDetails(group)} className="h-8 px-2 text-xs font-bold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                                            <Eye className="mr-1.5 h-3.5 w-3.5" /> {individualItems.length} Logs
                                        </Button>
                                    )}
                                </div>
                           </div>
                        </TableCell>
                    </TableRow>
                    );
                })}
                </TableBody>
            </Table>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:hidden">
                {groupedItems.map((group) => (
                    <InventoryItemCardMobile
                        key={`card-${group.mainItem.barcode}`}
                        item={group.mainItem}
                        product={productsByBarcode.get(group.mainItem.barcode)}
                        totalQuantity={group.totalQuantity}
                        individualItemCount={group.individualItems.length}
                        onDetails={group.individualItems.length === 1 ? () => handleOpenDetailsDialog(group.mainItem) : () => handleOpenGroupDetails(group)}
                        onViewImage={() => handleOpenDetailsDialog(group.mainItem, true)}
                        onReturn={role !== 'viewer' ? () => handleOpenReturnDialog(group.mainItem) : undefined}
                        onDelete={role === 'admin' ? () => handleOpenDeleteDialog(group.mainItem) : undefined}
                        isSelected={isMultiSelectEnabled && selectedBarcodes.has(group.mainItem.barcode)}
                        onSelect={isMultiSelectEnabled && role ==='admin' ? () => { const n = new Set(selectedBarcodes); if (n.has(group.mainItem.barcode)) n.delete(group.mainItem.barcode); else n.add(group.mainItem.barcode); setSelectedBarcodes(n); } : undefined}
                        context="inventory"
                    />
                ))}
            </div>
        </>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No inventory items found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Log new items to see them here.</p>
        </div>
      )}

       <InventoryItemGroupDetailsDialog
        key={selectedGroup ? `group-${selectedGroup.mainItem.barcode}` : 'group-none'}
        group={selectedGroup}
        isOpen={isGroupDetailsOpen}
        onOpenChange={setIsGroupDetailsOpen}
        onActionSuccess={handleActionSuccess}
        onOpenReturnDialog={handleOpenReturnDialog}
        onOpenEditDialog={handleOpenEditDialog}
        onOpenDeleteDialog={handleOpenDeleteDialog}
      />
      <InventoryItemDetailsDialog
        key={selectedItemForDetails ? `details-${selectedItemForDetails.id}` : 'details-none'}
        item={selectedItemForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        autoFetchImage={shouldAutoFetchImage}
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined}
      />
      <ReturnQuantityDialog
        key={selectedItemForReturn ? `return-${selectedItemForReturn.id}` : 'return-none'}
        item={selectedItemForReturn}
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onReturnSuccess={handleActionSuccess}
      />
      <EditInventoryItemDialog
        key={currentItemToEdit ? `edit-${currentItemToEdit.id}` : 'edit-none'}
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleActionSuccess}
        uniqueLocationsFromDb={uniqueDbLocations}
      />
      <DeleteConfirmationDialog
        key={selectedItemForDeletion ? `delete-${selectedItemForDeletion.id}` : 'delete-none'}
        item={selectedItemForDeletion}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleActionSuccess}
      />
      
      {barcodeToCreate && (
        <CreateProductFromInventoryDialog
          barcode={barcodeToCreate}
          allSuppliers={suppliers}
          isOpen={isCreateProductDialogOpen}
          onSuccess={(p) => { addProductToCache(p); onDataNeeded(); }}
          onOpenChange={setIsCreateProductDialogOpen}
        />
      )}
      
      <BulkReturnDialog isOpen={isBulkReturnOpen} onOpenChange={setIsBulkReturnOpen} itemIds={getItemsForBulkAction()} onSuccess={handleActionSuccess} itemCount={getItemsForBulkAction().length} />
      <BulkDeleteDialog isOpen={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen} itemIds={getItemsForBulkAction()} onSuccess={handleActionSuccess} itemCount={getItemsForBulkAction().length} />
    </div>
  );
}
