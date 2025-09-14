'use client';

import type { InventoryItem } from '@/lib/types';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Undo2, Eye, Pencil } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';

interface ReturnableInventoryItemRowProps {
  item: InventoryItem;
  onInitiateReturn?: (item: InventoryItem) => void; // Made optional
  onViewDetails: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
  isProcessing: boolean;
  showSupplierName?: boolean;
  showEditButtonText?: boolean; 
  disableReturnButton?: boolean; // New prop
  isSelected?: boolean;
  onSelectRow?: (id: string) => void;
}

export function ReturnableInventoryItemRow({
  item,
  onInitiateReturn,
  onViewDetails,
  onEditItem,
  isProcessing,
  showSupplierName = true,
  showEditButtonText = true, 
  disableReturnButton = false,
  isSelected = false,
  onSelectRow
}: ReturnableInventoryItemRowProps) {
  const parsedExpiryDate = item.expiryDate ? parseISO(item.expiryDate) : null;
  const isValidExpiry = !!parsedExpiryDate && isValid(parsedExpiryDate);
  const isExpired = isValidExpiry && parsedExpiryDate! < new Date();

  let formattedExpiryDate = 'N/A';
  if (item.expiryDate) { 
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');
      if (isExpired) {
        formattedExpiryDate += " (Expired)";
      }
    } else {
      formattedExpiryDate = "Invalid Date";
    }
  }

  let formattedTimestamp: string | null = null;
  if (item.timestamp) {
    const tsDate = parseISO(item.timestamp);
    if (isValid(tsDate)) {
      formattedTimestamp = format(tsDate, 'PPp');
    } else {
      // Keep as "Invalid Log Date" or similar if needed, or fallback to null/N/A
      formattedTimestamp = "Invalid Log Date";
    }
  }


  return (
    <TableRow data-state={isSelected ? 'selected' : ''} className={cn(isProcessing && "opacity-50 pointer-events-none")}>
      <TableCell className="text-center noprint">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelectRow?.(item.id)}
          aria-label={`Select row for ${item.productName}`}
        />
      </TableCell>
   <TableCell className="text-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onInitiateReturn?.(item)}
          disabled={isProcessing || item.quantity === 0 || disableReturnButton || !onInitiateReturn}
          aria-label={`Return ${item.productName}`}
          className="p-2 h-auto"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      </TableCell>
   <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(item)}
          aria-label={`View details for ${item.productName}`}
          className="p-2 h-auto"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
   <TableCell className="font-medium">{item.productName}</TableCell>
   <TableCell className="text-muted-foreground">{item.barcode}</TableCell>
   {showSupplierName && (
        <TableCell className="text-muted-foreground">{item.supplierName || 'N/A'}</TableCell>
      )}
   <TableCell className="text-right">{item.quantity}</TableCell>
   <TableCell className={cn(isExpired && isValidExpiry ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {formattedExpiryDate}
      </TableCell>
   <TableCell className="text-muted-foreground">{item.location}</TableCell>
   <TableCell className={cn(item.itemType === 'Damage' ? "text-orange-500 font-medium" : "text-muted-foreground")}>
        {item.itemType}
      </TableCell>
   {onEditItem && (
        <TableCell className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditItem(item)}
            aria-label={`Edit ${item.productName}`}
            className="p-2 h-auto"
            disabled={isProcessing} // Also disable if main row processing
          >
            <Pencil className={cn("h-4 w-4", showEditButtonText && "mr-1")} />
            {showEditButtonText && "Edit"}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
