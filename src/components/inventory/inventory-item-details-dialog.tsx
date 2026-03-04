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
import { Package, User, CalendarDays, AlertTriangle, Tag, Barcode as BarcodeIcon, Building, Pencil, History, Loader2 } from 'lucide-react';
import { ItemAuditLogDialog } from '@/components/audit/item-audit-log-dialog';
import { fetchProductExternalDataAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';

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
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [externalData, setExternalData] = useState<{ image?: string; brand?: string; name?: string } | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  
  useEffect(() => {
    if (isOpen && item?.barcode) {
        setExternalData(null);
        setIsFetchingImage(true);
        fetchProductExternalDataAction(item.barcode).then(res => {
            if (res.success && res.data) {
                setExternalData(res.data);
            }
            setIsFetchingImage(false);
        }).catch(() => setIsFetchingImage(false));
    }
  }, [isOpen, item?.barcode]);

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
        if (!open) {
            setIsAuditLogOpen(false);
            setExternalData(null);
        }
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        {/* Header Section with Image */}
        <div className="relative">
            {isFetchingImage ? (
                <div className="w-full h-48 flex items-center justify-center bg-muted">
                    <Skeleton className="w-full h-full" />
                    <Loader2 className="absolute h-8 w-8 animate-spin text-primary/50" />
                </div>
            ) : externalData?.image ? (
                <div className="w-full h-48 bg-white flex items-center justify-center relative border-b overflow-hidden">
                    <Image 
                        src={externalData.image} 
                        alt={item.productName}
                        fill
                        className="object-contain p-4"
                        unoptimized // External images might not be on optimized domains
                    />
                </div>
            ) : null}
            
            <div className={externalData?.image ? "p-6 pt-4" : "p-6"}>
                <DialogHeader className="mb-2">
                <DialogTitle className="flex items-center text-xl">
                    <Package className="mr-2 h-5 w-5 text-primary" />
                    {item.productName}
                </DialogTitle>
                <DialogDescription>
                    {externalData?.brand ? (
                        <span className="font-bold text-primary mr-2 uppercase text-xs tracking-widest">{externalData.brand}</span>
                    ) : null}
                    Internal log details for this inventory asset.
                </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm mt-4">
                <div className="flex items-center">
                    <BarcodeIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Barcode:</span>
                    <span className="ml-2 text-muted-foreground font-mono">{item.barcode}</span>
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