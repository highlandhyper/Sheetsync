
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
import { Html5QrcodeScanner, type Html5QrcodeResult, type QrcodeError } from 'html5-qrcode';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';


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

  const [isScanning, setIsScanning] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraPermissionAttempted, setCameraPermissionAttempted] = useState(false);
  
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


  useEffect(() => {
    let scannerInstance: Html5QrcodeScanner | null = null;

    const attemptScannerSetup = async () => {
      if (isScanning) {
        setCameraPermissionAttempted(false); // Reset attempt flag when starting new scan session
        setHasCameraPermission(null); // Reset permission status

        try {
          // Attempt to get camera permission first
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          // Important: Stop tracks to release camera immediately if only for permission check
          stream.getTracks().forEach(track => track.stop());

          if (!document.getElementById(SCANNER_REGION_ID)) {
            console.warn("Scanner region ID not found in DOM. Skipping scanner render.");
            setIsScanning(false); // Stop scanning if region not found
            return;
          }
          
          scannerInstance = new Html5QrcodeScanner(
            SCANNER_REGION_ID,
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
              rememberLastUsedCamera: true,
              supportedScanTypes: [0 /* SCAN_TYPE_CAMERA */],
            },
            false // verbose
          );

          const onScanSuccess = (decodedText: string, result: Html5QrcodeResult) => {
            console.log(`Barcode scan success: ${decodedText}`, result);
            setBarcodeToSearch(decodedText);
            setIsScanning(false); // This will trigger cleanup effect
            toast({
              title: 'Barcode Scanned & Searching!',
              description: `Automatically searching for barcode: ${decodedText}`,
            });
            executeSearch(decodedText);
          };

          const onScanFailure = (error: string | QrcodeError) => {
            // console.warn(`Barcode scan error: ${error}`);
          };
          
          scannerInstance.render(onScanSuccess, onScanFailure);
          html5QrcodeScannerRef.current = scannerInstance;

        } catch (error: any) {
          console.error('Error accessing or setting up camera:', error);
          setHasCameraPermission(false);
          let description = 'Please enable camera permissions in your browser settings.';
          if (error.name === 'NotAllowedError') {
            description = 'Camera access was denied. Please enable permissions in your browser settings.';
          } else if (error.name === 'NotFoundError') {
            description = 'No camera was found. Please ensure a camera is connected and enabled.';
          } else if (error.message && error.message.toLowerCase().includes('secure context')) {
            description = 'Camera access is only allowed in secure contexts (HTTPS or localhost). If accessing via IP, ensure it\'s over HTTPS.';
          } else if (error.name === 'NotReadableError') {
            description = 'The camera is already in use by another application or browser tab.';
          }
          toast({
            variant: 'destructive',
            title: 'Camera Access Issue',
            description: description,
          });
          setIsScanning(false); // Turn off scanning toggle if permission fails
        } finally {
            setCameraPermissionAttempted(true);
        }
      } else { // When isScanning becomes false
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.clear().catch(err => {
            console.error("Failed to clear html5QrcodeScanner: ", err);
          });
          html5QrcodeScannerRef.current = null;
        }
      }
    };

    attemptScannerSetup();

    return () => {
      // Cleanup when component unmounts or isScanning changes to false
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner on cleanup: ", error);
        });
        html5QrcodeScannerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, toast]); // Removed executeSearch from deps as it's passed into scan success


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

  const handleToggleScanner = () => {
    setIsScanning(prev => !prev);
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
            <div className="flex-grow flex items-center gap-0.5">
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
                className="flex-grow text-base rounded-r-none focus-visible:ring-offset-0"
                aria-label="Barcode Input"
              />
              <Button 
                onClick={handleToggleScanner} 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-l-none border-l-0"
                aria-label={isScanning ? 'Stop Barcode Scanner' : 'Start Barcode Scanner'}
              >
                {isScanning ? <VideoOff className="h-5 w-5" /> : <ScanBarcode className="h-5 w-5" />}
              </Button>
            </div>
            <Button onClick={handleSearch} disabled={isLoading || !barcodeToSearch.trim()} className="w-full sm:w-auto">
              {isLoading && lastSearchedBarcode === barcodeToSearch.trim() ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search Log
            </Button>
          </div>
           {isScanning && (
            <div id={SCANNER_REGION_ID} className="w-full md:w-1/2 lg:w-1/3 mx-auto aspect-video border-2 border-dashed border-primary rounded-md overflow-hidden mt-4 bg-muted/30 flex items-center justify-center">
              {/* Scanner will render here. Placeholder text if needed. */}
              <p className="text-sm text-muted-foreground p-4 text-center">Initializing camera scanner...</p>
            </div>
          )}
          {cameraPermissionAttempted && hasCameraPermission === false && !isScanning && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Access Issue</AlertTitle>
              <AlertDescription>
                Could not access the camera. This feature requires a secure context (HTTPS or localhost).
                If you are accessing this page via an IP address, please ensure it's served over HTTPS.
                Also, check your browser's camera permissions for this site.
              </AlertDescription>
            </Alert>
          )}
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

    