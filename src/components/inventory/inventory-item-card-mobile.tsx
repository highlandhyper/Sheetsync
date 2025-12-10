'use client';

import type { InventoryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, isBefore, startOfDay, isSameDay } from 'date-fns';
import {
  Barcode,
  Building,
  CalendarDays,
  Hash,
  MapPin,
  Package,
  Tag,
  AlertTriangle,
  User,
  Eye,
  Edit,
  Undo2,
  Trash2,
  PlusCircle,
} from 'lucide-react';

interface InventoryItemCardMobileProps {
  item: InventoryItem;
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

  let formattedExpiryDate = 'N/A';
  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');
      if (isExpired) formattedExpiryDate += " (Expired)";
    } else {
      formattedExpiryDate = "Invalid Date";
    }
  }

  return (
    <Card className={cn("w-full shadow-md", isSelected && 'ring-2 ring-primary ring-offset-2')}>
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        {onSelect && (
            <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="mt-1"
            aria-label={`Select item ${item.productName}`}
            />
        )}
        <div className="flex-1">
          <CardTitle className={cn("text-lg", !isProductFound && "text-muted-foreground italic")}>
            {item.productName}
          </CardTitle>
          <CardDescription className="flex items-center text-xs">
            <Barcode className="mr-1.5 h-3.5 w-3.5" /> {item.barcode}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onDetails} className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {context === 'staff' ? (
             <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><span className="font-medium">Supplier</span><p className="text-muted-foreground">{item.supplierName || 'N/A'}</p></div>
             </div>
          ): (
             <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><span className="font-medium">Logged by</span><p className="text-muted-foreground">{item.staffName}</p></div>
             </div>
          )}
         
          <div className="flex items-start gap-2">
            <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div><span className="font-medium">In Stock</span><p className="text-muted-foreground">{item.quantity}</p></div>
          </div>
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
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-2 flex justify-end gap-2">
         {isProductFound ? (
             <>
                {onEdit && <Button variant="ghost" size="icon" onClick={onEdit} className="h-9 w-9"><Edit className="h-4 w-4" /></Button>}
                {onReturn && <Button variant="outline" size="icon" onClick={onReturn} disabled={item.quantity === 0} className="h-9 w-9"><Undo2 className="h-4 w-4" /></Button>}
                {onDelete && <Button variant="destructive" size="icon" onClick={onDelete} className="h-9 w-9"><Trash2 className="h-4 w-4" /></Button>}
             </>
         ) : (
            onCreateProduct && <Button variant="default" size="sm" onClick={onCreateProduct}><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
         )}
      </CardFooter>
    </Card>
  );
}
