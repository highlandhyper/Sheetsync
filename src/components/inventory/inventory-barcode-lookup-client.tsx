
'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, PackageSearch, Loader2, Undo2, ScanBarcode, VideoOff, AlertTriangle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchInventoryLogEntriesByBarcodeAction, type ActionResponse } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { useAuth } from '@/context/auth-context';
import { Html5Qrcode } from 'html5-qrcode';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';


const SCANNER_REGION_ID = "barcode-scanner-region";

interface InventoryBarcodeLookupClientProps {
  uniqueLocations: string[];
}

export function InventoryBarcodeLookupClient({ uniqueLocations }: InventoryBarcodeLookupClientProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const [barcodeToSearch, setBarcodeToSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isLoading, startSearchTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchedBarcode, setLastSearchedBarcode] = useState('');

  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  
  const executeSearch = useCallback(async (barcode: string) => {
    if (!barcode || !barcode.trim()) return;
    setHasSearched(true);
    setLastSearchedBarcode(barcode);
    setSearchResults([]); 

    startSearchTransition(async () => {
      const response = await fetchInventoryLogEntriesByBarcodeAction(barcode);
      if (response.success && response.data) {
        setSearchResults(response.data);
        if (response.data.length === 0) {
          toast({
            title: 'No Results',
            description: `No inventory log entries found for barcode: ${barcode}`,
          });
        }
      } else {
        setSearchResults([]);
        toast({
          title: 'Search Error',
          description: response.message || 'Failed to fetch inventory log entries.',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  const onScanSuccess = useCallback((decodedText: string) => {
    setBarcodeToSearch(decodedText);
    setIsScannerDialogOpen(false);
    toast({
      title: 'Barcode Scanned & Searching!',
      description: `Automatically searching for barcode: ${decodedText}`,
    });
    executeSearch(decodedText);
  }, [executeSearch, toast]);


  useEffect(() => {
    if (isScannerDialogOpen) {
      const timer = setTimeout(() => {
        if (html5QrcodeScannerRef.current) return; // Already initialized

        const scanner = new Html5Qrcode(SCANNER_REGION_ID, false);
        const qrConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        scanner.start(
          { facingMode: 'environment' },
          qrConfig,
          onScanSuccess,
          (errorMessage: string) => { /* ignore errors */ }
        ).then(() => {
          html5QrcodeScannerRef.current = scanner;
        }).catch(err => {
          console.error("Failed to start QR code scanner:", err);
          toast({
            variant: 'destructive',
            title: 'Scanner Error',
            description: 'Could not start the camera. Please check permissions and ensure another app is not using it.'
          });
          setIsScannerDialogOpen(false); // Close dialog on start failure
        });
      }, 300); // Delay to ensure DOM is ready

      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(console.error);
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerDialogOpen, onScanSuccess, toast]);


  const handleSearch = () => {
    if (!barcodeToSearch.trim()) {
      toast({
        title: 'Barcode Required',
        description: 'Please enter a barcode to search.',
        variant: 'destructive',
      });
      return;
    }
    executeSearch(barcodeToSearch.trim());
  };

  const handleOpenReturnDialog = (item: InventoryItem) => {
    if (role !== 'admin') {
        toast({ title: 'Permission Denied', description: 'Only admins can process returns.', variant: 'destructive'});
        return;
    }
    setSelectedItemForReturn(item);
    setIsReturnDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (item: InventoryItem) => {
    if (role !== 'admin') {
      toast({ title: 'Permission Denied', description: 'Only admins can delete log entries.', variant: 'destructive'});
      return;
    }
    setSelectedItemForDeletion(item);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    if (role !== 'admin') {
      toast({ title: 'Permission Denied', description: 'Only admins can edit log entries.', variant: 'destructive'});
      return;
    }
    setCurrentItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleReturnSuccess = useCallback(() => {
    setIsReturnDialogOpen(false);
    setSelectedItemForReturn(null);
    if (lastSearchedBarcode) {
      toast({ title: 'Refreshing Log...', description: `Re-querying barcode ${lastSearchedBarcode}.`});
      executeSearch(lastSearchedBarcode);
    }
  }, [lastSearchedBarcode, executeSearch, toast]);
  
  const handleDeleteSuccess = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setSelectedItemForDeletion(null);
    if (lastSearchedBarcode) {
      toast({ title: 'Refreshing Log...', description: `Re-querying barcode ${lastSearchedBarcode}.`});
      executeSearch(lastSearchedBarcode);
    }
  }, [lastSearchedBarcode, executeSearch, toast]);

  const handleEditSuccess = useCallback(() => {
    setIsEditDialogOpen(false);
    setCurrentItemToEdit(null);
    if (lastSearchedBarcode) {
      toast({ title: 'Refreshing Log...', description: `Re-querying barcode ${lastSearchedBarcode}.`});
      executeSearch(lastSearchedBarcode);
    }
  }, [lastSearchedBarcode, executeSearch, toast]);


  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-grow">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Enter or scan barcode to lookup..."
                value={barcodeToSearch}
                onChange={(e) => setBarcodeToSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="flex-grow text-base pl-10"
                aria-label="Barcode Input"
              />
            </div>
             <Button 
                onClick={() => setIsScannerDialogOpen(true)}
                variant="outline" 
                className="w-full sm:w-auto"
                aria-label="Start Barcode Scanner"
              >
                <ScanBarcode className="mr-2 h-5 w-5" /> Scan
              </Button>
            <Button onClick={handleSearch} disabled={isLoading || !barcodeToSearch.trim()} className="w-full sm:w-auto">
              {isLoading && lastSearchedBarcode === barcodeToSearch.trim() ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search Log
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-10">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-2 text-muted-foreground">Searching inventory log for "{lastSearchedBarcode}"...</p>
        </div>
      )}

      {!isLoading && hasSearched && searchResults.length > 0 && (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Logged At</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Type</TableHead>
                {role === 'admin' && <TableHead className="text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((item) => {
                const parsedTimestamp = item.timestamp ? parseISO(item.timestamp) : null;
                const formattedTimestamp = parsedTimestamp && isValid(parsedTimestamp) ? format(parsedTimestamp, 'PPp') : 'N/A';
                
                let formattedExpiryDate = 'N/A';
                if (item.expiryDate) {
                    const parsedExp = parseISO(item.expiryDate);
                    if (isValid(parsedExp)) {
                        formattedExpiryDate = format(parsedExp, 'PP');
                        if (item.itemType === 'Expiry' && parsedExp < new Date() && parsedExp.setHours(0,0,0,0) !== new Date().setHours(0,0,0,0)) {
                             formattedExpiryDate += " (Expired)";
                        }
                    } else {
                        formattedExpiryDate = "Invalid Date";
                    }
                }
                const isExpiredNow = item.itemType === 'Expiry' && item.expiryDate ? 
                                     (isValid(parseISO(item.expiryDate)) && parseISO(item.expiryDate) < new Date() && parseISO(item.expiryDate).setHours(0,0,0,0) !== new Date().setHours(0,0,0,0) ) : false;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.staffName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formattedTimestamp}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell className={cn(isExpiredNow ? "text-destructive" : "text-muted-foreground")}>
                        {formattedExpiryDate}
                    </TableCell>
                    <TableCell className={cn(item.itemType === 'Damage' ? "text-orange-500" : "text-muted-foreground")}>
                      {item.itemType}
                    </TableCell>
                    {role === 'admin' && (
                      <TableCell className="text-center">
                         <div className="flex justify-center items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditDialog(item)}
                                aria-label={`Edit log for ${item.productName}`}
                                className="p-2 h-auto"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenReturnDialog(item)}
                                disabled={item.quantity <= 0} 
                                aria-label={`Return ${item.productName}`}
                                className="p-2 h-auto"
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                             <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleOpenDeleteDialog(item)}
                                aria-label={`Delete log for ${item.productName}`}
                                className="p-2 h-auto"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isLoading && hasSearched && searchResults.length === 0 && (
        <div className="text-center py-12">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No Log Entries Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No inventory log entries were found for barcode: "{lastSearchedBarcode}".
          </p>
        </div>
      )}

      {!isLoading && !hasSearched && (
        <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Lookup Inventory Log</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a barcode above to search for its historical log entries, or use the scanner.
          </p>
        </div>
      )}

      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-2xl w-full p-0">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>Scan Barcode</DialogTitle>
                <DialogDescription>
                    Position the barcode within the frame. The scanner will automatically detect it.
                </DialogDescription>
            </DialogHeader>
            <div id={SCANNER_REGION_ID} className="w-full aspect-video [&>span]:hidden" />
            <div className="p-6 pt-0 flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsScannerDialogOpen(false)}
                  className="mt-4"
                >
                  Cancel
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      {selectedItemForReturn && (
        <ReturnQuantityDialog
            item={selectedItemForReturn}
            isOpen={isReturnDialogOpen}
            onOpenChange={setIsReturnDialogOpen}
            onReturnSuccess={handleReturnSuccess}
        />
      )}
      
       {selectedItemForDeletion && (
        <DeleteConfirmationDialog
            item={selectedItemForDeletion}
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onSuccess={handleDeleteSuccess}
        />
      )}

      {currentItemToEdit && (
        <EditInventoryItemDialog
            item={currentItemToEdit}
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={handleEditSuccess}
            uniqueLocationsFromDb={uniqueLocations}
        />
      )}
    </div>
  );
}
