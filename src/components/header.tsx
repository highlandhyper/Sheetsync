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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-7 w-7 text-primary"
              aria-hidden="true"
            >
              <path d="M2.25 2.25a.75.75 0 000 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 00-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 000-1.5H5.378A2.25 2.25 0 017.5 15h11.218a.75.75 0 00.674-.421 60.358 60.358 0 002.46-5.23c.18-.487.18-.995 0-1.482A60.27 60.27 0 0018.718 4H7.5a.75.75 0 00-.674-.421L6.83 1.65a.75.75 0 00-.674-.421H2.25z" />
            </svg>
            <span className="font-headline text-2xl font-bold text-foreground">
              RBCart Express
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
