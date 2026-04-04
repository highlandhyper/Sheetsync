import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SheetSync Inventory Management',
    short_name: 'SheetSync',
    description: 'Cloud-Connected Real-time Inventory System',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#29abe2',
    icons: [
      {
        src: '/logo-pwa.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/logo-pwa.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      }
    ],
  };
}
