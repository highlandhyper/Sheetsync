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
    Barcode as BarcodeIcon, 
    CalendarDays, 
    AlertTriangle, 
    Tag, 
    Pencil, 
    History, 
    Loader2, 
    Image as ImageIcon, 
    X,
    MapPin,
    User,
    Layers,
    ChevronRight,
    Info,
    Clock
} from 'lucide-react';
import { ItemAuditLogDialog } from '@/components/audit/item-audit-log-dialog';
import { fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
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
                    title: "No Image Found", 
                    description: "No visual data identified for this barcode.", 
                    variant: "destructive" 
                });
            }
        } else {
            toast({ 
                title: "Lookup Failed", 
                description: res.message || "Visual identification offline.", 
                variant: "destructive" 
            });
        }
    } catch (err) {
        console.error("External lookup error:", err);
    } finally {
        setIsFetchingImage(false);
    }
  };

  if (!item) return null;

  const isItemExpired = item.expiryDate ? isValid(parseISO(item.expiryDate)) && parseISO(item.expiryDate) < new Date() : false;

  let formattedTimestamp = "N/A";
  if (item.timestamp) {
    const parsedTs = parseISO(item.timestamp);
    if (isValid(parsedTs)) {
      formattedTimestamp = format(parsedTs, 'dd MMM yyyy, HH:mm');
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

  const SimpleNode = ({ icon: Icon, label, value, variant }: { icon: any, label: string, value: string, variant?: 'destructive' | 'primary' }) => (
    <div className="flex items-start gap-3 py-1">
        <div className={cn("p-1.5 rounded-md mt-0.5", variant === 'destructive' ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
            <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-1">{label}</p>
            <p className={cn("text-sm font-bold", variant === 'destructive' ? "text-destructive" : "text-foreground")}>{value}</p>
        </div>
    </div>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) setIsAuditLogOpen(false);
        onOpenChange(open);
    }}>
      <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background">
        <div className="flex flex-col max-h-[85vh]">
            {/* CLEAN HEADER */}
            <div className="p-6 pb-4 border-b bg-muted/20 shrink-0">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-1 min-w-0">
                        <Badge variant="outline" className="text-[9px] font-black uppercase bg-background border-muted px-2 py-0.5 mb-2">
                            Inventory Log
                        </Badge>
                        <DialogTitle className="text-xl font-black text-foreground truncate leading-tight">
                            {item.productName}
                        </DialogTitle>
                        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <BarcodeIcon className="h-3 w-3" />
                            {item.barcode}
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10 shrink-0 rounded-xl" 
                        onClick={handleFetchImage}
                        disabled={isFetchingImage}
                    >
                        {isFetchingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* STOCK LEVEL */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/10 bg-primary/5">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-primary" />
                        <span className="text-xs font-black uppercase text-primary/60 tracking-widest">In Stock Registry</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-primary leading-none">{item.quantity}</span>
                        <span className="text-[10px] font-bold text-primary/40 uppercase">Units</span>
                    </div>
                </div>

                {/* DATA GROUPS */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Logistic Data</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <SimpleNode icon={MapPin} label="Zone" value={item.location} />
                            <SimpleNode 
                                icon={item.itemType === 'Damage' ? AlertTriangle : Tag} 
                                label="Type" 
                                value={item.itemType} 
                                variant={item.itemType === 'Damage' ? 'destructive' : undefined}
                            />
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Audit Trace</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <SimpleNode 
                                icon={CalendarDays} 
                                label="Lifecycle Expiry" 
                                value={formattedExpiryDate}
                                variant={isItemExpired && item.itemType === 'Expiry' ? 'destructive' : undefined}
                            />
                            <SimpleNode 
                                icon={User} 
                                label="Logged By" 
                                value={item.staffName}
                            />
                             <SimpleNode 
                                icon={Clock} 
                                label="System Timestamp" 
                                value={formattedTimestamp}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-6 bg-muted/20 border-t flex flex-col gap-3 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        variant="outline" 
                        className="font-bold text-xs h-10 rounded-lg" 
                        onClick={() => setIsAuditLogOpen(true)}
                    >
                        <History className="mr-2 h-3.5 w-3.5" /> History
                    </Button>
                    {onStartEdit && (
                        <Button 
                            variant="outline" 
                            className="font-bold text-xs h-10 rounded-lg" 
                            onClick={handleEditClick}
                        >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Log
                        </Button>
                    )}
                </div>
                <DialogClose asChild>
                    <Button className="w-full h-11 font-black uppercase tracking-widest text-[10px] rounded-lg">
                        Close Details
                    </Button>
                </DialogClose>
            </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isImagePopupOpen} onOpenChange={setIsImagePopupOpen}>
        <DialogContent className="max-w-full sm:max-w-3xl p-0 overflow-hidden bg-white border-none h-[80vh] flex flex-col rounded-xl">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div>
                    <h3 className="font-bold text-slate-900">{item.productName}</h3>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{item.barcode}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsImagePopupOpen(false)} className="rounded-full">
                    <X className="h-5 w-5" />
                </Button>
            </div>
            <div className="relative flex-1 bg-white p-4 flex items-center justify-center overflow-hidden">
                {externalData?.image && (
                    <div className="relative w-full h-full">
                        <Image 
                            src={externalData.image} 
                            alt={item.productName}
                            fill
                            className="object-contain"
                            unoptimized
                            priority
                        />
                    </div>
                )}
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
