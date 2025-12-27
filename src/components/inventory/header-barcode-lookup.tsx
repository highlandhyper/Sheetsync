
'use client';

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { Search, Loader2, X, PackageSearch, Undo2, Edit, Trash2, ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { ReturnQuantityDialog } from './return-quantity-dialog';
import { EditInventoryItemDialog } from './edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { Html5Qrcode } from 'html5-qrcode';


const SCANNER_REGION_ID = "header-barcode-scanner-region";

export function HeaderBarcodeLookup() {
  const [barcode, setBarcode] = useState('');
  const [lastSearchedBarcode, setLastSearchedBarcode] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoading, startSearchTransition] = useTransition();
  const { toast } = useToast();
  const { role } = useAuth();
  const { inventoryItems, uniqueLocations, refreshData } = useDataCache();
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);

  // States for action dialogs
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const executeSearch = useCallback(
    (barcodeToSearch: string) => {
      if (!barcodeToSearch.trim()) return;

      startSearchTransition(() => {
        setLastSearchedBarcode(barcodeToSearch);
        const searchResults = inventoryItems.filter(
          item => item.barcode.toLowerCase() === barcodeToSearch.trim().toLowerCase()
        ).sort((a, b) => {
            const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });

        setResults(searchResults);
        setIsDialogOpen(true);
        if (searchResults.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Not Found',
                description: `No inventory items found with barcode: ${barcodeToSearch}`,
            });
        }
      });
    },
    [inventoryItems, toast]
  );
  
  const onScanSuccess = useCallback((decodedText: string) => {
    setBarcode(decodedText);
    setIsScannerOpen(false);
    toast({
      title: 'Barcode Scanned!',
      description: `Searching for: ${decodedText}`,
    });
    executeSearch(decodedText);
  }, [executeSearch, toast]);
  
  useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        if (html5QrcodeScannerRef.current) return;

        const scanner = new Html5Qrcode(SCANNER_REGION_ID, false);
        scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          (errorMessage: string) => {}
        ).then(() => {
          html5QrcodeScannerRef.current = scanner;
        }).catch(err => {
          toast({
            variant: 'destructive',
            title: 'Scanner Error',
            description: 'Could not start camera. Check permissions.'
          });
          setIsScannerOpen(false);
        });
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(console.error);
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerOpen, onScanSuccess, toast]);

  const handleSearch = () => {
    if (barcode.trim()) {
      executeSearch(barcode.trim());
    }
  };
  
  const handleActionSuccess = () => {
    setIsReturnDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    // Data is already updated via context, but we can re-run the search
    // to refresh the dialog if it's still open.
    if(isDialogOpen && lastSearchedBarcode) {
        executeSearch(lastSearchedBarcode);
    }
  };

  const handleClear = () => {
    setBarcode('');
  }

  return (
    <>
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Barcode lookup"
          className="pl-9 pr-24"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
           {barcode && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
           )}
           <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsScannerOpen(true)}>
             <ScanBarcode className="h-4 w-4" />
           </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleSearch} disabled={!barcode || isLoading}>
             {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
           </Button>
        </div>
      </div>
      
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md w-full p-0">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>Scan Barcode</DialogTitle>
            </DialogHeader>
            <div id={SCANNER_REGION_ID} className="w-full aspect-square [&>span]:hidden" />
            <DialogFooter className="p-6 pt-0">
                <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Cancel</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Inventory Log for: {lastSearchedBarcode}</DialogTitle>
            <DialogDescription>
              Showing all recorded inventory entries for this barcode.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Logged At</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Type</TableHead>
                    {role === 'admin' && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</TableCell>
                      <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}</TableCell>
                      <TableCell className={cn(item.itemType === 'Damage' ? "text-orange-500" : "")}>{item.itemType}</TableCell>
                      {role === 'admin' && (
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => {setCurrentItemToEdit(item); setIsEditDialogOpen(true);}} className="p-2 h-auto"><Edit className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => {setSelectedItemForReturn(item); setIsReturnDialogOpen(true);}} disabled={item.quantity <= 0} className="p-2 h-auto"><Undo2 className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="sm" onClick={() => {setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true);}} className="p-2 h-auto"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
                <div className="text-center py-10">
                    <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Log Entries Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        No inventory history for barcode: "{lastSearchedBarcode}".
                    </p>
                </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Action Dialogs */}
      {selectedItemForReturn && <ReturnQuantityDialog item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />}
      {currentItemToEdit && <EditInventoryItemDialog item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />}
      {selectedItemForDeletion && <DeleteConfirmationDialog item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={() => handleActionSuccess()} />}
    </>
  );
}
