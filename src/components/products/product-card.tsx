
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Barcode as BarcodeIcon, Building, Package, Trash2, CheckCircle2, Circle } from 'lucide-react';
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

const ProductCardComponent = ({ product, onClick, isMultiSelect, isSelected, onSelect, onDelete }: ProductCardProps) => {

  return (
    <Card 
        className={cn(
            "w-full shadow-lg hover:shadow-xl transition-all duration-300 hover:ring-2 hover:ring-primary/50 cursor-pointer relative group overflow-hidden",
            isSelected && "ring-2 ring-primary bg-primary/[0.02]"
        )}
        onClick={(e) => {
            if (isMultiSelect) {
                onSelect?.();
            } else {
                onClick();
            }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (isMultiSelect) onSelect?.();
            else onClick();
          }
        }}
        role="button"
        tabIndex={0}
      >
      {isMultiSelect && (
          <div className="absolute top-3 right-3 z-10">
              {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-primary fill-primary text-white" />
              ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
          </div>
      )}

      {!isMultiSelect && onDelete && (
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
              >
                  <Trash2 className="h-4 w-4" />
              </Button>
          </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-4">
           <div className={cn("p-3 rounded-lg transition-colors", isSelected ? "bg-primary/10" : "bg-muted")}>
             <Package className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
           </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 leading-tight truncate">{product.productName}</CardTitle>
            <CardDescription className="text-xs flex items-center text-muted-foreground">
              <BarcodeIcon className="w-4 h-4 mr-1.5" />
              <span className="font-mono">{product.barcode}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {product.supplierName && (
          <div className="text-sm text-muted-foreground flex items-center mt-2">
            <Building className="w-4 h-4 mr-1.5 text-primary" />
            <span className="truncate">Supplier: {product.supplierName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const ProductCard = memo(ProductCardComponent);
