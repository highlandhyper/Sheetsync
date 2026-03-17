
import type {Metadata} from 'next';
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


export const metadata: Metadata = {
  title: 'SheetSync',
  description: 'Next-Gen Inventory Management',
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
  // Use a timestamp to force manifest refresh on new builds
  const manifestVersion = typeof window !== 'undefined' ? Date.now().toString() : "1.0.6";

  return (
    <html lang="en" suppressHydrationWarning>
       <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#29ABE2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href={`/manifest.json?v=${manifestVersion}`} />
        <link rel="apple-touch-startup-image" href="/logo-splash.jpg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Aggressive Production Recovery: Automatically refresh on ChunkLoadErrors or missing resources (404s)
              window.addEventListener('error', function(e) {
                // Detect if the error is a ChunkLoadError or a resource (JS/CSS) that failed to load
                const isResourceError = e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK');
                const message = e.message || "";
                const isChunkError = /Loading chunk [\\d]+ failed/i.test(message) || 
                                   /ChunkLoadError/i.test(message) ||
                                   /Script error/i.test(message);
                
                if (isChunkError || isResourceError) {
                  // Only care about our own static chunks failing
                  if (isResourceError) {
                    const url = e.target.src || e.target.href || "";
                    if (!url.includes('_next/static')) return; 
                  }

                  console.warn('SheetSync: Production chunk mismatch detected. Forcing clean recovery...');
                  
                  // Avoid infinite reload loops
                  const lastReload = sessionStorage.getItem('last_chunk_recovery');
                  const now = Date.now();
                  
                  if (!lastReload || (now - parseInt(lastReload)) > 15000) {
                    sessionStorage.setItem('last_chunk_recovery', now.toString());
                    
                    // Clear all caches to purge stale build manifest
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        for (let name of names) caches.delete(name);
                      });
                    }
                    
                    // Hard reload to fetch the latest production code
                    window.location.reload(true);
                  }
                }
              }, true); // Use capture phase to catch sub-resource errors

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SheetSync: SW registered');
                    
                    // Force update check on every load to prevent stale manifest mapping
                    registration.update();
                    
                    registration.onupdatefound = () => {
                      const installingWorker = registration.installing;
                      if (installingWorker) {
                        installingWorker.onstatechange = () => {
                          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('SheetSync: New version available, clearing cache and reloading...');
                            if ('caches' in window) {
                              caches.keys().then(names => {
                                for (let name of names) caches.delete(name);
                              });
                            }
                            window.location.reload();
                          }
                        };
                      }
                    };
                  }).catch(function(err) {
                    console.log('SheetSync: SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} ${poppins.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
