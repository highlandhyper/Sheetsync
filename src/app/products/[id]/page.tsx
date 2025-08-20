"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getProductById } from '@/lib/products';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import { ShoppingCart, ChevronsRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchedProduct = getProductById(params.id);
    setProduct(fetchedProduct);
  }, [params.id]);

  if (product === undefined) {
    // Loading state
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="w-full aspect-square rounded-lg" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-headline font-bold">Product not found</h1>
        <p className="text-muted-foreground mt-4">We couldn't find the product you were looking for.</p>
        <Button asChild className="mt-8">
            <Link href="/">Back to shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronsRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{product.name}</span>
        </div>
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg">
          <Image
            src={product.image}
            alt={product.name}
            data-ai-hint={product.dataAiHint}
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-6">
          <Badge variant="secondary">{product.category}</Badge>
          <h1 className="text-5xl font-headline font-bold text-foreground">{product.name}</h1>
          <p className="text-3xl font-headline text-primary">${product.price.toFixed(2)}</p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {product.description}
          </p>
          <Button size="lg" className="w-full md:w-auto h-14 text-xl" onClick={() => addToCart(product)}>
            <ShoppingCart className="mr-3 h-6 w-6" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
