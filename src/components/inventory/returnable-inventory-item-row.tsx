'use client';

import type { InventoryItem } from '@/lib/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  format,
  parseISO,
  isValid,
  isBefore,
  startOfDay,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Undo2,
  Eye,
  Pencil,
  Barcode,
  MapPin,
  Package,
  Building2,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
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
  const today = startOfDay(new Date());

  const parsedExpiryDate = item.expiryDate ? parseISO(item.expiryDate) : null;
  const isValidExpiry = !!parsedExpiryDate && isValid(parsedExpiryDate);

  // Preserve existing behavior: an item expiring today is treated as expired.
  const isExpired =
    isValidExpiry &&
    (isBefore(startOfDay(parsedExpiryDate!), today) ||
      isSameDay(parsedExpiryDate!, today));

  let formattedExpiryDate = 'N/A';

  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'dd MMM yyyy');

      if (isExpired) {
        formattedExpiryDate += ' • Expired';
      }
    } else {
      formattedExpiryDate = 'Invalid date';
    }
  }

  const parsedTimestamp = item.timestamp ? parseISO(item.timestamp) : null;
  const formattedTimestamp =
    parsedTimestamp && isValid(parsedTimestamp)
      ? format(parsedTimestamp, 'dd/MM/yy HH:mm')
      : 'N/A';

  const totalCost =
    costPrice !== undefined ? costPrice * item.quantity : undefined;

  const compactExpiry =
    isValidExpiry && parsedExpiryDate
      ? format(parsedExpiryDate, 'dd MMM yy')
      : item.expiryDate
        ? 'Invalid'
        : 'No expiry';

  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'group border-border/50 transition-colors hover:bg-muted/20',
        'data-[state=selected]:bg-primary/[0.045] data-[state=selected]:hover:bg-primary/[0.06]',
        'max-[520px]:h-auto',
        isProcessing && 'pointer-events-none opacity-50'
      )}
    >
      {showCheckbox && (
        <TableCell className="w-10 px-2 py-2 text-center align-middle noprint sm:w-11 sm:px-3 max-[520px]:w-8 max-[520px]:px-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectRow?.(item.id)}
            aria-label={`Select ${item.productName}`}
            className="h-4 w-4 rounded"
          />
        </TableCell>
      )}

      {/* Product identity.
          <=520px: this becomes the complete mobile summary. */}
      <TableCell className="min-w-[220px] max-w-[320px] px-3 py-3 align-middle sm:px-4 max-[520px]:w-auto max-[520px]:min-w-0 max-[520px]:max-w-none max-[520px]:px-2.5 max-[520px]:py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              'mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex max-[520px]:hidden',
              item.itemType === 'Damage'
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : isExpired
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
            )}
          >
            {item.itemType === 'Damage' ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-[12px] font-semibold leading-[1.3] tracking-tight text-foreground sm:text-[13px]">
              {item.productName}
            </p>

            {/* Mobile: complete condensed identity */}
            <div className="mt-1.5 hidden min-w-0 space-y-1.5 max-[520px]:block">
              <div className="flex min-w-0 items-center gap-1.5 text-[9px] leading-none text-muted-foreground">
                <Barcode className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate font-mono">
                  {item.barcode}
                </span>

                <span className="shrink-0 text-muted-foreground/40">•</span>

                <span className="shrink-0 font-semibold text-foreground">
                  Qty {item.quantity}
                </span>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-1.5 max-[360px]:grid-cols-1">
                <div
                  className={cn(
                    'min-w-0 rounded-lg px-2 py-1.5',
                    isExpired
                      ? 'bg-destructive/10'
                      : 'bg-muted/40'
                  )}
                >
                  <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Expiry
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 truncate text-[9px] font-semibold',
                      isExpired ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {compactExpiry}
                  </p>
                </div>

                <div
                  className={cn(
                    'min-w-0 rounded-lg px-2 py-1.5',
                    item.itemType === 'Damage'
                      ? 'bg-orange-500/10'
                      : 'bg-muted/40'
                  )}
                >
                  <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Type
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 truncate text-[9px] font-semibold',
                      item.itemType === 'Damage'
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-foreground'
                    )}
                  >
                    {item.itemType}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                {showSupplierName && (
                  <div className="flex min-w-0 items-center gap-1.5 text-[8px] text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">
                      {item.supplierName || 'No supplier'}
                    </span>
                  </div>
                )}

                <div className="flex min-w-0 items-center gap-1.5 text-[8px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 truncate">
                    {item.location || 'No location'}
                  </span>
                </div>
              </div>

              {showCost && costPrice !== undefined && (
                <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-[8px]">
                  <span className="text-muted-foreground">
                    Cost QAR {costPrice.toFixed(2)}
                  </span>
                  <span className="font-semibold text-foreground">
                    Total QAR {(costPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 text-[7px] tabular-nums text-muted-foreground/60">
                <Clock3 className="h-2.5 w-2.5" />
                {formattedTimestamp}
              </div>
            </div>

            {/* Tablet / narrow desktop helper line */}
            <div className="mt-1 hidden min-w-0 items-center gap-1.5 text-[9px] text-muted-foreground sm:flex max-[520px]:hidden">
              <span className="max-w-[160px] truncate">
                {showSupplierName
                  ? item.supplierName || 'No supplier'
                  : item.location || 'No location'}
              </span>
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-[9px] text-muted-foreground sm:px-4 sm:text-[10px] max-[520px]:hidden">
        {item.barcode}
      </TableCell>

      {showSupplierName && (
        <TableCell className="min-w-[150px] max-w-[220px] px-3 py-3 text-[10px] text-muted-foreground sm:px-4 max-[520px]:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            <span className="line-clamp-2 min-w-0">
              {item.supplierName || 'N/A'}
            </span>
          </div>
        </TableCell>
      )}

      <TableCell className="whitespace-nowrap px-3 py-3 text-right text-[11px] font-bold tabular-nums text-foreground sm:px-4 max-[520px]:hidden">
        {item.quantity}
      </TableCell>

      {showCost && (
        <>
          <TableCell className="whitespace-nowrap px-3 py-3 text-right text-[10px] tabular-nums text-muted-foreground sm:px-4 max-[520px]:hidden">
            {costPrice !== undefined
              ? `QAR ${costPrice.toFixed(2)}`
              : 'N/A'}
          </TableCell>

          <TableCell className="whitespace-nowrap px-3 py-3 text-right text-[10px] font-semibold tabular-nums text-foreground sm:px-4 max-[520px]:hidden">
            {totalCost !== undefined
              ? `QAR ${totalCost.toFixed(2)}`
              : 'N/A'}
          </TableCell>
        </>
      )}

      <TableCell className="min-w-[130px] px-3 py-3 sm:px-4 max-[520px]:hidden">
        <span
          className={cn(
            'inline-flex max-w-[150px] truncate rounded-lg px-2 py-1 text-[9px] font-medium',
            isExpired && isValidExpiry
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted/50 text-muted-foreground'
          )}
        >
          {formattedExpiryDate}
        </span>
      </TableCell>

      <TableCell className="min-w-[110px] px-3 py-3 text-[10px] text-muted-foreground sm:px-4 max-[520px]:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <span className="line-clamp-2 min-w-0">
            {item.location || 'N/A'}
          </span>
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap px-3 py-3 sm:px-4 max-[520px]:hidden">
        <span
          className={cn(
            'inline-flex rounded-lg px-2 py-1 text-[9px] font-medium',
            item.itemType === 'Damage'
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-primary/10 text-primary'
          )}
        >
          {item.itemType}
        </span>
      </TableCell>

      {/* Fixed action zone: desktop hover never changes the table column width. */}
      <TableCell className="relative w-[128px] min-w-[128px] max-w-[128px] px-2 py-2 text-right align-middle noprint sm:px-3 max-[520px]:w-[72px] max-[520px]:min-w-[72px] max-[520px]:max-w-[72px] max-[520px]:px-1">
        <div className="relative min-h-9 w-full lg:h-9">
          <span className="hidden whitespace-nowrap text-[9px] tabular-nums text-muted-foreground transition-opacity duration-150 lg:absolute lg:inset-0 lg:flex lg:items-center lg:justify-end lg:opacity-100 lg:group-hover:opacity-0">
            {formattedTimestamp}
          </span>

          <div className="flex items-center justify-end gap-0.5 lg:absolute lg:inset-0 lg:opacity-0 lg:pointer-events-none lg:transition-opacity lg:duration-150 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 max-[520px]:grid max-[520px]:grid-cols-2 max-[520px]:gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onInitiateReturn?.(item)}
              disabled={
                isProcessing ||
                item.quantity === 0 ||
                disableReturnButton ||
                !onInitiateReturn
              }
              aria-label={`Return ${item.productName}`}
              title="Return item"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary max-[520px]:h-8 max-[520px]:w-8"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails(item)}
              aria-label={`View details for ${item.productName}`}
              title="View details"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground max-[520px]:h-8 max-[520px]:w-8"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>

            {onEditItem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditItem(item)}
                aria-label={`Edit ${item.productName}`}
                title="Edit item"
                disabled={isProcessing}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground max-[520px]:col-span-2 max-[520px]:h-7 max-[520px]:w-full"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-0.5 whitespace-nowrap text-[8px] tabular-nums text-muted-foreground/60 lg:hidden max-[520px]:hidden">
          {formattedTimestamp}
        </p>
      </TableCell>
    </TableRow>
  );
};

export const ReturnableInventoryItemRow = memo(
  ReturnableInventoryItemRowComponent
);
