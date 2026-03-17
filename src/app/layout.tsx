
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
  const manifestVersion = typeof window !== 'undefined' ? Date.now().toString() : "1.0.5";

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
              // Production Recovery: Automatically refresh on ChunkLoadErrors (404s)
              window.addEventListener('error', function(e) {
                const chunkError = /Loading chunk [\\d]+ failed/i.test(e.message) || 
                                 /ChunkLoadError/i.test(e.message) ||
                                 /Script error/i.test(e.message);
                
                if (chunkError) {
                  console.warn('SheetSync: Code chunk mismatch detected. Performing clean recovery...');
                  
                  // Avoid infinite reload loops
                  const lastReload = sessionStorage.getItem('last_chunk_recovery');
                  const now = Date.now();
                  
                  if (!lastReload || (now - parseInt(lastReload)) > 10000) {
                    sessionStorage.setItem('last_chunk_recovery', now.toString());
                    
                    // Clear caches and force hard reload
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
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SheetSync: SW registered');
                    
                    // Force update check on every load
                    registration.update();
                    
                    registration.onupdatefound = () => {
                      const installingWorker = registration.installing;
                      if (installingWorker) {
                        installingWorker.onstatechange = () => {
                          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('SheetSync: New version available, reloading...');
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
