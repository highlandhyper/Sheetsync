'use client';

import * as React from 'react';
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
    Barcode,
    Eye
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
import { InventoryItemDetailsDialog } from '@/components/inventory/inventory-item-details-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '../ui/badge';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';

const SCANNER_REGION_ID = "barcode-lookup-scanner-region";

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
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
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
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

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
      // STRICT BARCODE MATCHING: Non-fuzzy identification per directive
      const normalizedInput = cleanBarcode.replace(/^0+/, '');
      const filtered = inventoryItems.filter(i => {
          if (i.quantity <= 0) return false;
          const normalizedItemBarcode = i.barcode.replace(/^0+/, '');
          return i.barcode === cleanBarcode || normalizedItemBarcode === normalizedInput;
      });
      
      setSearchResults(filtered);
      if (filtered.length === 0) {
        toast({ variant: 'destructive', title: 'Identity Zero', description: `No records for SKU: ${cleanBarcode}` });
      }
    });
  }, [inventoryItems, toast]);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;
    playProfessionalBeep();
    setBarcodeToSearch(decodedText);
    setIsScannerDialogOpen(false);
    executeSearch(decodedText);
    setTimeout(() => { scanProcessedRef.current = false; }, 1000);
  }, [executeSearch]);

  useEffect(() => {
    if (isScannerDialogOpen) {
      const timer = setTimeout(() => {
        if (html5QrcodeScannerRef.current) return;
        const scanner = new Html5Qrcode(SCANNER_REGION_ID, false);
        scanner.start({ facingMode: 'environment' }, { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, onScanSuccess, () => {}).then(() => {
          html5QrcodeScannerRef.current = scanner;
        }).catch(() => {
          setIsScannerDialogOpen(false);
        });
      }, 800);
      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(() => {});
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerDialogOpen, onScanSuccess]);

  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false); 
    setIsDeleteDialogOpen(false); 
    setIsEditDialogOpen(false); 
    setIsDetailsDialogOpen(false);
  }, []);

  const handleOpenDetails = (item: InventoryItem) => {
    setSelectedItemForDetails(item);
    setIsDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="shadow-none border-white/10 bg-card/40 rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-grow">
               <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
               <input type="text" placeholder="SCAN OR ENTER BARCODE..." value={barcodeToSearch} onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)} className="w-full h-14 bg-muted/10 border border-white/5 rounded-2xl pl-12 pr-4 text-lg font-black tracking-tight focus:outline-none focus:border-primary/20 transition-all placeholder:text-muted-foreground/20 placeholder:font-black placeholder:uppercase placeholder:text-xs placeholder:tracking-[0.2em]" />
              {barcodeToSearch && (
                  <button onClick={() => setBarcodeToSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-destructive/10 rounded-xl text-muted-foreground/30 hover:text-destructive transition-all"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="flex gap-2 h-14">
                <Button onClick={() => setIsScannerDialogOpen(true)} variant="outline" className="flex-1 sm:flex-none px-6 h-full rounded-2xl border-white/5 font-black uppercase tracking-widest text-[10px]"><ScanBarcode className="mr-2 h-5 w-5 text-primary" /> Scan</Button>
                <Button onClick={() => executeSearch(barcodeToSearch)} disabled={isLoading || !barcodeToSearch.trim()} className="flex-1 sm:flex-none px-8 h-full rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]">{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}<span className="ml-2">Lookup</span></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary/40" strokeWidth={3} />
            <h3 className="text-lg font-black uppercase tracking-[0.2em] text-primary/40 animate-pulse mt-4">Identifying...</h3>
        </div>
      )}

      {!isLoading && hasSearched && searchResults.length > 0 && (
        <div className="space-y-6">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-xl"><Layers className="h-5 w-5 text-primary" /></div><h2 className="text-xl font-black uppercase tracking-tight">System Records Found</h2></div></div>
            <div className="hidden md:block">
                <Card className="shadow-none border-white/10 overflow-hidden rounded-2xl">
                    <Table>
                    <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] uppercase font-black">Timestamp</TableHead><TableHead className="text-right text-[10px] uppercase font-black">Units</TableHead><TableHead className="text-[10px] uppercase font-black">Zone</TableHead><TableHead className="text-[10px] uppercase font-black">Staff</TableHead><TableHead className="text-[10px] uppercase font-black">Expiry</TableHead>{role === 'admin' && <TableHead className="text-center text-[10px] uppercase font-black">Action</TableHead>}</TableRow></TableHeader>
                    <TableBody>
                        {searchResults.map((item) => (
                            <TableRow key={item.id} className="group hover:bg-primary/[0.01] transition-colors"><TableCell className="text-xs font-mono text-muted-foreground">{item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell><TableCell className="text-right font-black text-primary text-base">{item.quantity}</TableCell><TableCell><div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-bold text-sm">{item.location}</span></div></TableCell><TableCell className="text-xs font-black uppercase tracking-tight text-muted-foreground">{item.staffName}</TableCell><TableCell className="text-xs font-medium">{item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'None'}</TableCell>{role === 'admin' && (<TableCell className="text-center"><div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-8 w-8 hover:bg-primary/5 text-primary"><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-8 w-8 hover:bg-primary/5 text-primary"><Undo2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/5 text-destructive"><Trash2 className="h-4 w-4" /></Button></div></TableCell>)}</TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </Card>
            </div>
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {searchResults.map((item) => (
                    <InventoryItemCardMobile key={`card-lookup-${item.id}`} item={item} product={productsByBarcode.get(item.barcode)} onDetails={() => handleOpenDetails(item)} onReturn={role === 'admin' ? () => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); } : undefined} onEdit={role === 'admin' ? () => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} onDelete={role === 'admin' ? () => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); } : undefined} context="inventory" />
                ))}
            </div>
        </div>
      )}

      {hasSearched && !isLoading && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center"><div className="bg-muted/10 p-8 rounded-2xl mb-6 border-2 border-dashed border-white/5"><PackageSearch className="h-16 w-16 text-muted-foreground/10" strokeWidth={1} /></div><h3 className="text-xl font-black uppercase tracking-tighter text-muted-foreground/40">Zero Inventory Match</h3><p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto font-medium">Barcode <span className="text-primary font-black">{lastSearchedBarcode}</span> is currently not in active zones.</p><Button variant="outline" className="mt-8 rounded-2xl border-white/10 font-black uppercase tracking-widest text-[9px]" onClick={() => setHasSearched(false)}><FilterX className="mr-2 h-4 w-4" /> Reset Identification</Button></div>
      )}

      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}><DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-black"><DialogHeader className="p-8 pb-4 bg-zinc-900/50 absolute top-0 left-0 right-0 z-20"><DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase text-primary"><ScanBarcode className="h-8 w-8" /> Visual Capture</DialogTitle><DialogDescription className="text-xs font-medium text-zinc-400">Position barcode within the frame.</DialogDescription></DialogHeader><div className="relative scanner-container h-[400px] w-full"><div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" /><div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /><div className="scanner-corner scanner-corner-tl" /><div className="scanner-corner scanner-corner-tr" /><div className="scanner-corner scanner-corner-bl" /><div className="scanner-corner scanner-corner-br" /></div></div></div><div className="p-6 bg-zinc-900/50 border-t border-white/10 relative z-20"><Button variant="outline" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-destructive border-white/5 transition-all">Abort Scan</Button></div></DialogContent></Dialog>

      <ReturnQuantityDialog key={selectedItemForReturn ? `lookup-return-${selectedItemForReturn.id}` : 'lookup-return'} item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />
      <DeleteConfirmationDialog key={selectedItemForDeletion ? `lookup-delete-${selectedItemForDeletion.id}` : 'lookup-delete'} item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={handleActionSuccess} />
      <EditInventoryItemDialog key={currentItemToEdit ? `lookup-edit-${currentItemToEdit.id}` : 'lookup-edit'} item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />
      <InventoryItemDetailsDialog key={selectedItemForDetails ? `lookup-details-${selectedItemForDetails.id}` : 'lookup-details'} item={selectedItemForDetails} isOpen={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} onStartEdit={role === 'admin' ? (item) => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} />
    </div>
  );
}
