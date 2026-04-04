'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, KeyRound, ShieldCheck, Palette, Settings2, Lock, Users, MapPin, UserPlus } from 'lucide-react';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { AccessControlManager } from '@/components/settings/access-control-manager';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MultiSelectToggle } from '@/components/settings/multi-select-toggle';
import { AdminWelcomeToggle } from '@/components/settings/admin-welcome-toggle';
import { InactivityTimeoutInput } from '@/components/settings/inactivity-timeout-input';
import { StaffManager } from '@/components/settings/staff-manager';
import { LocationManager } from '@/components/settings/location-manager';
import { UserManager } from '@/components/settings/user-manager';

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
            <CardTitle className="text-xl mb-1 tracking-tight">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex items-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-auto font-bold">
                <Settings2 className="mr-2 h-4 w-4" />
                {triggerText}
            </Button>
          </DialogTrigger>
          <DialogContent className={dialogClassName || "sm:max-w-2xl"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">{React.createElement(icon, { className: "h-5 w-5" })}{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="py-4">{children}</div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-black mb-8 text-primary flex items-center tracking-tight uppercase">
        < Cog className="mr-3 h-8 w-8" />
        System Settings
      </h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        <DialogCard
          icon={Palette}
          title="General Settings"
          description="Manage theme, interface preferences, and other global application settings."
          triggerText="Manage Preferences"
          dialogClassName="sm:max-w-xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 flex flex-col">
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold mb-1 text-sm">Light/Dark Mode</h3>
                  <p className="text-muted-foreground mb-4 text-xs">
                    System preference or manual toggle.
                  </p>
                </div>
                <ThemeToggle />
              </div>

              <div className="rounded-lg border p-4 flex flex-col">
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold mb-1 text-sm">Multi-Select Mode</h3>
                  <p className="text-muted-foreground mb-4 text-xs">
                    Enable checkboxes for bulk actions.
                  </p>
                </div>
                <MultiSelectToggle />
              </div>
              
              {role === 'admin' && (
                <>
                  <div className="rounded-lg border p-4 flex flex-col">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-1 text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary"/> Admin Welcome</h3>
                      <p className="text-muted-foreground mb-4 text-xs">
                        Show greeting screen on login.
                      </p>
                    </div>
                    <AdminWelcomeToggle />
                  </div>
                  
                  <div className="rounded-lg border p-4 flex flex-col">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-1 text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-primary"/> Session Lock</h3>
                      <p className="text-muted-foreground mb-4 text-xs">
                        Auto-lock due to inactivity.
                      </p>
                    </div>
                    <InactivityTimeoutInput />
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogCard>

        {role === 'admin' && (
          <>
            <DialogCard
                icon={UserPlus}
                title="User Management"
                description="Manage team accounts, registry sync, and system-wide roles."
                triggerText="Control Registry"
                dialogClassName="sm:max-w-6xl"
            >
                <UserManager />
            </DialogCard>

            <DialogCard
                icon={Users}
                title="Staff Registry"
                description="Add, edit, or remove staff members from the logging catalog."
                triggerText="Manage Names"
                dialogClassName="sm:max-w-md"
            >
                <StaffManager />
            </DialogCard>

            <DialogCard
                icon={MapPin}
                title="Location Manager"
                description="Customize the storage zones and warehouse locations."
                triggerText="Manage Locations"
                dialogClassName="sm:max-w-md"
            >
                <LocationManager />
            </DialogCard>

            <DialogCard
                icon={KeyRound}
                title="Local Credentials"
                description="Set the username and password needed for critical changes."
                triggerText="Manage Local Key"
                dialogClassName="sm:max-w-md"
            >
                <LocalCredentialsForm />
            </DialogCard>

            <DialogCard
                icon={ShieldCheck}
                title="Viewer Access"
                description="Control which pages the 'Viewer' role can access."
                triggerText="Manage Access"
                dialogClassName="sm:max-w-3xl"
            >
                <AccessControlManager />
            </DialogCard>
          </>
        )}

      </div>
    </div>
  );
}
