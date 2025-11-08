
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
    icon: null, 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                <MultiSelectProvider>
                  <DataCacheProvider>
                    {children}
                  </DataCacheProvider>
                  <Toaster />
                </MultiSelectProvider>
              </AccessControlProvider>
            </AuthProvider>
          </LocalSettingsAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

    