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
    if (isMultiSelect) {
      onSelect?.();
    } else {
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        `
          group relative w-full cursor-pointer overflow-hidden
          rounded-2xl border-0 bg-muted/20 shadow-none
          transition-colors duration-200
          hover:bg-muted/35
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-primary/25
          focus-visible:ring-offset-0
        `,
        isSelected && 'bg-primary/[0.075] ring-2 ring-primary/30',
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
      {/* Selection indicator */}
      {isMultiSelect && (
        <div className="absolute right-2.5 top-2.5 z-10">
          <div
            className={cn(
              `
                flex h-7 w-7 items-center justify-center
                rounded-lg bg-background/80 shadow-sm
                transition-colors
              `,
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground/50',
            )}
          >
            {isSelected ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </div>
        </div>
      )}

      {/* Delete action */}
      {!isMultiSelect && onDelete && (
        <div
          className="
            absolute right-2 top-2 z-10
            opacity-100
            transition-opacity
            sm:opacity-0
            sm:group-hover:opacity-100
            sm:group-focus-within:opacity-100
          "
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="
              h-8 w-8 rounded-lg
              bg-background/75 text-muted-foreground
              shadow-sm backdrop-blur-sm
              hover:bg-destructive/10
              hover:text-destructive
            "
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

      <CardHeader className="p-3 pb-2 sm:p-3.5 sm:pb-2">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              `
                flex h-10 w-10 shrink-0 items-center justify-center
                rounded-xl bg-background/70
                transition-colors
                sm:h-11 sm:w-11
              `,
              isSelected && 'bg-primary/10 text-primary',
            )}
          >
            <Package
              className={cn(
                'h-4.5 w-4.5 sm:h-5 sm:w-5',
                isSelected ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          </div>

          <div
            className={cn(
              'min-w-0 flex-1',
              (isMultiSelect || onDelete) && 'pr-7',
            )}
          >
            <CardTitle
              className="
                truncate text-sm font-semibold
                leading-5 tracking-tight text-foreground
                sm:text-[15px]
              "
              title={product.productName}
            >
              {product.productName}
            </CardTitle>

            <CardDescription className="mt-1 flex min-w-0 items-center text-[10px] text-muted-foreground sm:text-[11px]">
              <BarcodeIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />

              <span className="truncate font-mono">
                {product.barcode}
              </span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0 sm:px-3.5 sm:pb-3.5">
        <div className="min-h-[26px]">
          {product.supplierName ? (
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-background/45 px-2 py-1.5">
              <Building className="h-3.5 w-3.5 shrink-0 text-primary/65" />

              <span
                className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]"
                title={product.supplierName}
              >
                {product.supplierName}
              </span>
            </div>
          ) : (
            <div className="flex h-[26px] items-center px-0.5">
              <span className="text-[10px] text-muted-foreground/45">
                No supplier
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ProductCard = memo(ProductCardComponent);
