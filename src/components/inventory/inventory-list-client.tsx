
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { InventoryItem, Supplier, Product } from '@/lib/types';
import { Search, PackageOpen, FilterX, Info, Eye, Edit, Undo2, AlertTriangle, Tag, Printer, CalendarIcon, Trash2, ListChecks, PlusCircle, Building, User, Wallet } from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay, isSameDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const { role, user } = useAuth();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { 
      inventoryItems: cachedItems,
      products: cachedProducts,
      suppliers,
      uniqueLocations: uniqueDbLocations,
      updateInventoryItem, 
      removeInventoryItem, 
      addProduct: addProductToCache, 
      refreshData: onDataNeeded,
      addReturnedItem,
  } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilterType>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // States for individual item action dialogs
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  
  // States for grouped item dialog
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedInventoryItem | null>(null);
  
  // State for single item details dialog
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);


  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());

  // State for bulk action dialogs
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [barcodeToCreate, setBarcodeToCreate] = useState<string | null>(null);

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);

  const filteredItemsBySearchAndSupplierAndDate = useMemo(() => {
    let items = cachedItems;

     if (!activeDashboardFilter) {
      // Apply manual filters only if no dashboard filter is active
      if (searchTerm) {
          const lowerSearchTerm = searchTerm.toLowerCase();
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
    } else {
       // Dashboard filters are applied first
       switch(activeDashboardFilter.type) {
        case 'damaged': items = items.filter(item => item.itemType === 'Damage'); break;
        case 'expiringSoon': {
            const today = startOfDay(new Date());
            const sevenDaysFromNow = startOfDay(addDays(today, 7));
            items = items.filter(item => {
                if (item.itemType === 'Expiry' && item.expiryDate) {
                    try {
                        const expiry = startOfDay(parseISO(item.expiryDate));
                        return isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, today);
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
                    if (!isValid(from) || !isValid(to)) break;
                    items = items.filter(item => {
                        if (item.itemType === 'Expiry' && item.expiryDate) {
                            try {
                                const expiry = startOfDay(parseISO(item.expiryDate));
                                return isValid(expiry) && !isBefore(expiry, from) && !isAfter(expiry, to);
                            } catch { return false; }
                        }
                        return false;
                    });
                } catch { /* ignore parse errors */ }
            }
            break;
        }
       }
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
  }, [cachedItems, activeDashboardFilter, searchTerm, selectedSupplier, selectedDateRange, typeFilter]);
  
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { individualItems: InventoryItem[]; totalQuantity: number }>();

    for (const item of filteredItemsBySearchAndSupplierAndDate) {
        if (item.quantity <= 0) continue; // Exclude items with zero or negative quantity from grouping
        
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
        
        const mainItem = groupData.individualItems[0];
        
        result.push({
            mainItem,
            individualItems: groupData.individualItems,
            totalQuantity: groupData.totalQuantity,
        });
    }

    result.sort((a, b) => a.mainItem.productName.localeCompare(b.mainItem.productName));

    return result;
  }, [filteredItemsBySearchAndSupplierAndDate]);

  const totalValueOfSelectedItems = useMemo(() => {
    if (selectedBarcodes.size === 0) return 0;

    let totalValue = 0;
    groupedItems.forEach(group => {
      if (selectedBarcodes.has(group.mainItem.barcode)) {
        const product = productsByBarcode.get(group.mainItem.barcode);
        const costPrice = product?.costPrice ?? 0;
        totalValue += costPrice * group.totalQuantity;
      }
    });
    return totalValue;
  }, [selectedBarcodes, groupedItems, productsByBarcode]);
  
  const getItemsForBulkAction = (): string[] => {
    if (selectedBarcodes.size === 0) return [];
    
    const itemIds: string[] = [];
    groupedItems.forEach(group => {
        if(selectedBarcodes.has(group.mainItem.barcode)) {
            group.individualItems.forEach(item => itemIds.push(item.id));
        }
    });
    return itemIds;
  };


  useEffect(() => {
    const filterTypeFromQuery = searchParams.get('filterType');
    const suppliersFromQuery = searchParams.get('suppliers');
    const fromDateQuery = searchParams.get('from');
    const toDateQuery = searchParams.get('to');

    let newPotentialFilter: DashboardFilterType = null;
    let clearUrlParams = false;

    if (filterTypeFromQuery === 'specificSupplier' && suppliersFromQuery) {
      newPotentialFilter = { type: 'specificSupplier', suppliers: [decodeURIComponent(suppliersFromQuery)] };
      clearUrlParams = true;
    } else if (filterTypeFromQuery === 'customExpiry' && fromDateQuery && toDateQuery) {
      newPotentialFilter = { type: 'customExpiry', customExpiryFrom: fromDateQuery, customExpiryTo: toDateQuery };
    } else if (filterTypeFromQuery === 'damaged') {
      newPotentialFilter = { type: 'damaged' };
      clearUrlParams = true;
    } else if (filterTypeFromQuery === 'expiringSoon') {
      newPotentialFilter = { type: 'expiringSoon' };
      clearUrlParams = true;
    } else if (filterTypeFromQuery === 'otherSuppliers' && suppliersFromQuery) {
      const supplierNames = decodeURIComponent(suppliersFromQuery).split(',');
      newPotentialFilter = { type: 'otherSuppliers', suppliers: supplierNames };
      clearUrlParams = true;
    }

    if (JSON.stringify(newPotentialFilter) !== JSON.stringify(activeDashboardFilter)) {
      setActiveDashboardFilter(newPotentialFilter);
      if (newPotentialFilter) {
        setSearchTerm('');
        setSelectedSupplier('');
        setSelectedDateRange(undefined);
        if (newPotentialFilter.type === 'specificSupplier' && newPotentialFilter.suppliers?.length) {
            setSelectedSupplier(newPotentialFilter.suppliers[0]);
        }
      }
    } 
    
    if (clearUrlParams) {
        router.replace('/inventory', { shallow: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  useEffect(() => {
    if (!isMultiSelectEnabled) {
      setSelectedBarcodes(new Set());
    }
  }, [isMultiSelectEnabled]);


  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSupplier('');
    setSelectedDateRange(undefined);
    setIsDatePopoverOpen(false);
    setTypeFilter('all');
    if (activeDashboardFilter) {
        setActiveDashboardFilter(null);
        router.replace('/inventory', { shallow: true });
    }
  }

  const handleSupplierChange = (value: string) => {
    if (value === ALL_SUPPLIERS_VALUE) {
      setSelectedSupplier('');
    } else {
      setSelectedSupplier(value);
    }
    if (activeDashboardFilter) {
        setActiveDashboardFilter(null);
        router.replace('/inventory', { shallow: true });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if(activeDashboardFilter) setActiveDashboardFilter(null);
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setSelectedDateRange(range);
    if (range?.from && range?.to) {
      setIsDatePopoverOpen(false);
    }
    if (activeDashboardFilter) {
        setActiveDashboardFilter(null);
        router.replace('/inventory', { shallow: true });
    }
  }

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    if (activeDashboardFilter) {
      setActiveDashboardFilter(null);
      router.replace('/inventory', { shallow: true });
    }
  };


  const getDashboardFilterMessage = () => {
    if (!activeDashboardFilter) return null;
    if (activeDashboardFilter.type === 'damaged') return "Showing only Damaged items from dashboard.";
    if (activeDashboardFilter.type === 'expiringSoon') return "Showing only Items Expiring Soon (next 7 days) from dashboard.";
    if (activeDashboardFilter.type === 'otherSuppliers' || activeDashboardFilter.type === 'specificSupplier') {
      const count = activeDashboardFilter.suppliers?.length || 0;
      return `Showing items from ${count} supplier${count !== 1 ? 's' : ''} (from dashboard).`;
    }
    if (activeDashboardFilter.type === 'customExpiry' && activeDashboardFilter.customExpiryFrom && activeDashboardFilter.customExpiryTo) {
      try {
        const from = format(parseISO(activeDashboardFilter.customExpiryFrom), 'PP');
        const to = format(parseISO(activeDashboardFilter.customExpiryTo), 'PP');
        return `Showing items expiring between ${from} and ${to} (from dashboard).`;
      } catch {
        return "Showing items expiring within a custom date range from dashboard.";
      }
    }
    return null;
  };

  const handleOpenGroupDetails = (group: GroupedInventoryItem) => {
    setSelectedGroup(group);
    setIsGroupDetailsOpen(true);
  };
  
  const handleOpenDetailsDialog = (item: InventoryItem) => {
    setSelectedItemForDetails(item);
    setIsDetailsDialogOpen(true);
  };

  const handleOpenReturnDialog = (item: InventoryItem) => {
    if (role === 'viewer') return;
    setSelectedItemForReturn(item);
    setIsReturnDialogOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    if (role === 'viewer') return;
    setCurrentItemToEdit(item);
    setIsEditDialogOpen(true);
  };
  
  const handleOpenCreateProductDialog = (barcode: string) => {
    if (role !== 'admin') return;
    setBarcodeToCreate(barcode);
    setIsCreateProductDialogOpen(true);
  };

  const handleOpenDeleteDialog = (item: InventoryItem) => {
    if (role !== 'admin') {
      toast({ title: 'Permission Denied', description: 'Only admins can delete log entries.', variant: 'destructive'});
      return;
    }
    setSelectedItemForDeletion(item);
    setIsDeleteDialogOpen(true);
  };

  const handleActionSuccess = useCallback(() => {
    // This is a generic success handler. We'll refresh all data
    // to ensure consistency after any modification.
    onDataNeeded();
    // Close all individual action dialogs
    setIsReturnDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setIsDetailsDialogOpen(false);

    // If the group details dialog is open, we need to update its content
    // by finding the new state of the group and setting it.
    if (isGroupDetailsOpen && selectedGroup) {
        const updatedGroup = groupedItems.find(g => g.mainItem.barcode === selectedGroup.mainItem.barcode);
        if (updatedGroup) {
            setSelectedGroup(updatedGroup);
        } else {
            // The group might no longer exist (e.g., all items deleted)
            setIsGroupDetailsOpen(false);
            setSelectedGroup(null);
        }
    }
    setSelectedBarcodes(new Set());
  }, [onDataNeeded, isGroupDetailsOpen, selectedGroup, groupedItems]);

  const handleBulkSuccess = useCallback(() => {
    onDataNeeded();
    setSelectedBarcodes(new Set());
    setIsBulkReturnOpen(false);
    setIsBulkDeleteOpen(false);
  }, [onDataNeeded]);
  
  const handleProductCreateSuccess = useCallback((newProduct: Product) => {
    addProductToCache(newProduct);
    onDataNeeded();
  }, [addProductToCache, onDataNeeded]);

  const handlePrint = () => {
    window.print();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allBarcodes = new Set(groupedItems.map(g => g.mainItem.barcode));
      setSelectedBarcodes(allBarcodes);
    } else {
      setSelectedBarcodes(new Set());
    }
  };

  const handleSelectRow = (barcode: string) => {
    setSelectedBarcodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barcode)) {
        newSet.delete(barcode);
      } else {
        newSet.add(barcode);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 printable-area">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0">
          {selectedBarcodes.size > 0 && role === 'admin' && isMultiSelectEnabled ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-sm font-medium text-muted-foreground">
                        {selectedBarcodes.size} product group(s) selected
                    </div>
                    <div className="flex items-center text-sm font-semibold text-primary border-l pl-4">
                        <Wallet className="mr-2 h-4 w-4" />
                        <span>
                            Selected Value: QAR {totalValueOfSelectedItems.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBulkReturnOpen(true)}><Undo2 className="mr-2 h-4 w-4" /> Return All</Button>
                    <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete All</Button>
                </div>
             </div>
          ) : (
          <div className="flex flex-col gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search product, barcode, staff..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
               <Select value={selectedSupplier || ALL_SUPPLIERS_VALUE} onValueChange={handleSupplierChange}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-40 flex-1">
                  <div className="flex items-center">
                    <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Supplier" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SUPPLIERS_VALUE}>All Suppliers</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-40 flex-1">
                 <div className="flex items-center">
                    <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Item Types</SelectItem>
                  <SelectItem value="expiry">Expiry Items</SelectItem>
                  <SelectItem value="damage">Damaged Items</SelectItem>
                  <SelectItem value="expired">Already Expired</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-auto justify-start text-left font-normal sm:min-w-48 flex-1",
                      !selectedDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDateRange?.from ? (
                      selectedDateRange.to ? (
                        <>
                          {format(selectedDateRange.from, "LLL dd, y")} - {format(selectedDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(selectedDateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Filter by Expiry Date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={selectedDateRange?.from}
                    selected={selectedDateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex gap-2">
                 {(searchTerm || selectedSupplier || activeDashboardFilter || selectedDateRange || typeFilter !== 'all') && (
                    <Button variant="ghost" onClick={clearFilters} className="w-full">
                        <FilterX className="mr-2 h-4 w-4" /> Clear
                    </Button>
                  )}
                   <div className="print-button-container w-full">
                    <Button onClick={handlePrint} variant="outline" className="w-full">
                    <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                </div>
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {activeDashboardFilter && (
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <Info className="h-4 w-4 !text-primary" />
          <AlertTitle>Dashboard Filter Active</AlertTitle>
          <AlertDescription>
            {getDashboardFilterMessage()} Local filters will apply to this subset. Use "Clear Filters" to reset all.
          </AlertDescription>
        </Alert>
      )}

      {isMultiSelectEnabled && (
        <Alert variant="default" className="bg-blue-500/10 border-blue-500/30 filters-card-noprint">
            <ListChecks className="h-4 w-4 !text-blue-500" />
            <AlertTitle className="text-blue-600">Multi-Select Mode Active</AlertTitle>
            <AlertDescription>
                Checkboxes are now visible for bulk actions. You can disable this in settings or via the command menu (Ctrl/Cmd + K).
            </AlertDescription>
        </Alert>
      )}

      {groupedItems.length > 0 ? (
        <>
            {/* Desktop Table View */}
            <Card className="shadow-md hidden md:block">
            <Table>
                <TableHeader>
                <TableRow>
                    {role === 'admin' && isMultiSelectEnabled && (
                    <TableHead className="w-12 text-center noprint">
                        <Checkbox
                        checked={selectedBarcodes.size > 0 && selectedBarcodes.size === groupedItems.length}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        aria-label="Select all rows"
                        />
                    </TableHead>
                    )}
                    <TableHead className="w-16 text-center print-show-table-cell">No.</TableHead>
                    <TableHead className="w-auto sm:w-36 text-center noprint">Actions</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="hidden lg:table-cell">Barcode</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Expiry</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {groupedItems.map((group, index) => {
                    const { mainItem, totalQuantity, individualItems } = group;
                    const isProductFound = mainItem.productName !== 'Not Found';
                    const product = productsByBarcode.get(mainItem.barcode);
                    const costPrice = product?.costPrice;
                    const totalValue = costPrice !== undefined ? costPrice * totalQuantity : undefined;
                    const isSingleItem = individualItems.length === 1;

                    const hasMultipleExpiry = new Set(individualItems.map(i => i.expiryDate)).size > 1;

                    return (
                    <TableRow key={mainItem.barcode} data-state={selectedBarcodes.has(mainItem.barcode) ? "selected" : ""}>
                        {role === 'admin' && isMultiSelectEnabled && (
                        <TableCell className="text-center noprint">
                            <Checkbox
                            checked={selectedBarcodes.has(mainItem.barcode)}
                            onCheckedChange={() => handleSelectRow(mainItem.barcode)}
                            aria-label={`Select row for ${mainItem.productName}`}
                            />
                        </TableCell>
                        )}
                        <TableCell className="text-center print-show-table-cell">{index + 1}</TableCell>
                        <TableCell className="text-center noprint">
                           {isSingleItem ? (
                                <div className="flex justify-center items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(mainItem)} className="h-8 w-8" aria-label="View Details">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {role !== 'viewer' && (
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenReturnDialog(mainItem)} disabled={mainItem.quantity <= 0} className="h-8 w-8" aria-label="Return">
                                            <Undo2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {role === 'admin' && (
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(mainItem)} className="h-8 w-8 text-destructive/70 hover:text-destructive" aria-label="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => handleOpenGroupDetails(group)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View {individualItems.length} Logs
                                </Button>
                            )}
                        </TableCell>
                        <TableCell className={cn("font-medium", !isProductFound && "text-muted-foreground italic")}>{mainItem.productName}</TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">{mainItem.barcode}</TableCell>
                        <TableCell className="text-muted-foreground">{mainItem.supplierName || 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold">{totalQuantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{costPrice !== undefined ? `QAR ${costPrice.toFixed(2)}` : 'N/A'}</TableCell>
                        <TableCell className="text-right font-semibold">{totalValue !== undefined ? `QAR ${totalValue.toFixed(2)}` : 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {hasMultipleExpiry ? "Multiple" : (mainItem.expiryDate ? format(parseISO(mainItem.expiryDate), 'PP') : 'N/A')}
                        </TableCell>
                    </TableRow>
                    );
                })}
                </TableBody>
            </Table>
            </Card>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {groupedItems.map((group) => {
                    const product = productsByBarcode.get(group.mainItem.barcode);
                    const isSingleItem = group.individualItems.length === 1;
                    return (
                        <InventoryItemCardMobile
                            key={group.mainItem.barcode}
                            item={group.mainItem}
                            product={product}
                            totalQuantity={group.totalQuantity}
                            individualItemCount={group.individualItems.length}
                            onDetails={isSingleItem ? () => handleOpenDetailsDialog(group.mainItem) : () => handleOpenGroupDetails(group)}
                            onEdit={undefined}
                            onReturn={role !== 'viewer' ? () => handleOpenReturnDialog(group.mainItem) : undefined}
                            onDelete={role === 'admin' ? () => handleOpenDeleteDialog(group.mainItem) : undefined}
                            isSelected={isMultiSelectEnabled && selectedBarcodes.has(group.mainItem.barcode)}
                            onSelect={isMultiSelectEnabled && role ==='admin' ? () => handleSelectRow(group.mainItem.barcode) : undefined}
                            context="inventory"
                        />
                    )
                })}
            </div>
        </>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No inventory items found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeDashboardFilter || searchTerm || selectedSupplier || selectedDateRange ? "Try adjusting your search or filters." : "Log new items to see them here."}
          </p>
          {(searchTerm || selectedSupplier || activeDashboardFilter || selectedDateRange || typeFilter !== 'all') && (
             <Button variant="outline" onClick={clearFilters} className="mt-6">
                <FilterX className="mr-2 h-4 w-4" /> Clear All Filters and Search
            </Button>
          )}
        </div>
      )}

      {/* Individual Item Action Dialogs (triggered from the group dialog) */}
       <InventoryItemGroupDetailsDialog
        group={selectedGroup}
        isOpen={isGroupDetailsOpen}
        onOpenChange={setIsGroupDetailsOpen}
        onActionSuccess={handleActionSuccess}
        onOpenReturnDialog={handleOpenReturnDialog}
        onOpenEditDialog={handleOpenEditDialog}
        onOpenDeleteDialog={handleOpenDeleteDialog}
      />
      <InventoryItemDetailsDialog
        item={selectedItemForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined}
      />
      <ReturnQuantityDialog
        item={selectedItemForReturn}
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onReturnSuccess={handleActionSuccess}
      />
      <EditInventoryItemDialog
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleActionSuccess}
        uniqueLocationsFromDb={uniqueDbLocations}
      />
      <DeleteConfirmationDialog
        item={selectedItemForDeletion}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={() => handleActionSuccess()}
      />
      
       {/* Create Product Dialog */}
      {barcodeToCreate && (
        <CreateProductFromInventoryDialog
          barcode={barcodeToCreate}
          allSuppliers={suppliers}
          isOpen={isCreateProductDialogOpen}
          onSuccess={handleProductCreateSuccess}
          onOpenChange={setIsCreateProductDialogOpen}
        />
      )}
      
      {/* Bulk Action Dialogs */}
      <BulkReturnDialog 
        isOpen={isBulkReturnOpen}
        onOpenChange={setIsBulkReturnOpen}
        itemIds={getItemsForBulkAction()}
        onSuccess={handleBulkSuccess}
        itemCount={getItemsForBulkAction().length}
      />
      <BulkDeleteDialog
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        itemIds={getItemsForBulkAction()}
        onSuccess={handleBulkSuccess}
        itemCount={getItemsForBulkAction().length}
      />
    </div>
  );
}
