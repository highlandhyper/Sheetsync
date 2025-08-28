
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { InventoryItem, Supplier } from '@/lib/types';
import { Search, PackageOpen, FilterX, Info, Eye, Edit, Undo2, AlertTriangle, Tag, Printer, CalendarIcon } from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay, isSameDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';

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

    // console.log('[InventoryListClient Effect] URL Params:', { filterTypeFromQuery, suppliersFromQuery, fromDateQuery, toDateQuery });

    let newPotentialFilter: DashboardFilterType = null;
    let clearUrlParams = false;

    if (filterTypeFromQuery === 'specificSupplier' && suppliersFromQuery) {
      const specificSupplierName = decodeURIComponent(suppliersFromQuery);
      if (suppliers.some(s => s.name === specificSupplierName)) {
        setSelectedSupplier(specificSupplierName);
        setSearchTerm(''); // Clear other local filters
        setSelectedDateRange(undefined);
        // No need to set activeDashboardFilter, local filter will apply
        toast({ title: "Filter Applied", description: `Showing items for supplier: ${specificSupplierName} (from dashboard).` });
      } else {
        toast({ title: "Filter Error", description: `Supplier "${specificSupplierName}" from dashboard link not found. Displaying all items.`, variant: "destructive" });
      }
      clearUrlParams = true; // Clear URL params as we've handled this via local state
      newPotentialFilter = null; // Prevent activeDashboardFilter from being set for this type
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

    // console.log('[InventoryListClient Effect] Derived newPotentialFilter:', newPotentialFilter);
    // console.log('[InventoryListClient Effect] Current activeDashboardFilter before set:', activeDashboardFilter);

    if (JSON.stringify(newPotentialFilter) !== JSON.stringify(activeDashboardFilter)) {
      // console.log('[InventoryListClient Effect] Filter change detected. Setting new filter and potentially clearing local search/filters.');
      setActiveDashboardFilter(newPotentialFilter);
      if (newPotentialFilter && newPotentialFilter.type !== 'specificSupplier') { // specificSupplier uses local state
        setSearchTerm('');
        setSelectedSupplier('');
        setSelectedDateRange(undefined);
      }
    } else {
      // console.log('[InventoryListClient Effect] No change in dashboard filter from URL detected.');
    }
    
    if (clearUrlParams) {
        router.replace('/inventory', { shallow: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, suppliers, toast, router]);


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
     // If user manually changes supplier, clear any active dashboard URL filter for suppliers
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
      setIsDatePopoverOpen(false); // Close popover when a range is selected
    }
    // If user manually changes date range, clear any active dashboard URL filter for expiry
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

  const handleDialogSuccess = useCallback(() => {
    // Data revalidation should handle list updates via server actions
  }, []);

  const handlePrint = () => {
    window.print();
  };


  return (
    <div className="space-y-6 printable-area">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search product, barcode, staff, supplier..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <Select value={selectedSupplier || ALL_SUPPLIERS_VALUE} onValueChange={handleSupplierChange}>
                <SelectTrigger className="w-full sm:w-auto md:min-w-[200px]">
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
                <SelectTrigger className="w-full sm:w-auto md:min-w-[180px]">
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
                      "w-full sm:w-auto md:min-w-[200px] justify-start text-left font-normal",
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

              {(searchTerm || selectedSupplier || activeDashboardFilter || selectedDateRange || typeFilter !== 'all') && (
                <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Clear Filters
                </Button>
              )}
            </div>
            <div className="print-button-container">
                <Button onClick={handlePrint} variant="outline" className="w-full md:w-auto shrink-0 ">
                <Printer className="mr-2 h-4 w-4" /> Print List
                </Button>
            </div>
          </div>
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

      {isLoading ? (
        <div className="text-center py-10"><Search className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
      ) : itemsToRender.length > 0 ? (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={item.id}>
                    <TableCell className="text-center print-show-table-cell">{index + 1}</TableCell>
                    <TableCell className="text-center noprint">
                      <div className="flex justify-center items-center gap-1 sm:gap-1.5">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(item)} className="h-7 w-7 sm:h-8 sm:w-8" aria-label="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && (
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)} className="h-7 w-7 sm:h-8 sm:w-8" aria-label="Edit Item">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenReturnDialog(item)}
                          disabled={item.quantity === 0 || role === 'viewer'}
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          aria-label="Return Item"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}
