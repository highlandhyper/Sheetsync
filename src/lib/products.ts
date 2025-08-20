
import type { Product } from './types';

export const products: Product[] = [
  {
    id: '1',
    name: 'Astro-Gazer Telescope',
    description: 'Explore the cosmos with this powerful home telescope. Perfect for beginners and seasoned astronomers alike.',
    price: 299.99,
    image: '/assets/telescope.png',
    dataAiHint: 'galaxy stars',
    category: 'Electronics',
  },
  {
    id: '2',
    name: 'Modernist Bookshelf',
    description: 'A stylish and functional bookshelf that adds a touch of minimalist elegance to any room.',
    price: 149.50,
    image: '/assets/bookshelf.png',
    dataAiHint: 'modern furniture',
    category: 'Furniture',
  },
  {
    id: '3',
    name: 'Artisan Pour-Over Coffee Set',
    description: 'Brew the perfect cup of coffee every morning with this beautifully crafted pour-over set.',
    price: 79.00,
    image: '/assets/coffee-set.png',
    dataAiHint: 'coffee morning',
    category: 'Kitchenware',
  },
  {
    id: '4',
    name: 'Evergreen Scented Candle',
    description: 'Bring the fresh scent of a forest into your home. Made with natural soy wax.',
    price: 24.99,
    image: '/assets/candle.png',
    dataAiHint: 'candle light',
    category: 'Home Goods',
  },
  {
    id: '5',
    name: 'Smart Fitness Watch',
    description: 'Track your workouts, heart rate, and sleep patterns with this sleek and intelligent fitness watch.',
    price: 199.99,
    image: '/assets/watch.png',
    dataAiHint: 'fitness watch',
    category: 'Electronics',
  },
  {
    id: '6',
    name: 'Gourmet Olive Oil',
    description: 'Extra virgin olive oil from a single origin, perfect for dressings and fine cooking.',
    price: 35.00,
    image: '/assets/olive-oil.png',
    dataAiHint: 'olive oil',
    category: 'Kitchenware',
  },
  {
    id: '7',
    name: 'Plush Velvet Throw Pillow',
    description: 'Add a pop of color and comfort to your living space with this luxurious velvet pillow.',
    price: 45.00,
    image: '/assets/pillow.png',
    dataAiHint: 'cozy pillow',
    category: 'Home Goods',
  },
  {
    id: '8',
    name: 'Wireless Noise-Cancelling Headphones',
    description: 'Immerse yourself in sound with these high-fidelity, noise-cancelling headphones.',
    price: 349.00,
    image: '/assets/headphones.png',
    dataAiHint: 'headphones music',
    category: 'Electronics',
  },
];

export const getProductById = (id: string): Product | undefined => {
  return products.find(p => p.id === id);
}

export const getProductsByNames = (names: string[]): Product[] => {
  const lowerCaseNames = names.map(name => name.toLowerCase());
  return products.filter(p => lowerCaseNames.includes(p.name.toLowerCase()));
};
