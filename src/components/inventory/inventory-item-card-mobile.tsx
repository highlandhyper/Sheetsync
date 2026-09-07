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

  // TURBO EXPIRE: Preserve existing behavior — today counts as expired.
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
      formattedExpiryDate = format(parsedExpiryDate!, 'PP');
      if (isExpired) formattedExpiryDate += ' (Expired)';
    } else {
      formattedExpiryDate = 'Invalid Date';
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

  return (
    <Card
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-0 bg-card shadow-sm ring-1 ring-border/60 transition-shadow',
        'max-[520px]:rounded-xl',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <CardHeader className="min-w-0 px-3 pb-2 pt-3 sm:px-4 sm:pb-2.5 sm:pt-4 max-[360px]:px-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          {onSelect && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Select ${item.productName}`}
              onClick={onSelect}
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted',
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <CardTitle
                className={cn(
                  'min-w-0 flex-1 line-clamp-2 break-words [overflow-wrap:anywhere] text-[14px] font-semibold leading-[1.25] tracking-tight sm:text-[15px] max-[360px]:text-[13px]',
                  !isProductFound && 'italic text-muted-foreground',
                )}
              >
                {item.productName}
              </CardTitle>

              {individualItemCount && individualItemCount > 1 && (
                <Badge
                  variant="secondary"
                  className="h-5 max-w-[72px] shrink-0 truncate rounded-md px-1.5 text-[9px] font-semibold max-[360px]:max-w-[58px] max-[360px]:text-[8px]"
                >
                  {individualItemCount} logs
                </Badge>
              )}
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <Barcode className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{item.barcode}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4 max-[360px]:px-2.5">
        {/* High-priority information first for 480x800 screens */}
        <div className="grid min-w-0 grid-cols-3 gap-1.5 max-[400px]:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-lg bg-muted/40 px-2 py-2 max-[360px]:px-1.5">
            <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              <Hash className="h-3 w-3 shrink-0" />
              Qty
            </div>
            <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-foreground">
              {quantityToShow}
            </p>
          </div>

          <div
            className={cn(
              'min-w-0 overflow-hidden rounded-lg px-2 py-2 max-[360px]:px-1.5',
              isExpired && isValidExpiry
                ? 'bg-destructive/10'
                : 'bg-muted/40',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide',
                isExpired && isValidExpiry
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="h-3 w-3 shrink-0" />
              Expiry
            </div>
            <p
              className={cn(
                'mt-0.5 truncate text-[10px] font-semibold leading-4',
                isExpired && isValidExpiry
                  ? 'text-destructive'
                  : 'text-foreground',
              )}
            >
              {context === 'inventory' && individualItemCount && individualItemCount > 1
                ? 'Multiple'
                : isValidExpiry && parsedExpiryDate
                  ? `${format(parsedExpiryDate, 'dd MMM yy')}${isExpired ? ' • Expired' : ''}`
                  : formattedExpiryDate}
            </p>
          </div>

          <div
            className={cn(
              'min-w-0 overflow-hidden rounded-lg px-2 py-2 max-[400px]:col-span-2 max-[360px]:px-1.5',
              item.itemType === 'Damage'
                ? 'bg-orange-500/10'
                : 'bg-muted/40',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide',
                item.itemType === 'Damage'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-muted-foreground',
              )}
            >
              {item.itemType === 'Damage' ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Tag className="h-3 w-3 shrink-0" />
              )}
              Type
            </div>
            <p
              className={cn(
                'mt-0.5 truncate text-[10px] font-semibold leading-4',
                item.itemType === 'Damage'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-foreground',
              )}
            >
              {item.itemType}
            </p>
          </div>
        </div>

        {/* Compact metadata */}
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 px-0.5 max-[360px]:grid-cols-1">
          {context !== 'supplier' && (
            <div className="flex min-w-0 items-start gap-1.5">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <div className="min-w-0">
                <span className="block text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                  Supplier
                </span>
                <p className="truncate text-[10px] font-medium text-foreground">
                  {item.supplierName || 'N/A'}
                </p>
              </div>
            </div>
          )}

          <div className="flex min-w-0 items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <div className="min-w-0">
              <span className="block text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                Zone
              </span>
              <p className="truncate text-[10px] font-medium text-foreground">
                {item.location || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <div className="min-w-0">
              <span className="block text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                Staff
              </span>
              <p className="truncate text-[10px] font-medium text-foreground">
                {item.staffName || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <div className="min-w-0">
              <span className="block text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                Logged
              </span>
              <p className="truncate text-[10px] tabular-nums text-muted-foreground">
                {formattedTimestamp}
              </p>
            </div>
          </div>
        </div>

        {costPrice !== undefined && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg bg-primary/[0.06] px-2.5 py-2 max-[360px]:px-2">
            <Wallet className="h-4 w-4 shrink-0 text-primary" />

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="min-w-0">
                <span className="block text-[8px] font-medium uppercase tracking-wide text-primary/70">
                  Unit Cost
                </span>
                <p className="truncate text-[10px] font-semibold tabular-nums max-[360px]:text-[9px]">
                  QAR {costPrice.toFixed(2)}
                </p>
              </div>

              <div className="min-w-0 text-right">
                <span className="block text-[8px] font-medium uppercase tracking-wide text-primary/70">
                  Total
                </span>
                <p className="truncate text-[11px] font-bold tabular-nums text-primary max-[360px]:text-[9px]">
                  QAR {(costPrice * quantityToShow).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="min-w-0 border-t border-border/50 bg-muted/20 px-2.5 py-2 max-[360px]:px-2">
        {context === 'inventory' ? (
          isSingleItem ? (
            <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 max-[420px]:grid-cols-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onDetails}
                className="h-10 rounded-lg px-2 text-[10px] font-semibold max-[360px]:text-[9px]"
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                Details
              </Button>

              {onViewImage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewImage}
                  className="h-10 rounded-lg px-2 text-[10px] font-semibold max-[360px]:text-[9px]"
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
                  className="h-10 w-full rounded-lg"
                >
                  <Pencil className="h-4 w-4" />
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
                    className="h-10 w-full rounded-lg text-primary"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}

                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    aria-label={`Delete ${item.productName}`}
                    className="h-10 w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
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
                className="h-10 min-w-0 rounded-lg px-3 text-[10px] font-semibold"
              >
                <Eye className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="truncate">
                  View {individualItemCount || 1} Logs
                </span>
              </Button>

              {onViewImage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onViewImage}
                  aria-label={`View image for ${item.productName}`}
                  className="h-10 w-10 rounded-lg"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          )
        ) : isProductFound ? (
          <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 max-[420px]:grid-cols-2">
            {onViewImage ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onViewImage}
                aria-label={`View image for ${item.productName}`}
                className="h-10 w-full rounded-lg"
              >
                <ImageIcon className="h-4 w-4" />
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
                className="h-10 w-full rounded-lg"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}

            {onReturn ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onReturn}
                disabled={item.quantity === 0}
                aria-label={`Return ${item.productName}`}
                className="h-10 w-full rounded-lg text-primary"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}

            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete ${item.productName}`}
                className="h-10 w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        ) : (
          onCreateProduct && (
            <Button
              variant="default"
              size="sm"
              onClick={onCreateProduct}
              className="h-10 w-full rounded-lg text-[11px] font-semibold"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Create Product
            </Button>
          )
        )}
      </CardFooter>
    </Card>
  );
}

export const InventoryItemCardMobile = memo(
  InventoryItemCardMobileComponent,
);
