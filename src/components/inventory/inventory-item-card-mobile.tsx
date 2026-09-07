'use client';

import type { InventoryItem, Product } from '@/lib/types';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  format,
  parseISO,
  isValid,
  startOfDay,
  isSameDay,
  isBefore,
} from 'date-fns';
import { memo } from 'react';
import {
  Barcode,
  Building2,
  CalendarDays,
  Hash,
  Tag,
  AlertTriangle,
  Eye,
  Pencil,
  Undo2,
  Trash2,
  PlusCircle,
  Wallet,
  Clock3,
  MapPin,
  Image as ImageIcon,
  Check,
  Layers3,
  UserRound,
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

  // Preserve existing behavior: today counts as expired.
  const isExpired =
    isValidExpiry &&
    (isBefore(startOfDay(parsedExpiryDate!), startOfDay(new Date())) ||
      isSameDay(parsedExpiryDate!, new Date()));

  const isProductFound = item.productName !== 'Not Found';
  const costPrice = product?.costPrice;
  const quantityToShow = totalQuantity ?? item.quantity;
  const isSingleItem = !individualItemCount || individualItemCount === 1;

  let formattedExpiryDate = 'N/A';

  if (item.expiryDate) {
    if (isValidExpiry) {
      formattedExpiryDate = format(parsedExpiryDate!, 'dd MMM yyyy');
      if (isExpired) formattedExpiryDate += ' • Expired';
    } else {
      formattedExpiryDate = 'Invalid date';
    }
  }

  if (
    context === 'inventory' &&
    individualItemCount &&
    individualItemCount > 1
  ) {
    formattedExpiryDate = 'Multiple';
  }

  const parsedTimestamp = item.timestamp ? parseISO(item.timestamp) : null;
  const formattedTimestamp =
    parsedTimestamp && isValid(parsedTimestamp)
      ? format(parsedTimestamp, 'dd/MM/yy HH:mm')
      : 'N/A';

  const compactExpiry =
    context === 'inventory' &&
    individualItemCount &&
    individualItemCount > 1
      ? 'Multiple'
      : isValidExpiry && parsedExpiryDate
        ? format(parsedExpiryDate, 'dd MMM yy')
        : item.expiryDate
          ? 'Invalid'
          : 'No expiry';

  const statusTone =
    item.itemType === 'Damage'
      ? 'orange'
      : isExpired
        ? 'danger'
        : 'primary';

  return (
    <Card
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all',
        isSelected && 'border-primary/40 ring-2 ring-primary/15'
      )}
    >
      {/* Identity */}
      <CardHeader className="min-w-0 p-3 pb-2.5 max-[360px]:p-2.5 max-[360px]:pb-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {onSelect && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Select ${item.productName}`}
              onClick={onSelect}
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-background text-muted-foreground'
              )}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-sm border border-current opacity-40" />
              )}
            </button>
          )}

          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              statusTone === 'orange'
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : statusTone === 'danger'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
            )}
          >
            {item.itemType === 'Damage' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Layers3 className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <CardTitle
                className={cn(
                  'min-w-0 flex-1 line-clamp-2 break-words text-[13px] font-semibold leading-[1.28] tracking-tight text-foreground',
                  'max-[360px]:text-[12px]',
                  !isProductFound && 'italic text-muted-foreground'
                )}
              >
                {item.productName}
              </CardTitle>

              {individualItemCount && individualItemCount > 1 && (
                <Badge
                  variant="secondary"
                  className="max-w-[66px] shrink-0 truncate rounded-lg border-0 bg-muted px-2 py-0.5 text-[8px] font-semibold"
                >
                  {individualItemCount} logs
                </Badge>
              )}
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] text-muted-foreground">
              <Barcode className="h-3 w-3 shrink-0" />
              <span className="truncate font-mono">{item.barcode}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-2.5 px-3 pb-3 pt-0 max-[360px]:px-2.5">
        {/* High-priority stats */}
        <div className="grid min-w-0 grid-cols-3 gap-1.5 max-[380px]:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-muted/35 px-2.5 py-2 max-[360px]:px-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Hash className="h-3 w-3 shrink-0" />
              Qty
            </div>
            <p className="mt-1 truncate text-[15px] font-bold tabular-nums text-foreground">
              {quantityToShow}
            </p>
          </div>

          <div
            className={cn(
              'min-w-0 rounded-xl px-2.5 py-2 max-[360px]:px-2',
              isExpired && isValidExpiry
                ? 'bg-destructive/10'
                : 'bg-muted/35'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.08em]',
                isExpired && isValidExpiry
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              )}
            >
              <CalendarDays className="h-3 w-3 shrink-0" />
              Expiry
            </div>

            <p
              className={cn(
                'mt-1 truncate text-[10px] font-semibold leading-4',
                isExpired && isValidExpiry
                  ? 'text-destructive'
                  : 'text-foreground'
              )}
            >
              {compactExpiry}
            </p>
          </div>

          <div
            className={cn(
              'min-w-0 rounded-xl px-2.5 py-2 max-[380px]:col-span-2 max-[360px]:px-2',
              item.itemType === 'Damage'
                ? 'bg-orange-500/10'
                : 'bg-primary/[0.06]'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.08em]',
                item.itemType === 'Damage'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-primary'
              )}
            >
              <Tag className="h-3 w-3 shrink-0" />
              Type
            </div>

            <p
              className={cn(
                'mt-1 truncate text-[10px] font-semibold',
                item.itemType === 'Damage'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-foreground'
              )}
            >
              {item.itemType}
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border/50 bg-background/70 px-2.5 py-2.5 max-[350px]:grid-cols-1">
          {context !== 'supplier' && (
            <div className="flex min-w-0 items-start gap-1.5">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Supplier
                </span>
                <p className="mt-0.5 truncate text-[9px] font-medium text-foreground">
                  {item.supplierName || 'N/A'}
                </p>
              </div>
            </div>
          )}

          <div className="flex min-w-0 items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0">
              <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Location
              </span>
              <p className="mt-0.5 truncate text-[9px] font-medium text-foreground">
                {item.location || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0">
              <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Staff
              </span>
              <p className="mt-0.5 truncate text-[9px] font-medium text-foreground">
                {item.staffName || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0">
              <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Logged
              </span>
              <p className="mt-0.5 truncate text-[9px] tabular-nums text-muted-foreground">
                {formattedTimestamp}
              </p>
            </div>
          </div>
        </div>

        {/* Cost */}
        {costPrice !== undefined && (
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-primary/[0.055] px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
              <Wallet className="h-3.5 w-3.5" />
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <div className="min-w-0">
                <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-primary/70">
                  Unit cost
                </span>
                <p className="mt-0.5 truncate text-[9px] font-semibold tabular-nums text-foreground">
                  QAR {costPrice.toFixed(2)}
                </p>
              </div>

              <div className="min-w-0 text-right">
                <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-primary/70">
                  Total value
                </span>
                <p className="mt-0.5 truncate text-[10px] font-bold tabular-nums text-primary">
                  QAR {(costPrice * quantityToShow).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="min-w-0 border-t border-border/50 bg-muted/[0.16] px-2.5 py-2">
        {context === 'inventory' ? (
          isSingleItem ? (
            <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 max-[420px]:grid-cols-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onDetails}
                className="h-9 rounded-lg px-2 text-[9px] font-semibold shadow-none"
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                Details
              </Button>

              {onViewImage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewImage}
                  className="h-9 rounded-lg px-2 text-[9px] font-semibold"
                >
                  <ImageIcon className="mr-1 h-3.5 w-3.5" />
                  Image
                </Button>
              ) : (
                <div />
              )}

              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  aria-label={`Edit ${item.productName}`}
                  className="h-9 w-full rounded-lg"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <div />
              )}

              <div className="grid min-w-0 grid-cols-2 gap-0.5 max-[420px]:col-span-2">
                {onReturn && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onReturn}
                    disabled={item.quantity === 0}
                    aria-label={`Return ${item.productName}`}
                    className="h-9 w-full rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                )}

                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    aria-label={`Delete ${item.productName}`}
                    className="h-9 w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={onDetails}
                className="h-9 min-w-0 rounded-lg px-3 text-[9px] font-semibold shadow-none"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  View {individualItemCount || 1} logs
                </span>
              </Button>

              {onViewImage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onViewImage}
                  aria-label={`View image for ${item.productName}`}
                  className="h-9 w-9 rounded-lg"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        ) : isProductFound ? (
          /* Keep Image + Edit + Return in one row on smaller staff/supplier screens. */
          <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 max-[420px]:grid-cols-3">
            {onViewImage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onViewImage}
                aria-label={`View image for ${item.productName}`}
                className="h-9 w-full rounded-lg"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            )}

            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label={`Edit ${item.productName}`}
                className="h-9 w-full rounded-lg"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}

            {onReturn && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onReturn}
                disabled={item.quantity === 0}
                aria-label={`Return ${item.productName}`}
                className="h-9 w-full rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete ${item.productName}`}
                className="h-9 w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive max-[420px]:col-span-3"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          onCreateProduct && (
            <Button
              variant="default"
              size="sm"
              onClick={onCreateProduct}
              className="h-9 w-full rounded-lg text-[10px] font-semibold shadow-none"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Create product
            </Button>
          )
        )}
      </CardFooter>
    </Card>
  );
}

export const InventoryItemCardMobile = memo(
  InventoryItemCardMobileComponent
);

export default InventoryItemCardMobile;
