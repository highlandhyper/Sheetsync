'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryItem } from '@/lib/types';
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import { Edit, Undo2, Trash2, CalendarDays, User as UserIcon, Tag, AlertTriangle, Image as ImageIcon, Loader2, X, Barcode } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '../ui/separator';
import { fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

export interface GroupedInventoryItem {
  mainItem: InventoryItem;
  individualItems: InventoryItem[];
  totalQuantity: number;
}

interface InventoryItemGroupDetailsDialogProps {
  group: GroupedInventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReturnDialog: (item: InventoryItem) => void;
  onOpenEditDialog: (item: InventoryItem) => void;
  onOpenDeleteDialog: (item: InventoryItem) => void;
  onActionSuccess: () => void;
}

export function InventoryItemGroupDetailsDialog({
  group,
  isOpen,
  onOpenChange,
  onOpenReturnDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
}: InventoryItemGroupDetailsDialogProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
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
    if (!group?.mainItem?.barcode) return;
    
    setIsFetchingImage(true);
    
    try {
        const res = await fetchProductExternalDataAction(group.mainItem.barcode);
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

  if (!group) return null;

  const renderItemDetails = (item: InventoryItem) => {
    const isExpired = item.expiryDate && isValid(parseISO(item.expiryDate)) ? isBefore(startOfDay(parseISO(item.expiryDate)), startOfDay(new Date())) : false;
    
    if (isMobile) {
      return (
        <div key={item.id} className="rounded-lg border bg-card/50 p-3 text-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-base">{item.quantity} <span className="text-sm font-normal text-muted-foreground">in stock</span></p>
              <p className="text-xs text-muted-foreground">{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</p>
            </div>
             {role === 'admin' && (
                <div className="flex flex-shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenReturnDialog(item)} disabled={item.quantity <= 0} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenDeleteDialog(item)} className="h-8 w-8 text-destructive/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3">
             <div className="flex items-start gap-2">
              <div><span className="font-medium">Location</span><p className="text-muted-foreground">{item.location}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <UserIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div><span className="font-medium">Logged By</span><p className="text-muted-foreground">{item.staffName}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Expiry</span>
                <p className={cn(isExpired ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                  {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
                </p>
              </div>
            </div>
             <div className="flex items-start gap-2">
              {item.itemType === 'Damage' ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-500" /> : <Tag className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />}
              <div>
                <span className="font-medium">Type</span>
                <p className={cn(item.itemType === 'Damage' ? 'text-orange-500' : 'text-muted-foreground')}>{item.itemType}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <TableRow key={item.id}>
        <TableCell className="text-xs">{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</TableCell>
        <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
        <TableCell>{item.location}</TableCell>
        <TableCell className={cn(isExpired ? 'text-destructive font-semibold' : '')}>
          {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
        </TableCell>
        <TableCell className={cn(item.itemType === 'Damage' ? 'text-orange-500' : '')}>{item.itemType}</TableCell>
        <TableCell>{item.staffName}</TableCell>
        {role === 'admin' && (
          <TableCell className="text-center">
            <div className="flex justify-center items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenReturnDialog(item)} disabled={item.quantity <= 0} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenDeleteDialog(item)} className="h-8 w-8 text-destructive/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
        <div className="p-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <DialogHeader className="flex-grow">
                    <DialogTitle className="flex items-center text-xl">
                        {group.mainItem.productName}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex items-center flex-wrap gap-2 pt-1 text-sm text-muted-foreground">
                            {externalData?.brand && (
                                <span className="font-bold text-primary uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-full tracking-widest">{externalData.brand}</span>
                            )}
                            <span className="font-mono text-xs text-muted-foreground flex items-center">
                                <Barcode className="h-3 w-3 mr-1" /> {group.mainItem.barcode}
                            </span>
                            <Separator orientation="vertical" className="h-3 mx-1 hidden sm:block" />
                            <span>{group.totalQuantity} units in stock</span>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="shrink-0">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[10px] font-bold px-3 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary w-full sm:w-auto" 
                        onClick={handleFetchImage}
                        disabled={isFetchingImage}
                    >
                        {isFetchingImage ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        VIEW PRODUCT IMAGE
                    </Button>
                </div>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-4">
           {isMobile ? (
              <div className="space-y-3 py-2">
                  {group.individualItems.map(renderItemDetails)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logged At</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Logged By</TableHead>
                    {role === 'admin' && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.individualItems.map(renderItemDetails)}
                </TableBody>
              </Table>
            )}
        </div>
        <DialogFooter className="p-6 pt-2 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full sm:w-auto">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isImagePopupOpen} onOpenChange={setIsImagePopupOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-white border-none shadow-2xl">
            <DialogHeader className="p-4 border-b bg-white">
                <DialogTitle className="text-sm font-bold truncate pr-8 text-slate-900">{group.mainItem.productName}</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary">
                    {externalData?.brand || 'Product Verification Image'}
                </DialogDescription>
            </DialogHeader>
            <div className="relative w-full aspect-square flex items-center justify-center p-8 bg-white">
                {externalData?.image ? (
                    <Image 
                        src={externalData.image} 
                        alt={group.mainItem.productName}
                        fill
                        className="object-contain p-6"
                        unoptimized
                    />
                ) : null}
                <button 
                    onClick={() => setIsImagePopupOpen(false)}
                    className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-50"
                >
                    <X className="h-5 w-5 text-slate-600" />
                </button>
            </div>
            <div className="p-4 bg-slate-50 border-t flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono text-slate-500">Barcode: {group.mainItem.barcode}</p>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
