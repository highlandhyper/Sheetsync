import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Barcode as BarcodeIcon, Building, Package } from 'lucide-react';
import type { Product } from '@/lib/types';
import { memo } from 'react';

interface ProductCardProps {
  product: Product;
}

const ProductCardComponent = ({ product }: ProductCardProps) => {

  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-4">
           <div className="p-3 bg-muted rounded-lg">
             <Package className="h-6 w-6 text-muted-foreground" />
           </div>
          <div className="flex-1">
            <CardTitle className="text-lg mb-1 leading-tight">{product.productName}</CardTitle>
            <CardDescription className="text-xs flex items-center text-muted-foreground">
              <BarcodeIcon className="w-4 h-4 mr-1.5" />
              {product.barcode}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {product.supplierName && (
          <div className="text-sm text-muted-foreground flex items-center mt-2">
            <Building className="w-4 h-4 mr-1.5 text-primary" />
            <span>Supplier: {product.supplierName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const ProductCard = memo(ProductCardComponent);
