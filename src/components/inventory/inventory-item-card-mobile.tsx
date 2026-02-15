
'use client';

import type { InventoryItem, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, isBefore, startOfDay, isSameDay } from 'date-fns';
import {
  Barcode,
  Building,
  CalendarDays,
  Hash,
  MapPin,
  Tag,
  AlertTriangle,
  User,
  Eye,
  Edit,
  Undo2,
  Trash2,
  PlusCircle,
  DollarSign,
  Wallet,
} from 'lucide-react';

interface InventoryItemCardMobileProps {
  item: InventoryItem;
  product?: Product;
  totalQuantity?: number;
  individualItemCount?: number;
  onDetails: () => void;
  onEdit?: () => void;
  onReturn?: () => void;
  onDelete?: () => void;
  onCreateProduct?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  context?: 'staff' | 'supplier' | 'inventory';
}

export function InventoryItemCardMobile({
  item,
  product,
  totalQuantity,
  individualItemCount,
  onDetails,
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
  const isExpired = isValidExpiry && startOfDay(parsedExpiryDate!) < startOfDay(new Date()) && !isSameDay(startOfDay(parsedExpiryDate!), startOfDay(new Date()));
  const isProductFound = item.productName !== 'Not Found';
  const costPrice = product?.costPrice;
  const quantityToShow = totalQuantity ?? item.quantity;
  const isSingleItem = individualItemCount === 1;


  let formattedExpiryDate = 'N/A';
  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');
      if (isExpired) formattedExpiryDate += " (Expired)";
    } else {
      formattedExpiryDate = "Invalid Date";
    }
  }

  // For grouped view, if there are multiple expiry dates, show "Multiple"
  if (context === 'inventory' && individualItemCount && individualItemCount > 1) {
      formattedExpiryDate = "Multiple";
  }


  return (
    <Card className={cn("w-full shadow-md", isSelected && 'ring-2 ring-primary ring-offset-2')}>
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        {onSelect && (
            <div
            role="checkbox"
            aria-checked={isSelected}
            onClick={onSelect}
            className="mt-1 h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
        )}
        <div className="flex-1">
          <CardTitle className={cn("text-lg flex justify-between items-center", !isProductFound && "text-muted-foreground italic")}>
            {item.productName}
            {individualItemCount && individualItemCount > 1 && <Badge variant="secondary">{individualItemCount} logs</Badge>}
          </CardTitle>
          <CardDescription className="flex items-center text-xs">
            <Barcode className="mr-1.5 h-3.5 w-3.5" /> {item.barcode}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {context !== 'supplier' && (
            <div className="flex items-start gap-2">
              <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><span className="font-medium">Supplier</span><p className="text-muted-foreground">{item.supplierName || 'N/A'}</p></div>
            </div>
          )}
         
          <div className="flex items-start gap-2">
            <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div><span className="font-medium">In Stock</span><p className="text-muted-foreground font-semibold">{quantityToShow}</p></div>
          </div>
          {(context === 'supplier' || context === 'inventory' || context === 'staff') && costPrice !== undefined && (
             <>
                <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div><span className="font-medium">Unit Cost</span><p className="text-muted-foreground">QAR {costPrice.toFixed(2)}</p></div>
                </div>
                <div className="flex items-start gap-2">
                    <Wallet className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div><span className="font-medium">Total Value</span><p className="text-muted-foreground font-semibold">QAR {(costPrice * quantityToShow).toFixed(2)}</p></div>
                </div>
             </>
          )}
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div><span className="font-medium">Location</span><p className="text-muted-foreground">{item.location}</p></div>
          </div>
          <div className="flex items-start gap-2">
             <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground" />
             <div>
                <span className="font-medium">Expiry</span>
                <p className={cn(isExpired && isValidExpiry ? 'text-destructive' : 'text-muted-foreground')}>
                   {formattedExpiryDate}
                </p>
             </div>
          </div>
           <div className="flex items-start gap-2 col-span-2">
                {item.itemType === 'Damage' ? 
                <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" /> : 
                <Tag className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                <div>
                <span className="font-medium">Type</span>
                <p className={cn(item.itemType === 'Damage' ? 'text-orange-500' : 'text-muted-foreground')}>
                    {item.itemType}
                </p>
                </div>
           </div>
           {context === 'inventory' && (
             <div className="flex items-start gap-2 col-span-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                <span className="font-medium">Logged By</span>
                <p className="text-muted-foreground">{item.staffName}</p>
                </div>
              </div>
           )}
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-2 flex justify-end gap-2">
        {context === 'inventory' ? (
          isSingleItem ? (
            <>
              <Button variant="outline" size="sm" onClick={onDetails}><Eye className="mr-2 h-4 w-4" />Details</Button>
              {onReturn && <Button variant="outline" size="sm" onClick={onReturn} disabled={item.quantity === 0}><Undo2 className="mr-2 h-4 w-4" />Return</Button>}
              {onDelete && <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onDetails} className="w-full">
              <Eye className="mr-2 h-4 w-4" /> View {individualItemCount || 1} Log(s)
            </Button>
          )
        ) : isProductFound ? (
          <>
            {onEdit && <Button variant="ghost" size="sm" onClick={onEdit}><Edit className="mr-2 h-4 w-4" />Edit</Button>}
            {onReturn && <Button variant="outline" size="sm" onClick={onReturn} disabled={item.quantity === 0}><Undo2 className="mr-2 h-4 w-4" />Return</Button>}
            {onDelete && <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
          </>
        ) : (
          onCreateProduct && <Button variant="default" size="sm" onClick={onCreateProduct}><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
        )}
      </CardFooter>
    </Card>
  );
}
