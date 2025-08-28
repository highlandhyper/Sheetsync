
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, KeyRound } from 'lucide-react';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary flex items-center">
        <Cog className="mr-3 h-8 w-8" />
        Application Settings
      </h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card className="shadow-xl">
                <CardHeader>
                <CardTitle className="text-2xl">General Settings</CardTitle>
                <CardDescription>
                    Manage your application preferences and configurations.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1">
             <Card className="shadow-xl sticky top-24">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <KeyRound className="h-6 w-6 text-primary" />
                        <CardTitle className="text-2xl">Local Credentials</CardTitle>
                    </div>
                    <CardDescription>
                        Set the local username and password required to confirm critical inventory changes, like adjusting quantity.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LocalCredentialsForm />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
