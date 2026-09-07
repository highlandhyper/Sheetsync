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
    Terminal,
    Bell,
    CheckCircle2,
    Save,
    BellDot,
    Volume2,
    Music,
    Smartphone,
    MessageSquare,
    Info,
    SmartphoneNfc,
    Wifi,
    WifiOff,
    ShieldAlert,
    Cpu
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
import { getMasterSpreadsheetUrlAction, checkSmsConfigAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { BulkImportTerminal } from '@/components/settings/bulk-import-terminal';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useGeneralSettings } from '@/context/general-settings-context';
import { useNotifications } from '@/context/notification-context';
import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AudioFeedbackToggle } from '@/components/settings/audio-feedback-toggle';
import { IdentityAudioSelector } from '@/components/settings/identity-audio-selector';

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
  const toneClass =
    variant === 'premium'
      ? 'bg-primary/10 text-primary'
      : variant === 'security'
        ? 'bg-destructive/10 text-destructive'
        : variant === 'logic'
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground';

  const triggerButton = (
    <Button
      variant={variant === 'premium' ? 'default' : 'outline'}
      onClick={isManual ? onManualClick : undefined}
      className={cn(
        'h-9 shrink-0 rounded-lg px-3 text-[10px] font-semibold shadow-none',
        variant === 'premium'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border/60 bg-background hover:bg-muted/60',
        variant === 'security' &&
          'hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive'
      )}
    >
      {isManual && <Settings2 className="mr-1.5 h-3.5 w-3.5" />}
      {triggerText}
    </Button>
  );

  return (
    <div className="group min-w-0 bg-card transition-colors hover:bg-muted/[0.18]">
      <div className="flex min-w-0 flex-col gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              toneClass
            )}
          >
            {React.createElement(icon, {
              className: 'h-4 w-4',
              strokeWidth: 2.2,
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-foreground sm:text-sm">
                {title}
              </h3>

              {badge && (
                <Badge
                  variant="outline"
                  className="max-w-[100px] shrink-0 truncate rounded-md border-border/60 bg-muted/40 px-1.5 py-0 text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {badge}
                </Badge>
              )}
            </div>

            <p className="mt-0.5 line-clamp-2 max-w-3xl text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">
              {description}
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 justify-end md:w-auto">
          {isManual ? (
            triggerButton
          ) : (
            <Dialog onOpenChange={(open) => { if (open && onOpen) onOpen(); }}>
              <DialogTrigger asChild>{triggerButton}</DialogTrigger>

              <DialogContent
                className={cn(
                  'w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl',
                  dialogClassName || 'sm:max-w-2xl'
                )}
              >
                <div className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col">
                  <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/20 px-4 py-3.5 sm:px-5 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          toneClass
                        )}
                      >
                        {React.createElement(icon, {
                          className: 'h-4 w-4',
                          strokeWidth: 2.2,
                        })}
                      </div>

                      <div className="min-w-0">
                        <DialogTitle className="truncate text-base font-semibold tracking-tight sm:text-lg">
                          {title}
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">
                          {description}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="min-w-0 overflow-y-auto p-4 sm:p-5">
                    {children}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationTerminal() {
  const { settings, setSetting } = useGeneralSettings();
  const { requestPermission } = useNotifications();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = React.useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setIsRequesting(true);
      const granted = await requestPermission();
      setIsRequesting(false);

      if (granted) {
        setSetting('isBrowserNotificationsEnabled', true);
        toast({ title: "Alerts Enabled", description: "Browser notifications are now active." });
      } else {
        toast({
          variant: "destructive",
          title: "Action Required",
          description: "Please enable notification permissions in your browser settings."
        });
      }
    } else {
      setSetting('isBrowserNotificationsEnabled', false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BellDot className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Browser notifications</p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
            Receive OTP and security alerts directly on this device.
          </p>
        </div>

        {isRequesting ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Switch
            checked={settings.isBrowserNotificationsEnabled}
            onCheckedChange={handleToggle}
            disabled={isRequesting}
          />
        )}
      </div>

      {settings.isBrowserNotificationsEnabled && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em]">
            Notifications active
          </span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { settings, setSetting } = useGeneralSettings();
  const { permissions, setSmsRecipientNumber, setSmsDeviceId } = useAccessControl();
  
  const [dbUrl, setDbUrl] = React.useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = React.useState(false);
  const [isDbAuthOpen, setIsDbAuthOpen] = React.useState(false);
  const [isMasterDbDialogOpen, setIsMasterDbDialogOpen] = React.useState(false);
  
  const [isBulkAuthOpen, setIsBulkAuthOpen] = React.useState(false);
  const [isImportTerminalOpen, setIsImportTerminalOpen] = React.useState(false);

  const [smsEnvStatus, setSmsEnvStatus] = React.useState<{ hasApiKey: boolean; hasDeviceId: boolean } | null>(null);

  React.useEffect(() => {
    if (role === 'admin') {
        checkSmsConfigAction().then(res => {
            if (res.success && res.data) setSmsEnvStatus(res.data);
        });
    }
  }, [role]);

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
    <div className="mx-auto w-full min-w-0 max-w-[1680px] overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 animate-in fade-in duration-300 sm:px-4 md:px-5 lg:px-6 lg:pb-10">
      <header className="mb-5 min-w-0 sm:mb-7">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-12 sm:w-12">
            <Settings2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Settings
            </h1>
            <p className="mt-0.5 max-w-3xl text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">
              Manage application behavior, alerts, warehouse access, and system connections.
            </p>
          </div>

          <Badge
            variant="outline"
            className="hidden shrink-0 rounded-lg border-border/60 bg-background px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:inline-flex"
          >
            v5.0.0
          </Badge>
        </div>

        <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-0.5 lg:hidden">
          <a href="#interface-settings" className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-[9px] font-semibold text-foreground">
            General
          </a>
          {role === 'admin' && (
            <a href="#warehouse-settings" className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-[9px] font-semibold text-foreground">
              Warehouse
            </a>
          )}
          {role === 'admin' && (
            <a href="#system-settings" className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-[9px] font-semibold text-foreground">
              System
            </a>
          )}
        </div>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            <nav className="overflow-hidden rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
              <a href="#interface-settings" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                <Palette className="h-4 w-4 text-primary" />
                General
              </a>
              {role === 'admin' && (
                <a href="#warehouse-settings" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                  <Layers className="h-4 w-4 text-primary" />
                  Warehouse
                </a>
              )}
              {role === 'admin' && (
                <a href="#system-settings" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                  <Database className="h-4 w-4 text-primary" />
                  System
                </a>
              )}
            </nav>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Access level
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {role === 'admin' ? 'Administrator' : 'Viewer'}
              </p>

              {role === 'admin' && (
                <div className="mt-3 flex items-center gap-2 text-[9px] font-medium text-muted-foreground">
                  <span className={cn(
                    'h-2 w-2 rounded-full',
                    smsEnvStatus?.hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'
                  )} />
                  {smsEnvStatus?.hasApiKey ? 'SMS gateway ready' : 'SMS gateway needs setup'}
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-7 sm:space-y-8">
        
        <section id="interface-settings" className="scroll-mt-6 space-y-3">
            <div className="px-0.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">General</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                  Interface preferences, notifications, communication, and session behavior.
                </p>
            </div>
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <SettingsCard
                    icon={Palette}
                    title="Appearance & behavior"
                    description="Theme, multi-select behavior, audio feedback, and identity prompts."
                    triggerText="Open"
                    dialogClassName="sm:max-w-4xl"
                    badge="GENERAL"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                            <h3 className="mb-1 text-[11px] font-semibold tracking-tight">Visual Theme</h3>
                            <p className="mb-3 text-[10px] font-medium leading-4 text-muted-foreground">Sync luminosity with lighting.</p>
                            <ThemeToggle />
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                            <h3 className="mb-1 text-[11px] font-semibold tracking-tight">Batch Processing</h3>
                            <p className="mb-3 text-[10px] font-medium leading-4 text-muted-foreground">Enable high-volume log manipulation.</p>
                            <MultiSelectToggle />
                        </div>
                        {role === 'admin' && (
                          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                              <h3 className="mb-1 text-[11px] font-semibold tracking-tight flex items-center gap-2">
                                <Volume2 className="h-3.5 w-3.5" /> Audio Feedback
                              </h3>
                              <p className="mb-3 text-[10px] font-medium leading-4 text-muted-foreground">Global "Thank You" sounds.</p>
                              <AudioFeedbackToggle />
                          </div>
                        )}
                        {role === 'admin' && (
                          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                              <h3 className="mb-1 text-[11px] font-semibold tracking-tight flex items-center gap-2">
                                <Music className="h-3.5 w-3.5" /> Identity Prompt
                              </h3>
                              <p className="mb-3 text-[10px] font-medium leading-4 text-muted-foreground">"Who are you?" voice variants.</p>
                              <IdentityAudioSelector />
                          </div>
                        )}
                    </div>
                </SettingsCard>

                <SettingsCard
                    icon={Bell}
                    title="Notifications"
                    description="Control browser notifications for OTP and security events."
                    triggerText="Open"
                    badge="ALERTS"
                >
                    <NotificationTerminal />
                </SettingsCard>
                
                {role === 'admin' && (
                    <SettingsCard
                        icon={Smartphone}
                        title="SMS delivery"
                        description="Configure the TextBee recipient and device used for security messages."
                        triggerText="Configure"
                        badge="SMS"
                        dialogClassName="sm:max-w-xl"
                    >
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-black uppercase tracking-widest">Gateway Health</h3>
                                        <div className="flex gap-2">
                                            {smsEnvStatus?.hasApiKey ? (
                                                <Badge className="bg-green-500/10 text-green-600 border-none px-3">
                                                    <Wifi className="mr-1.5 h-3 w-3" /> API READY
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none px-3">
                                                    <WifiOff className="mr-1.5 h-3 w-3" /> NO API KEY
                                                </Badge>
                                            )}
                                            {smsEnvStatus?.hasDeviceId && (
                                                <Badge className="bg-primary/10 text-primary border-none px-3">
                                                    <Cpu className="mr-1.5 h-3 w-3" /> ENV LOADED
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {!smsEnvStatus?.hasApiKey && (
                                        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3">
                                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-destructive/80 font-bold leading-relaxed">
                                                TEXTBEE_API_KEY not detected in .env.local. SMS dispatch is disabled.
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Recipient Phone Number</Label>
                                        <div className="relative">
                                            <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
                                            <Input 
                                                placeholder="+974..." 
                                                value={permissions.smsRecipientNumber || ''} 
                                                onChange={(e) => setSmsRecipientNumber(e.target.value)}
                                                className="h-11 rounded-xl border-border/60 bg-background pl-10 text-sm font-semibold shadow-none"
                                            />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight ml-1">International format required (e.g. +974...)</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Textbee Device ID</Label>
                                            {smsEnvStatus?.hasDeviceId && <span className="text-[8px] font-black text-primary uppercase">Securely Loaded from Environment</span>}
                                        </div>
                                        <div className="relative">
                                            <SmartphoneNfc className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
                                            <Input 
                                                placeholder={smsEnvStatus?.hasDeviceId ? "******** (Loaded from ENV)" : "6a95..."} 
                                                value={permissions.smsDeviceId || ''} 
                                                onChange={(e) => setSmsDeviceId(e.target.value)}
                                                className="h-11 rounded-xl border-border/60 bg-background pl-10 font-mono text-xs shadow-none"
                                            />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight ml-1">Leave empty if configured in .env.local (Safe Practice).</p>
                                    </div>

                                    <div className="py-4 px-5 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-4">
                                        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-primary/70 font-medium leading-relaxed">
                                            When a Silent Entry is authorized, the system will automatically route the OTP to this terminal via the Textbee REST API. Environment variables in .env.local take priority for maximum security.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SettingsCard>
                )}
                
                {role === 'admin' && (
                    <SettingsCard
                        icon={Shield}
                        title="Session security"
                        description="Control admin welcome behavior and automatic session locking."
                        triggerText="Configure"
                        variant="security"
                        badge="SECURITY"
                    >
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                                <h3 className="text-base font-black uppercase tracking-widest mb-2">Greeting Protocol</h3>
                                <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed tracking-tight">Display administrative welcome sequence on session start.</p>
                                <AdminWelcomeToggle />
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 sm:p-4">
                                <h3 className="text-base font-black uppercase tracking-widest mb-2">Auto-Lock Timer</h3>
                                <p className="text-muted-foreground mb-6 text-xs font-medium leading-relaxed tracking-tight">Terminate active terminal access after idle period.</p>
                                <InactivityTimeoutInput />
                            </div>
                        </div>
                    </SettingsCard>
                )}
            </div>
        </section>

        {role === 'admin' && (
            <section id="warehouse-settings" className="scroll-mt-6 space-y-3">
                <div className="px-0.5">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">Warehouse</h2>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                      Staff, storage locations, and viewer permissions.
                    </p>
                </div>
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                    <SettingsCard
                        icon={UserPlus}
                        title="Staff"
                        description="Manage staff members available for inventory and Diary logging."
                        triggerText="Manage"
                        variant="logic"
                        dialogClassName="sm:max-w-4xl"
                        badge="PEOPLE"
                    >
                        <StaffManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={MapPin}
                        title="Locations"
                        description="Manage warehouse locations available during inventory logging."
                        triggerText="Manage"
                        variant="logic"
                        dialogClassName="sm:max-w-4xl"
                        badge="WAREHOUSE"
                    >
                        <LocationManager />
                    </SettingsCard>

                    <SettingsCard
                        icon={ShieldCheck}
                        title="Permissions"
                        description="Control which pages and actions are available to restricted users."
                        triggerText="Manage"
                        variant="logic"
                        dialogClassName="sm:max-w-3xl"
                        badge="ACCESS"
                    >
                        <AccessControlManager />
                    </SettingsCard>
                </div>
            </section>
        )}

        {role === 'admin' && (
            <section id="system-settings" className="scroll-mt-6 space-y-3">
                <div className="px-0.5">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">System</h2>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                      Data import, registry access, and administrative credentials.
                    </p>
                </div>
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                    <SettingsCard
                        icon={CloudUpload}
                        title="Bulk import"
                        description="Import and synchronize large product datasets."
                        triggerText="Open importer"
                        variant="premium"
                        isManual={true}
                        onManualClick={() => setIsBulkAuthOpen(true)}
                        badge="DATA"
                    />

                    <SettingsCard
                        icon={Database}
                        title="Data source"
                        description="Open the connected Google Sheets registry after authorization."
                        triggerText="Open source"
                        isManual={true}
                        onManualClick={() => setIsDbAuthOpen(true)}
                        badge="GOOGLE SHEETS"
                    />

                    <SettingsCard
                        icon={KeyRound}
                        title="Admin credentials"
                        description="Manage local administrative credentials used for protected actions."
                        triggerText="Manage"
                        variant="security"
                        dialogClassName="sm:max-w-md"
                        badge="SECURITY"
                    >
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 p-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div className="space-y-1">
                                <p className="text-[11px] font-semibold text-amber-700">Security Alert</p>
                                <p className="mt-0.5 text-[10px] font-medium leading-4 text-amber-700/90">
                                    These credentials authorize stock deletion and quantity overrides. Guard these keys with extreme prejudice.
                                </p>
                            </div>
                        </div>
                        <LocalCredentialsForm />
                    </SettingsCard>
                </div>
            </section>
        )}

        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5 sm:p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-foreground">Data integrity</p>
            <p className="mt-0.5 max-w-3xl text-[9px] leading-4 text-muted-foreground sm:text-[10px]">
              Verify that the Google Spreadsheet ID and Service Account credentials are correctly set in the environment variables.
            </p>
          </div>
        </div>
        </main>
      </div>

      <div className="hidden">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Industrial Data Integrity Check</p>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-lg mx-auto">
              Verify that the Google Spreadsheet ID and Service Account credentials are correctly set in the environment variables to ensure zero-latency synchronization.
          </p>
      </div>

      <Dialog open={isMasterDbDialogOpen} onOpenChange={setIsMasterDbDialogOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl">
              <div className="p-4 pb-3 sm:p-5 sm:pb-3">
                <DialogHeader>
                    <div className="mb-3 flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Database className="h-5 w-5 text-primary" strokeWidth={2.2} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                                Cloud Tunnel
                            </DialogTitle>
                            <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest text-primary border-primary/20">Authorized Access</Badge>
                        </div>
                    </div>
                    <DialogDescription className="font-bold text-sm leading-relaxed tracking-tight text-muted-foreground">
                        Establishing secure system link to the Google Sheets industrial registry.
                    </DialogDescription>
                </DialogHeader>
              </div>
              
              <div className="space-y-4 overflow-y-auto p-4 pt-2 sm:p-5 sm:pt-2">
                  <div className="p-6 bg-yellow-500/5 border-2 border-yellow-500/10 rounded-[2rem] flex items-start gap-5">
                      <AlertTriangle className="h-8 w-8 text-yellow-600 shrink-0 mt-1" />
                      <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-yellow-800 tracking-widest">Integrity Protocol</p>
                          <p className="text-[11px] text-yellow-700/70 font-semibold leading-relaxed tracking-tighter">
                              Manual structural modifications to headers, column order, or tab definitions will disrupt the synchronization engine. Proceed with extreme caution.
                          </p>
                      </div>
                  </div>
                  
                  {dbUrl ? (
                      <Button 
                          asChild 
                          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                      >
                          <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" strokeWidth={2.3} />
                              Open Registry
                          </a>
                      </Button>
                  ) : (
                      <Button 
                          disabled 
                          className="h-12 w-full rounded-xl border border-dashed border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60"
                      >
                          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                          Handshaking...
                      </Button>
                  )}
              </div>
              <div className="flex justify-center border-t border-border/50 bg-muted/20 p-3">
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
          <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-border/60 p-0 shadow-2xl">
              <div className="p-3 sm:p-5">
                <BulkImportTerminal />
              </div>
          </DialogContent>
      </Dialog>

      <div className="mt-8 pb-3 text-center sm:mt-10">
          <p className="flex items-center justify-center text-[8px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 sm:text-[9px]">
              SHEETSYNC CORE • SECURED TERMINAL • 2024
          </p>
      </div>
    </div>
  );
}
