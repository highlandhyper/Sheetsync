"use client";

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import type { Product } from '@/lib/types';
import { getSuggestedProductsAction } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from './ui/button';
import { ShoppingCart } from 'lucide-react';

export function SuggestedProducts() {
  const { cartItems, addToCart } = useCart();
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cartItems.length > 0) {
      const productNames = cartItems.map(item => item.product.name);
      startTransition(async () => {
        const result = await getSuggestedProductsAction(productNames);
        if (result.error) {
          setError(result.error);
          setSuggestions([]);
        } else {
          setSuggestions(result.products);
          setError(null);
        }
      });
    } else {
      setSuggestions([]);
    }
  }, [cartItems]);

  if (isPending) {
    return (
      <div>
        <h4 className="font-semibold mb-2">You might also like...</h4>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="space-y-2 flex-grow">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || suggestions.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="font-semibold mb-2">You might also like...</h4>
      <div className="space-y-3">
        {suggestions.map(product => (
          <div key={product.id} className="flex items-center gap-3">
            <Link href={`/products/${product.id}`} className="flex-shrink-0">
              <div className="relative h-14 w-14 rounded-md overflow-hidden border">
                <Image src={product.image} alt={product.name} data-ai-hint={product.dataAiHint} fill className="object-cover" />
              </div>
            </Link>
            <div className="flex-grow">
              <Link href={`/products/${product.id}`} className="hover:underline">
                <p className="text-sm font-medium leading-tight">{product.name}</p>
              </Link>
              <p className="text-xs text-muted-foreground">${product.price.toFixed(2)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => addToCart(product)}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
