'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Cog, 
    KeyRound, 
    ShieldCheck, 
    Palette, 
    Settings2, 
    Lock, 
    MapPin, 
    UserPlus, 
    Database, 
    ExternalLink, 
    AlertTriangle, 
    CloudUpload, 
    Loader2, 
    X,
    Layout,
    Globe,
    Layers,
    Shield
} from 'lucide-react';
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
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
  triggerText?: string;
  dialogClassName?: string;
  onOpen?: () => void;
  isManual?: boolean;
  onManualClick?: () => void;
  variant?: 'default' | 'premium' | 'security';
}

function SettingsCard({ 
    icon, 
    title, 
    description, 
    children, 
    triggerText = "Open Manager", 
    dialogClassName, 
    onOpen, 
    isManual, 
    onManualClick,
    variant = 'default'
}: SettingsCardProps) {
  
  const triggerButton = (
    <Button 
        variant={variant === 'premium' ? "default" : "outline"} 
        className={cn(
            "w-full mt-auto font-black uppercase tracking-widest text-[10px] h-10 rounded-xl transition-all",
            variant === 'premium' ? "shadow-lg shadow-primary/20" : "bg-muted/10 border-white/5"
        )}
        onClick={isManual ? onManualClick : undefined}
    >
        {isManual ? <Settings2 className="mr-2 h-3.5 w-3.5" /> : null}
        {triggerText}
    </Button>
  );

  return (
    <Card className="group relative flex flex-col h-full border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl overflow-hidden shadow-none hover:border-primary/20 transition-all duration-500">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <div className={cn(
              "p-3 rounded-2xl transition-all duration-500 group-hover:scale-110",
              variant === 'premium' ? "bg-primary/10 text-primary" : 
              variant === 'security' ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}>
            {React.createElement(icon, { className: "h-6 w-6" })}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg font-black uppercase tracking-tight leading-none pt-1">{title}</CardTitle>
            <CardDescription className="text-[10px] font-bold text-muted-foreground/60 leading-relaxed uppercase tracking-tighter">
                {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex items-end pt-2">
        {isManual ? (
            triggerButton
        ) : (
            <Dialog onOpenChange={(open) => { if (open && onOpen) onOpen(); }}>
                <DialogTrigger asChild>
                    {triggerButton}
                </DialogTrigger>
                <DialogContent className={cn("rounded-3xl border-none shadow-2xl", dialogClassName || "sm:max-w-2xl")}>
                    <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
                        {React.createElement(icon, { className: "h-6 w-6 text-primary" })}
                        {title}
                    </DialogTitle>
                    <DialogDescription className="font-medium text-sm">{description}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">{children}</div>
                </DialogContent>
            </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  
  const [dbUrl, setDbUrl] = React.useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = React.useState(false);
  const [isDbAuthOpen, setIsDbAuthOpen] = React.useState(false);
  const [isMasterDbDialogOpen, setIsMasterDbDialogOpen] = React.useState(false);
  
  const [isBulkAuthOpen, setIsBulkAuthOpen] = React.useState(false);
  const [isImportTerminalOpen, setIsImportTerminalOpen] = React.useState(false);

  const handleOpenMasterDb = async () => {
    if (dbUrl) return;
    setIsDbLoading(true);
    try {
        const res = await getMasterSpreadsheetUrlAction();
        if (res.success && res.data) {
            setDbUrl(res.data);
        } else {
            toast({ 
                variant: "destructive", 
                title: "Access Error", 
                description: res.message || "Spreadsheet ID is not configured." 
            });
            setIsMasterDbDialogOpen(false);
        }
    } catch (e) {
        toast({ variant: "destructive", title: "Auth Failure", description: "Failed to verify database session." });
        setIsMasterDbDialogOpen(false);
    } finally {
        setIsDbLoading(false);
    }
  };

  const handleDbAuthSuccess = () => {
      setIsDbAuthOpen(false);
      setIsMasterDbDialogOpen(true);
      handleOpenMasterDb();
  };

  const handleBulkImportAuthSuccess = () => {
      setIsBulkAuthOpen(false);
      setIsImportTerminalOpen(true);
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex flex-col gap-1 mb-12">
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
            <Cog className="mr-4 h-8 w-8 sm:h-12 sm:w-12 text-primary" strokeWidth={3} />
            System <span className="text-primary">Terminal</span>
        </h1>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] opacity-40 ml-1">
            Industrial Control & Security Interface
        </p>
      </div>

      <div className="space-y-16">
        
        {/* SECTION: INTERFACE & EXPERIENCE */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 px-1">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">01 Interface Protocol</h2>
                <div className="h-px flex-1 bg-gradient-to-right from-primary/10 to-transparent" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <SettingsCard
                    icon={Palette}
                    title="User Experience"
                    description="Themes, dark mode, and multi-select interface toggles."
                    triggerText="Preferences"
                    dialogClassName="sm:max-w-xl"
                >
                    <div className="grid grid-cols-1 gap-4">
                        <div className="rounded-2xl border-2 border-primary/5 p-5 flex flex-col bg-muted/5">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-1">Visual Theme</h3>
                            <p className="text-muted-foreground mb-4 text-[10px] font-medium leading-relaxed">Toggle between dark and light industrial modes.</p>
                            <ThemeToggle />
                        </div>
                        <div className="rounded-2xl border-2 border-primary/5 p-5 flex flex-col bg-muted/5">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-1">Batch Operations</h3>
                            <p className="text-muted-foreground mb-4 text-[10px] font-medium leading-relaxed">Enable checkboxes for high-volume inventory tasks.</p>
                            <MultiSelectToggle />
                        </div>
                    </div>
                </SettingsCard>
                
                {role === 'admin' && (
                    <SettingsCard
                        icon={Shield}
                        title="Session Security"
                        description="Auto-lock timers and administrative greeting protocols."
                        triggerText="Clearance"
                    >
                        <div className="space-y-4">
                            <div className="rounded-2xl border-2 border-primary/5 p-5 bg-muted/5">
                                <AdminWelcomeToggle />
                            </div>
                            <div className="rounded-2xl border-2 border-primary/5 p-5 bg-muted/5">
                                <InactivityTimeoutInput />
                            </div>
                        </div>
                    </SettingsCard>
                )}
            </div>
        </div>

        {/* SECTION: ASSET INFRASTRUCTURE */}
        {role === 'admin' && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">02 Warehouse Logic</h2>
                    <div className="h-px flex-1 bg-gradient-to-right from-primary/10 to-transparent" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <SettingsCard
                        icon={UserPlus}
                        title="Staff Registry"
                        description="Identify authorized personnel for logging operations."
                        triggerText="Registry"
                        dialogClassName="sm:max-w-md"
                    >
                        <StaffManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={MapPin}
                        title="Zones"
                        description="Define storage locations and warehouse regions."
                        triggerText="Zones"
                        dialogClassName="sm:max-w-md"
                    >
                        <LocationManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={ShieldCheck}
                        title="Viewer Access"
                        description="Restrict role-based visibility across system pages."
                        triggerText="Permissions"
                        dialogClassName="sm:max-w-3xl"
                    >
                        <AccessControlManager />
                    </SettingsCard>
                </div>
            </div>
        )}

        {/* SECTION: DATA TERMINAL */}
        {role === 'admin' && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">03 Data Core</h2>
                    <div className="h-px flex-1 bg-gradient-to-right from-primary/10 to-transparent" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <SettingsCard
                        icon={CloudUpload}
                        title="Bulk Sync"
                        description="Synchronize 80k+ records via industrial CSV terminal."
                        triggerText="Open Terminal"
                        variant="premium"
                        isManual={true}
                        onManualClick={() => setIsBulkAuthOpen(true)}
                    />

                    <SettingsCard
                        icon={Database}
                        title="Master DB"
                        description="Direct cloud access to the Google Sheet source."
                        triggerText="Launch Cloud"
                        isManual={true}
                        onManualClick={() => setIsDbAuthOpen(true)}
                    />

                    <SettingsCard
                        icon={KeyRound}
                        title="Local Keys"
                        description="Set secondary credentials for critical action overrides."
                        triggerText="Manage Keys"
                        variant="security"
                        dialogClassName="sm:max-w-md"
                    >
                        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl mb-4 flex items-start gap-3">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-yellow-800 leading-tight uppercase">Critical: These keys authorize deletes and quantity overrides.</p>
                        </div>
                        <LocalCredentialsForm />
                    </SettingsCard>
                </div>
            </div>
        )}

      </div>

      {/* SECURE OVERLAYS */}
      <Dialog open={isMasterDbDialogOpen} onOpenChange={setIsMasterDbDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
              <div className="p-8 pb-4">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tighter">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                            <Database className="h-8 w-8 text-primary" />
                        </div>
                        Cloud Access
                    </DialogTitle>
                    <DialogDescription className="font-medium pt-2">
                        System link to the Google Sheets industrial core.
                    </DialogDescription>
                </DialogHeader>
              </div>
              
              <div className="p-8 pt-4 space-y-8">
                  <div className="p-5 bg-yellow-500/5 border-2 border-yellow-500/10 rounded-2xl flex items-start gap-4">
                      <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0" />
                      <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-yellow-800 tracking-tight">Integrity Alert</p>
                          <p className="text-[10px] text-yellow-700/80 font-semibold leading-relaxed">
                              Manual structural changes to headers or tab names will disrupt the synchronization engine.
                          </p>
                      </div>
                  </div>
                  
                  {dbUrl ? (
                      <Button 
                          asChild 
                          className="w-full h-16 rounded-2xl text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                      >
                          <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-3 h-6 w-6" />
                              Open Spreadsheet
                          </a>
                      </Button>
                  ) : (
                      <Button 
                          disabled 
                          className="w-full h-16 rounded-2xl font-black uppercase tracking-widest opacity-50 bg-muted"
                      >
                          <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                          Verifying Link...
                      </Button>
                  )}
              </div>
              <div className="p-4 bg-muted/30 border-t flex justify-center">
                  <DialogClose asChild>
                      <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Terminate Session</Button>
                  </DialogClose>
              </div>
          </DialogContent>
      </Dialog>

      <AuthorizeActionDialog 
        isOpen={isDbAuthOpen}
        onOpenChange={setIsDbAuthOpen}
        onAuthorizationSuccess={handleDbAuthSuccess}
        fixedIdentifier={user?.email || undefined}
        actionDescription={`Identity check required for ${user?.email}. Enter your login password to unlock the registry core link.`}
      />

      <AuthorizeActionDialog 
        isOpen={isBulkAuthOpen}
        onOpenChange={setIsBulkAuthOpen}
        onAuthorizationSuccess={handleBulkImportAuthSuccess}
        fixedIdentifier={user?.email || undefined}
        actionDescription={`Identity check required for ${user?.email}. Enter your login password to unlock the industrial bulk sync terminal.`}
      />

      <Dialog open={isImportTerminalOpen} onOpenChange={setIsImportTerminalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] border-none shadow-3xl p-0">
              <div className="p-8 sm:p-12">
                <BulkImportTerminal />
              </div>
          </DialogContent>
      </Dialog>

      <div className="mt-20 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.6em] text-muted-foreground/10 flex items-center justify-center gap-4">
              SHEETSYNC CORE • 2024 • ENTERPRISE EDITION
          </p>
      </div>
    </div>
  );
}

