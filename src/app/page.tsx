"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { ProductCard } from '@/components/product-card';
import { products as allProducts } from '@/lib/products';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {

  const featuredProducts = useMemo(() => {
    return allProducts.slice(0, 4);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <section className="py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight">Curated Goods, Delivered.</h1>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto md:mx-0">
              Discover a collection of high-quality items, thoughtfully selected for the modern lifestyle.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="#featured-products">Explore Products</Link>
            </Button>
          </div>
          <div className="relative w-full aspect-square max-w-lg mx-auto md:max-w-none">
            <Image
              src="/assets/hero.png"
              alt="Modern lifestyle products"
              data-ai-hint="lifestyle products"
              fill
              className="object-cover rounded-lg shadow-xl"
              priority
            />
          </div>
        </div>
      </section>

      <section id="featured-products" className="py-16">
        <h2 className="text-3xl font-bold font-headline text-center mb-12">Featured Products</h2>
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-2xl font-headline text-foreground">No Products Found</h2>
            <p className="text-muted-foreground mt-2">Check back later for new arrivals.</p>
          </div>
        )}
      </section>
    </div>
  );
}
