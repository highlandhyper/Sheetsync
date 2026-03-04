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
import { Package, User, CalendarDays, AlertTriangle, Tag, Barcode as BarcodeIcon, Building, Pencil, History, Loader2, Image as ImageIcon, Search, ExternalLink } from 'lucide-react';
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
  const [showImage, setShowImage] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!isOpen) {
        setShowImage(false);
        setExternalData(null);
        setIsFetchingImage(false);
        setLookupError(null);
    }
  }, [isOpen]);

  const handleFetchImage = async () => {
    if (!item?.barcode) return;
    
    setShowImage(true);
    setIsFetchingImage(true);
    setLookupError(null);
    
    try {
        const res = await fetchProductExternalDataAction(item.barcode);
        if (res.success && res.data) {
            setExternalData(res.data);
            if (!res.data.image) {
                setLookupError("Product data found, but no image URL was provided by the registry.");
            }
        } else {
            setLookupError(res.message || "Could not find this product in the global database.");
        }
    } catch (err) {
        console.error("Failed to fetch image:", err);
        setLookupError("A network error occurred while connecting to the image server.");
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
        if (!open) {
            setIsAuditLogOpen(false);
        }
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

                <Separator />

                {/* Conditional Image Section */}
                <div className="pt-2">
                    {!showImage ? (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs font-bold bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" 
                            onClick={handleFetchImage}
                        >
                            <ImageIcon className="mr-2 h-3.5 w-3.5" />
                            View Global Product Image
                        </Button>
                    ) : (
                        <div className="relative rounded-lg border bg-muted/30 overflow-hidden flex flex-col items-center justify-center min-h-[200px]">
                            {isFetchingImage ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Querying GTINHub Registry...</span>
                                </div>
                            ) : externalData?.image ? (
                                <div className="relative w-full h-48 bg-white flex flex-col">
                                    <div className="relative flex-grow">
                                        <Image 
                                            src={externalData.image} 
                                            alt={item.productName}
                                            fill
                                            className="object-contain p-4"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="bg-muted/50 p-2 text-[10px] text-center border-t flex items-center justify-center gap-2">
                                        <span className="text-muted-foreground">Source: GTINHub</span>
                                        <a href={`https://gtinhub.com/product/${item.barcode}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 font-bold">
                                            Open Website <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center px-4">
                                    {lookupError ? (
                                        <>
                                            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight leading-relaxed max-w-[200px] mx-auto">{lookupError}</p>
                                            <Button variant="link" size="sm" className="h-auto p-0 mt-2 text-xs" asChild>
                                                <a href={`https://gtinhub.com/product/${item.barcode}`} target="_blank" rel="noopener noreferrer">Try manual search</a>
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No image available for barcode {item.barcode}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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