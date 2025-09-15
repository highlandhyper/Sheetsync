'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'; 
import type { InventoryItem, Supplier } from '@/lib/types';
import { Search, PackageOpen, Building, Check, ChevronsUpDown, X, ListFilter, Eye, Printer, Filter, Undo2, ListChecks, Pencil, Trash2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton'; 
import { ReturnableInventoryItemRow } from '@/components/inventory/returnable-inventory-item-row';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';
import { Checkbox } from '../ui/checkbox';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';


interface ReturnableInventoryBySupplierClientProps {
  initialInventoryItems: InventoryItem[];
  allSuppliers: Supplier[];
}

const MAX_INVENTORY_ITEMS_TO_DISPLAY = 100;

export function ReturnableInventoryBySupplierClient({ initialInventoryItems, allSuppliers }: ReturnableInventoryBySupplierClientProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const { isMultiSelectEnabled } = useSettings();
  const [selectedSupplierNames, setSelectedSupplierNames] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);


  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierFilterInput, setSupplierFilterInput] = useState('');
  const supplierSearchInputRef = useRef<HTMLInputElement>(null); 

  const [totalItemsForSelectedSuppliers, setTotalItemsForSelectedSuppliers] = useState(0);
  const [allSortedSuppliers, setAllSortedSuppliers] = useState<Supplier[]>([]);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // State for bulk action dialogs
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const uniqueDbLocations = useMemo(() => {
    const locations = new Set<string>();
    (initialInventoryItems || []).forEach(item => {
      if (item.location) locations.add(item.location);
    });
    return Array.from(locations).sort();
  }, [initialInventoryItems]);


  useEffect(() => {
    setAllSortedSuppliers((allSuppliers || []).sort((a, b) => a.name.localeCompare(b.name)));

    if (initialInventoryItems) {
       const sortedAndFiltered = initialInventoryItems
        .filter(item => item.quantity > 0)
        .sort((a, b) => {
          const dateA = a.timestamp ? parseISO(a.timestamp) : null;
          const dateB = b.timestamp ? parseISO(b.timestamp) : null;
          if (dateA && isValid(dateA) && dateB && isValid(dateB)) {
            return dateB.getTime() - dateA.getTime();
          }
          if (dateA && isValid(dateA)) return -1;
          if (dateB && isValid(dateB)) return 1;
          return 0;
        });
      setInventoryItems(sortedAndFiltered);
    } else {
      setInventoryItems([]);
    }
    setIsLoading(false);
  }, [initialInventoryItems, allSuppliers]);

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

    const isMounted = inventoryItems.length > 0 || selectedSupplierNames.length > 0;
    
    if (isMounted) {
        if (isMultiSelectMode) {
            toast({
                title: `Multi-select mode activated.`,
                description: 'You can now select multiple items.',
            });
        } else {
             if (selectedItemIds.size > 0) {
                setSelectedItemIds(new Set());
            }
        }
    }
  }, [isMultiSelectMode, toast, inventoryItems, selectedSupplierNames]);

  const handleOpenReturnDialog = (item: InventoryItem) => {
    setSelectedItemForReturn(item);
    setIsReturnDialogOpen(true);
  };

  const handleOpenDetailsDialog = (item: InventoryItem) => {
    setSelectedItemForDetails(item);
    setIsDetailsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    setCurrentItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleDialogSuccess = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const filteredInventoryItemsBySupplier = useMemo(() => {
    if (selectedSupplierNames.length === 0) {
      setTotalItemsForSelectedSuppliers(0);
      return [];
    }
    const lowerSelectedSupplierNames = selectedSupplierNames.map(name => name.toLowerCase());
    const filtered = inventoryItems.filter(item =>
      item.supplierName && lowerSelectedSupplierNames.includes(item.supplierName.toLowerCase()) && item.quantity > 0
    );
    setTotalItemsForSelectedSuppliers(filtered.length);
    return filtered;
  }, [inventoryItems, selectedSupplierNames]);

  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [selectedSupplierNames])

  const clearSupplierSelection = () => {
    setSelectedSupplierNames([]);
    setSupplierFilterInput('');
    setTotalItemsForSelectedSuppliers(0);
  };

  const itemsToRender = useMemo(() => {
    if (filteredInventoryItemsBySupplier.length > MAX_INVENTORY_ITEMS_TO_DISPLAY) {
      return filteredInventoryItemsBySupplier.slice(0, MAX_INVENTORY_ITEMS_TO_DISPLAY);
    }
    return filteredInventoryItemsBySupplier;
  }, [filteredInventoryItemsBySupplier]);

  const handlePrint = () => {
    window.print();
  };

  const suppliersForCombobox = useMemo(() => {
    if (!supplierFilterInput) return allSortedSuppliers;
    const filtered = allSortedSuppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(supplierFilterInput.toLowerCase())
    );
    return filtered;
  }, [allSortedSuppliers, supplierFilterInput]);


  const getSupplierButtonText = () => {
    if (selectedSupplierNames.length === 0) return "Select supplier(s)...";
    if (selectedSupplierNames.length === 1) return selectedSupplierNames[0];
    if (selectedSupplierNames.length > 1 && selectedSupplierNames.length <=3) return selectedSupplierNames.join(', ');
    return `${selectedSupplierNames.length} suppliers selected`;
  };

  const handleSupplierDropdownOpenChange = (open: boolean) => {
    setIsSupplierDropdownOpen(open);
    if (open) {
      // Delay focus slightly to ensure input is rendered
      setTimeout(() => {
        supplierSearchInputRef.current?.focus();
      }, 50);
    }
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
            <Skeleton className="h-10 w-36" /> 
            <Skeleton className="h-6 w-32 md:ml-auto" /> 
        </div>
        <Card className="shadow-md">
          <Table><TableHeader>
            <TableRow><TableHead className="w-20 text-center">Return</TableHead><TableHead className="w-20 text-center">Details</TableHead><TableHead>Product Name</TableHead><TableHead>Barcode</TableHead><TableHead className="text-right">In Stock</TableHead><TableHead>Expiry</TableHead><TableHead>Location</TableHead><TableHead>Type</TableHead><TableHead className="w-20 text-center">Edit</TableHead>
           </TableRow>
          </TableHeader><TableBody>
            {Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={index}><TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell><TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 printable-area">
      <Card className="filters-card-noprint shadow-md p-4 sticky top-16 z-30 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-0">
          {isMultiSelectMode && selectedItemIds.size > 0 ? (
             <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
               <div className="text-sm font-medium text-muted-foreground">
                  {selectedItemIds.size} item(s) selected
               </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBulkReturnOpen(true)}><Undo2 className="mr-2 h-4 w-4" /> Return Selected</Button>
                    {role === 'admin' && (
                        <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete Selected</Button>
                    )}
                </div>
             </div>
          ) : (
          <div className="flex flex-col md:flex-row items-center gap-4">
            <DropdownMenu open={isSupplierDropdownOpen} onOpenChange={handleSupplierDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full md:max-w-lg justify-between items-center"
                >
                  <div className="flex items-center flex-grow overflow-hidden">
                    <Building className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-grow text-center truncate px-1">
                      {getSupplierButtonText()}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width]"
                align="start"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenuLabel className="flex items-center justify-between">
                  Filter by Supplier
                  {selectedSupplierNames.length > 0 && (
                     <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setSelectedSupplierNames([]);
                            setSupplierFilterInput('');
                        }}
                        className="h-auto p-1 text-xs"
                      >
                        Clear All ({selectedSupplierNames.length})
                      </Button>
                  )}
                </DropdownMenuLabel>
                <div className="p-2">
                  <Input
                    ref={supplierSearchInputRef}
                    placeholder="Search suppliers..."
                    value={supplierFilterInput}
                    onChange={(e) => {
                      setSupplierFilterInput(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()} 
                    onKeyDown={(e) => e.stopPropagation()} 
                    className="w-full h-8"
                  />
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="h-72">
                  {suppliersForCombobox.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {supplierFilterInput ? `No suppliers found for "${supplierFilterInput}"` : (allSortedSuppliers.length > 0 ? "Type to search suppliers..." : "No suppliers available.")}
                    </div>
                  )}
                  {suppliersForCombobox.map((supplier) => (
                    <DropdownMenuCheckboxItem
                      key={supplier.id}
                      checked={selectedSupplierNames.includes(supplier.name)}
                      onCheckedChange={(checked) => {
                        setSelectedSupplierNames((prev) =>
                          checked
                            ? [...prev, supplier.name]
                            : prev.filter((name) => name !== supplier.name)
                        );
                      }}
                      onSelect={(e) => e.preventDefault()} 
                    >
                      {supplier.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedSupplierNames.length > 0 && (
              <Button variant="ghost" onClick={clearSupplierSelection} className="w-full md:w-auto">
                 <X className="mr-2 h-4 w-4" /> Clear Selection
              </Button>
            )}
            {selectedSupplierNames.length > 0 && (
                <div className="flex items-center text-sm text-muted-foreground md:ml-auto whitespace-nowrap">
                    <ListFilter className="mr-2 h-4 w-4" />
                    <span>Found: {totalItemsForSelectedSuppliers} item(s)</span>
                </div>
            )}
             <div className="print-button-container ml-auto md:ml-0 md:pl-2">
                <Button onClick={handlePrint} variant="outline" size="icon" disabled={itemsToRender.length === 0 && selectedSupplierNames.length === 0}>
                    <Printer className="h-4 w-4" />
                    <span className="sr-only">Print List</span>
                </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
      
      {isMultiSelectMode && selectedSupplierNames.length > 0 && (
        <Alert variant="default" className="bg-blue-500/10 border-blue-500/30 filters-card-noprint">
            <ListChecks className="h-4 w-4 !text-blue-500" />
            <AlertTitle className="text-blue-600">Multi-Select Mode Active</AlertTitle>
            <AlertDescription>
                You can now select multiple items. Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Ctrl/Cmd + M</kbd> to exit this mode.
            </AlertDescription>
        </Alert>
      )}

      {selectedSupplierNames.length === 0 ? (
         <div className="text-center py-12">
          <Filter className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Filter Inventory by Supplier</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one or more suppliers using the button above to view their inventory items eligible for return.
          </p>
        </div>
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
              <TableHead className="w-20 text-center">Return</TableHead>
              <TableHead className="w-20 text-center">Details</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead className="text-right">In Stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-20 text-center">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsToRender.map((item) => (
              <ReturnableInventoryItemRow
                key={item.id}
                item={item}
                onInitiateReturn={handleOpenReturnDialog}
                onViewDetails={handleOpenDetailsDialog}
                onEditItem={role === 'admin' ? handleOpenEditDialog : undefined} 
                isProcessing={selectedItemForReturn?.id === item.id && isReturnDialogOpen}
                showSupplierName={false} 
                showEditButtonText={false}
                isSelected={selectedItemIds.has(item.id)}
                onSelectRow={isMultiSelectMode ? handleSelectRow : undefined}
                showCheckbox={isMultiSelectMode && role === 'admin'}
              />
            ))}
          </TableBody></Table>
          {filteredInventoryItemsBySupplier.length > MAX_INVENTORY_ITEMS_TO_DISPLAY && (
            <CardContent className="pt-4 text-center filters-card-noprint">
              <p className="text-sm text-muted-foreground">
                Displaying first {MAX_INVENTORY_ITEMS_TO_DISPLAY} of {filteredInventoryItemsBySupplier.length} items for this selection.
              </p>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="text-center py-12">
          <PackageOpen className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">
            No inventory items found for the selected supplier(s)
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ensure items for the selected supplier(s) are logged with quantity greater than zero.
          </p>
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
        displayContext="returnBySupplier" 
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined} 
      />
      <EditInventoryItemDialog
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleDialogSuccess}
        uniqueLocationsFromDb={uniqueDbLocations}
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
