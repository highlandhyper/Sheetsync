
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, KeyRound, ShieldCheck, Palette, ListChecks, Settings2, Lock } from 'lucide-react';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { AccessControlManager } from '@/components/settings/access-control-manager';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MultiSelectToggle } from '@/components/settings/multi-select-toggle';
import { AdminWelcomeToggle } from '@/components/settings/admin-welcome-toggle';
import { Separator } from '@/components/ui/separator';
import { InactivityTimeoutInput } from '@/components/settings/inactivity-timeout-input';

export default function SettingsPage() {
  const { role } = useAuth();

  const DialogCard = ({ icon, title, description, children, triggerText = "Manage", dialogClassName }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode, triggerText?: string, dialogClassName?: string }) => (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-lg">
            {React.createElement(icon, { className: "h-6 w-6 text-primary" })}
          </div>
          <div>
            <CardTitle className="text-xl mb-1">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex items-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-auto">
                <Settings2 className="mr-2 h-4 w-4" />
                {triggerText}
            </Button>
          </DialogTrigger>
          <DialogContent className={dialogClassName || "sm:max-w-2xl"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">{React.createElement(icon, { className: "h-5 w-5" })}{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="py-4 overflow-y-auto pr-6">{children}</div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-8 text-primary flex items-center">
        <Cog className="mr-3 h-8 w-8" />
        Application Settings
      </h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        <DialogCard
          icon={Palette}
          title="General Settings"
          description="Manage theme, interface preferences, and other general application settings."
          triggerText="Manage General Settings"
          dialogClassName="sm:max-w-2xl"
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Theme</h3>
              <p className="text-muted-foreground mb-3 text-sm">
                Choose a light, dark, or system-default theme.
              </p>
              <ThemeToggle />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Multi-Select Mode</h3>
               <p className="text-muted-foreground mb-3 text-sm">
                Enable or disable checkboxes for bulk actions on inventory lists.
              </p>
              <MultiSelectToggle />
            </div>
            {role === 'admin' && (
              <>
                <Separator />
                <div className="space-y-6 rounded-lg border border-dashed p-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/> Admin Settings</h3>
                  <div>
                    <h4 className="font-medium mb-1">Admin Welcome Screen</h4>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Show the "Welcome back, Chief!" screen on login.
                    </p>
                    <AdminWelcomeToggle />
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-1">Session Lock</h4>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Manage automatic session locking for inactivity.
                    </p>
                    <InactivityTimeoutInput />
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogCard>

        <DialogCard
          icon={KeyRound}
          title="Local Credentials"
          description="Set the local username and password needed for critical inventory changes."
          triggerText="Manage Credentials"
          dialogClassName="sm:max-w-md"
        >
          <LocalCredentialsForm />
        </DialogCard>

        {role === 'admin' && (
          <DialogCard
            icon={ShieldCheck}
            title="User Access Control"
            description="Enable or disable access to specific pages for the 'Viewer' role."
            triggerText="Manage Access"
            dialogClassName="sm:max-w-3xl"
          >
            <AccessControlManager />
          </DialogCard>
        )}

      </div>
    </div>
  );
}
