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
    Terminal
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
        <div className="flex items-center gap-3 p-4 bg-muted/10 border border-white/5 rounded-2xl shadow-inner">
            <div className={cn("p-2 rounded-lg bg-background border border-white/5", colorClass || "text-primary")}>
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="text-[8px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-1">{label}</p>
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32">
      <Card className="border-white/5 bg-primary/5 dark:bg-primary/[0.02] rounded-[2.5rem] overflow-hidden shadow-none">
        <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6 px-1">
                <Terminal className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Identity Terminal</span>
            </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <div className="relative flex-grow group p-1 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 transition-all focus-within:border-primary/20">
               <Barcode className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/20 group-focus-within:text-primary transition-colors" strokeWidth={3} />
               <input 
                    type="text" 
                    placeholder="ENTER REGISTRY BARCODE..." 
                    value={barcodeToSearch} 
                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())} 
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)} 
                    className="w-full h-16 sm:h-20 bg-transparent border-none rounded-2xl pl-16 pr-12 text-xl sm:text-2xl font-black tracking-tighter focus:ring-0 placeholder:text-muted-foreground/10 placeholder:font-black placeholder:uppercase placeholder:text-xs placeholder:tracking-[0.4em]" 
                />
              {barcodeToSearch && (
                  <button onClick={() => setBarcodeToSearch('')} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground/20 hover:text-destructive transition-all"><X className="h-5 w-5" /></button>
              )}
            </div>
            <div className="flex gap-3 h-16 sm:h-22 items-center">
                <Button onClick={() => setIsScannerDialogOpen(true)} variant="outline" className="flex-1 sm:flex-none px-8 h-full rounded-2xl sm:rounded-[1.5rem] border-white/5 bg-background/50 backdrop-blur-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all hover:bg-primary/5 active:scale-95">
                    <Scan className="mr-3 h-6 w-6 text-primary" /> Scan
                </Button>
                <Button onClick={() => executeSearch(barcodeToSearch)} disabled={isLoading || !barcodeToSearch.trim()} className="flex-1 sm:flex-none px-12 h-full rounded-2xl sm:rounded-[1.5rem] shadow-2xl shadow-primary/20 font-black uppercase tracking-[0.2em] text-[10px] bg-primary text-white hover:bg-primary/90 transition-all active:scale-95">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" strokeWidth={3} />}<span className="ml-3">Identify</span>
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-32 text-center animate-pulse">
            <div className="relative">
                <Loader2 className="h-20 w-20 animate-spin text-primary/20" strokeWidth={1} />
                <Loader2 className="absolute inset-0 h-20 w-20 animate-[spin_3s_linear_infinite] text-primary" strokeWidth={3} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.6em] text-primary mt-8">Establishing Link</h3>
            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-2">Querying Master Registry Core...</p>
        </div>
      )}

      {!isLoading && hasSearched && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {matchedProduct && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <Card className="lg:col-span-8 border-white/5 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-zinc-900 dark:to-black text-white rounded-[2.5rem] overflow-hidden shadow-2xl relative group">
                        <div className="absolute inset-0 bg-tech-grid opacity-30" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] transition-all duration-1000 group-hover:bg-primary/20" />
                        
                        <CardContent className="p-8 sm:p-10 relative z-10 flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
                            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-[2rem] bg-white/10 backdrop-blur-xl border-2 border-white/10 flex items-center justify-center shrink-0 shadow-2xl transition-transform duration-700 group-hover:scale-110">
                                <ShieldCheck className="h-12 w-12 sm:h-16 sm:w-16 text-primary" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 font-black text-[9px] uppercase tracking-[0.3em] px-3 py-1">Verified SKU Master</Badge>
                                <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-tight truncate">{matchedProduct.productName}</h2>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-white/40">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{matchedProduct.supplierName || 'NO MASTER VENDOR'}</span>
                                    </div>
                                    <div className="h-1 w-1 rounded-full bg-white/20" />
                                    <div className="flex items-center gap-2">
                                        <Barcode className="h-4 w-4" />
                                        <span className="font-mono text-xs font-bold tracking-tighter">{matchedProduct.barcode}</span>
                                    </div>
                                </div>
                            </div>
                            {matchedProduct.costPrice && (
                                <div className="p-6 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/10 shrink-0 shadow-inner">
                                    <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-1">Unit Valuation</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs font-bold opacity-40 uppercase">QAR</span>
                                        <span className="text-3xl font-black tracking-tighter leading-none">{matchedProduct.costPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {resultStats && (
                        <div className="lg:col-span-4 grid grid-cols-1 gap-4 h-full">
                            <StatNode icon={Box} label="Active Units" value={resultStats.totalQty} colorClass="text-primary" />
                            <StatNode icon={MapPin} label="Active Zones" value={resultStats.zones} colorClass="text-blue-500" />
                            <StatNode icon={AlertTriangle} label="Damage Logs" value={resultStats.damaged} colorClass="text-orange-500" />
                        </div>
                    )}
                </div>
            )}

            {searchResults.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-muted/20 rounded-2xl border border-white/5">
                                <History className="h-6 w-6 text-muted-foreground/60" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Temporal Registry Feed</h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-1">Live Historical Audit Traces</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="font-black uppercase tracking-[0.2em] text-[8px] bg-primary/5 text-primary border-primary/20 py-2 px-6 rounded-full shadow-sm">
                            {searchResults.length} VERIFIED TRACES IDENTIFIED
                        </Badge>
                    </div>

                    <div className="hidden md:block">
                        <Card className="shadow-2xl border-white/5 overflow-hidden rounded-[2.5rem] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl">
                            <Table>
                                <TableHeader className="bg-muted/10 border-b border-white/5">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] pl-10 h-16 text-muted-foreground/40">Timestamp</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40 text-right">Volume</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">Storage Zone</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">Identity Node</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-[0.3em] h-16 text-muted-foreground/40">Lifecycle</TableHead>
                                        {role === 'admin' && <TableHead className="text-center text-[10px] uppercase font-black tracking-[0.3em] h-16 pr-10 text-muted-foreground/40">Protocol</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResults.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-primary/[0.02] transition-colors h-20 border-white/5">
                                            <TableCell className="text-[10px] font-mono font-black text-muted-foreground/40 pl-10 tracking-tighter">
                                                {item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm:ss') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xl font-black text-primary leading-none tabular-nums">{item.quantity}</span>
                                                    <span className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-widest mt-1">UNITS</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-muted/40 rounded-xl text-muted-foreground/40">
                                                        <MapPin className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-black text-sm tracking-tight uppercase text-slate-800 dark:text-slate-200">{item.location}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Fingerprint className="h-4 w-4 text-muted-foreground/20" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.staffName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={cn("inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", item.itemType === 'Damage' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600")}>
                                                    {item.itemType}
                                                </div>
                                            </TableCell>
                                            {role === 'admin' && (
                                                <TableCell className="text-center pr-10">
                                                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-10 w-10 rounded-xl hover:bg-primary/5 text-primary"><Edit className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-10 w-10 rounded-xl hover:bg-primary/5 text-primary"><Undo2 className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-10 w-10 rounded-xl hover:bg-destructive/5 text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
                                onDetails={() => handleOpenDetails(item)} 
                                onReturn={role === 'admin' ? () => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); } : undefined} 
                                onEdit={role === 'admin' ? () => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} 
                                onDelete={role === 'admin' ? () => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); } : undefined} 
                                context="inventory" 
                            />
                        ))}
                    </div>
                </div>
            ) : hasSearched && !isLoading && (
                <div className="flex flex-col items-center justify-center py-40 text-center animate-in zoom-in-95 duration-700">
                    <div className="bg-muted/10 p-12 rounded-[3.5rem] mb-8 border-4 border-dashed border-white/5 shadow-inner">
                        <PackageSearch className="h-24 w-24 text-muted-foreground/10" strokeWidth={1} />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter text-muted-foreground/20 leading-none">Zero Registry Volume</h3>
                    <p className="text-sm text-muted-foreground/40 mt-4 max-w-xs font-medium uppercase tracking-widest leading-relaxed">
                        SKU <span className="text-primary font-black">{lastSearchedBarcode}</span> has no identified stock nodes in active warehouse zones.
                    </p>
                    <Button variant="outline" className="mt-10 rounded-2xl border-primary/20 text-primary font-black uppercase tracking-[0.2em] text-[10px] px-10 h-12 hover:bg-primary/5 transition-all" onClick={() => setHasSearched(false)}>
                        <FilterX className="mr-3 h-4 w-4" /> Reset Search Command
                    </Button>
                </div>
            )}
        </div>
      )}

      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-black">
            <DialogHeader className="p-8 pb-4 bg-zinc-900/50 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase text-primary">
                    <Scan className="h-8 w-8" /> Visual Capture
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-zinc-400">Position barcode within the optical target frame.</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[400px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay">
                    <div className="scanner-focus">
                        <div className="scanner-laser" />
                        <div className="scanner-corner scanner-corner-tl" />
                        <div className="scanner-corner scanner-corner-tr" />
                        <div className="scanner-corner scanner-corner-bl" />
                        <div className="scanner-corner scanner-corner-br" />
                    </div>
                </div>
            </div>
            <div className="p-6 bg-zinc-900/50 border-t border-white/10 relative z-20">
                <Button variant="outline" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-destructive border-white/5 transition-all active:scale-95">
                    Abort Protocol
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <ReturnQuantityDialog key={selectedItemForReturn ? `lookup-return-${selectedItemForReturn.id}` : 'lookup-return'} item={selectedItemForReturn} isOpen={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen} onReturnSuccess={handleActionSuccess} />
      <DeleteConfirmationDialog key={selectedItemForDeletion ? `lookup-delete-${selectedItemForDeletion.id}` : 'lookup-delete'} item={selectedItemForDeletion} isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onSuccess={handleActionSuccess} />
      <EditInventoryItemDialog key={currentItemToEdit ? `lookup-edit-${currentItemToEdit.id}` : 'lookup-edit'} item={currentItemToEdit} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSuccess={handleActionSuccess} uniqueLocationsFromDb={uniqueLocations} />
      <InventoryItemDetailsDialog key={selectedItemForDetails ? `lookup-details-${selectedItemForDetails.id}` : 'lookup-details'} item={selectedItemForDetails} isOpen={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} onStartEdit={role === 'admin' ? (item) => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); } : undefined} />
    </div>
  );
}