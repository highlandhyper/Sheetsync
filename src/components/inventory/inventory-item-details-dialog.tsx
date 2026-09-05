'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { InventoryItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { 
    Package, 
    User, 
    CalendarDays, 
    AlertTriangle, 
    Tag, 
    Barcode as BarcodeIcon, 
    Building, 
    Pencil, 
    History, 
    Loader2, 
    Image as ImageIcon, 
    X,
    MapPin,
    Clock,
    ShieldCheck,
    Hash,
    Layers,
    ChevronRight
} from 'lucide-react';
import { ItemAuditLogDialog } from '@/components/audit/item-audit-log-dialog';
import { fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface InventoryItemDetailsDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStartEdit?: (item: InventoryItem) => void; 
  displayContext?: 'returnByStaff' | 'default' | 'returnBySupplier';
  autoFetchImage?: boolean;
}

export function InventoryItemDetailsDialog({
  item,
  isOpen,
  onOpenChange,
  onStartEdit,
  displayContext = 'default',
  autoFetchImage = false,
}: InventoryItemDetailsDialogProps) {
  const { toast } = useToast();
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [externalData, setExternalData] = useState<{ image?: string; brand?: string; name?: string } | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  
  useEffect(() => {
    if (!isOpen) {
        setExternalData(null);
        setIsFetchingImage(false);
        setIsImagePopupOpen(false);
    } else if (autoFetchImage && item?.barcode) {
        handleFetchImage();
    }
  }, [isOpen, autoFetchImage, item?.barcode]);

  const handleFetchImage = async () => {
    if (!item?.barcode) return;
    
    setIsFetchingImage(true);
    
    try {
        const res = await fetchProductExternalDataAction(item.barcode);
        if (res.success && res.data) {
            setExternalData(res.data);
            if (res.data.image) {
                setIsImagePopupOpen(true);
            } else {
                toast({ 
                    title: "Visual ID Missing", 
                    description: "No global imagery found for this SKU.", 
                    variant: "destructive" 
                });
            }
        } else {
            toast({ 
                title: "Lookup Failed", 
                description: res.message || "Visual registry handshake failed.", 
                variant: "destructive" 
            });
        }
    } catch (err) {
        console.error("External lookup error:", err);
        toast({ 
            title: "Registry Timeout", 
            description: "Visual service temporarily unavailable.", 
            variant: "destructive" 
        });
    } finally {
        setIsFetchingImage(false);
    }
  };

  if (!item) return null;

  const isItemExpired = item.expiryDate ? isValid(parseISO(item.expiryDate)) && parseISO(item.expiryDate) < new Date() : false;

  let formattedTimestamp = "Not available";
  if (item.timestamp) {
    const parsedTs = parseISO(item.timestamp);
    if (isValid(parsedTs)) {
      formattedTimestamp = format(parsedTs, 'dd MMM yyyy • HH:mm');
    }
  }

  let formattedExpiryDate = "N/A";
  if (item.expiryDate) {
    const parsedExpDate = parseISO(item.expiryDate);
    if (isValid(parsedExpDate)) {
      formattedExpiryDate = format(parsedExpDate, 'dd MMM yyyy');
    }
  }

  const handleEditClick = () => {
    if (onStartEdit && item) {
      onOpenChange(false);
      onStartEdit(item);
    }
  };

  const DataNode = ({ icon: Icon, label, value, subValue, variant = 'default', color = 'primary' }: { icon: any, label: string, value: string, subValue?: string, variant?: 'default' | 'alert', color?: 'primary' | 'orange' }) => (
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/20 border border-white/5 shadow-inner group transition-all hover:bg-muted/30">
          <div className={cn(
              "p-2.5 rounded-xl transition-all duration-500 group-hover:scale-110",
              color === 'primary' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500",
              variant === 'alert' && "animate-pulse"
          )}>
              <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-[0.2em] leading-none mb-1.5">{label}</p>
              <p className={cn(
                  "text-sm font-black uppercase tracking-tight truncate",
                  variant === 'alert' ? "text-destructive" : "text-slate-900 dark:text-white"
              )}>
                  {value}
              </p>
              {subValue && <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">{subValue}</p>}
          </div>
      </div>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) setIsAuditLogOpen(false);
        onOpenChange(open);
    }}>
      <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-background">
        <div className="flex flex-col max-h-[90vh]">
            {/* ATMOSPHERIC HEADER */}
            <div className="relative p-8 pb-6 bg-muted/20 border-b border-white/5 overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-tech-grid opacity-10" />
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">
                            Industrial Log Node
                        </Badge>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 text-[10px] font-black px-4 bg-background/50 border-primary/20 text-primary shadow-sm hover:bg-primary/5 transition-all" 
                            onClick={handleFetchImage}
                            disabled={isFetchingImage}
                        >
                            {isFetchingImage ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <ImageIcon className="mr-2 h-3.5 w-3.5" />
                            )}
                            VISUAL ID
                        </Button>
                    </div>
                    
                    <DialogHeader>
                        <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-tight">
                            {item.productName}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-2 mt-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background px-2 py-0.5 rounded border border-white/10">
                                <BarcodeIcon className="h-3 w-3 mr-1.5" />
                                {item.barcode}
                            </span>
                            {externalData?.brand && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 border-l border-white/10 pl-2">
                                    {externalData.brand}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                </div>
            </div>

            {/* SCROLLABLE CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8">
                {/* PRIMARY STOCK NODE */}
                <div className="p-6 rounded-[2rem] bg-primary/5 border-2 border-primary/10 flex items-center justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-tech-grid opacity-20" />
                    <div className="relative z-10 flex items-center gap-5">
                        <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                            <Layers className="h-8 w-8 text-white" strokeWidth={3} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary/60 tracking-[0.3em] leading-none mb-1.5">In Stock Registry</p>
                            <div className="flex items-baseline gap-2 leading-none">
                                <h4 className="text-4xl font-black text-primary tracking-tighter">{item.quantity}</h4>
                                <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest">Active Units</span>
                            </div>
                        </div>
                    </div>
                    <ChevronRight className="h-6 w-6 text-primary/10 relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-2 opacity-40">Logistic Context</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <DataNode 
                                icon={MapPin} 
                                label="Storage Zone" 
                                value={item.location} 
                            />
                            <DataNode 
                                icon={item.itemType === 'Damage' ? AlertTriangle : Tag} 
                                label="Log Type" 
                                value={item.itemType}
                                color={item.itemType === 'Damage' ? 'orange' : 'primary'}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-2 opacity-40">Temporal Audit</Label>
                        <div className="grid grid-cols-1 gap-3">
                            <DataNode 
                                icon={CalendarDays} 
                                label="Lifecycle Expiry" 
                                value={formattedExpiryDate}
                                subValue={isItemExpired ? "CRITICAL: EXPIRED" : "Nominal Window"}
                                variant={isItemExpired && item.itemType === 'Expiry' ? 'alert' : 'default'}
                            />
                            <DataNode 
                                icon={User} 
                                label="Operating Personnel" 
                                value={item.staffName}
                                subValue={formattedTimestamp}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* HIGH-VELOCITY FOOTER */}
            <div className="p-8 bg-muted/20 border-t border-white/5 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] border-white/10 hover:bg-primary/5 hover:text-primary transition-all active:scale-95" 
                        onClick={() => setIsAuditLogOpen(true)}
                    >
                        <History className="mr-2 h-4 w-4" /> Audit History
                    </Button>
                    {onStartEdit && (
                        <Button 
                            variant="outline" 
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] border-white/10 hover:bg-primary/5 hover:text-primary transition-all active:scale-95" 
                            onClick={handleEditClick}
                        >
                            <Pencil className="mr-2 h-4 w-4" /> Modify Node
                        </Button>
                    )}
                </div>
                <DialogClose asChild>
                    <Button className="w-full h-16 rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 text-white transition-all active:scale-95 border-none">
                        Terminate View
                    </Button>
                </DialogClose>
            </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isImagePopupOpen} onOpenChange={setIsImagePopupOpen}>
        <DialogContent className="max-w-full sm:max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl h-[90vh] sm:h-auto flex flex-col">
            <DialogHeader className="p-6 border-b bg-white shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold truncate pr-12 text-slate-900">{item.productName}</DialogTitle>
                        <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2 mt-1">
                            {externalData?.brand || 'Product Verification Asset'}
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="font-mono text-slate-500">{item.barcode}</span>
                        </DialogDescription>
                    </div>
                    <button 
                        onClick={() => setIsImagePopupOpen(false)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors shadow-sm"
                    >
                        <X className="h-6 w-6 text-slate-600" />
                    </button>
                </div>
            </DialogHeader>
            <div className="relative flex-1 w-full flex items-center justify-center p-4 sm:p-12 bg-white min-h-[300px] overflow-hidden">
                {externalData?.image ? (
                    <div className="relative w-full h-[60vh] sm:h-[75vh]">
                        <Image 
                            src={externalData.image} 
                            alt={item.productName}
                            fill
                            className="object-contain"
                            unoptimized
                            priority
                            sizes="(max-width: 768px) 100vw, 80vw"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                        <ImageIcon className="h-20 w-20 opacity-20" />
                        <p className="font-medium">No Image Available</p>
                    </div>
                )}
            </div>
            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter italic">Industrial Visual Identification System</p>
            </div>
        </DialogContent>
    </Dialog>

    {item && (
      <ItemAuditLogDialog
        isOpen={isAuditLogOpen}
        onOpenChange={setIsAuditLogOpen}
        targetId={item.id}
        productName={item.productName}
      />
    )}
  </>
  );
}
