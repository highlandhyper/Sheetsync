'use client';

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { Search, Loader2, X, PackageSearch, Undo2, Edit, Trash2, ScanBarcode, ArrowRight, Layers, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import type { InventoryItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseISO } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { ReturnQuantityDialog } from './return-quantity-dialog';
import { EditInventoryItemDialog } from './edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { Separator } from '../ui/separator';

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

  useEffect(() => {
    if (isSearchModalOpen) {
        setTimeout(() => {
            spotlightInputRef.current?.focus();
        }, 150);
    } else {
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
          item => (item.barcode.toLowerCase() === barcodeToSearch.trim().toLowerCase() || 
                   item.productName.toLowerCase().includes(barcodeToSearch.trim().toLowerCase())) && 
                   item.quantity > 0
        ).sort((a, b) => {
            const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });

        setResults(searchResults);
        if (searchResults.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Registry Zero',
                description: `No active logs found for: ${barcodeToSearch}`,
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
      title: 'Visual ID Success',
      description: `Analyzing: ${decodedText}`,
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
            title: 'Optical Failure',
            description: 'Could not engage camera system.'
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
    if (lastSearchedBarcode) executeSearch(lastSearchedBarcode);
  }, [lastSearchedBarcode, executeSearch]);

  const handleClear = () => {
    setBarcode('');
    setResults([]);
    setHasSearched(false);
    spotlightInputRef.current?.focus();
  }

  const showResults = hasSearched || results.length > 0;

  return (
    <>
      <button 
        onClick={() => setIsSearchModalOpen(true)}
        className="group relative flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left transition-all hover:bg-white/10 active:scale-95"
      >
        <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-muted-foreground/60">Registry Lookup...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-black uppercase opacity-100 sm:flex">
            <span className="text-[8px]">ALT</span> /
        </kbd>
      </button>
      
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden border-none shadow-none bg-transparent rounded-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Command Hub</DialogTitle>
            <DialogDescription>Industrial search interface for real-time inventory lookup.</DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            {/* SEARCH BAR CONTAINER */}
            <div className="relative flex items-center bg-background/95 backdrop-blur-3xl border border-white/10 rounded-2xl h-16 sm:h-20 px-6 shadow-2xl overflow-hidden">
                <Search className="h-6 w-6 text-muted-foreground mr-4 shrink-0" strokeWidth={3} />
                <input
                    ref={spotlightInputRef}
                    placeholder="SEARCH BARCODE OR ASSET..."
                    className="h-full w-full border-none bg-transparent p-0 text-lg sm:text-xl font-bold tracking-tight focus:outline-none focus:ring-0 placeholder:text-muted-foreground/20 placeholder:font-black placeholder:uppercase placeholder:text-xs placeholder:tracking-[0.3em]"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                        if (e.key === 'Escape' && !barcode) setIsSearchModalOpen(false);
                    }}
                />
                <div className="flex items-center gap-2 ml-2 shrink-0">
                    {barcode && (
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all" onClick={handleClear}>
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                    <Separator orientation="vertical" className="h-8 bg-white/10" />
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10 transition-all" onClick={() => setIsScannerOpen(true)}>
                        <ScanBarcode className="h-6 w-6" />
                    </Button>
                    <Button variant="default" size="icon" className="h-10 w-10 rounded-xl shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all" onClick={handleSearch} disabled={!barcode || isLoading}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* RESULTS TERMINAL WRAPPER FOR SMOOTH HEIGHT TRANSITION */}
            <div className={cn(
              "grid transition-all duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]",
              showResults ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}>
              <div className="overflow-hidden">
                <Card className="max-h-[50vh] overflow-y-auto bg-background/90 backdrop-blur-3xl border-white/10 rounded-2xl shadow-2xl p-2 sm:p-4">
                  {results.length > 0 ? (
                      <div className="space-y-2">
                          {results.map((item) => (
                              <div 
                                  key={`spotlight-${item.id}`} 
                                  className="group relative flex items-center justify-between p-4 rounded-xl border border-transparent hover:bg-primary/[0.05] hover:border-primary/10 transition-all duration-200"
                              >
                                  <div className="flex items-center gap-4 min-w-0">
                                      <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                                          <Layers className="h-6 w-6 text-primary" strokeWidth={2.5} />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                          <h4 className="text-base font-black text-slate-900 dark:text-white truncate tracking-tight mb-0.5">{item.productName}</h4>
                                          <div className="flex items-center gap-3">
                                              <span className="text-[9px] font-mono font-black bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground tracking-tighter uppercase">{item.barcode}</span>
                                              <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground/50">
                                                  <MapPin className="h-3 w-3" /> {item.location}
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0">
                                      <div className="flex flex-col items-end">
                                          <div className="flex items-baseline gap-1">
                                              <span className="text-xl font-black text-primary tracking-tighter leading-none">{item.quantity}</span>
                                              <span className="text-[8px] font-black uppercase text-muted-foreground/30">Units</span>
                                          </div>
                                          <div className={cn("mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest", item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600")}>
                                              {item.itemType}
                                          </div>
                                      </div>

                                      {role === 'admin' ? (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                                              <Button variant="outline" size="icon" onClick={() => {setCurrentItemToEdit(item); setIsEditDialogOpen(true);}} className="h-8 w-8 rounded-lg bg-background border-primary/10"><Edit className="h-3.5 w-3.5" /></Button>
                                              <Button variant="outline" size="icon" onClick={() => {setSelectedItemForReturn(item); setIsReturnDialogOpen(true);}} disabled={item.quantity <= 0} className="h-8 w-8 rounded-lg bg-background border-primary/10"><Undo2 className="h-3.5 w-3.5" /></Button>
                                              <Button variant="outline" size="icon" onClick={() => {setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true);}} className="h-8 w-8 rounded-lg bg-background border-destructive/10 text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></Button>
                                          </div>
                                      ) : (
                                          <div className="opacity-20 translate-x-1 group-hover:translate-x-0 transition-transform">
                                              <ChevronRight className="h-6 w-6 text-muted-foreground" />
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="bg-muted/20 p-6 rounded-2xl mb-4">
                              <PackageSearch className="h-12 w-12 text-muted-foreground/20" strokeWidth={1.5} />
                          </div>
                          <h3 className="text-xl font-black text-muted-foreground/40 uppercase tracking-tighter">No Active Logs</h3>
                          <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-xs mx-auto">
                              The registry system could not locate identified stock for barcode: <span className="text-primary font-black">{lastSearchedBarcode}</span>
                          </p>
                      </div>
                  )}
                </Card>
              </div>
            </div>

            {/* KEYBOARD SHORTCUT FOOTER */}
            {!showResults && (
                <div className="mx-auto flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                    <div className="flex items-center gap-1.5">
                        <kbd className="bg-background border border-white/5 rounded px-1.5 py-0.5 text-foreground/50">ESC</kbd> <span>Close</span>
                    </div>
                    <Separator orientation="vertical" className="h-3 bg-white/5" />
                    <div className="flex items-center gap-1.5">
                        <kbd className="bg-background border border-white/5 rounded px-1.5 py-0.5 text-foreground/50">ENTER</kbd> <span>Search</span>
                    </div>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* SCANNER MODAL */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
              <DialogHeader className="p-8 pb-4 bg-muted/40">
                  <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase text-primary">
                      <ScanBarcode className="h-8 w-8" /> Visual Capture
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium text-muted-foreground/80">Position barcode within the identification frame.</DialogDescription>
              </DialogHeader>
              <div id={SCANNER_REGION_ID} className="w-full aspect-square bg-black relative" />
              <div className="p-6 bg-muted/40">
                  <Button variant="outline" onClick={() => setIsScannerOpen(false)} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-destructive border-white/5 transition-all active:scale-95">
                    Abort Scan
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* ACTION TERMINALS */}
      <ReturnQuantityDialog 
        key={selectedItemForReturn ? `spotlight-return-${selectedItemForReturn.id}` : 'spotlight-return-none'} 
        item={selectedItemForReturn} 
        isOpen={isReturnDialogOpen} 
        onOpenChange={setIsReturnDialogOpen} 
        onReturnSuccess={handleActionSuccess} 
      />
      <EditInventoryItemDialog 
        key={currentItemToEdit ? `spotlight-edit-${currentItemToEdit.id}` : 'spotlight-edit-none'} 
        item={currentItemToEdit} 
        isOpen={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        onSuccess={handleActionSuccess} 
        uniqueLocationsFromDb={uniqueLocations} 
      />
      <DeleteConfirmationDialog 
        key={selectedItemForDeletion ? `spotlight-delete-${selectedItemForDeletion.id}` : 'spotlight-delete-none'} 
        item={selectedItemForDeletion} 
        isOpen={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onSuccess={handleActionSuccess} 
      />
    </>
  );
}