'use client';

import type { PropsWithChildren } from 'react';
import { AuthProvider } from '@/context/auth-context';
import { LocalSettingsAuthProvider } from '@/context/local-settings-auth-context';
import { ThemeProvider } from 'next-themes';
import { AccessControlProvider } from '@/context/access-control-context';
import { MultiSelectProvider } from '@/context/multi-select-context';
import { DataCacheProvider } from '@/context/data-cache-context';
import { GeneralSettingsProvider } from '@/context/general-settings-context';
import { NotificationProvider } from '@/context/notification-context';
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: PropsWithChildren) {
  return (
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
                <NotificationProvider>
                  <DataCacheProvider>
                    {children}
                    <Toaster />
                  </DataCacheProvider>
                </NotificationProvider>
              </MultiSelectProvider>
            </GeneralSettingsProvider>
          </AccessControlProvider>
        </AuthProvider>
      </LocalSettingsAuthProvider>
    </ThemeProvider>
  );
}
