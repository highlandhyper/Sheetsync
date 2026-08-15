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
    Shield,
    Terminal
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
import { Badge } from '@/components/ui/badge';

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
  variant?: 'default' | 'premium' | 'security' | 'logic';
  badge?: string;
}

function SettingsCard({ 
    icon, 
    title, 
    description, 
    children, 
    triggerText = "Configure", 
    dialogClassName, 
    onOpen, 
    isManual, 
    onManualClick,
    variant = 'default',
    badge
}: SettingsCardProps) {
  
  const triggerButton = (
    <Button 
        variant={variant === 'premium' ? "default" : "outline"} 
        className={cn(
            "w-full mt-auto font-black uppercase tracking-widest text-[10px] h-11 rounded-xl transition-all duration-300",
            variant === 'premium' ? "shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90" : "bg-muted/10 border-white/5 hover:bg-primary/5 hover:text-primary hover:border-primary/20",
            variant === 'security' ? "hover:border-destructive/30 hover:text-destructive" : ""
        )}
        onClick={isManual ? onManualClick : undefined}
    >
        {isManual ? <Settings2 className="mr-2 h-3.5 w-3.5" /> : null}
        {triggerText}
    </Button>
  );

  return (
    <Card className="group relative flex flex-col h-full border-white/5 bg-card/40 backdrop-blur-3xl rounded-[2rem] overflow-hidden shadow-none hover:border-primary/20 transition-all duration-500">
      {/* CARD DECORATION */}
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
         {badge && (
             <Badge variant="outline" className="font-black text-[8px] uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                {badge}
             </Badge>
         )}
      </div>

      <CardHeader className="pb-4 pt-8 px-8">
        <div className="flex flex-col gap-6">
          <div className={cn(
              "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg",
              variant === 'premium' ? "bg-primary/10 text-primary group-hover:shadow-primary/20" : 
              variant === 'security' ? "bg-destructive/10 text-destructive group-hover:shadow-destructive/20" : 
              variant === 'logic' ? "bg-accent/10 text-accent-foreground group-hover:shadow-accent/20" :
              "bg-muted text-muted-foreground"
          )}>
            {React.createElement(icon, { className: "h-6 w-6", strokeWidth: 2.5 })}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl font-black uppercase tracking-tight leading-none">{title}</CardTitle>
            <CardDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed uppercase tracking-tighter">
                {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex items-end pt-2 pb-8 px-8">
        {isManual ? (
            triggerButton
        ) : (
            <Dialog onOpenChange={(open) => { if (open && onOpen) onOpen(); }}>
                <DialogTrigger asChild>
                    {triggerButton}
                </DialogTrigger>
                <DialogContent className={cn("rounded-[2.5rem] border-none shadow-3xl", dialogClassName || "sm:max-w-2xl")}>
                    <div className="p-2">
                        <DialogHeader className="mb-6">
                        <div className="flex items-center gap-4 mb-2">
                             <div className="p-3 bg-primary/10 rounded-2xl">
                                {React.createElement(icon, { className: "h-6 w-6 text-primary" })}
                             </div>
                             <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter">
                                    {title}
                                </DialogTitle>
                                <DialogDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">
                                    {description}
                                </DialogDescription>
                             </div>
                        </div>
                        </DialogHeader>
                        <div className="py-2">{children}</div>
                    </div>
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
    <div className="container max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* SYSTEM HEADER */}
      <div className="flex flex-col gap-2 mb-16 relative">
        <div className="absolute -left-12 top-0 h-full w-1 bg-primary/20 rounded-full hidden lg:block" />
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
            <Terminal className="mr-6 h-10 w-10 sm:h-14 sm:w-14 text-primary" strokeWidth={3} />
            System <span className="text-primary">Terminal</span>
        </h1>
        <div className="flex items-center gap-4 ml-1">
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.6em] opacity-40">
                Operational Registry Control • v4.0.2
            </p>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[9px] uppercase tracking-widest px-2 py-0.5 animate-pulse">Live Link Active</Badge>
        </div>
      </div>

      <div className="space-y-24">
        
        {/* SECTION 01: INTERFACE PROTOCOL */}
        <div className="space-y-8">
            <div className="flex items-center gap-4 px-1">
                <div className="text-3xl font-black text-primary/10 tracking-tighter">01</div>
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-primary">Interface Protocol</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <SettingsCard
                    icon={Palette}
                    title="User Experience"
                    description="Personalize the industrial interface and batch operation toggles."
                    triggerText="Manage Experience"
                    dialogClassName="sm:max-w-xl"
                    badge="UI CORE"
                >
                    <div className="grid grid-cols-1 gap-6">
                        <div className="rounded-[2rem] border-2 border-primary/5 p-8 flex flex-col bg-muted/5 shadow-inner">
                            <h3 className="text-base font-black uppercase tracking-widest mb-2">Visual Theme</h3>
                            <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed uppercase tracking-tight">Synchronize interface luminosity with environment lighting.</p>
                            <ThemeToggle />
                        </div>
                        <div className="rounded-[2rem] border-2 border-primary/5 p-8 flex flex-col bg-muted/5 shadow-inner">
                            <h3 className="text-base font-black uppercase tracking-widest mb-2">Batch Processing</h3>
                            <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed uppercase tracking-tight">Enable high-volume log manipulation via multi-select checkboxes.</p>
                            <MultiSelectToggle />
                        </div>
                    </div>
                </SettingsCard>
                
                {role === 'admin' && (
                    <SettingsCard
                        icon={Shield}
                        title="Session Armor"
                        description="Security handshake protocols and automated inactivity locking."
                        triggerText="Security Clearances"
                        variant="security"
                        badge="SEC OPS"
                    >
                        <div className="space-y-6">
                            <div className="rounded-[2rem] border-2 border-destructive/5 p-8 bg-muted/5 shadow-inner">
                                <h3 className="text-base font-black uppercase tracking-widest mb-2">Greeting Protocol</h3>
                                <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed uppercase tracking-tight">Display administrative welcome sequence on session start.</p>
                                <AdminWelcomeToggle />
                            </div>
                            <div className="rounded-[2rem] border-2 border-destructive/5 p-8 bg-muted/5 shadow-inner">
                                <h3 className="text-base font-black uppercase tracking-widest mb-2">Auto-Lock Timer</h3>
                                <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed uppercase tracking-tight">Terminate active terminal access after idle period.</p>
                                <InactivityTimeoutInput />
                            </div>
                        </div>
                    </SettingsCard>
                )}
            </div>
        </div>

        {/* SECTION 02: WAREHOUSE LOGIC */}
        {role === 'admin' && (
            <div className="space-y-8">
                <div className="flex items-center gap-4 px-1">
                    <div className="text-3xl font-black text-primary/10 tracking-tighter">02</div>
                    <h2 className="text-sm font-black uppercase tracking-[0.4em] text-primary">Warehouse Logic</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <SettingsCard
                        icon={UserPlus}
                        title="Staff Registry"
                        description="Modify the authoritative list of personnel eligible for inventory logging."
                        triggerText="Personnel Database"
                        variant="logic"
                        dialogClassName="sm:max-w-md"
                        badge="HR SYNC"
                    >
                        <StaffManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={MapPin}
                        title="Storage Zones"
                        description="Define physical storage locations and warehouse regions."
                        triggerText="Zone Mapping"
                        variant="logic"
                        dialogClassName="sm:max-w-md"
                        badge="LOC DATA"
                    >
                        <LocationManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={ShieldCheck}
                        title="Viewer Matrix"
                        description="Granular control over restricted role page visibility and feature sets."
                        triggerText="Access Matrix"
                        variant="logic"
                        dialogClassName="sm:max-w-3xl"
                        badge="RBAC"
                    >
                        <AccessControlManager />
                    </SettingsCard>
                </div>
            </div>
        )}

        {/* SECTION 03: DATA CORE */}
        {role === 'admin' && (
            <div className="space-y-8">
                <div className="flex items-center gap-4 px-1">
                    <div className="text-3xl font-black text-primary/10 tracking-tighter">03</div>
                    <h2 className="text-sm font-black uppercase tracking-[0.4em] text-primary">Data Core</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <SettingsCard
                        icon={CloudUpload}
                        title="Industrial Bulk Sync"
                        description="Synchronize 80k+ records via high-performance industrial terminal."
                        triggerText="Launch Terminal"
                        variant="premium"
                        isManual={true}
                        onManualClick={() => setIsBulkAuthOpen(true)}
                        badge="HIGH VOL"
                    />

                    <SettingsCard
                        icon={Database}
                        title="Registry Source"
                        description="Direct authenticated tunnel to the Google Sheets industrial core."
                        triggerText="Access Cloud Source"
                        isManual={true}
                        onManualClick={() => setIsDbAuthOpen(true)}
                        badge="RAW DATA"
                    />

                    <SettingsCard
                        icon={KeyRound}
                        title="System Keys"
                        description="Manage local administrative keys for critical logic overrides."
                        triggerText="Manage Access Keys"
                        variant="security"
                        dialogClassName="sm:max-w-md"
                        badge="CORE SEC"
                    >
                        <div className="p-6 bg-yellow-500/10 border-2 border-yellow-500/20 rounded-[2rem] mb-8 flex items-start gap-4">
                            <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0 mt-1" />
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase text-yellow-800 tracking-tight leading-none">Security Alert</p>
                                <p className="text-[10px] font-bold text-yellow-700 leading-relaxed uppercase tracking-tighter">
                                    These credentials authorize stock deletion and quantity overrides. Guard these keys with extreme prejudice.
                                </p>
                            </div>
                        </div>
                        <LocalCredentialsForm />
                    </SettingsCard>
                </div>
            </div>
        )}

      </div>

      {/* SECURE OVERLAYS */}
      <Dialog open={isMasterDbDialogOpen} onOpenChange={setIsMasterDbDialogOpen}>
          <DialogContent className="sm:max-w-lg rounded-[3rem] border-none shadow-3xl p-0 overflow-hidden bg-background">
              <div className="p-10 pb-4">
                <DialogHeader>
                    <div className="flex items-center gap-5 mb-4">
                        <div className="bg-primary/10 p-4 rounded-[1.5rem] shadow-lg shadow-primary/5">
                            <Database className="h-10 w-10 text-primary" strokeWidth={2.5} />
                        </div>
                        <div>
                            <DialogTitle className="text-4xl font-black uppercase tracking-tighter">
                                Cloud Tunnel
                            </DialogTitle>
                            <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest text-primary border-primary/20">Authorized Access</Badge>
                        </div>
                    </div>
                    <DialogDescription className="font-bold text-sm leading-relaxed uppercase tracking-tight text-muted-foreground">
                        Establishing secure system link to the Google Sheets industrial registry.
                    </DialogDescription>
                </DialogHeader>
              </div>
              
              <div className="p-10 pt-4 space-y-10">
                  <div className="p-6 bg-yellow-500/5 border-2 border-yellow-500/10 rounded-[2rem] flex items-start gap-5">
                      <AlertTriangle className="h-8 w-8 text-yellow-600 shrink-0 mt-1" />
                      <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-yellow-800 tracking-widest">Integrity Protocol</p>
                          <p className="text-[11px] text-yellow-700/70 font-semibold leading-relaxed uppercase tracking-tighter">
                              Manual structural modifications to headers, column order, or tab definitions will disrupt the synchronization engine. Proceed with extreme caution.
                          </p>
                      </div>
                  </div>
                  
                  {dbUrl ? (
                      <Button 
                          asChild 
                          className="w-full h-20 rounded-[2rem] text-xl font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 text-white"
                      >
                          <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-4 h-8 w-8" strokeWidth={3} />
                              Open Registry
                          </a>
                      </Button>
                  ) : (
                      <Button 
                          disabled 
                          className="w-full h-20 rounded-[2rem] font-black uppercase tracking-widest opacity-50 bg-muted/50 border-2 border-dashed border-muted"
                      >
                          <Loader2 className="mr-4 h-8 w-8 animate-spin text-primary" />
                          Handshaking...
                      </Button>
                  )}
              </div>
              <div className="p-6 bg-muted/30 border-t flex justify-center">
                  <DialogClose asChild>
                      <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100 hover:bg-transparent">Terminate Link Session</Button>
                  </DialogClose>
              </div>
          </DialogContent>
      </Dialog>

      <AuthorizeActionDialog 
        isOpen={isDbAuthOpen}
        onOpenChange={setIsDbAuthOpen}
        onAuthorizationSuccess={handleDbAuthSuccess}
        fixedIdentifier={user?.email || undefined}
        actionDescription={`Identity check required for ${user?.email}. Provide account credentials to establish a secure registry tunnel.`}
      />

      <AuthorizeActionDialog 
        isOpen={isBulkAuthOpen}
        onOpenChange={setIsBulkAuthOpen}
        onAuthorizationSuccess={handleBulkImportAuthSuccess}
        fixedIdentifier={user?.email || undefined}
        actionDescription={`Identity check required for ${user?.email}. Enterprise synchronization terminal requires verified administrative clearance.`}
      />

      <Dialog open={isImportTerminalOpen} onOpenChange={setIsImportTerminalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-[3rem] border-none shadow-3xl p-0">
              <div className="p-10 sm:p-16">
                <BulkImportTerminal />
              </div>
          </DialogContent>
      </Dialog>

      <div className="mt-24 text-center pb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.8em] text-muted-foreground/10 flex items-center justify-center gap-8">
              SHEETSYNC CORE • SECURED TERMINAL • 2024
          </p>
      </div>
    </div>
  );
}
