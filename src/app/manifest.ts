import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SheetSync',
    short_name: 'SheetSync',
    description: 'Cloud-connected real-time inventory management system.',

    start_url: '/',
    scope: '/',
    display: 'standalone',

    background_color: '#f8fafc',
    theme_color: '#29abe2',

    lang: 'en',
    dir: 'ltr',
    orientation: 'portrait-primary',

    categories: ['business', 'productivity', 'utilities'],

    icons: [
      {
        src: '/logo-pwa.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/logo-pwa.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}
