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
    Scan, 
    Trash2, 
    Edit, 
    MapPin, 
    X,
    FilterX,
    Barcode,
    ShieldCheck,
    Building,
    Box,
    AlertTriangle,
    History,
    Fingerprint,
    Terminal,
    Layers,
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, Product } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
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

function StatNode({ icon: Icon, label, value, colorClass }: { icon: any, label: string, value: string | number, colorClass?: string }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-background border border-border/60 rounded-xl shadow-sm">
            <div className={cn("p-1.5 rounded-lg bg-muted/50", colorClass || "text-primary")}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-0.5">{label}</p>
                <p className="text-sm font-black tracking-tight">{value}</p>
            </div>
        </div>
    );
}

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

  const matchedProduct = useMemo(() => {
      if (!lastSearchedBarcode) return null;
      const normalizedTerm = lastSearchedBarcode.trim().replace(/^0+/, '');
      return cachedProducts.find(p => 
        p.barcode === lastSearchedBarcode.trim() || 
        p.barcode.replace(/^0+/, '') === normalizedTerm
      );
  }, [cachedProducts, lastSearchedBarcode]);

  const resultStats = useMemo(() => {
      if (searchResults.length === 0) return null;
      return {
          totalQty: searchResults.reduce((s, i) => s + i.quantity, 0),
          damaged: searchResults.filter(i => i.itemType === 'Damage').reduce((s, i) => s + i.quantity, 0),
          zones: new Set(searchResults.map(i => i.location)).size
      };
  }, [searchResults]);
  
  const executeSearch = useCallback(async (barcode: string) => {
    if (!barcode || !barcode.trim()) return;
    const cleanBarcode = barcode.trim();
    setHasSearched(true);
    setLastSearchedBarcode(cleanBarcode);
    
    startSearchTransition(async () => {
      const normalizedInput = cleanBarcode.replace(/^0+/, '');
      const filtered = inventoryItems.filter(i => {
          if (i.quantity <= 0) return false;
          const normalizedItemBarcode = i.barcode.replace(/^0+/, '');
          return i.barcode === cleanBarcode || normalizedItemBarcode === normalizedInput;
      });
      
      setSearchResults(filtered);
      if (filtered.length === 0) {
        toast({ variant: 'destructive', title: 'Zero Records', description: `No active stock found for SKU: ${cleanBarcode}` });
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">
      {/* MINIMAL SEARCH TERMINAL */}
      <Card className="border-border/40 bg-card/40 backdrop-blur-sm rounded-2xl overflow-hidden shadow-none border-dashed border-2">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-grow group">
               <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
               <input 
                    type="text" 
                    placeholder="ENTER SKU OR SCAN..." 
                    value={barcodeToSearch} 
                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())} 
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)} 
                    className="w-full h-12 sm:h-14 bg-background/50 border border-border/60 rounded-xl pl-12 pr-12 text-base sm:text-lg font-bold tracking-tight focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/20 placeholder:font-black uppercase placeholder:text-[10px] placeholder:tracking-[0.2em]" 
                />
              {barcodeToSearch && (
                  <button onClick={() => setBarcodeToSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground/30 hover:text-destructive transition-all"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="flex gap-2 h-12 sm:h-14">
                <Button onClick={() => setIsScannerDialogOpen(true)} variant="outline" className="flex-1 sm:flex-none px-6 h-full rounded-xl border-border/60 bg-background font-black uppercase tracking-widest text-[9px] hover:bg-muted/50 transition-all">
                    <Scan className="mr-2 h-4 w-4 text-primary" /> Scan
                </Button>
                <Button onClick={() => executeSearch(barcodeToSearch)} disabled={isLoading || !barcodeToSearch.trim()} className="flex-1 sm:flex-none px-8 h-full rounded-xl font-black uppercase tracking-widest text-[9px] shadow-sm">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-2">Identify</span>
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20 mb-4" strokeWidth={3} />
            <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.4em]">Querying Registry Core...</p>
        </div>
      ) : hasSearched && (
        <div className="space-y-8 animate-in fade-in duration-500">
            {matchedProduct && (
                <div className="space-y-6">
                    {/* CLEAN IDENTITY CARD */}
                    <Card className="border-border/60 bg-background rounded-2xl overflow-hidden shadow-sm">
                        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-primary" strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5">Verified SKU</Badge>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate tracking-tight">{matchedProduct.productName}</h2>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-muted-foreground/60">
                                    <div className="flex items-center gap-1.5">
                                        <Building className="h-3.5 w-3.5 opacity-40" />
                                        <span className="text-[10px] font-bold uppercase tracking-tight">{matchedProduct.supplierName || 'NO VENDOR'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono text-xs">
                                        <Barcode className="h-3.5 w-3.5 opacity-40" />
                                        <span className="tracking-tighter">{matchedProduct.barcode}</span>
                                    </div>
                                </div>
                            </div>
                            {matchedProduct.costPrice && (
                                <div className="p-4 bg-muted/20 rounded-xl border border-border/40 shrink-0 min-w-[140px] text-right">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">Unit Value</p>
                                    <div className="flex items-baseline justify-center sm:justify-end gap-1">
                                        <span className="text-[10px] font-bold opacity-30">QAR</span>
                                        <span className="text-2xl font-black tracking-tight">{matchedProduct.costPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {resultStats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <StatNode icon={Box} label="In Stock" value={`${resultStats.totalQty} Units`} colorClass="text-primary" />
                            <StatNode icon={MapPin} label="Zone Count" value={resultStats.zones} colorClass="text-blue-500" />
                            <StatNode icon={AlertTriangle} label="Damage Logs" value={resultStats.damaged} colorClass="text-orange-500" />
                        </div>
                    )}
                </div>
            )}

            {searchResults.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-muted-foreground/40">
                            <History className="h-4 w-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Temporal Registry Feed</h3>
                        </div>
                        <span className="text-[8px] font-black uppercase text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10">{searchResults.length} Verified Traces</span>
                    </div>

                    <div className="hidden md:block">
                        <Card className="shadow-sm border-border/60 overflow-hidden rounded-xl bg-background">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="h-12 hover:bg-transparent">
                                        <TableHead className="text-[9px] uppercase font-black tracking-widest pl-8">Timestamp</TableHead>
                                        <TableHead className="text-[9px] uppercase font-black tracking-widest text-right">Volume</TableHead>
                                        <TableHead className="text-[9px] uppercase font-black tracking-widest">Zone</TableHead>
                                        <TableHead className="text-[9px] uppercase font-black tracking-widest">Personnel</TableHead>
                                        <TableHead className="text-[9px] uppercase font-black tracking-widest">Classification</TableHead>
                                        {role === 'admin' && <TableHead className="text-right text-[9px] uppercase font-black tracking-widest pr-8">Protocol</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResults.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-muted/20 transition-colors h-14">
                                            <TableCell className="text-[10px] font-mono text-muted-foreground/60 pl-8">
                                                {item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm') : '---'}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <span className="font-black text-primary">{item.quantity}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-xs uppercase tracking-tight text-slate-700 dark:text-slate-300">{item.location}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Fingerprint className="h-3.5 w-3.5 text-muted-foreground/30" />
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{item.staffName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-tighter px-2 py-0 border-none", item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600")}>
                                                    {item.itemType}
                                                </Badge>
                                            </TableCell>
                                            {role === 'admin' && (
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/5"><Edit className="h-3.5 w-3.5" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/5"><Undo2 className="h-3.5 w-3.5" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {searchResults.map((item) => (
                            <InventoryItemCardMobile 
                                key={`lookup-mob-${item.id}`} 
                                item={item} 
                                product={productsByBarcode.get(item.barcode)} 
                                onDetails={() => handleOpenDetails(item)} 
                                onReturn={role === 'admin' ? () => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); } : undefined} 
                                onEdit={role === 'admin' ? () => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} 
                                onDelete={role === 'admin' ? () => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); } : undefined} 
                                context="inventory" 
                            />
                        ))}
                    </div>
                </div>
            ) : !isLoading && hasSearched && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="bg-muted/20 p-8 rounded-3xl mb-4 border border-border/40 border-dashed">
                        <PackageSearch className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-muted-foreground/40">Registry Match Failure</h3>
                    <p className="text-[10px] text-muted-foreground/40 mt-1 max-w-xs font-medium uppercase tracking-widest leading-relaxed">
                        No active stock logged for SKU: <span className="text-primary font-black">{lastSearchedBarcode}</span>
                    </p>
                    <Button variant="ghost" className="mt-6 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5" onClick={() => setHasSearched(false)}>
                        Clear Identifiers
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* SCANNER INTERFACE */}
      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-3xl border-none bg-black">
            <DialogHeader className="p-6 pb-2 border-b border-white/10 bg-zinc-900/50 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-lg font-black uppercase tracking-tighter text-white">Optical identification</DialogTitle>
                <DialogDescription className="text-[10px] text-zinc-400">Position SKU barcode within target frame.</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[400px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
            </div>
            <div className="p-4 bg-zinc-900/50 border-t border-white/10 relative z-20">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-12 text-xs font-black uppercase text-destructive hover:bg-destructive/10">Abort</Button>
            </div>
        </DialogContent>
      </Dialog>

      <ReturnQuantityDialog key={selectedItemForReturn ? `lookup-ret-${selectedItemForReturn.id}` : 'none-ret'} item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />
      <DeleteConfirmationDialog key={selectedItemForDeletion ? `lookup-del-${selectedItemForDeletion.id}` : 'none-del'} item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={handleActionSuccess} />
      <EditInventoryItemDialog key={currentItemToEdit ? `lookup-edt-${currentItemToEdit.id}` : 'none-edt'} item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />
      <InventoryItemDetailsDialog key={selectedItemForDetails ? `lookup-det-${selectedItemForDetails.id}` : 'none-det'} item={selectedItemForDetails} isOpen={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} onStartEdit={role === 'admin' ? (item) => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} />
    </div>
  );
}
