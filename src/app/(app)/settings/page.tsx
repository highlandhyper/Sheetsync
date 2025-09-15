
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, KeyRound, ShieldCheck, UserCog, Palette, Settings2 } from 'lucide-react';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { Separator } from '@/components/ui/separator';
import { AccessControlManager } from '@/components/settings/access-control-manager';
import { useAuth } from '@/context/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SettingsPage() {
  const { role } = useAuth();
  
  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary flex items-center">
        <Cog className="mr-3 h-8 w-8" />
        Application Settings
      </h1>
      
      <div className="space-y-4 max-w-lg mx-auto">
        
        {/* General Settings Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start h-16 text-left">
                <div className="flex items-center">
                    <Palette className="mr-4 h-6 w-6 text-primary" />
                    <div className="flex flex-col">
                        <span className="font-semibold text-base">General Settings</span>
                        <span className="text-sm text-muted-foreground">Appearance and theme.</span>
                    </div>
                </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">General Settings</DialogTitle>
              <DialogDescription>
                Manage your application preferences and configurations.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
               <div>
                    <h3 className="text-lg font-semibold mb-2">Theme Configuration</h3>
                    <p className="text-muted-foreground mb-3">
                    Choose your preferred theme for the application.
                    </p>
                    <ThemeToggle />
                </div>
                <Separator />
                <div className="pt-4">
                    <h3 className="text-lg font-semibold mb-2">Data Sync Settings</h3>
                    <p className="text-muted-foreground">
                    If connected to an external source like Google Sheets, settings for sheet IDs,
                    sync frequency, or specific ranges could be managed here. (Placeholder)
                    </p>
                </div>
                 <Separator />
                <div>
                    <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
                    <p className="text-muted-foreground">
                    Controls for enabling/disabling email or in-app notifications for events like
                    low stock, expiring items, etc. (Placeholder)
                    </p>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User Access Control Dialog (Admin only) */}
        {role === 'admin' && (
          <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start h-16 text-left">
                    <div className="flex items-center">
                        <ShieldCheck className="mr-4 h-6 w-6 text-primary" />
                        <div className="flex flex-col">
                            <span className="font-semibold text-base">User Access Control</span>
                            <span className="text-sm text-muted-foreground">Manage 'Viewer' role permissions.</span>
                        </div>
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
              <DialogHeader className="p-6 pb-2">
                 <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    <DialogTitle className="text-2xl">User Access Control</DialogTitle>
                  </div>
                <DialogDescription>
                  Enable or disable access to specific pages for the 'Viewer' role. Changes are saved automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="px-6">
                <ScrollArea className="h-full max-h-[60vh] pr-4">
                    <AccessControlManager />
                </ScrollArea>
              </div>
               <DialogFooter className="p-6 pt-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Local Credentials Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start h-16 text-left">
                <div className="flex items-center">
                    <KeyRound className="mr-4 h-6 w-6 text-primary" />
                    <div className="flex flex-col">
                        <span className="font-semibold text-base">Local Credentials</span>
                        <span className="text-sm text-muted-foreground">Manage credentials for critical actions.</span>
                    </div>
                </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
               <div className="flex items-center gap-3 mb-2">
                    <KeyRound className="h-6 w-6 text-primary" />
                    <DialogTitle className="text-2xl">Local Credentials</DialogTitle>
                </div>
              <DialogDescription>
                Set the local username and password required to confirm critical inventory changes, like adjusting quantity.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <LocalCredentialsForm />
            </div>
            {/* Footer is part of the LocalCredentialsForm component */}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
