import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Barcode as BarcodeIcon,
  Building,
  Check,
  Circle,
  Package,
  Trash2,
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  isMultiSelect?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

const ProductCardComponent = ({
  product,
  onClick,
  isMultiSelect,
  isSelected,
  onSelect,
  onDelete,
}: ProductCardProps) => {
  const handleActivate = () => {
    if (isMultiSelect) onSelect?.();
    else onClick();
  };

  return (
    <Card
      className={cn(
        'group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-none transition-colors hover:border-primary/30 hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        isSelected && 'border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20',
      )}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isMultiSelect ? !!isSelected : undefined}
    >
      {isMultiSelect && (
        <div className="absolute right-3 top-3 z-10">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border bg-background',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
          )}>
            {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5" />}
          </div>
        </div>
      )}

      {!isMultiSelect && onDelete && (
        <div className="absolute right-2 top-2 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label={`Delete ${product.productName}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <CardHeader className="p-4 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
            isSelected && 'bg-primary/10 text-primary',
          )}>
            <Package className="h-5 w-5" />
          </div>
          <div className={cn('min-w-0 flex-1', (isMultiSelect || onDelete) && 'pr-7')}>
            <CardTitle className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 tracking-tight text-foreground" title={product.productName}>
              {product.productName}
            </CardTitle>
            <CardDescription className="mt-1.5 flex min-w-0 items-center text-xs text-muted-foreground">
              <BarcodeIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{product.barcode}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="border-t border-border/70 px-4 py-3">
        {product.supplierName ? (
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Building className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={product.supplierName}>{product.supplierName}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70">No supplier assigned</p>
        )}
      </CardContent>
    </Card>
  );
};

export const ProductCard = memo(ProductCardComponent);
