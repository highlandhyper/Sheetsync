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
  const today = startOfDay(new Date());

  const parsedExpiryDate = item.expiryDate ? parseISO(item.expiryDate) : null;
  const isValidExpiry = !!parsedExpiryDate && isValid(parsedExpiryDate);

  // Preserve existing rule: today is treated as expired.
  const isExpired =
    isValidExpiry &&
    (isBefore(startOfDay(parsedExpiryDate!), today) ||
      isSameDay(parsedExpiryDate!, today));

  let formattedExpiryDate = 'N/A';

  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');

      if (isExpired) {
        formattedExpiryDate += ' (Expired)';
      }
    } else {
      formattedExpiryDate = 'Invalid Date';
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
        ? 'Invalid date'
        : 'No expiry';

  return (
    <TableRow
      data-state={isSelected ? 'selected' : ''}
      className={cn(
        'group transition-colors hover:bg-muted/30 data-[state=selected]:bg-primary/[0.06]',
        'max-[520px]:h-auto border-white/5',
        isProcessing && 'pointer-events-none opacity-50',
      )}
    >
      {showCheckbox && (
        <TableCell className="w-10 px-2 py-2 text-center align-middle noprint sm:w-12 sm:px-3 max-[520px]:w-9 max-[520px]:px-1.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectRow?.(item.id)}
            aria-label={`Select row for ${item.productName}`}
            className="h-4 w-4"
          />
        </TableCell>
      )}

      {/* Primary cell.
          At <=520px this becomes the complete compact mobile summary so
          the row fits comfortably inside a 480px-wide device. */}
      <TableCell
        className={cn(
          'min-w-[180px] max-w-[260px] px-2.5 py-2.5 align-middle sm:min-w-[220px] sm:px-4 sm:py-3',
          'max-[520px]:min-w-0 max-[520px]:max-w-none max-[520px]:w-auto max-[520px]:px-2 max-[520px]:py-2',
        )}
      >
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-[13px] font-black uppercase leading-snug text-slate-800 dark:text-white sm:text-sm max-[520px]:text-[12px] max-[520px]:leading-[1.25] tracking-tight">
            {item.productName}
          </p>

          {/* 480px summary */}
          <div className="mt-1.5 hidden min-w-0 space-y-1.5 max-[520px]:block">
            <div className="flex min-w-0 items-center gap-1.5 text-[9px] leading-none text-muted-foreground font-bold">
              <span className="min-w-0 truncate font-mono tracking-widest bg-muted/50 px-1 py-0.5 rounded">
                {item.barcode}
              </span>

              <span className="shrink-0 text-muted-foreground/40">•</span>

              <span className="shrink-0 font-black text-primary">
                {item.quantity} UNITS
              </span>

              <span className="shrink-0 text-muted-foreground/40">•</span>

              <span
                className={cn(
                  'shrink-0 uppercase',
                  isExpired && isValidExpiry
                    ? 'font-black text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {compactExpiry}
              </span>
            </div>

            <div className="flex min-w-0 items-center gap-1.5 text-[9px] leading-none text-muted-foreground font-bold uppercase tracking-tighter">
              {showSupplierName && (
                <>
                  <span className="min-w-0 truncate">
                    {item.supplierName || 'No supplier'}
                  </span>
                  <span className="shrink-0 text-muted-foreground/40">•</span>
                </>
              )}

              <span className="min-w-0 truncate">
                {item.location || 'No location'}
              </span>

              <span className="shrink-0 text-muted-foreground/40">•</span>

              <span
                className={cn(
                  'shrink-0 font-black',
                  item.itemType === 'Damage'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-primary/60',
                )}
              >
                {item.itemType}
              </span>
            </div>

            {showCost && costPrice !== undefined && (
              <div className="text-[9px] leading-none text-muted-foreground font-black uppercase tracking-tighter">
                COST QAR {costPrice.toFixed(2)}
                <span className="px-1 text-muted-foreground/40">•</span>
                TOTAL QAR {(costPrice * item.quantity).toFixed(2)}
              </div>
            )}

            <div className="text-[8px] tabular-nums leading-none text-muted-foreground/60 font-medium">
              {formattedTimestamp}
            </div>
          </div>

          {/* Normal mobile/tablet quick glance */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-tight text-muted-foreground sm:hidden max-[520px]:hidden font-bold uppercase">
            <span className="font-mono tracking-widest">{item.barcode}</span>
            <span aria-hidden="true" className="opacity-30">•</span>
            <span
              className={cn(
                isExpired && isValidExpiry && 'font-black text-destructive',
              )}
            >
              {compactExpiry}
            </span>
          </div>
        </div>
      </TableCell>

      {/* Secondary columns collapse completely at 480px.
          All of their useful information is already shown in the primary cell. */}
      <TableCell className="whitespace-nowrap px-2.5 py-2.5 font-mono text-[11px] text-muted-foreground/60 sm:px-4 sm:py-3 sm:text-xs max-[520px]:hidden font-black tracking-widest uppercase">
        {item.barcode}
      </TableCell>

      {showSupplierName && (
        <TableCell className="min-w-[150px] max-w-[220px] px-2.5 py-2.5 text-[11px] text-muted-foreground sm:px-4 sm:py-3 max-[520px]:hidden font-bold uppercase tracking-tight">
          <span className="line-clamp-2">{item.supplierName || 'N/A'}</span>
        </TableCell>
      )}

      <TableCell className="whitespace-nowrap px-2.5 py-2.5 text-right text-[13px] font-black tabular-nums sm:px-4 sm:py-3 sm:text-sm max-[520px]:hidden text-primary">
        {item.quantity}
      </TableCell>

      {showCost && (
        <>
          <TableCell className="whitespace-nowrap px-2.5 py-2.5 text-right text-[11px] tabular-nums text-muted-foreground/60 sm:px-4 sm:py-3 max-[520px]:hidden font-bold">
            {costPrice !== undefined ? `QAR ${costPrice.toFixed(2)}` : 'N/A'}
          </TableCell>

          <TableCell className="whitespace-nowrap px-2.5 py-2.5 text-right text-[11px] font-black tabular-nums sm:px-4 sm:py-3 max-[520px]:hidden">
            {totalCost !== undefined ? `QAR ${totalCost.toFixed(2)}` : 'N/A'}
          </TableCell>
        </>
      )}

      <TableCell className="min-w-[130px] px-2.5 py-2.5 sm:px-4 sm:py-3 max-[520px]:hidden">
        <span
          className={cn(
            'inline-flex rounded-lg px-2 py-1 text-[10px] font-black leading-none uppercase tracking-widest',
            isExpired && isValidExpiry
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted/50 text-muted-foreground',
          )}
        >
          {formattedExpiryDate}
        </span>
      </TableCell>

      <TableCell className="min-w-[110px] px-2.5 py-2.5 text-[11px] text-muted-foreground sm:px-4 sm:py-3 max-[520px]:hidden font-bold uppercase tracking-tighter">
        <span className="line-clamp-2">{item.location || 'N/A'}</span>
      </TableCell>

      <TableCell className="whitespace-nowrap px-2.5 py-2.5 sm:px-4 sm:py-3 max-[520px]:hidden">
        <span
          className={cn(
            'inline-flex rounded-lg px-2 py-1 text-[10px] font-black leading-none uppercase tracking-widest',
            item.itemType === 'Damage'
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-primary/10 text-primary',
          )}
        >
          {item.itemType}
        </span>
      </TableCell>

      {/* Actions stay visible on touch devices. On a 480px screen they become
          a compact 2-column control block taking only ~76px. */}
      <TableCell className="min-w-[116px] px-2 py-2 text-right align-middle noprint sm:px-3 max-[520px]:min-w-[76px] max-[520px]:w-[76px] max-[520px]:px-1.5">
        <div className="flex min-h-9 items-center justify-end max-[520px]:min-h-0">
          <span className="hidden whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/40 lg:inline lg:group-hover:hidden font-bold">
            {formattedTimestamp}
          </span>

          <div className="flex items-center justify-end gap-1 lg:hidden lg:group-hover:flex max-[520px]:grid max-[520px]:grid-cols-2 max-[520px]:gap-1">
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
              className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary lg:h-8 lg:w-8 max-[520px]:h-8 max-[520px]:w-8 bg-muted/10 border border-white/5"
            >
              <Undo2 className="h-4 w-4 max-[520px]:h-3.5 max-[520px]:w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails(item)}
              aria-label={`View details for ${item.productName}`}
              title="View details"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground lg:h-8 lg:w-8 max-[520px]:h-8 max-[520px]:w-8 bg-muted/10 border border-white/5"
            >
              <Eye className="h-4 w-4 max-[520px]:h-3.5 max-[520px]:w-3.5" />
            </Button>

            {onEditItem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditItem(item)}
                aria-label={`Edit ${item.productName}`}
                title="Edit item"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground lg:h-8 lg:w-8 max-[520px]:col-span-2 max-[520px]:h-7 max-[520px]:w-full bg-muted/10 border border-white/5"
                disabled={isProcessing}
              >
                <Pencil className="h-4 w-4 max-[520px]:h-3.5 max-[520px]:w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-0.5 whitespace-nowrap text-[9px] tabular-nums text-muted-foreground/30 lg:hidden max-[520px]:hidden font-medium">
          {formattedTimestamp}
        </p>
      </TableCell>
    </TableRow>
  );
};

export const ReturnableInventoryItemRow = memo(
  ReturnableInventoryItemRowComponent,
);
