import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono, Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  display: 'swap',
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#29abe2',
};

export const metadata: Metadata = {
  title: 'SheetSync',
  description: 'Next-Gen Inventory Management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SheetSync',
  },
  icons: {
    icon: '/logo.ico',
    apple: '/logo-pwa.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
       <head>
        <link rel="icon" href="/logo.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/logo-pwa.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Aggressive Production Recovery: Automatically refresh on ChunkLoadErrors
              window.addEventListener('error', function(e) {
                const isResourceError = e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK');
                const message = e.message || "";
                const isChunkError = /Loading chunk [\\d]+ failed/i.test(message) || 
                                   /ChunkLoadError/i.test(message);
                
                if (isChunkError || isResourceError) {
                  if (isResourceError) {
                    const url = e.target.src || e.target.href || "";
                    if (!url.includes('_next/static')) return; 
                  }

                  console.warn('SheetSync: Asset mismatch detected. Recovering...');
                  
                  const lastReload = sessionStorage.getItem('last_chunk_recovery');
                  const now = Date.now();
                  
                  if (!lastReload || (now - parseInt(lastReload)) > 10000) {
                    sessionStorage.setItem('last_chunk_recovery', now.toString());
                    
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        for (let name of names) caches.delete(name);
                      });
                    }
                    window.location.reload(true);
                  }
                }
              }, true);

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SheetSync: SW registered');
                    reg.update();
                  }).catch(function(err) {
                    console.error('SheetSync: SW failed', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} ${poppins.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
