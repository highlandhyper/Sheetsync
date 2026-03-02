'use client';

import type { InventoryItem } from '@/lib/types';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Undo2, Eye, Pencil } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { memo } from 'react';

interface ReturnableInventoryItemRowProps {
  item: InventoryItem;
  onInitiateReturn?: (item: InventoryItem) => void; 
  onViewDetails: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
  isProcessing: boolean;
  showSupplierName?: boolean;
  showEditButtonText?: boolean; 
  disableReturnButton?: boolean;
  isSelected?: boolean;
  onSelectRow?: (id: string) => void;
  showCheckbox?: boolean;
  costPrice?: number;
  showCost?: boolean;
}

const ReturnableInventoryItemRowComponent = ({
  item,
  onInitiateReturn,
  onViewDetails,
  onEditItem,
  isProcessing,
  showSupplierName = true,
  disableReturnButton = false,
  isSelected = false,
  onSelectRow,
  showCheckbox = false,
  costPrice,
  showCost = false,
}: ReturnableInventoryItemRowProps) => {
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

  return (
    <TableRow data-state={isSelected ? 'selected' : ''} className={cn("group", isProcessing && "opacity-50 pointer-events-none")}>
      {showCheckbox && (
        <TableCell className="text-center noprint">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectRow?.(item.id)}
            aria-label={`Select row for ${item.productName}`}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">{item.productName}</TableCell>
      <TableCell className="text-muted-foreground">{item.barcode}</TableCell>
      {showSupplierName && (
        <TableCell className="text-muted-foreground">{item.supplierName || 'N/A'}</TableCell>
      )}
      <TableCell className="text-right">{item.quantity}</TableCell>
      {showCost && (
        <>
          <TableCell className="text-right text-sm text-muted-foreground">{costPrice !== undefined ? `QAR ${costPrice.toFixed(2)}` : 'N/A'}</TableCell>
          <TableCell className="text-right font-semibold">{costPrice !== undefined ? `QAR ${(costPrice * item.quantity).toFixed(2)}` : 'N/A'}</TableCell>
        </>
      )}
      <TableCell className={cn(isExpired && isValidExpiry ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {formattedExpiryDate}
      </TableCell>
      <TableCell className="text-muted-foreground">{item.location}</TableCell>
      <TableCell className={cn(item.itemType === 'Damage' ? "text-orange-500 font-medium" : "text-muted-foreground")}>
        {item.itemType}
      </TableCell>
      <TableCell className="text-right noprint">
        <div className="relative h-8 flex items-center justify-end">
            {/* Date/Time shown when not hovering */}
            <span className="text-xs text-muted-foreground group-hover:hidden transition-all duration-200 whitespace-nowrap">
                {item.timestamp ? format(parseISO(item.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}
            </span>

            {/* Actions hidden by default, shown on hover */}
            <div className="hidden group-hover:flex justify-end items-center gap-1 transition-all duration-200">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onInitiateReturn?.(item)}
                    disabled={isProcessing || item.quantity === 0 || disableReturnButton || !onInitiateReturn}
                    aria-label={`Return ${item.productName}`}
                    className="h-8 w-8"
                >
                    <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetails(item)}
                    aria-label={`View details for ${item.productName}`}
                    className="h-8 w-8"
                >
                    <Eye className="h-4 w-4" />
                </Button>
                {onEditItem && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditItem(item)}
                        aria-label={`Edit ${item.productName}`}
                        className="h-8 w-8"
                        disabled={isProcessing}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ReturnableInventoryItemRow = memo(ReturnableInventoryItemRowComponent);
