'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { InventoryItem, Product } from '@/lib/types';
import { Search, PackageOpen, User, Loader2, X, ListFilter, Eye, Printer, Undo2, Pencil, Trash2, ListChecks, Wallet, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton'; 
import { ReturnableInventoryItemRow } from '@/components/inventory/returnable-inventory-item-row';
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseISO, isValid, format } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';
import { Checkbox } from '../ui/checkbox';
import { useMultiSelect } from '@/context/multi-select-context';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { generateInventoryPDF } from '@/lib/pdf-reports';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';


const MAX_INVENTORY_ITEMS_TO_DISPLAY = 100;

export function ReturnableInventoryByStaffClient() {
  const { toast } = useToast();
  const { role, user } = useAuth();
  const { isMultiSelectEnabled } = useMultiSelect();
  const { 
    inventoryItems: cachedItems, 
    products: cachedProducts,
    uniqueLocations,
    uniqueStaffNames: allStaffNames,
    updateInventoryItem, 
    removeInventoryItem,
    addReturnedItem,
    refreshData,
  } = useDataCache();
  const [selectedStaffName, setSelectedStaffName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);

  const [totalItemsForSelectedStaff, setTotalItemsForSelectedStaff] = useState(0);
  
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const uniqueDbLocations = useMemo(() => {
    return uniqueLocations;
  }, [uniqueLocations]);

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);

  const totalValueOfSelectedItems = useMemo(() => {
    if (selectedItemIds.size === 0) return 0;

    let totalValue = 0;
    selectedItemIds.forEach(itemId => {
      const item = cachedItems.find(i => i.id === itemId);
      if (item) {
        const product = productsByBarcode.get(item.barcode);
        const costPrice = product?.costPrice ?? 0;
        totalValue += costPrice * item.quantity;
      }
    });
    return totalValue;
  }, [selectedItemIds, cachedItems, productsByBarcode]);


  useEffect(() => {
    setCurrentItemToEdit(null);
    setIsEditDialogOpen(false);
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    if (!isMultiSelectEnabled) {
      setSelectedItemIds(new Set());
    }
  }, [isMultiSelectEnabled]);

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

  const handleEditSuccess = useCallback(() => {
    // Local state is updated by the context, no full refresh needed
    setIsEditDialogOpen(false);
    setSelectedItemIds(new Set());
  }, []);

  const handleReturnSuccess = useCallback((returnedItemId: string, returnedQuantity: number) => {
    const itemToUpdate = cachedItems.find(item => item.id === returnedItemId);
    if (itemToUpdate) {
        const newQuantity = itemToUpdate.quantity - returnedQuantity;
         addReturnedItem({
            ...itemToUpdate,
            id: `ret_${Date.now()}`,
            originalInventoryItemId: itemToUpdate.id,
            returnedQuantity: returnedQuantity,
            returnTimestamp: new Date().toISOString(),
            processedBy: user?.email || 'Unknown', 
        });

        if (newQuantity > 0) {
            updateInventoryItem({ ...itemToUpdate, quantity: newQuantity });
        } else {
            removeInventoryItem(returnedItemId);
        }
    }
    setIsReturnDialogOpen(false);
    setSelectedItemIds(new Set());
  }, [cachedItems, user, addReturnedItem, updateInventoryItem, removeInventoryItem]);
  
  const handleBulkSuccess = useCallback(() => {
      refreshData();
      setSelectedItemIds(new Set());
      setIsBulkReturnOpen(false);
      setIsBulkDeleteOpen(false);
  }, [refreshData]);

  const filteredInventoryItemsByStaff = useMemo(() => {
    const sortedAndFiltered = cachedItems
      .filter(item => item.quantity > 0)
      .sort((a, b) => {
        const dateA = a.timestamp ? parseISO(a.timestamp) : null;
        const dateB = b.timestamp ? parseISO(b.timestamp) : null;
        if (dateA && isValid(dateA) && dateB && isValid(dateB)) {
          return dateB.getTime() - dateA.getTime();
        }
        return 0;
      });

    if (!selectedStaffName.trim()) {
      setTotalItemsForSelectedStaff(0);
      return [];
    }
    const lowerStaffName = selectedStaffName.toLowerCase();
    const filtered = sortedAndFiltered.filter(item =>
      item.staffName?.toLowerCase() === lowerStaffName
    );
    setTotalItemsForSelectedStaff(filtered.length);
    return filtered;
  }, [cachedItems, selectedStaffName]);
  
  const totalValueForSelectedStaff = useMemo(() => {
    return filteredInventoryItemsByStaff.reduce((total, item) => {
      const product = productsByBarcode.get(item.barcode);
      const itemValue = (product?.costPrice ?? 0) * item.quantity;
      return total + itemValue;
    }, 0);
  }, [filteredInventoryItemsByStaff, productsByBarcode]);


  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [selectedStaffName]);

  const clearStaffSearch = () => {
    setSelectedStaffName('');
    setTotalItemsForSelectedStaff(0);
  };

  const itemsToRender = useMemo(() => {
    if (filteredInventoryItemsByStaff.length > MAX_INVENTORY_ITEMS_TO_DISPLAY) {
      return filteredInventoryItemsByStaff.slice(0, MAX_INVENTORY_ITEMS_TO_DISPLAY);
    }
    return filteredInventoryItemsByStaff;
  }, [filteredInventoryItemsByStaff]);


  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!selectedStaffName || itemsToRender.length === 0) return;
    
    const cols = ['No.', 'Product Name', 'Barcode', 'Supplier', 'Qty', 'Unit Cost', 'Total Value', 'Expiry', 'Location'];
    const dataMapper = (item: InventoryItem, idx: number) => {
        const product = productsByBarcode.get(item.barcode);
        const cost = product?.costPrice ?? 0;
        return [
            (idx + 1).toString(),
            item.productName,
            item.barcode,
            item.supplierName || 'N/A',
            item.quantity.toString(),
            `QAR ${cost.toFixed(2)}`,
            `QAR ${(cost * item.quantity).toFixed(2)}`,
            item.expiryDate || 'N/A',
            item.location
        ];
    };

    generateInventoryPDF(
        `Staff Return Summary: ${selectedStaffName}`, 
        itemsToRender, 
        cols, 
        (item) => dataMapper(item, itemsToRender.indexOf(item)), 
        totalValueForSelectedStaff
    );
  };

  const handleShareToWhatsApp = () => {
    if (!selectedStaffName || itemsToRender.length === 0) return;

    let reportText = `*Inventory Return List for Staff: ${selectedStaffName}*\n\n`;

    itemsToRender.forEach(item => {
      const product = productsByBarcode.get(item.barcode);
      const costPrice = product?.costPrice;
      const totalValue = costPrice !== undefined ? costPrice * item.quantity : undefined;

      reportText += `*${item.productName}*\n`;
      reportText += `  Barcode: ${item.barcode}\n`;
      if(item.supplierName) reportText += `  Supplier: ${item.supplierName}\n`;
      reportText += `  In Stock: ${item.quantity}\n`;
      if (totalValue !== undefined) {
        reportText += `  Total Value: QAR ${totalValue.toFixed(2)}\n`;
      }
      reportText += `  Location: ${item.location}\n`;
      if (item.expiryDate && isValid(parseISO(item.expiryDate))) {
        reportText += `  Expiry: ${format(parseISO(item.expiryDate), 'PP')}\n`;
      }
      reportText += '\n';
    });

    const encodedText = encodeURIComponent(reportText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg shadow bg-card mb-6">
            <Skeleton className="h-10 w-full md:max-w-lg" />
            <Skeleton className="h-10 w-28" /> {/* Clear */}
            <Skeleton className="h-10 w-28" /> {/* Print */}
            <Skeleton className="h-6 w-32 md:ml-auto" />
        </div>
        <Card className="shadow-md">
          <Table><TableHeader>
            <TableRow>{/*
             */}<TableHead className="w-20 text-center">Return</TableHead>{/*
             */}<TableHead className="w-20 text-center">Details</TableHead>{/*
             */}<TableHead>Product Name</TableHead>{/*
             */}<TableHead>Barcode</TableHead>{/*
             */}<TableHead>Supplier</TableHead>{/*
             */}<TableHead className="text-right">In Stock</TableHead>{/*
             */}<TableHead>Expiry</TableHead>{/*
             */}<TableHead>Location</TableHead>{/*
             */}<TableHead>Type</TableHead>{/*
             */}<TableHead className="w-20 text-center">Edit</TableHead>{/*
           */}</TableRow>
          </TableHeader><TableBody>
            {Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={index}>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell className="text-right"><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/* Edit
              */}</TableRow>
            ))}
          </TableBody></Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0">
          {selectedItemIds.size > 0 && isMultiSelectEnabled && role === 'admin' ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-sm font-medium text-muted-foreground">
                        {selectedItemIds.size} item(s) selected
                    </div>
                    <div className="flex items-center text-sm font-semibold text-primary border-l pl-4">
                        <Wallet className="mr-2 h-4 w-4" />
                        <span>
                            Selected Value: QAR {totalValueOfSelectedItems.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBulkReturnOpen(true)}>Return Selected</Button>
                    <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>Delete Selected</Button>
                </div>
             </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <Select
                        value={selectedStaffName}
                        onValueChange={(value) => {
                            setSelectedStaffName(value === "__EMPTY_STAFF_VALUE__" ? "" : value);
                        }}
                    >
                        <SelectTrigger className="w-full md:w-[320px]">
                            <div className="flex items-center">
                                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Filter by staff member..." />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <ScrollArea className="h-72">
                                <SelectItem value="__EMPTY_STAFF_VALUE__">
                                    <em>Show All / Clear Filter</em>
                                </SelectItem>
                                {allStaffNames.length > 0 ? (
                                    allStaffNames.map((staffName) => (
                                        <SelectItem key={staffName} value={staffName}>
                                            {staffName}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-sm text-muted-foreground text-center">No staff names available.</div>
                                )}
                            </ScrollArea>
                        </SelectContent>
                    </Select>

                    {selectedStaffName && (
                        <Button variant="ghost" onClick={clearStaffSearch} className="w-full sm:w-auto">
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {selectedStaffName && (
                        <div className="hidden lg:flex items-center text-xs text-muted-foreground mr-2 whitespace-nowrap">
                            <ListFilter className="mr-1.5 h-3.5 w-3.5" />
                            <span>{totalItemsForSelectedStaff} logs found</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={itemsToRender.length === 0}>
                              <FileText className="mr-2 h-4 w-4" /> Reports <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                              <FileText className="mr-2 h-4 w-4 text-primary" />
                              Download PDF Report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleShareToWhatsApp} className="cursor-pointer">
                              <WhatsAppIcon className="mr-2 h-4 w-4 text-green-500" />
                              Share via WhatsApp
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="print-button-container flex-1 sm:flex-none">
                            <Button onClick={handlePrint} variant="outline" size="sm" className="w-full" disabled={itemsToRender.length === 0}>
                                <Printer className="mr-2 h-4 w-4" /> Print
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedStaffName && itemsToRender.length > 0 && (
        <Card className="p-4 shadow-md filters-card-noprint">
            <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-primary" />
                <div>
                    <h3 className="text-lg font-semibold">Staff Selection Value</h3>
                    <p className="text-sm text-muted-foreground">Total cost of all items logged by {selectedStaffName}.</p>
                </div>
            </div>
            <p className="text-2xl font-bold text-primary">
                QAR {totalValueForSelectedStaff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            </div>
        </Card>
      )}

      {isMultiSelectEnabled && selectedStaffName && (
        <Alert variant="default" className="bg-blue-500/10 border-blue-500/30 filters-card-noprint">
            <ListChecks className="h-4 w-4 !text-blue-500" />
            <AlertTitle className="text-blue-600">Multi-Select Mode Active</AlertTitle>
            <AlertDescription>
                Checkboxes are now available for bulk actions. You can disable this in settings.
            </AlertDescription>
        </Alert>
      )}

      {!selectedStaffName.trim() ? (
         <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Search Inventory by Staff Member</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a staff member using the button above to view inventory items they logged.
          </p>
        </div>
      ) : itemsToRender.length > 0 ? (
        <>
            {/* Desktop Table View */}
            <Card className="shadow-md hidden md:block">
            <Table><TableHeader>
                <TableRow>
                {isMultiSelectEnabled && role === 'admin' && (
                  <TableHead className="w-12 text-center noprint">
                      <Checkbox
                      checked={selectedItemIds.size === itemsToRender.length && itemsToRender.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      aria-label="Select all rows"
                      />
                  </TableHead>
                )}
                <TableHead className="w-20 text-center">Return</TableHead>
                <TableHead className="w-20 text-center">Details</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right font-semibold">Total Value</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-20 text-center">Edit</TableHead>
            </TableRow>
            </TableHeader><TableBody>
                {itemsToRender.map((item) => (
                <ReturnableInventoryItemRow
                    key={item.id}
                    item={item}
                    onInitiateReturn={handleOpenReturnDialog}
                    onViewDetails={handleOpenDetailsDialog}
                    onEditItem={role === 'admin' ? handleOpenEditDialog : undefined}
                    isProcessing={selectedItemForReturn?.id === item.id && isReturnDialogOpen}
                    showSupplierName={true}
                    showEditButtonText={false}
                    disableReturnButton={role === 'viewer'}
                    isSelected={selectedItemIds.has(item.id)}
                    onSelectRow={isMultiSelectEnabled && role === 'admin' ? handleSelectRow : undefined}
                    showCheckbox={isMultiSelectEnabled && role === 'admin'}
                    costPrice={productsByBarcode.get(item.barcode)?.costPrice}
                    showCost={true}
                />
                ))}
            </TableBody></Table>
            {filteredInventoryItemsByStaff.length > MAX_INVENTORY_ITEMS_TO_DISPLAY && (
                <CardContent className="pt-4 text-center filters-card-noprint">
                    <p className="text-sm text-muted-foreground">
                    Displaying first {MAX_INVENTORY_ITEMS_TO_DISPLAY} of {filteredInventoryItemsByStaff.length} items for this staff member.
                    </p>
                </CardContent>
                )}
            </Card>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {itemsToRender.map((item) => {
                    const product = productsByBarcode.get(item.barcode);
                    return (
                    <InventoryItemCardMobile
                        key={item.id}
                        item={item}
                        product={product}
                        onDetails={() => handleOpenDetailsDialog(item)}
                        onEdit={role === 'admin' ? () => handleOpenEditDialog(item) : undefined}
                        onReturn={role !== 'viewer' ? () => handleOpenReturnDialog(item) : undefined}
                        context="staff"
                    />
                )})}
            </div>
        </>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No inventory items found logged by "{selectedStaffName}"</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ensure items logged by this staff member have quantity greater than zero.
          </p>
        </div>
      )}
      <ReturnQuantityDialog
        item={selectedItemForReturn}
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onReturnSuccess={handleReturnSuccess}
      />
      <InventoryItemDetailsDialog
        item={selectedItemForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        displayContext="returnByStaff"
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined}
      />
      <EditInventoryItemDialog
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        uniqueLocationsFromDb={uniqueDbLocations}
      />
       <BulkReturnDialog 
        isOpen={isBulkReturnOpen}
        onOpenChange={setIsBulkReturnOpen}
        itemIds={Array.from(selectedItemIds)}
        onSuccess={handleBulkSuccess}
        itemCount={selectedItemIds.size}
      />
      <BulkDeleteDialog
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        itemIds={Array.from(selectedItemIds)}
        onSuccess={handleBulkSuccess}
        itemCount={selectedItemIds.size}
      />
    </div>
  );
}
