
'use client';

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { Search, Loader2, X, PackageSearch, Undo2, Edit, Trash2, ScanBarcode, Command, ArrowRight } from 'lucide-react';
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

const playProfessionalBeep = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); 

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio feedback failed:", e);
  }
};

export function HeaderBarcodeLookup() {
  const [barcode, setBarcode] = useState('');
  const [lastSearchedBarcode, setLastSearchedBarcode] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoading, startSearchTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  
  const { toast } = useToast();
  const { role } = useAuth();
  const { inventoryItems, uniqueLocations } = useDataCache();
  
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const scanProcessedRef = useRef(false);

  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // GLOBAL KEYBOARD LISTENER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '/' || e.key === '÷')) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // FOCUS MANAGEMENT
  useEffect(() => {
    if (isSearchModalOpen) {
        setTimeout(() => {
            spotlightInputRef.current?.focus();
        }, 150);
    } else {
        // Reset search state when closing
        setBarcode('');
        setResults([]);
        setHasSearched(false);
    }
  }, [isSearchModalOpen]);

  const executeSearch = useCallback(
    (barcodeToSearch: string) => {
      if (!barcodeToSearch.trim()) return;

      startSearchTransition(() => {
        setHasSearched(true);
        setLastSearchedBarcode(barcodeToSearch);
        const searchResults = inventoryItems.filter(
          item => item.barcode.toLowerCase() === barcodeToSearch.trim().toLowerCase() && item.quantity > 0
        ).sort((a, b) => {
            const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });

        setResults(searchResults);
        if (searchResults.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Data Found',
                description: `No active logs found for SKU: ${barcodeToSearch}`,
            });
        }
      });
    },
    [inventoryItems, toast]
  );

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current) return;
    scanProcessedRef.current = true;

    playProfessionalBeep();
    setBarcode(decodedText);
    setIsScannerOpen(false);
    
    toast({
      title: 'Barcode Captured!',
      description: `Analyzing SKU: ${decodedText}`,
    });

    executeSearch(decodedText);
    
    setTimeout(() => {
        scanProcessedRef.current = false;
    }, 1000);
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
          () => {}
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
      }, 800);

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
  
  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsDeleteDialogOpen(false);
    // Re-execute search to refresh current table results in modal
    if (lastSearchedBarcode) executeSearch(lastSearchedBarcode);
  }, [lastSearchedBarcode, executeSearch]);

  const handleClear = () => {
    setBarcode('');
    setResults([]);
    setHasSearched(false);
    spotlightInputRef.current?.focus();
  }

  return (
    <>
      {/* HEADER TRIGGER (REPLACING THE OLD INPUT) */}
      <button 
        onClick={() => setIsSearchModalOpen(true)}
        className="group relative flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left transition-all hover:bg-white/10 active:scale-95"
      >
        <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-muted-foreground/60">Quick search SKU...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-black uppercase opacity-100 sm:flex">
            <span className="text-[8px]">ALT</span> /
        </kbd>
      </button>
      
      {/* SPOTLIGHT MODAL */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden border-none shadow-[0_0_80px_rgba(0,0,0,0.4)] bg-background/95 backdrop-blur-2xl">
          <div className="relative flex items-center border-b border-white/5 p-4">
            <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-primary animate-in zoom-in duration-300" />
            <Input
                ref={spotlightInputRef}
                placeholder="Lookup SKU or Product Name..."
                className="h-14 w-full border-none bg-transparent pl-12 pr-32 text-xl font-bold focus-visible:ring-0 placeholder:text-muted-foreground/30"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                    if (e.key === 'Escape' && !barcode) setIsSearchModalOpen(false);
                }}
            />
            <div className="absolute right-4 flex items-center gap-2">
                {barcode && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={handleClear}>
                        <X className="h-5 w-5" />
                    </Button>
                )}
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10" onClick={() => setIsScannerOpen(true)}>
                    <ScanBarcode className="h-5 w-5" />
                </Button>
                <Button variant="default" size="icon" className="h-10 w-10 rounded-xl shadow-lg shadow-primary/20" onClick={handleSearch} disabled={!barcode || isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                </Button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {hasSearched ? (
                results.length > 0 ? (
                    <div className="p-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Table>
                            <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Product Identification</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Registry Log</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Stock</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Location</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Classification</TableHead>
                                {role === 'admin' && <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Admin Actions</TableHead>}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {results.map((item) => (
                                <TableRow key={`spotlight-${item.id}`} className="group hover:bg-primary/[0.02]">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-primary">{item.productName}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.barcode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right font-black text-lg">{item.quantity}</TableCell>
                                    <TableCell className="text-xs font-bold uppercase tracking-tight">{item.location}</TableCell>
                                    <TableCell>
                                        <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest", item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600")}>
                                            {item.itemType}
                                        </div>
                                    </TableCell>
                                    {role === 'admin' && (
                                        <TableCell className="text-center">
                                            <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" onClick={() => {setCurrentItemToEdit(item); setIsEditDialogOpen(true);}} className="h-8 w-8 p-0 rounded-lg"><Edit className="h-4 w-4" /></Button>
                                                <Button variant="outline" size="sm" onClick={() => {setSelectedItemForReturn(item); setIsReturnDialogOpen(true);}} disabled={item.quantity <= 0} className="h-8 w-8 p-0 rounded-lg"><Undo2 className="h-4 w-4" /></Button>
                                                <Button variant="destructive" size="sm" onClick={() => {setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true);}} className="h-8 w-8 p-0 rounded-lg"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
                        <div className="bg-muted p-6 rounded-[2.5rem] mb-6 shadow-inner">
                            <PackageSearch className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-black text-muted-foreground uppercase tracking-tighter">Zero Logs Found</h3>
                        <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs mx-auto font-medium">
                            No active inventory sessions match barcode: <span className="font-mono text-primary font-black">{lastSearchedBarcode}</span>
                        </p>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                    <Command className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">System Registry Handshake Active</p>
                </div>
            )}
          </div>
          
          <div className="bg-muted/30 border-t border-white/5 p-3 flex justify-between items-center px-6">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        <kbd className="bg-background border rounded px-1.5 py-0.5">ESC</kbd> Close
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        <kbd className="bg-background border rounded px-1.5 py-0.5">ENTER</kbd> Execute
                    </div>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 italic">Industrial Core v4.1 Spotlight</p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* SCANNER MODAL */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
              <DialogHeader className="p-6 pb-2 bg-muted/30">
                  <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
                      <ScanBarcode className="h-5 w-5 text-primary" /> Visual Capture
                  </DialogTitle>
                  <DialogDescription className="text-xs">Position product barcode within the central optical frame.</DialogDescription>
              </DialogHeader>
              <div id={SCANNER_REGION_ID} className="w-full aspect-square [&>span]:hidden bg-black" />
              <div className="p-4 bg-muted/30">
                  <Button variant="outline" onClick={() => setIsScannerOpen(false)} className="w-full h-12 rounded-xl font-black uppercase tracking-widest">
                    Abort Scan
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* SECONDARY ACTION DIALOGS */}
      <ReturnQuantityDialog 
        key={selectedItemForReturn ? `spotlight-return-${selectedItemForReturn.id}` : 'spot-ret'} 
        item={selectedItemForReturn} 
        isOpen={isReturnDialogOpen} 
        onOpenChange={setIsReturnDialogOpen} 
        onReturnSuccess={handleActionSuccess} 
      />
      <EditInventoryItemDialog 
        key={currentItemToEdit ? `spotlight-edit-${currentItemToEdit.id}` : 'spot-ed'} 
        item={currentItemToEdit} 
        isOpen={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        onSuccess={handleActionSuccess} 
        uniqueLocationsFromDb={uniqueLocations} 
      />
      <DeleteConfirmationDialog 
        key={selectedItemForDeletion ? `spotlight-delete-${selectedItemForDeletion.id}` : 'spot-del'} 
        item={selectedItemForDeletion} 
        isOpen={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onSuccess={handleActionSuccess} 
      />
    </>
  );
}
