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
        <div className="min-w-0 rounded-xl bg-muted/35 p-2.5 sm:flex sm:items-center sm:gap-3 sm:p-3">
            <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 sm:mb-0", colorClass || "text-primary")}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-[9px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 truncate text-sm font-bold tracking-tight text-foreground sm:text-base">{value}</p>
            </div>
        </div>
    );
}

export function InventoryBarcodeLookupClient() {
  const { toast } = useToast();
  const { role } = useAuth();
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
    <div className="mx-auto w-full max-w-7xl space-y-5 overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] animate-in fade-in duration-300 sm:px-4 sm:pb-8 md:px-5 lg:px-6">
      {/* INVENTORY SEARCH */}
      <div className="mx-auto w-full max-w-3xl">
          <div className="flex min-w-0 items-center gap-2">
              <div className="group relative min-w-0 flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
                  <input
                      type="text"
                      placeholder="Scan or enter barcode"
                      value={barcodeToSearch}
                      onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && executeSearch(barcodeToSearch)}
                      className="h-11 w-full rounded-xl border-0 bg-muted/40 pl-9 pr-9 text-base font-semibold uppercase text-foreground shadow-none outline-none ring-0 placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:text-muted-foreground sm:h-12 sm:text-sm"
                  />

                  {barcodeToSearch && (
                      <button
                          type="button"
                          onClick={() => setBarcodeToSearch('')}
                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Clear barcode"
                      >
                          <X className="h-3.5 w-3.5" />
                      </button>
                  )}
              </div>

              <Button
                  type="button"
                  onClick={() => setIsScannerDialogOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl bg-muted/40 text-primary shadow-none hover:bg-primary/10 sm:h-12 sm:w-12"
                  aria-label="Scan barcode"
              >
                  <Scan className="h-5 w-5" />
              </Button>

              <Button
                  type="button"
                  onClick={() => executeSearch(barcodeToSearch)}
                  disabled={isLoading || !barcodeToSearch.trim()}
                  className="h-11 shrink-0 rounded-xl px-3 text-xs font-semibold shadow-none sm:h-12 sm:px-5"
              >
                  {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                      <Search className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Search</span>
              </Button>
          </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
            <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" strokeWidth={2.5} />
            <p className="text-xs font-medium text-muted-foreground">Searching inventory…</p>
        </div>
      ) : hasSearched && (
        <div className="space-y-5 animate-in fade-in duration-300">
            {matchedProduct && (
                <div className="space-y-3">
                    {/* PRODUCT IDENTITY */}
                    <div className="mx-auto w-full max-w-4xl">
                        <div className="rounded-2xl bg-primary/[0.055] p-3.5 sm:p-5">
                            <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm sm:h-12 sm:w-12">
                                    <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Badge className="shrink-0 border-0 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary shadow-none hover:bg-primary/10">
                                            Product found
                                        </Badge>
                                    </div>

                                    <h2 className="mt-1.5 line-clamp-2 text-base font-bold leading-tight tracking-tight text-foreground sm:text-xl lg:text-2xl">
                                        {matchedProduct.productName}
                                    </h2>

                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:text-xs">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <Building className="h-3.5 w-3.5 shrink-0" />
                                            <span className="max-w-[180px] truncate sm:max-w-[320px]">
                                                {matchedProduct.supplierName || 'No supplier'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 font-mono">
                                            <Barcode className="h-3.5 w-3.5 shrink-0" />
                                            <span>{matchedProduct.barcode}</span>
                                        </div>
                                    </div>
                                </div>

                                {matchedProduct.costPrice && (
                                    <div className="shrink-0 rounded-xl bg-background/70 px-2.5 py-2 text-right sm:px-3">
                                        <p className="text-[8px] font-medium text-muted-foreground">Cost</p>
                                        <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-foreground sm:text-base">
                                            <span className="mr-1 text-[9px] font-semibold text-primary">QAR</span>
                                            {matchedProduct.costPrice.toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {resultStats && (
                        <div className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-2 sm:gap-3">
                            <StatNode icon={Layers} label="Stock" value={`${resultStats.totalQty} units`} colorClass="text-primary" />
                            <StatNode icon={MapPin} label="Locations" value={resultStats.zones} colorClass="text-blue-500" />
                            <StatNode icon={AlertTriangle} label="Damaged" value={resultStats.damaged} colorClass="text-orange-500" />
                        </div>
                    )}
                </div>
            )}

            {searchResults.length > 0 ? (
                <div className="mx-auto w-full max-w-6xl space-y-3">
                    <div className="flex min-w-0 items-center justify-between gap-3 px-0.5 sm:px-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <h3 className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">Inventory entries</h3>
                        </div>
                        <Badge className="shrink-0 border-0 bg-muted/40 px-2 py-1 text-[9px] font-semibold text-muted-foreground shadow-none hover:bg-muted/40">{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</Badge>
                    </div>

                    <div className="hidden lg:block">
                        <Card className="overflow-hidden rounded-2xl border-0 bg-muted/20 shadow-none">
                            <Table>
                                <TableHeader className="bg-muted/35">
                                    <TableRow className="h-11 border-0 hover:bg-transparent">
                                        <TableHead className="pl-5 text-[10px] font-semibold text-muted-foreground">Timestamp</TableHead>
                                        <TableHead className="pr-5 text-right text-[10px] font-semibold text-muted-foreground">Qty</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Location</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Staff</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Status</TableHead>
                                        {role === 'admin' && <TableHead className="pr-5 text-right text-[10px] font-semibold text-muted-foreground">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResults.map((item) => (
                                        <TableRow key={item.id} className="group h-14 border-border/30 transition-colors hover:bg-muted/30">
                                            <TableCell className="pl-5 font-mono text-[10px] text-muted-foreground">
                                                {item.timestamp ? format(parseISO(item.timestamp), 'dd MMM yy • HH:mm') : '---'}
                                            </TableCell>
                                            <TableCell className="pr-5 text-right">
                                                <span className="text-sm font-bold tabular-nums text-primary">{item.quantity}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs font-medium text-foreground">{item.location}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Fingerprint className="h-3.5 w-3.5 text-muted-foreground/50" />
                                                    <span className="max-w-[180px] truncate text-[10px] font-medium text-muted-foreground">{item.staffName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", item.itemType === 'Damage' ? "bg-orange-500" : "bg-blue-500")} />
                                                    <span className={cn("text-[9px] font-semibold", item.itemType === 'Damage' ? "text-orange-500" : "text-blue-500")}>
                                                        {item.itemType}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            {role === 'admin' && (
                                                <TableCell className="pr-5 text-right">
                                                    <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentItemToEdit(item); setIsEditDialogOpen(true); }} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"><Edit className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForReturn(item); setIsReturnDialogOpen(true); }} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"><Undo2 className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 lg:hidden">
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
                <div className="flex flex-col items-center justify-center py-14 text-center animate-in fade-in duration-300 sm:py-20">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
                        <PackageSearch className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">No active stock found</h3>
                    <p className="mt-1 max-w-xs px-4 text-xs leading-relaxed text-muted-foreground">
                        No inventory entry was found for
                        <span className="ml-1 font-mono font-semibold text-primary">{lastSearchedBarcode}</span>.
                    </p>
                    <Button variant="ghost" className="mt-3 h-9 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary/5" onClick={() => setHasSearched(false)}>
                        Search again
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* OPTICAL HANDSHAKE TERMINAL */}
      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border-0 bg-black p-0 shadow-2xl sm:rounded-3xl">
            <DialogHeader className="absolute inset-x-0 top-0 z-20 bg-zinc-900/85 p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-white">Barcode Scanner</DialogTitle>
                <DialogDescription className="text-[10px] text-zinc-400">Position the barcode inside the frame</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[60dvh] min-h-[300px] max-h-[450px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
            </div>
            <div className="relative z-20 flex justify-center bg-zinc-900/85 p-1.5">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="h-10 w-full rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10">
                    Close Scanner
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
