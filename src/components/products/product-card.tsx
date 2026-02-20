import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Barcode as BarcodeIcon, Building } from 'lucide-react';
import type { Product } from '@/lib/types';
import { memo } from 'react';

interface ProductCardProps {
  product: Product;
}

const ProductCardComponent = ({ product }: ProductCardProps) => {
  // A simple function to extract one or two keywords from the product name for the AI hint.
  const getAiHint = (name: string): string => {
    if (!name) return 'product';
    const words = name.toLowerCase().split(' ');
    // Filter out very short words or common articles/prepositions
    const significantWords = words.filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'of'].includes(w));
    if (significantWords.length > 0) {
      return significantWords.slice(0, 2).join(' ');
    }
    // Fallback to the first word if filtering results in an empty array
    return words[0] || 'product';
  };

  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Image
            src={`https://picsum.photos/seed/${product.barcode}/80/80`} // Use barcode for a consistent placeholder
            alt={product.productName}
            width={60}
            height={60}
            className="rounded-md mr-4 object-cover"
            data-ai-hint={getAiHint(product.productName)}
          />
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
