'use client';

import type { InventoryItem, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, startOfDay, isSameDay, isBefore } from 'date-fns';
import { memo } from 'react';
import {
  Barcode,
  Building,
  CalendarDays,
  Hash,
  Tag,
  AlertTriangle,
  User,
  Eye,
  Pencil,
  Undo2,
  Trash2,
  PlusCircle,
  DollarSign,
  Wallet,
  Clock,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';

interface InventoryItemCardMobileProps {
  item: InventoryItem;
  product?: Product;
  totalQuantity?: number;
  individualItemCount?: number;
  onDetails: () => void;
  onViewImage?: () => void;
  onEdit?: () => void;
  onReturn?: () => void;
  onDelete?: () => void;
  onCreateProduct?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  context?: 'staff' | 'supplier' | 'inventory';
}

function InventoryItemCardMobileComponent({
  item,
  product,
  totalQuantity,
  individualItemCount,
  onDetails,
  onViewImage,
  onEdit,
  onReturn,
  onDelete,
  onCreateProduct,
  isSelected,
  onSelect,
  context = 'inventory',
}: InventoryItemCardMobileProps) {
  const parsedExpiryDate = item.expiryDate ? parseISO(item.expiryDate) : null;
  const isValidExpiry = !!parsedExpiryDate && isValid(parsedExpiryDate);
  // TURBO EXPIRE: Classify today as expired for UI consistency and mail protocol
  const isExpired = isValidExpiry && (isBefore(startOfDay(parsedExpiryDate!), startOfDay(new Date())) || isSameDay(parsedExpiryDate!, new Date()));
  const isProductFound = item.productName !== 'Not Found';
  const costPrice = product?.costPrice;
  const quantityToShow = totalQuantity ?? item.quantity;
  const isSingleItem = !individualItemCount || individualItemCount === 1;

  let formattedExpiryDate = 'N/A';
  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');
      if (isExpired) formattedExpiryDate += " (Expired)";
    } else {
      formattedExpiryDate = "Invalid Date";
    }
  }

  if (context === 'inventory' && individualItemCount && individualItemCount > 1) {
      formattedExpiryDate = "Multiple";
  }

  const formattedTimestamp = item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm') : 'N/A';

  return (
    <Card className={cn("w-full shadow-md overflow-hidden", isSelected && 'ring-2 ring-primary ring-offset-2')}>
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        {onSelect && (
            <div
            role="checkbox"
            aria-checked={isSelected}
            onClick={onSelect}
            className="mt-1 h-5 w-5 shrink-0 rounded-md border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center cursor-pointer transition-all"
          >
            {isSelected && <div className="h-2.5 w-2.5 bg-primary-foreground rounded-sm" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <CardTitle className={cn("text-lg flex justify-between items-center gap-2", !isProductFound && "text-muted-foreground italic")}>
            <span className="truncate">{item.productName}</span>
            {individualItemCount && individualItemCount > 1 && <Badge variant="secondary" className="shrink-0">{individualItemCount} logs</Badge>}
          </CardTitle>
          <CardDescription className="flex items-center text-xs font-mono">
            <Barcode className="mr-1.5 h-3.5 w-3.5" /> {item.barcode}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {context !== 'supplier' && (
            <div className="flex items-start gap-2 min-w-0">
              <Building className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />
              <div className="min-w-0"><span className="font-bold text-[10px] uppercase text-muted-foreground block">Supplier</span><p className="text-muted-foreground truncate">{item.supplierName || 'N/A'}</p></div>
            </div>
          )}
         
          <div className="flex items-start gap-2">
            <Hash className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />
            <div><span className="font-bold text-[10px] uppercase text-muted-foreground block">In Stock</span><p className="text-primary font-black text-base leading-none">{quantityToShow}</p></div>
          </div>

          {(context === 'supplier' || context === 'inventory' || context === 'staff') && costPrice !== undefined && (
             <div className="flex items-start gap-2 col-span-2 p-2 bg-primary/5 rounded-xl border border-primary/10">
                <Wallet className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="grid grid-cols-2 gap-4 w-full">
                    <div><span className="font-bold text-[9px] uppercase text-primary/60 block">Unit Cost</span><p className="text-xs font-bold">QAR {costPrice.toFixed(2)}</p></div>
                    <div><span className="font-bold text-[9px] uppercase text-primary/60 block">Total Value</span><p className="text-sm font-black text-primary">QAR {(costPrice * quantityToShow).toFixed(2)}</p></div>
                </div>
             </div>
          )}

          <div className="flex items-start gap-2">
             <MapPin className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />
             <div><span className="font-bold text-[10px] uppercase text-muted-foreground block">Zone</span><p className="text-muted-foreground font-medium">{item.location}</p></div>
          </div>

          <div className="flex items-start gap-2">
             <CalendarDays className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />
             <div>
                <span className="font-bold text-[10px] uppercase text-muted-foreground block">Expiry</span>
                <p className={cn("text-xs font-medium", isExpired && isValidExpiry ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                   {formattedExpiryDate}
                </p>
             </div>
          </div>

           <div className="flex items-start gap-2">
                {item.itemType === 'Damage' ? 
                <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" /> : 
                <Tag className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />}
                <div>
                <span className="font-bold text-[10px] uppercase text-muted-foreground block">Type</span>
                <p className={cn("text-xs font-bold", item.itemType === 'Damage' ? 'text-orange-500' : 'text-primary/60')}>
                    {item.itemType}
                </p>
                </div>
           </div>

           <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-primary/40 shrink-0" />
              <div>
                <span className="font-bold text-[10px] uppercase text-muted-foreground block">Identity</span>
                <p className="text-muted-foreground text-[10px] font-black uppercase truncate">{item.staffName}</p>
              </div>
           </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 p-2 flex flex-wrap justify-end gap-2 border-t">
        {onViewImage && (
            <Button variant="outline" size="sm" onClick={onViewImage} className="h-9 bg-primary/5 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest flex-1">
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Visual
            </Button>
        )}
        {context === 'inventory' ? (
          isSingleItem ? (
            <>
              <Button variant="outline" size="sm" onClick={onDetails} className="h-9 font-bold flex-1"><Eye className="mr-1.5 h-3.5 w-3.5" />Details</Button>
              {onEdit && <Button variant="ghost" size="sm" onClick={onEdit} className="h-9 font-bold text-primary"><Pencil className="h-3.5 w-3.5" /></Button>}
              {onReturn && <Button variant="outline" size="sm" onClick={onReturn} disabled={item.quantity === 0} className="h-9 font-bold text-primary"><Undo2 className="h-3.5 w-3.5" /></Button>}
              {onDelete && <Button variant="ghost" size="sm" onClick={onDelete} className="h-9 font-bold text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></Button>}
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onDetails} className="w-full h-10 font-black uppercase text-[10px] tracking-widest">
              <Eye className="mr-2 h-4 w-4" /> View {individualItemCount || 1} Industrial Logs
            </Button>
          )
        ) : isProductFound ? (
          <>
            {onEdit && <Button variant="ghost" size="sm" onClick={onEdit} className="h-9 font-bold text-primary"><Pencil className="h-3.5 w-3.5" /></Button>}
            {onReturn && <Button variant="outline" size="sm" onClick={onReturn} disabled={item.quantity === 0} className="h-9 font-bold text-primary"><Undo2 className="h-3.5 w-3.5" /></Button>}
            {onDelete && <Button variant="ghost" size="sm" onClick={onDelete} className="h-9 font-bold text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></Button>}
          </>
        ) : (
          onCreateProduct && <Button variant="default" size="sm" onClick={onCreateProduct} className="font-bold flex-1 h-9"><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
        )}
      </CardFooter>
    </Card>
  );
}

export const InventoryItemCardMobile = memo(InventoryItemCardMobileComponent);
