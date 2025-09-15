'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { InventoryItem, Supplier } from '@/lib/types';
import { Search, PackageOpen, FilterX, Info, Eye, Edit, Undo2, AlertTriangle, Tag, Printer, CalendarIcon, Trash2, ListChecks, Keyboard } from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay, isSameDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { useSettings } from '@/context/settings-context';


interface InventoryListClientProps {
  initialInventoryItems: InventoryItem[];
  suppliers: Supplier[];
  uniqueDbLocations: string[];
}

const ALL_SUPPLIERS_VALUE = "___ALL_SUPPLIERS___";

type DashboardFilterType = {
  type: 'damaged' | 'expiringSoon' | 'otherSuppliers' | 'customExpiry';
  suppliers?: string[];
  customExpiryFrom?: string;
  customExpiryTo?: string;
} | null;

export function InventoryListClient({ initialInventoryItems, suppliers, uniqueDbLocations }: InventoryListClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useAuth();
  const { isMultiSelectEnabled } = useSettings();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilterType>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // State for bulk action dialogs
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);



  useEffect(() => {
    setIsLoading(true);
    if (initialInventoryItems) {
      setInventoryItems([...initialInventoryItems]);
    } else {
      setInventoryItems([]);
    }
    setIsLoading(false);
  }, [initialInventoryItems]);

  useEffect(() => {
    const filterTypeFromQuery = searchParams.get('filterType');
    const suppliersFromQuery = searchParams.get('suppliers');
    const fromDateQuery = searchParams.get('from');
    const toDateQuery = searchParams.get('to');

    let newPotentialFilter: DashboardFilterType = null;
    let clearUrlParams = false;

    if (filterTypeFromQuery === 'specificSupplier' && suppliersFromQuery) {
      const specificSupplierName = decodeURIComponent(suppliersFromQuery);
      if (suppliers.some(s => s.name === specificSupplierName)) {
        setSelectedSupplier(specificSupplierName);
        setSearchTerm(''); // Clear other local filters
        setSelectedDateRange(undefined);
        toast({ title: "Filter Applied", description: `Showing items for supplier: ${specificSupplierName} (from dashboard).` });
      } else {
        toast({ title: "Filter Error", description: `Supplier "${specificSupplierName}" from dashboard link not found. Displaying all items.`, variant: "destructive" });
      }
      clearUrlParams = true; 
      newPotentialFilter = null; 
    } else if (filterTypeFromQuery === 'customExpiry' && fromDateQuery && toDateQuery) {
      newPotentialFilter = { type: 'customExpiry', customExpiryFrom: fromDateQuery, customExpiryTo: toDateQuery };
    } else if (filterTypeFromQuery === 'damaged') {
      newPotentialFilter = { type: 'damaged' };
    } else if (filterTypeFromQuery === 'expiringSoon') {
      newPotentialFilter = { type: 'expiringSoon' };
    } else if (filterTypeFromQuery === 'otherSuppliers' && suppliersFromQuery) {
      const supplierNames = decodeURIComponent(suppliersFromQuery).split(',');
      newPotentialFilter = { type: 'otherSuppliers', suppliers: supplierNames };
    }

    if (JSON.stringify(newPotentialFilter) !== JSON.stringify(activeDashboardFilter)) {
      setActiveDashboardFilter(newPotentialFilter);
      if (newPotentialFilter && newPotentialFilter.type !== 'specificSupplier') { // specificSupplier uses local state
        setSearchTerm('');
        setSelectedSupplier('');
        setSelectedDateRange(undefined);
      }
    } 
    
    if (clearUrlParams) {
        router.replace('/inventory', { shallow: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, suppliers, toast, router]);

  useEffect(() => {
    if (!isMultiSelectEnabled) {
      setIsMultiSelectMode(false);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMultiSelectEnabled && (event.metaKey || event.ctrlKey) && event.key === 'm') {
        event.preventDefault();
        setIsMultiSelectMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectEnabled]);

  // Effect to show toast *after* state has changed
  useEffect(() => {
    if (!isMultiSelectEnabled) return;
    const isMounted = inventoryItems.length > 0 || searchTerm || selectedSupplier;

    if (isMounted) {
      if (isMultiSelectMode) {
        toast({
          title: `Multi-select mode activated.`,
          description: 'You can now select multiple items.',
        });
      } else {
        // Clear selections when exiting mode
        if (selectedItemIds.size > 0) {
            setSelectedItemIds(new Set());
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiSelectMode]);


  const itemsAfterDashboardFilters = useMemo(() => {
    if (!activeDashboardFilter) return inventoryItems;

    if (activeDashboardFilter.type === 'damaged') {
      return inventoryItems.filter(item => item.itemType === 'Damage');
    }
    if (activeDashboardFilter.type === 'expiringSoon') {
      const today = startOfDay(new Date());
      const sevenDaysFromNow = startOfDay(addDays(today, 7));
      return inventoryItems.filter(item => {
        if (item.itemType === 'Expiry' && item.expiryDate) {
          try {
            const expiry = startOfDay(parseISO(item.expiryDate));
            return isValid(expiry) && isBefore(expiry, sevenDaysFromNow) && !isBefore(expiry, today);
          } catch { return false; }
        }
        return false;
      });
    }
    if (activeDashboardFilter.type === 'otherSuppliers' && activeDashboardFilter.suppliers) {
      const lowerCaseOtherSuppliers = activeDashboardFilter.suppliers.map(s => s.toLowerCase());
      return inventoryItems.filter(item =>
        item.supplierName && lowerCaseOtherSuppliers.includes(item.supplierName.toLowerCase())
      );
    }
    if (activeDashboardFilter.type === 'customExpiry' && activeDashboardFilter.customExpiryFrom && activeDashboardFilter.customExpiryTo) {
      try {
        const from = startOfDay(parseISO(activeDashboardFilter.customExpiryFrom));
        const to = startOfDay(parseISO(activeDashboardFilter.customExpiryTo));
        if (!isValid(from) || !isValid(to)) return inventoryItems;

        return inventoryItems.filter(item => {
          if (item.itemType === 'Expiry' && item.expiryDate) {
            try {
              const expiry = startOfDay(parseISO(item.expiryDate));
              return isValid(expiry) && !isBefore(expiry, from) && !isAfter(expiry, to);
            } catch { return false; }
          }
          return false;
        });
      } catch { return inventoryItems; }
    }
    return inventoryItems;
  }, [inventoryItems, activeDashboardFilter]);


  const filteredItemsBySearchAndSupplierAndDate = useMemo(() => {
    let items = itemsAfterDashboardFilters;

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

    if (typeFilter !== 'all') {
      const today = startOfDay(new Date());
      items = items.filter(item => {
        if (typeFilter === 'damage') {
          return item.itemType === 'Damage';
        }
        if (typeFilter === 'expiry') {
          return item.itemType === 'Expiry';
        }
        if (typeFilter === 'expired') {
          if (item.itemType !== 'Expiry' || !item.expiryDate) return false;
          try {
            const expiry = startOfDay(parseISO(item.expiryDate));
            return isValid(expiry) && isBefore(expiry, today);
          } catch {
            return false;
          }
        }
        return true;
      });
    }

    return items;
  }, [itemsAfterDashboardFilters, searchTerm, selectedSupplier, selectedDateRange, typeFilter]);

  const itemsToRender = useMemo(() => {
    return filteredItemsBySearchAndSupplierAndDate;
  }, [filteredItemsBySearchAndSupplierAndDate]);


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
    if (activeDashboardFilter && (activeDashboardFilter.type === 'otherSuppliers' || activeDashboardFilter.type === 'specificSupplier')) {
        setActiveDashboardFilter(null);
        router.replace('/inventory', { shallow: true });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setSelectedDateRange(range);
    if (range?.from && range?.to) {
      setIsDatePopoverOpen(false);
    }
    if (activeDashboardFilter && (activeDashboardFilter.type === 'expiringSoon' || activeDashboardFilter.type === 'customExpiry')) {
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
    if (activeDashboardFilter.type === 'otherSuppliers') {
      const count = activeDashboardFilter.suppliers?.length || 0;
      return `Showing items from ${count} 'Other Supplier${count !== 1 ? 's' : ''}' identified on the dashboard.`;
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

  const handleOpenReturnDialog = (item: InventoryItem) => {
    if (role === 'viewer') return;
    setSelectedItemForReturn(item);
    setIsReturnDialogOpen(true);
  };

  const handleOpenDetailsDialog = (item: InventoryItem) => {
    setSelectedItemForDetails(item);
    setIsDetailsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    if (role === 'viewer') return;
    setCurrentItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (item: InventoryItem) => {
    if (role !== 'admin') {
      toast({ title: 'Permission Denied', description: 'Only admins can delete log entries.', variant: 'destructive'});
      return;
    }
    setSelectedItemForDeletion(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDialogSuccess = useCallback(() => {
    setSelectedItemIds(new Set());
    // Data is revalidated by server actions, so we just clear selections
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allItemIds = new Set(itemsToRender.map(item => item.id));
      setSelectedItemIds(allItemIds);
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleSelectRow = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 printable-area">
       <Card className="filters-card-noprint shadow-md sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          {isMultiSelectMode && selectedItemIds.size > 0 && role === 'admin' ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="text-sm font-medium text-muted-foreground">
                  {selectedItemIds.size} item(s) selected
               </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBulkReturnOpen(true)}><Undo2 className="mr-2 h-4 w-4" /> Return Selected</Button>
                    <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete Selected</Button>
                </div>
             </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search product, barcode, staff..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Select value={selectedSupplier || ALL_SUPPLIERS_VALUE} onValueChange={handleSupplierChange}>
                  <SelectTrigger className="flex-1 min-w-40">
                    <SelectValue placeholder="Filter by Supplier" />
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
                  <SelectTrigger className="flex-1 min-w-40">
                    <SelectValue placeholder="Filter by Type" />
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
                        "flex-1 justify-start text-left font-normal min-w-48",
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
                      <Button variant="ghost" onClick={clearFilters} className="flex-1 sm:flex-initial">
                          <FilterX className="mr-2 h-4 w-4" /> Clear
                      </Button>
                    )}
                    <div className="print-button-container">
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

      {isMultiSelectMode && (
        <Alert variant="default" className="bg-blue-500/10 border-blue-500/30 filters-card-noprint">
            <ListChecks className="h-4 w-4 !text-blue-500" />
            <AlertTitle className="text-blue-600">Multi-Select Mode Active</AlertTitle>
            <AlertDescription>
                You can now select multiple items. Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Ctrl/Cmd + M</kbd> to exit this mode.
            </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-10"><Search className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
      ) : itemsToRender.length > 0 ? (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                {role === 'admin' && isMultiSelectMode && (
                  <TableHead className="w-12 text-center noprint">
                    <Checkbox
                      checked={selectedItemIds.size === itemsToRender.length && itemsToRender.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}
                <TableHead className="w-16 text-center print-show-table-cell">No.</TableHead>
                <TableHead className="w-auto sm:w-36 text-center noprint">Actions</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="hidden md:table-cell">Barcode</TableHead>
                <TableHead className="hidden lg:table-cell">Supplier</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="hidden sm:table-cell">Location</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsToRender.map((item, index) => {
                const parsedExpiryDate = item.expiryDate ? parseISO(item.expiryDate) : null;
                const isValidExpiry = !!parsedExpiryDate && isValid(parsedExpiryDate);
                const isExpired = isValidExpiry && startOfDay(parsedExpiryDate!) < startOfDay(new Date()) && !isSameDay(startOfDay(parsedExpiryDate!), startOfDay(new Date()));
                let formattedExpiryDate = 'N/A';
                if (item.expiryDate) {
                  if (isValidExpiry) {
                    formattedExpiryDate = format(parsedExpiryDate!, 'PP');
                    if (isExpired) formattedExpiryDate += " (Expired)";
                  } else {
                    formattedExpiryDate = "Invalid Date";
                  }
                }
                return (
                  <TableRow key={item.id} data-state={selectedItemIds.has(item.id) ? "selected" : ""}>
                     {role === 'admin' && isMultiSelectMode && (
                      <TableCell className="text-center noprint">
                        <Checkbox
                          checked={selectedItemIds.has(item.id)}
                          onCheckedChange={() => handleSelectRow(item.id)}
                          aria-label={`Select row for ${item.productName}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-center print-show-table-cell">{index + 1}</TableCell>
                    <TableCell className="text-center noprint">
                      <div className="flex justify-center items-center gap-1 sm:gap-1.5">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(item)} className="h-8 w-8" aria-label="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)} className="h-8 w-8" aria-label="Edit Item">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenReturnDialog(item)}
                              disabled={item.quantity === 0}
                              className="h-8 w-8"
                              aria-label="Return Item"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                             <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteDialog(item)}
                              className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              aria-label="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{item.barcode}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{item.supplierName || 'N/A'}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className={cn(isExpired && isValidExpiry ? 'text-destructive' : 'text-muted-foreground', "whitespace-nowrap")}>
                      {formattedExpiryDate}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{item.location}</TableCell>
                    <TableCell className={cn(item.itemType === 'Damage' ? 'text-orange-500 font-medium' : 'text-muted-foreground')}>
                      {item.itemType === 'Damage' ? <AlertTriangle className="inline-block h-4 w-4 mr-1 text-orange-500" /> : <Tag className="inline-block h-4 w-4 mr-1 text-muted-foreground" />}
                      {item.itemType}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
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

      {/* Single Item Dialogs */}
      <ReturnQuantityDialog
        item={selectedItemForReturn}
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onReturnSuccess={handleDialogSuccess}
      />
      <InventoryItemDetailsDialog
        item={selectedItemForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined}
        displayContext="default"
      />
      <EditInventoryItemDialog
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleDialogSuccess}
        uniqueLocationsFromDb={uniqueDbLocations}
      />
      <DeleteConfirmationDialog
        item={selectedItemForDeletion}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleDialogSuccess}
      />
      
      {/* Bulk Action Dialogs */}
      <BulkReturnDialog 
        isOpen={isBulkReturnOpen}
        onOpenChange={setIsBulkReturnOpen}
        itemIds={Array.from(selectedItemIds)}
        onSuccess={handleDialogSuccess}
        itemCount={selectedItemIds.size}
      />
      <BulkDeleteDialog
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        itemIds={Array.from(selectedItemIds)}
        onSuccess={handleDialogSuccess}
        itemCount={selectedItemIds.size}
      />
    </div>
  );
}
