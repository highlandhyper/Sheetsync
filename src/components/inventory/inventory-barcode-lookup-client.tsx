'use client';

import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Search, 
    PackageSearch, 
    Loader2, 
    Undo2, 
    ScanBarcode, 
    Trash2, 
    Edit, 
    Layers, 
    MapPin, 
    X,
    FilterX,
    Barcode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { Html5Qrcode } from 'html5-qrcode';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '../ui/badge';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';

const SCANNER_REGION_ID = "barcode-scanner-region";

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

export function InventoryBarcodeLookupClient() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const { inventoryItems, uniqueLocations, products: cachedProducts } = useDataCache();
  
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
  const scanProcessedRef = useRef(false);

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);
  
  const executeSearch = useCallback(async (barcode: string) => {
    if (!barcode || !barcode.trim()) return;
    const cleanBarcode = barcode.trim();
    setHasSearched(true);
    setLastSearchedBarcode(cleanBarcode);
    
    startSearchTransition(async () => {
      const filtered = inventoryItems.filter(i => i.barcode === cleanBarcode && i.quantity > 0);
      setSearchResults(filtered);
      
      if (filtered.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Identity Null',
          description: `No active stock records for SKU: ${cleanBarcode}`,
        });
      }
    });
  }, [inventoryItems, toast]);

  useEffect(() => {
    if (hasSearched && lastSearchedBarcode) {
      const filtered = inventoryItems.filter(i => i.barcode === lastSearchedBarcode && i.quantity > 0);
      setSearchResults(filtered);
    }
  }, [inventoryItems, hasSearched, lastSearchedBarcode]);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;

    playProfessionalBeep();
    setBarcodeToSearch(decodedText);
    setIsScannerDialogOpen(false);
    executeSearch(decodedText);

    setTimeout(() => {
        scanProcessedRef.current = false;
    }, 1000);
  }, [executeSearch]);

  useEffect(() => {
    if (isScannerDialogOpen) {
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
        }).catch(() => {
          toast({ variant: 'destructive', title: 'Hardware Error', description: 'Optical system failed to initialize.' });
          setIsScannerDialogOpen(false);
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
  }, [isScannerDialogOpen, onScanSuccess, toast]);

  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setIsEditDialogOpen(false);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="shadow-2xl border-white/10 bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden group">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-grow">
               <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
               <input
                type="text"
                placeholder="SCAN OR ENTER BARCODE KEY..."
                value={barcodeToSearch}
                onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)}
                className="w-full h-14 bg-muted/20 border border-white/5 rounded-2xl pl-12 pr-4 text-lg font-black tracking-tight focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/20 placeholder:font-black placeholder:uppercase placeholder:text-xs placeholder:tracking-[0.2em]"
              />
              {barcodeToSearch && (
                  <button 
                    onClick={() => setBarcodeToSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-destructive/10 rounded-xl text-muted-foreground/30 hover:text-destructive transition-all"
                  >
                      <X className="h-4 w-4" />
                  </button>
              )}
            </div>
            
            <div className="flex gap-2 h-14">
                <Button 
                    onClick={() => setIsScannerDialogOpen(true)}
                    variant="outline" 
                    className="flex-1 sm:flex-none px-6 h-full rounded-2xl border-white/10 font-black uppercase tracking-widest text-xs hover:bg-primary/5 hover:text-primary"
                >
                    <ScanBarcode className="mr-2 h-5 w-5" /> Scan
                </Button>
                <Button 
                    onClick={() => executeSearch(barcodeToSearch)} 
                    disabled={isLoading || !barcodeToSearch.trim()} 
                    className="flex-1 sm:flex-none px-8 h-full rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-xs"
                >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    <span className="ml-2">Identify</span>
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
                <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" strokeWidth={1} />
                <Loader2 className="absolute inset-0 h-16 w-16 animate-[spin_3s_linear_infinite] text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.3em] text-primary animate-pulse">Scanning Registry...</h3>
        </div>
      )}

      {!isLoading && hasSearched && searchResults.length > 0 && (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl">
                    <Layers className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Verified Records Found</h2>
            </div>
            
            <div className="hidden md:block">
                <Card className="shadow-2xl border-white/10 overflow-hidden rounded-2xl">
                    <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                        <TableHead className="text-[10px] uppercase font-black">Logged At</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-black">Units</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Zone</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Staff</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Expiry</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Classification</TableHead>
                        {role === 'admin' && <TableHead className="text-center text-[10px] uppercase font-black">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {searchResults.map((item) => (
                            <TableRow key={item.id} className="group hover:bg-primary/[0.02] transition-colors">
                                <TableCell className="text-xs font-mono text-muted-foreground">
                                    {item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right font-black text-primary text-base">
                                    {item.quantity}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="font-bold text-sm">{item.location}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-black uppercase tracking-tight text-muted-foreground">
                                    {item.staffName}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                    {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'None'}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-black uppercase tracking-widest py-1 border-none",
                                        item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600"
                                    )}>
                                        {item.itemType}
                                    </Badge>
                                </TableCell>
                                {role === 'admin' && (
                                    <TableCell className="text-center">
                                    <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-8 w-8 hover:bg-primary/10 text-primary"><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-8 w-8 hover:bg-primary/10 text-primary"><Undo2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:hidden">
                {searchResults.map((item) => (
                    <InventoryItemCardMobile
                        key={`card-lookup-${item.id}`}
                        item={item}
                        product={productsByBarcode.get(item.barcode)}
                        onDetails={() => {}}
                        onReturn={role === 'admin' ? () => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); } : undefined}
                        onEdit={role === 'admin' ? () => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined}
                        onDelete={role === 'admin' ? () => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); } : undefined}
                        context="inventory"
                    />
                ))}
            </div>
        </div>
      )}

      {hasSearched && !isLoading && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
            <div className="bg-muted/20 p-8 rounded-[2.5rem] mb-6 shadow-inner border-2 border-dashed border-white/5">
                <PackageSearch className="h-20 w-20 text-muted-foreground/10" strokeWidth={1} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-muted-foreground/40">Zero Inventory Match</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto font-medium opacity-60">
                The barcode <span className="text-primary font-black">{lastSearchedBarcode}</span> is currently not identified in any active storage zones.
            </p>
            <Button variant="outline" className="mt-8 rounded-2xl border-white/10 font-black uppercase tracking-widest text-[10px]" onClick={() => setHasSearched(false)}>
                <FilterX className="mr-2 h-4 w-4" /> Reset Identification
            </Button>
          </div>
      )}

      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            <DialogHeader className="p-8 pb-4 bg-muted/40">
                <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase text-primary">
                    <ScanBarcode className="h-8 w-8" /> Visual Capture
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground/80">Position barcode within the identification frame.</DialogDescription>
            </DialogHeader>
            <div id={SCANNER_REGION_ID} className="w-full aspect-square bg-black" />
            <div className="p-6 bg-muted/40">
                <Button variant="outline" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-destructive border-white/5 transition-all">
                  Abort Scan
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <ReturnQuantityDialog key={selectedItemForReturn ? `lookup-return-${selectedItemForReturn.id}` : 'lookup-return'} item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />
      <DeleteConfirmationDialog key={selectedItemForDeletion ? `lookup-delete-${selectedItemForDeletion.id}` : 'lookup-delete'} item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={handleActionSuccess} />
      <EditInventoryItemDialog key={currentItemToEdit ? `lookup-edit-${currentItemToEdit.id}` : 'lookup-edit'} item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />
    </div>
  );
}
