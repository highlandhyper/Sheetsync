'use client';

import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { Search, Loader2, X, PackageSearch, Undo2, Edit, Trash2, ScanBarcode, Command, ArrowRight, Activity, Cpu, Layers, ChevronRight, Hash, MapPin, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from '../ui/badge';
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
                title: 'Search Terminal',
                description: `No active registries found for: ${barcodeToSearch}`,
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
      title: 'Visual Logic Capture',
      description: `Analyzing ID: ${decodedText}`,
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
            title: 'Optical Fault',
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

  return (
    <>
      <button 
        onClick={() => setIsSearchModalOpen(true)}
        className="group relative flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left transition-all hover:bg-white/10 active:scale-95"
      >
        <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-muted-foreground/60">Search Registry...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-black uppercase opacity-100 sm:flex">
            <span className="text-[8px]">ALT</span> /
        </kbd>
      </button>
      
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden border-none shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-background/95 backdrop-blur-3xl rounded-[2rem]">
          <DialogHeader className="sr-only">
            <DialogTitle>Search Spotlight</DialogTitle>
            <DialogDescription>Industrial search interface for inventory registries.</DialogDescription>
          </DialogHeader>
          
          {/* SEARCH AREA */}
          <div className="relative flex items-center p-6 sm:p-8 bg-white/5 border-b border-white/5">
            <div className="absolute left-10 flex items-center gap-4">
                <Search className="h-6 w-6 text-primary animate-in zoom-in duration-500" strokeWidth={3} />
                <Separator orientation="vertical" className="h-8 bg-white/10" />
            </div>
            <Input
                ref={spotlightInputRef}
                placeholder="Lookup Identification or Asset Name..."
                className="h-16 w-full border-none bg-transparent pl-20 pr-40 text-2xl font-black tracking-tight focus-visible:ring-0 placeholder:text-muted-foreground/20 placeholder:uppercase placeholder:text-sm placeholder:tracking-[0.3em]"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                    if (e.key === 'Escape' && !barcode) setIsSearchModalOpen(false);
                }}
            />
            <div className="absolute right-8 flex items-center gap-3">
                {barcode && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-destructive/10 hover:text-destructive group/clear" onClick={handleClear}>
                        <X className="h-5 w-5 transition-transform group-hover/clear:rotate-90" />
                    </Button>
                )}
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 shadow-inner" onClick={() => setIsScannerOpen(true)}>
                    <ScanBarcode className="h-6 w-6" />
                </Button>
                <Button variant="default" size="icon" className="h-12 w-12 rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all" onClick={handleSearch} disabled={!barcode || isLoading}>
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRight className="h-6 w-6" />}
                </Button>
            </div>
          </div>

          {/* RESULTS AREA */}
          <div className="max-h-[65vh] min-h-[300px] overflow-y-auto bg-muted/[0.01] px-4 py-6 sm:px-8">
            {hasSearched ? (
                results.length > 0 ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
                        {results.map((item) => (
                            <div 
                                key={`spotlight-${item.id}`} 
                                className="group relative flex items-center justify-between p-4 sm:p-6 rounded-3xl border border-white/[0.03] bg-white/[0.02] hover:bg-primary/[0.04] hover:border-primary/20 transition-all duration-300"
                            >
                                <div className="flex items-center gap-6 min-w-0">
                                    <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-inner">
                                        <Layers className="h-7 w-7 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h4 className="text-lg font-black text-slate-900 dark:text-white truncate tracking-tight mb-1">{item.productName}</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono font-bold bg-muted/50 px-2 py-0.5 rounded-md text-muted-foreground tracking-tighter uppercase">{item.barcode}</span>
                                            <Separator orientation="vertical" className="h-3 bg-white/10" />
                                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                                                <MapPin className="h-3 w-3" /> {item.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8 shrink-0">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-primary tracking-tighter leading-none">{item.quantity}</span>
                                            <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Units</span>
                                        </div>
                                        <div className={cn("mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest", item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600")}>
                                            <Tag className="h-2 w-2" /> {item.itemType}
                                        </div>
                                    </div>

                                    {role === 'admin' ? (
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                            <Button variant="outline" size="sm" onClick={() => {setCurrentItemToEdit(item); setIsEditDialogOpen(true);}} className="h-10 w-10 p-0 rounded-xl bg-background border-primary/10 hover:bg-primary/5 hover:text-primary transition-colors shadow-sm"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="outline" size="sm" onClick={() => {setSelectedItemForReturn(item); setIsReturnDialogOpen(true);}} disabled={item.quantity <= 0} className="h-10 w-10 p-0 rounded-xl bg-background border-primary/10 hover:bg-primary/5 hover:text-primary transition-colors shadow-sm"><Undo2 className="h-4 w-4" /></Button>
                                            <Button variant="outline" size="sm" onClick={() => {setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true);}} className="h-10 w-10 p-0 rounded-xl bg-background border-destructive/10 hover:bg-destructive/5 hover:text-destructive transition-colors shadow-sm"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ) : (
                                        <div className="opacity-20">
                                            <ChevronRight className="h-6 w-6" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-700">
                        <div className="bg-muted/30 p-10 rounded-[4rem] mb-8 border border-white/5 shadow-inner">
                            <PackageSearch className="h-24 w-24 text-muted-foreground/10" strokeWidth={1} />
                        </div>
                        <h3 className="text-3xl font-black text-muted-foreground/40 uppercase tracking-tighter">Zero Logs Identified</h3>
                        <p className="text-sm text-muted-foreground/60 mt-4 max-w-sm mx-auto font-medium leading-relaxed">
                            No active inventory registries match the search criteria for: <span className="font-mono text-primary font-black bg-primary/5 px-2 py-0.5 rounded ml-1">{lastSearchedBarcode}</span>
                        </p>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-40 animate-pulse transition-all duration-1000">
                    <div className="relative mb-10">
                        <Cpu className="h-24 w-24 text-primary/30" strokeWidth={1.5} />
                        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary/80">System Command Terminal Active</p>
                </div>
            )}
          </div>
          
          {/* FOOTER */}
          <div className="bg-muted/40 border-t border-white/5 p-5 flex justify-between items-center px-10">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        <kbd className="bg-background/80 border border-white/10 rounded-lg px-2.5 py-1 shadow-sm text-foreground">ESC</kbd> <span>Terminate</span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        <kbd className="bg-background/80 border border-white/10 rounded-lg px-2.5 py-1 shadow-sm text-foreground">ENTER</kbd> <span>Execute</span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        <kbd className="bg-background/80 border border-white/10 rounded-lg px-2.5 py-1 shadow-sm text-foreground">ALT + /</kbd> <span>Quick Launch</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                    <Activity className="h-3 w-3 text-primary animate-pulse" />
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60 italic">Industrial Core v4.1</p>
                </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* SCANNER MODAL */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-[3rem] border-none shadow-[0_0_100px_rgba(0,0,0,0.6)]">
              <DialogHeader className="p-10 pb-4 bg-muted/40">
                  <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 uppercase text-primary">
                      <ScanBarcode className="h-9 w-9" strokeWidth={3} /> Optical Capture
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-muted-foreground/80 mt-2">Engaging high-frequency visual identification system.</DialogDescription>
              </DialogHeader>
              <div id={SCANNER_REGION_ID} className="w-full aspect-square [&>span]:hidden bg-black relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/60 z-10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-primary/40 rounded-[2.5rem] z-20 animate-pulse shadow-[0_0_60px_rgba(var(--primary),0.4)]" />
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-primary/30 z-30 animate-[bounce_3s_infinite]" />
              </div>
              <div className="p-8 bg-muted/40">
                  <Button variant="outline" onClick={() => setIsScannerOpen(false)} className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 hover:text-destructive border-white/5 text-base transition-all active:scale-95">
                    Abort Optical Scan
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* ACTION DIALOGS */}
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
