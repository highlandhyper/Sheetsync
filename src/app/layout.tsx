import type {Metadata} from 'next';
import { Inter, Roboto_Mono, Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { LocalSettingsAuthProvider } from '@/context/local-settings-auth-context';
import { ThemeProvider } from 'next-themes';
import { AccessControlProvider } from '@/context/access-control-context';
import { MultiSelectProvider } from '@/context/multi-select-context';
import { DataCacheProvider } from '@/context/data-cache-context';
import { GeneralSettingsProvider } from '@/context/general-settings-context';

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
  const manifestVersion = "1.0.1";

  return (
    <html lang="en" suppressHydrationWarning>
       <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#29ABE2" />
        <link rel="manifest" href={`/manifest.json?v=${manifestVersion}`} />
        <link rel="apple-touch-startup-image" href="/logo-splash.jpg" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} ${poppins.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocalSettingsAuthProvider>
            <AuthProvider>
              <AccessControlProvider>
                <GeneralSettingsProvider>
                  <MultiSelectProvider>
                    <DataCacheProvider>
                      {children}
                    </DataCacheProvider>
                    <Toaster />
                  </MultiSelectProvider>
                </GeneralSettingsProvider>
              </AccessControlProvider>
            </AuthProvider>
          </LocalSettingsAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
