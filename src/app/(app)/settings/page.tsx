'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, KeyRound, ShieldCheck, Palette, Settings2, Lock, MapPin, UserPlus, Database, ExternalLink, AlertTriangle, CloudUpload, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { AccessControlManager } from '@/components/settings/access-control-manager';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { MultiSelectToggle } from '@/components/settings/multi-select-toggle';
import { AdminWelcomeToggle } from '@/components/settings/admin-welcome-toggle';
import { InactivityTimeoutInput } from '@/components/settings/inactivity-timeout-input';
import { StaffManager } from '@/components/settings/staff-manager';
import { LocationManager } from '@/components/settings/location-manager';
import { getMasterSpreadsheetUrlAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { BulkImportTerminal } from '@/components/settings/bulk-import-terminal';

export default function SettingsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [dbUrl, setDbUrl] = React.useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = React.useState(false);

  const handleOpenMasterDb = async () => {
    setIsDbLoading(true);
    const res = await getMasterSpreadsheetUrlAction();
    setIsDbLoading(false);
    
    if (res.success && res.data) {
        setDbUrl(res.data);
    } else {
        toast({ 
            variant: "destructive", 
            title: "Access Error", 
            description: res.message || "The spreadsheet identifier is not configured correctly." 
        });
    }
  };

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
        <Dialog onOpenChange={(open) => { if (open && title === "Master Database") handleOpenMasterDb(); }}>
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
                icon={CloudUpload}
                title="Bulk DB Update"
                description="Import large datasets (50k+ rows) via CSV mapping terminal."
                triggerText="Open Terminal"
                dialogClassName="sm:max-w-3xl"
            >
                <BulkImportTerminal />
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
                icon={Database}
                title="Master Database"
                description="Direct access to the source Google Sheet registry."
                triggerText="Explore Sheet"
                dialogClassName="sm:max-w-md"
            >
                <div className="space-y-6 py-2">
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-black uppercase text-yellow-800 tracking-tight">Structural Warning</p>
                            <p className="text-[10px] text-yellow-700/80 font-medium leading-relaxed">
                                Manual changes to column headers or sheet names can break the synchronization engine. Avoid renaming tabs or shifting the primary data structure.
                            </p>
                        </div>
                    </div>
                    
                    <Button 
                        asChild 
                        disabled={!dbUrl || isDbLoading} 
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        {dbUrl ? (
                            <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-5 w-5" />
                                Launch Spreadsheet
                            </a>
                        ) : (
                            <span className="flex items-center">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Authenticating...
                            </span>
                        )}
                    </Button>
                </div>
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
