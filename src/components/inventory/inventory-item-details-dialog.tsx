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
import type { InventoryItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Package, User, CalendarDays, AlertTriangle, Tag, Barcode as BarcodeIcon, Building, Pencil, History, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { ItemAuditLogDialog } from '@/components/audit/item-audit-log-dialog';
import { fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface InventoryItemDetailsDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStartEdit?: (item: InventoryItem) => void; 
  displayContext?: 'returnByStaff' | 'default' | 'returnBySupplier';
}

export function InventoryItemDetailsDialog({
  item,
  isOpen,
  onOpenChange,
  onStartEdit,
  displayContext = 'default'
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
    }
  }, [isOpen]);

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
                toast({ title: "No Image", description: "No visual data found in global registries.", variant: "destructive" });
            }
        } else {
            toast({ title: "Lookup Failed", description: res.message || "Product not found.", variant: "destructive" });
        }
    } catch (err) {
        console.error("Failed to fetch image:", err);
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
      formattedTimestamp = format(parsedTs, 'PPp');
    } else {
      formattedTimestamp = "Invalid timestamp";
    }
  }

  let formattedExpiryDate = "N/A";
  if (item.expiryDate) {
    const parsedExpDate = parseISO(item.expiryDate);
    if (isValid(parsedExpDate)) {
      formattedExpiryDate = format(parsedExpDate, 'PP');
      if (isItemExpired) {
        formattedExpiryDate += " (Expired)";
      }
    } else {
      formattedExpiryDate = "Invalid date";
    }
  }

  const handleEditClick = () => {
    if (onStartEdit && item) {
      onOpenChange(false);
      onStartEdit(item);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) setIsAuditLogOpen(false);
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <div className="p-6">
            <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center text-xl">
                <Package className="mr-2 h-5 w-5 text-primary" />
                {item.productName}
            </DialogTitle>
            <DialogDescription>
                {externalData?.brand ? (
                    <span className="font-bold text-primary mr-2 uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-full tracking-widest">{externalData.brand}</span>
                ) : null}
                Internal log details for this inventory asset.
            </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm mt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <BarcodeIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Barcode:</span>
                        <span className="ml-2 text-muted-foreground font-mono">{item.barcode}</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] font-bold px-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" 
                        onClick={handleFetchImage}
                        disabled={isFetchingImage}
                    >
                        {isFetchingImage ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                            <ImageIcon className="mr-1 h-3 w-3" />
                        )}
                        VIEW IMAGE
                    </Button>
                </div>

                <Separator />

                {displayContext === 'returnByStaff' ? (
                    <div className="flex items-center">
                    <Building className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Supplier:</span>
                    <span className="ml-2 text-muted-foreground">{item.supplierName || 'N/A'}</span>
                    </div>
                ) : ( 
                    <div className="flex items-center">
                    <User className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Logged by:</span>
                    <span className="ml-2 text-muted-foreground">{item.staffName}</span>
                    </div>
                )}

                <div className="flex items-center">
                    <CalendarDays className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Logged on:</span>
                    <span className="ml-2 text-muted-foreground">
                    {formattedTimestamp}
                    </span>
                </div>

                <Separator />

                <div className="flex items-center">
                    <Building className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                    <span className="ml-2 text-muted-foreground">{item.location}</span>
                </div>

                <div className="flex items-center">
                    <CalendarDays className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Expiry Date:</span>
                    <span className={`ml-2 ${isItemExpired && item.itemType === 'Expiry' ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {formattedExpiryDate}
                    </span>
                </div>

                <div className="flex items-center">
                    {item.itemType === 'Damage' ?
                    <AlertTriangle className="mr-3 h-4 w-4 text-orange-500" /> :
                    <Tag className="mr-3 h-4 w-4 text-muted-foreground" />
                    }
                    <span className="font-medium">Item Type:</span>
                    <span className={`ml-2 ${item.itemType === 'Damage' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {item.itemType}
                    </span>
                </div>

                <Separator />
            </div>

            <DialogFooter className="mt-8 flex justify-between items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAuditLogOpen(true)}>
                    <History className="mr-2 h-4 w-4" /> History
                </Button>
                <div className="flex items-center gap-2">
                {onStartEdit && (
                    <Button type="button" variant="outline" size="sm" onClick={handleEditClick}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                )}
                <DialogClose asChild>
                    <Button type="button" variant="secondary" size="sm">
                    Close
                    </Button>
                </DialogClose>
                </div>
            </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isImagePopupOpen} onOpenChange={setIsImagePopupOpen}>
        <DialogContent className="max-w-full sm:max-w-lg p-0 overflow-hidden bg-white border-none shadow-2xl h-full sm:h-auto flex flex-col">
            <DialogHeader className="p-4 border-b bg-white shrink-0">
                <DialogTitle className="text-sm font-bold truncate pr-8 text-slate-900">{item.productName}</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary">
                    {externalData?.brand || 'Product Verification Image'}
                </DialogDescription>
            </DialogHeader>
            <div className="relative flex-1 w-full flex items-center justify-center p-4 sm:p-8 bg-white min-h-0">
                {externalData?.image ? (
                    <Image 
                        src={externalData.image} 
                        alt={item.productName}
                        fill
                        className="object-contain p-4 sm:p-6"
                        unoptimized
                    />
                ) : null}
                <button 
                    onClick={() => setIsImagePopupOpen(false)}
                    className="absolute top-4 right-4 p-2 bg-slate-100/80 backdrop-blur hover:bg-slate-200 rounded-full transition-colors z-50 shadow-sm"
                >
                    <X className="h-6 w-6 text-slate-600" />
                </button>
            </div>
            <div className="p-4 bg-slate-50 border-t shrink-0 flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono text-slate-500 font-bold">Barcode: {item.barcode}</p>
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
