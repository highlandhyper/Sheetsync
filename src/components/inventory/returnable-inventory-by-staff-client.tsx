
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { InventoryItem } from '@/lib/types';
import { Search, PackageOpen, User, Loader2, X, ListFilter, Eye, Printer, Undo2, Pencil } from 'lucide-react'; // Added Pencil
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReturnableInventoryItemRow } from '@/components/inventory/returnable-inventory-item-row';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';


interface ReturnableInventoryByStaffClientProps {
  initialInventoryItems: InventoryItem[];
  allStaffNames: string[];
}

const MAX_INVENTORY_ITEMS_TO_DISPLAY = 100;

export function ReturnableInventoryByStaffClient({ initialInventoryItems, allStaffNames }: ReturnableInventoryByStaffClientProps) {
  const { toast } = useToast();
  const { role } = useAuth(); 
  const { 
    inventoryItems: cachedItems, 
    uniqueLocations, 
    updateInventoryItem, 
    removeInventoryItem,
    addReturnedItem,
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

  const uniqueDbLocations = useMemo(() => {
    return uniqueLocations;
  }, [uniqueLocations]);


  useEffect(() => {
    setCurrentItemToEdit(null);
    setIsEditDialogOpen(false);
    setIsLoading(false);
  }, [initialInventoryItems]);

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
            processedBy: role || 'Unknown', 
        });

        if (newQuantity > 0) {
            updateInventoryItem({ ...itemToUpdate, quantity: newQuantity });
        } else {
            removeInventoryItem(returnedItemId);
        }
    }
    setIsReturnDialogOpen(false);
  }, [cachedItems, role, addReturnedItem, updateInventoryItem, removeInventoryItem]);

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
    <div className="space-y-6 printable-area">
      <Card className="p-4 shadow-md filters-card-noprint">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Select
              value={selectedStaffName}
              onValueChange={(value) => {
                setSelectedStaffName(value === "__EMPTY_STAFF_VALUE__" ? "" : value);
              }}
            >
              <SelectTrigger className="w-full md:max-w-lg">
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
              <Button variant="ghost" onClick={clearStaffSearch} className="w-full md:w-auto">
                 <X className="mr-2 h-4 w-4" /> Clear Staff
              </Button>
            )}
            <div className="print-button-container ml-auto md:ml-0">
                <Button onClick={handlePrint} variant="outline" size="sm" disabled={itemsToRender.length === 0 && !selectedStaffName.trim()}>
                    <Printer className="mr-2 h-4 w-4" /> Print List
                </Button>
            </div>
            {selectedStaffName && (
              <div className="flex items-center text-sm text-muted-foreground md:ml-auto">
                <ListFilter className="mr-2 h-4 w-4" />
                <span>Found: {totalItemsForSelectedStaff} item(s) by {selectedStaffName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedStaffName.trim() ? (
         <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Search Inventory by Staff Member</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a staff member using the button above to view inventory items they logged.
          </p>
        </div>
      ) : itemsToRender.length > 0 ? (
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
    </div>
  );
}
