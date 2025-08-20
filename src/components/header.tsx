"use client";

import Link from 'next/link';
import { ShoppingCart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import { CartSheet } from './cart-sheet';
import { useState } from 'react';

export function Header() {
  const { getCartItemCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const itemCount = getCartItemCount();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-headline text-2xl font-bold text-foreground">
              rbcart
            </span>
          </Link>
          <nav className="hidden md:flex gap-4">
            <Button variant="ghost" asChild>
              <Link href="#featured-products">Shop</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/about">About</Link>
            </Button>
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-6 w-6" />
          </Button>

          <CartSheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCartOpen(true)}
              className="relative"
              aria-label={`Open shopping cart with ${itemCount} items`}
            >
              <ShoppingCart className="h-6 w-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {itemCount}
                </span>
              )}
            </Button>
          </CartSheet>
        </div>
      </div>
    </header>
  );
}
