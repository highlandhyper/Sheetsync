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
    Barcode,
    ShieldCheck,
    Building,
    Box,
    AlertTriangle,
    History,
    Fingerprint,
    Layers,
    Clock
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
        <div className="flex items-center gap-3 p-3 bg-muted/20 border border-white/5 rounded-xl">
            <div className={cn("p-1.5 rounded-lg bg-background", colorClass || "text-primary/40")}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
                <p className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-widest leading-none mb-0.5">{label}</p>
                <p className="text-sm font-black tracking-tight text-slate-700 dark:text-slate-300">{value}</p>
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
        toast({ variant: 'destructive', title: 'Zero Records', description: `No active stock identified for SKU: ${cleanBarcode}` });
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
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">
      {/* PROFESSIONAL COMMAND SEARCH */}
      <div className="max-w-3xl mx-auto w-full">
          <div className="relative group p-1 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-[2rem] transition-all duration-700">
              <div className="flex flex-col sm:flex-row gap-0 bg-background/95 backdrop-blur-xl rounded-[1.9rem] overflow-hidden border border-white/5 shadow-2xl">
                  <div className="relative flex-grow">
                      <Barcode className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                      <input 
                          type="text" 
                          placeholder="IDENTIFY ASSET OR SCAN..." 
                          value={barcodeToSearch} 
                          onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())} 
                          onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)} 
                          className="w-full h-16 sm:h-20 bg-transparent border-none pl-16 pr-12 text-lg sm:text-xl font-black tracking-tight focus:ring-0 placeholder:text-muted-foreground/10 placeholder:font-black uppercase placeholder:text-[10px] placeholder:tracking-[0.4em]" 
                      />
                      {barcodeToSearch && (
                          <button onClick={() => setBarcodeToSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-destructive/10 rounded-full text-muted-foreground/30 hover:text-destructive transition-all">
                              <X className="h-4 w-4" />
                          </button>
                      )}
                  </div>
                  <div className="p-2 sm:p-3 flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-white/5">
                      <Button onClick={() => setIsScannerDialogOpen(true)} variant="ghost" className="h-12 sm:h-14 px-6 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-primary/5 text-primary transition-all">
                          <Scan className="mr-2 h-4 w-4" /> Optical
                      </Button>
                      <Button onClick={() => executeSearch(barcodeToSearch)} disabled={isLoading || !barcodeToSearch.trim()} className="h-12 sm:h-14 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 transition-all active:scale-95">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          <span className="ml-3">Identify</span>
                      </Button>
                  </div>
              </div>
          </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary/20 mb-6" strokeWidth={3} />
            <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.5em]">Establishing Registry Handshake...</p>
        </div>
      ) : hasSearched && (
        <div className="space-y-12 animate-in fade-in duration-700">
            {matchedProduct && (
                <div className="space-y-10">
                    {/* CLEAN MINIMAL IDENTITY CARD */}
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="p-8 sm:p-12 rounded-[2.5rem] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl border border-white/5 flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
                            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                                <ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12 text-primary" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20 px-3 py-1">Verified Registry Node</Badge>
                                    <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{matchedProduct.productName}</h2>
                                </div>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 text-muted-foreground/40">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        <span className="text-[11px] font-black uppercase tracking-widest">{matchedProduct.supplierName || 'NO VENDOR'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                        <Barcode className="h-4 w-4" />
                                        <span className="tracking-widest">{matchedProduct.barcode}</span>
                                    </div>
                                </div>
                            </div>
                            {matchedProduct.costPrice && (
                                <div className="p-6 bg-muted/10 rounded-3xl border border-white/5 shrink-0 min-w-[180px] text-right shadow-inner">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground/30 tracking-widest mb-1.5">Asset Valuation</p>
                                    <div className="flex items-baseline justify-center sm:justify-end gap-1.5">
                                        <span className="text-xs font-black text-primary/40 uppercase tracking-tighter">QAR</span>
                                        <span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">{matchedProduct.costPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {resultStats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
                            <StatNode icon={Layers} label="Registry Volume" value={`${resultStats.totalQty} Units`} colorClass="text-primary" />
                            <StatNode icon={MapPin} label="Zone Footprint" value={resultStats.zones} colorClass="text-blue-500" />
                            <StatNode icon={AlertTriangle} label="Damage Traces" value={resultStats.damaged} colorClass="text-orange-500" />
                        </div>
                    )}
                </div>
            )}

            {searchResults.length > 0 ? (
                <div className="space-y-6 max-w-6xl mx-auto w-full">
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted/50 rounded-lg">
                                <History className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">Forensic Registry Feed</h3>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-muted/5 border-white/5 text-muted-foreground/60 px-4 py-1.5 rounded-full">{searchResults.length} Verified Traces</Badge>
                    </div>

                    <div className="hidden md:block">
                        <Card className="shadow-2xl border-white/5 overflow-hidden rounded-[2rem] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl">
                            <Table>
                                <TableHeader className="bg-muted/10 border-b border-white/5">
                                    <TableRow className="h-14 hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] pl-10 text-muted-foreground/30">Timestamp</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] text-right pr-8 text-muted-foreground/30">Volume</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground/30">Zone</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground/30">Identity</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground/30">Status</TableHead>
                                        {role === 'admin' && <TableHead className="text-right text-[10px] uppercase font-black tracking-[0.3em] pr-10 text-muted-foreground/30">Protocol</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResults.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-primary/[0.02] transition-colors h-16 border-white/5">
                                            <TableCell className="text-[10px] font-mono text-muted-foreground/50 pl-10 tracking-tighter">
                                                {item.timestamp ? format(parseISO(item.timestamp), 'dd MMM yy • HH:mm') : '---'}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <span className="font-black text-base text-primary/80 tracking-tighter">{item.quantity}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-xs uppercase tracking-tight text-slate-600 dark:text-slate-400">{item.location}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Fingerprint className="h-3.5 w-3.5 text-muted-foreground/20" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.staffName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", item.itemType === 'Damage' ? "bg-orange-500" : "bg-blue-500")} />
                                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", item.itemType === 'Damage' ? "text-orange-500/80" : "text-blue-500/80")}>
                                                        {item.itemType}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            {role === 'admin' && (
                                                <TableCell className="text-right pr-10">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"><Edit className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"><Undo2 className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:hidden px-2">
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
                <div className="flex flex-col items-center justify-center py-40 text-center animate-in zoom-in-95 duration-700">
                    <div className="bg-muted/10 p-10 rounded-[3rem] mb-8 border-4 border-dashed border-white/5">
                        <PackageSearch className="h-16 w-16 text-muted-foreground/10" strokeWidth={1} />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-muted-foreground/20">Registry Match Failure</h3>
                    <p className="text-[10px] text-muted-foreground/40 mt-4 max-w-xs font-medium uppercase tracking-widest leading-relaxed px-6">
                        No active stock identified for SKU:<br/>
                        <span className="text-primary font-black mt-1 block">{lastSearchedBarcode}</span>
                    </p>
                    <Button variant="ghost" className="mt-10 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5" onClick={() => setHasSearched(false)}>
                        Purge Search Identifiers
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* OPTICAL HANDSHAKE TERMINAL */}
      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-[2.5rem] border-none bg-black">
            <DialogHeader className="p-8 pb-4 border-b border-white/5 bg-zinc-900/80 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white">Registry Visual Capture</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary">Position SKU for instant identification</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[450px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
            </div>
            <div className="p-6 bg-zinc-900/80 border-t border-white/5 relative z-20 flex justify-center">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-14 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 border-white/5">
                    Abort Scanning Protocol
                </Button>
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
