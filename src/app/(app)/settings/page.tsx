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
    Cpu,
    LayoutDashboard,
    History,
    Zap,
    Key
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
import { getMasterSpreadsheetUrlAction, checkSmsConfigAction, sendSmsAction } from '@/app/actions';
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
import { ManualOnDisplaySmsTerminal } from '@/components/settings/manual-on-display-sms-terminal';
import { OnDisplayAlertsTerminal } from '@/components/settings/on-display-alerts-terminal';

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
  isLoading?: boolean;
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
    badge,
    isLoading = false
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
      disabled={isLoading}
      className={cn(
        'h-9 shrink-0 rounded-lg px-3 text-[10px] font-semibold shadow-none',
        variant === 'premium'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border/60 bg-background hover:bg-muted/60',
        variant === 'security' &&
          'hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive'
      )}
    >
      {isLoading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : isManual && (
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
      )}
      {triggerText}
    </Button>
  );

  return (
    <div className="group min-w-0 bg-card transition-colors hover:bg-muted/[0.18]">
      <div className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
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
            <div className="flex min-w-0 items-center gap-2">
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

        <div className="flex shrink-0">
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
        toast({ title: "Alerts Enabled", description: "Browser notifications..." });
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
  
  const [isBulkSmsDialogOpen, setIsBulkSmsDialogOpen] = React.useState(false);
  const [generatedBulkPin, setGeneratedBulkPin] = React.useState('');
  const [isSendingSms, setIsSendingSms] = React.useState(false);
  const [isImportTerminalOpen, setIsImportTerminalOpen] = React.useState(false);

  const [smsEnvStatus, setSmsEnvStatus] = React.useState<{ hasApiKey: boolean; hasDeviceId: boolean } | null>(null);

  React.useEffect(() => {
    if (role === 'admin') {
        checkSmsConfigAction().then(res => {
            if (res.success && res.data) setSmsEnvStatus(res.data);
        });
    }
  }, [role]);

  const handleInitiateBulkImport = async () => {
    if (!permissions.smsRecipientNumber) {
        toast({ 
            variant: "destructive", 
            title: "Security Config Missing", 
            description: "SMS recipient number must be configured in SMS Delivery settings." 
        });
        return;
    }

    setIsSendingSms(true);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const msg = `SHEETSYNC SECURITY: Authorized request for Bulk Data Import. Authentication Key: ${pin}. This code is valid for single session entry only.`;

    try {
        const res = await sendSmsAction(msg, permissions.smsRecipientNumber);
        if (res.success) {
            setGeneratedBulkPin(pin);
            setIsBulkSmsDialogOpen(true);
            toast({ title: "Verification Sent", description: "Security PIN routed to authorized terminal." });
        } else {
            toast({ variant: "destructive", title: "Gateway Error", description: res.message || "Failed to dispatch SMS." });
        }
    } catch (e) {
        toast({ variant: "destructive", title: "Connection Error", description: "SMS Gateway unreachable." });
    } finally {
        setIsSendingSms(false);
    }
  };

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
                        icon={LayoutDashboard}
                        title="On-Display protocol"
                        description="Manually trigger 7-day expiry alerts and temporary access for specific staff."
                        triggerText="Open terminal"
                        variant="logic"
                        badge="ALERTS"
                        dialogClassName="sm:max-w-md"
                    >
                        <ManualOnDisplaySmsTerminal />
                    </SettingsCard>

                    <SettingsCard
                        icon={History}
                        title="Transmission Log"
                        description="Review recently dispatched On-Display alerts and security tokens."
                        triggerText="View History"
                        variant="logic"
                        badge="ALERTS"
                        dialogClassName="sm:max-w-4xl"
                    >
                        <OnDisplayAlertsTerminal />
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
                        description="Import large datasets with mandatory SMS identity handshake."
                        triggerText="Open importer"
                        variant="premium"
                        isManual={true}
                        isLoading={isSendingSms}
                        onManualClick={handleInitiateBulkImport}
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

      <Dialog open={isBulkSmsDialogOpen} onOpenChange={setIsBulkSmsDialogOpen}>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-[2rem] border-none shadow-3xl overflow-hidden p-0">
              <div className="p-6 bg-muted/30 border-b border-white/5">
                <DialogHeader className="text-left">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-primary/10 p-2.5 rounded-xl">
                            <Key className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Security Handshake</DialogTitle>
                    </div>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-relaxed">
                        Enter the 4-digit PIN sent to {permissions.smsRecipientNumber?.slice(-4).padStart(permissions.smsRecipientNumber.length, '*')}
                    </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-6 space-y-6">
                  <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Authentication Key</Label>
                      <Input 
                          type="text" 
                          inputMode="numeric" 
                          maxLength={4}
                          className="h-20 text-center text-5xl font-black tracking-[0.4em] bg-muted/20 border-none rounded-3xl shadow-inner focus-visible:ring-primary/20"
                          placeholder="••••"
                          autoFocus
                          onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              if (val.length === 4) {
                                  if (val === generatedBulkPin) {
                                      setIsBulkSmsDialogOpen(false);
                                      setIsImportTerminalOpen(true);
                                      setGeneratedBulkPin('');
                                      toast({ title: "Access Granted", description: "Identity verified via SMS." });
                                  } else {
                                      toast({ variant: "destructive", title: "Access Denied", description: "Invalid security PIN." });
                                      e.target.value = '';
                                  }
                              }
                          }}
                      />
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold leading-relaxed text-primary/70 uppercase tracking-tighter">
                          Bulk synchronization requires industrial-grade verification. Code is valid for this session only.
                      </p>
                  </div>
              </div>
              <DialogFooter className="p-4 bg-muted/20 border-t border-white/5">
                  <Button variant="ghost" onClick={() => setIsBulkSmsDialogOpen(false)} className="w-full font-black uppercase tracking-widest text-[10px] opacity-40 hover:opacity-100">Abort Protocol</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

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

```
- src/components/suppliers/edit-supplier-dialog.tsx:
```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { editSupplierSchema, type EditSupplierFormValues } from '@/lib/schemas';
import { editSupplierAction } from '@/app/actions'; 
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto font-bold">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

interface EditSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export function EditSupplierDialog({ isOpen, onOpenChange, supplier }: EditSupplierDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateSupplier, refreshData } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditSupplierFormValues>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      supplierId: supplier?.id || '',
      currentSupplierName: supplier?.name || '',
      newSupplierName: supplier?.name || '',
    }
  });
  
  useEffect(() => {
    if (supplier && isOpen) {
      reset({
        supplierId: supplier.id,
        currentSupplierName: supplier.name,
        newSupplierName: supplier.name,
      });
    }
  }, [supplier, reset, isOpen]);

  const handleFormSubmit = (data: EditSupplierFormValues) => {
    if (!supplier) return;
    
    if (!isDirty) {
        onOpenChange(false);
        return;
    }
    
    const formData = new FormData();
    formData.append('supplierId', supplier.id || data.supplierId);
    formData.append('currentSupplierName', supplier.name || data.currentSupplierName);
    formData.append('newSupplierName', data.newSupplierName);
    formData.append('userEmail', user?.email || 'Admin');
    
    startActionTransition(async () => {
      // 1. OPTIMISTIC UPDATE: Instant feedback locally
      const oldName = supplier.name;
      const newName = data.newSupplierName;
      
      updateSupplier(oldName, newName);
      onOpenChange(false); // CLOSE DIALOG INSTANTLY
      
      toast({
        title: 'Registry Update Initiated',
        description: `Renaming "${oldName}" to "${newName}" in background...`,
      });

      try {
        const result = await editSupplierAction(undefined, formData);
        
        if (result.success) {
          toast({
            title: 'Update Successful',
            description: `Registry updated. all associated logs now reflect "${newName}".`,
          });
          refreshData(); // Final sync to confirm all changes
        } else {
          toast({
            title: 'Sync Error',
            description: result.message || 'Cloud rename failed. Reverting local changes...',
            variant: 'destructive',
          });
          refreshData(); // REVERT
        }
      } catch (error) {
        toast({
          title: 'Connection Error',
          description: 'Failed to reach registry service. Reverting local changes...',
          variant: 'destructive',
        });
        refreshData();
      }
    });
  };
  
  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Rename Master Registry: {supplier.name}</DialogTitle>
          <DialogDescription>
            Updating this name will propagate changes to all associated products and inventory logs. This ensures data consistency.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <input type="hidden" {...register('supplierId')} value={supplier.id} />
          <input type="hidden" {...register('currentSupplierName')} value={supplier.name} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="newSupplierName" className="text-left font-bold uppercase text-[10px] text-muted-foreground tracking-widest">
                New Master Name
              </Label>
              <Input
                id="newSupplierName"
                placeholder="Enter new supplier name"
                {...register('newSupplierName')}
                className={cn("h-11 font-semibold", formErrors.newSupplierName && 'border-destructive')}
              />
              {formErrors.newSupplierName && <p className="text-xs text-destructive mt-1 font-medium">{formErrors.newSupplierName.message}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline" className="font-bold">Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isActionPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

```
- src/components/suppliers/supplier-card.tsx:
```tsx

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Edit } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import { memo } from 'react';
import placeholderData from '@/app/lib/placeholder-images.json';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
}

const SupplierCardComponent = ({ supplier, onEdit }: SupplierCardProps) => {
  const getAiHint = (name: string): string => {
    if (!name) return 'office building';
    const words = name.toLowerCase().split(' ');
    const significantWords = words.filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'of', 'ltd', 'inc', 'co', 'llc'].includes(w));
    if (significantWords.length > 0) {
      return significantWords.slice(0, 2).join(' ');
    }
    return words[0] || 'office building';
  };

  const imageUrl = placeholderData.supplierPlaceholder.urlTemplate.replace('{id}', supplier.id);

  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="pb-3">
         <Image
            src={imageUrl}
            alt={supplier.name}
            width={placeholderData.supplierPlaceholder.width}
            height={placeholderData.supplierPlaceholder.height}
            className="rounded-t-lg aspect-[2/1] object-cover -mt-6 -mx-6 mb-4"
            data-ai-hint={getAiHint(supplier.name)}
          />
        <CardTitle className="text-lg leading-tight">{supplier.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-xs text-muted-foreground flex items-center">
          <Building className="w-3 h-3 mr-1.5" />
          <span>ID: {supplier.id}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
          <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(supplier)}>
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit Supplier
          </Button>
      </CardFooter>
    </Card>
  );
}

export const SupplierCard = memo(SupplierCardComponent);

```
- src/components/suppliers/supplier-list-client.tsx:
```tsx

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Supplier } from '@/lib/types';
import { Search, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AddSupplierDialog } from './add-supplier-dialog';
import { EditSupplierDialog } from './edit-supplier-dialog';
import { SupplierCard } from './supplier-card';
import { useDataCache } from '@/context/data-cache-context';

const MAX_SUPPLIERS_TO_DISPLAY = 250; 

export function SupplierListClient() {
  const { suppliers } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a,b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const filteredSuppliersToRender = useMemo(() => {
    let itemsToFilter = sortedSuppliers;
    if (searchTerm) {
      itemsToFilter = itemsToFilter.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return itemsToFilter;
  }, [sortedSuppliers, searchTerm]);
  
  const itemsToRender = useMemo(() => {
    if (filteredSuppliersToRender.length > MAX_SUPPLIERS_TO_DISPLAY) {
        return filteredSuppliersToRender.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    return filteredSuppliersToRender;
  }, [filteredSuppliersToRender]);


  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <AddSupplierDialog />
      </div>

      {itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {itemsToRender.map((supplier) => (
                <SupplierCard 
                    key={supplier.id} 
                    supplier={supplier} 
                    onEdit={() => handleEditSupplier(supplier)}
                />
            ))}
          </div>

          {filteredSuppliersToRender.length > MAX_SUPPLIERS_TO_DISPLAY && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_SUPPLIERS_TO_DISPLAY} of {filteredSuppliersToRender.length} suppliers. Use search to find others.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No suppliers found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? `Try adjusting your search for "${searchTerm}" or ` : ''}
            Add a new supplier to get started.
          </p>
           {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
            Clear Search
          </Button>
          )}
        </div>
      )}
      {editingSupplier && (
        <EditSupplierDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          supplier={editingSupplier}
        />
      )}
    </div>
  );
}

```
- src/components/suppliers/edit-supplier-dialog.tsx:
```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { editSupplierSchema, type EditSupplierFormValues } from '@/lib/schemas';
import { editSupplierAction } from '@/app/actions'; 
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto font-bold">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

interface EditSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export function EditSupplierDialog({ isOpen, onOpenChange, supplier }: EditSupplierDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateSupplier, refreshData } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditSupplierFormValues>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      supplierId: supplier?.id || '',
      currentSupplierName: supplier?.name || '',
      newSupplierName: supplier?.name || '',
    }
  });
  
  useEffect(() => {
    if (supplier && isOpen) {
      reset({
        supplierId: supplier.id,
        currentSupplierName: supplier.name,
        newSupplierName: supplier.name,
      });
    }
  }, [supplier, reset, isOpen]);

  const handleFormSubmit = (data: EditSupplierFormValues) => {
    if (!supplier) return;
    
    if (!isDirty) {
        onOpenChange(false);
        return;
    }
    
    const formData = new FormData();
    formData.append('supplierId', supplier.id || data.supplierId);
    formData.append('currentSupplierName', supplier.name || data.currentSupplierName);
    formData.append('newSupplierName', data.newSupplierName);
    formData.append('userEmail', user?.email || 'Admin');
    
    startActionTransition(async () => {
      // 1. OPTIMISTIC UPDATE: Instant feedback locally
      const oldName = supplier.name;
      const newName = data.newSupplierName;
      
      updateSupplier(oldName, newName);
      onOpenChange(false); // CLOSE DIALOG INSTANTLY
      
      toast({
        title: 'Registry Update Initiated',
        description: `Renaming "${oldName}" to "${newName}" in background...`,
      });

      try {
        const result = await editSupplierAction(undefined, formData);
        
        if (result.success) {
          toast({
            title: 'Update Successful',
            description: `Registry updated. all associated logs now reflect "${newName}".`,
          });
          refreshData(); // Final sync to confirm all changes
        } else {
          toast({
            title: 'Sync Error',
            description: result.message || 'Cloud rename failed. Reverting local changes...',
            variant: 'destructive',
          });
          refreshData(); // REVERT
        }
      } catch (error) {
        toast({
          title: 'Connection Error',
          description: 'Failed to reach registry service. Reverting local changes...',
          variant: 'destructive',
        });
        refreshData();
      }
    });
  };
  
  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Rename Master Registry: {supplier.name}</DialogTitle>
          <DialogDescription>
            Updating this name will propagate changes to all associated products and inventory logs. This ensures data consistency.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <input type="hidden" {...register('supplierId')} value={supplier.id} />
          <input type="hidden" {...register('currentSupplierName')} value={supplier.name} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="newSupplierName" className="text-left font-bold uppercase text-[10px] text-muted-foreground tracking-widest">
                New Master Name
              </Label>
              <Input
                id="newSupplierName"
                placeholder="Enter new supplier name"
                {...register('newSupplierName')}
                className={cn("h-11 font-semibold", formErrors.newSupplierName && 'border-destructive')}
              />
              {formErrors.newSupplierName && <p className="text-xs text-destructive mt-1 font-medium">{formErrors.newSupplierName.message}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline" className="font-bold">Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isActionPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

```
- src/components/suppliers/supplier-card.tsx:
```tsx

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Edit } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import { memo } from 'react';
import placeholderData from '@/app/lib/placeholder-images.json';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
}

const SupplierCardComponent = ({ supplier, onEdit }: SupplierCardProps) => {
  const getAiHint = (name: string): string => {
    if (!name) return 'office building';
    const words = name.toLowerCase().split(' ');
    const significantWords = words.filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'of', 'ltd', 'inc', 'co', 'llc'].includes(w));
    if (significantWords.length > 0) {
      return significantWords.slice(0, 2).join(' ');
    }
    return words[0] || 'office building';
  };

  const imageUrl = placeholderData.supplierPlaceholder.urlTemplate.replace('{id}', supplier.id);

  return (
    <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="pb-3">
         <Image
            src={imageUrl}
            alt={supplier.name}
            width={placeholderData.supplierPlaceholder.width}
            height={placeholderData.supplierPlaceholder.height}
            className="rounded-t-lg aspect-[2/1] object-cover -mt-6 -mx-6 mb-4"
            data-ai-hint={getAiHint(supplier.name)}
          />
        <CardTitle className="text-lg leading-tight">{supplier.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-xs text-muted-foreground flex items-center">
          <Building className="w-3 h-3 mr-1.5" />
          <span>ID: {supplier.id}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
          <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(supplier)}>
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit Supplier
          </Button>
      </CardFooter>
    </Card>
  );
}

export const SupplierCard = memo(SupplierCardComponent);

```
- src/components/suppliers/supplier-list-client.tsx:
```tsx

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Supplier } from '@/lib/types';
import { Search, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AddSupplierDialog } from './add-supplier-dialog';
import { EditSupplierDialog } from './edit-supplier-dialog';
import { SupplierCard } from './supplier-card';
import { useDataCache } from '@/context/data-cache-context';

const MAX_SUPPLIERS_TO_DISPLAY = 250; 

export function SupplierListClient() {
  const { suppliers } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a,b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const filteredSuppliersToRender = useMemo(() => {
    let itemsToFilter = sortedSuppliers;
    if (searchTerm) {
      itemsToFilter = itemsToFilter.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return itemsToFilter;
  }, [sortedSuppliers, searchTerm]);
  
  const itemsToRender = useMemo(() => {
    if (filteredSuppliersToRender.length > MAX_SUPPLIERS_TO_DISPLAY) {
        return filteredSuppliersToRender.slice(0, MAX_SUPPLIERS_TO_DISPLAY);
    }
    return filteredSuppliersToRender;
  }, [filteredSuppliersToRender]);


  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <AddSupplierDialog />
      </div>

      {itemsToRender.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {itemsToRender.map((supplier) => (
                <SupplierCard 
                    key={supplier.id} 
                    supplier={supplier} 
                    onEdit={() => handleEditSupplier(supplier)}
                />
            ))}
          </div>

          {filteredSuppliersToRender.length > MAX_SUPPLIERS_TO_DISPLAY && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Displaying first {MAX_SUPPLIERS_TO_DISPLAY} of {filteredSuppliersToRender.length} suppliers. Use search to find others.
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No suppliers found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? `Try adjusting your search for "${searchTerm}" or ` : ''}
            Add a new supplier to get started.
          </p>
           {searchTerm && (
             <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
            Clear Search
          </Button>
          )}
        </div>
      )}
      {editingSupplier && (
        <EditSupplierDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          supplier={editingSupplier}
        />
      )}
    </div>
  );
}

```

### **The Issue Analysis**
The OTP (One-Time PIN) is part of the **On-Display Protocol**. This protocol is triggered when a product is logged to the "On Display" location and is within the 7-day expiration window.

Based on the code:
1.  **`src/app/actions.ts`**: The `addInventoryItemAction` contains the logic to decide which Apps Script action to call. 
2.  **`standardLog` vs `triggerOnDisplayAlerts`**: Your Google Apps Script has a specialized `triggerOnDisplayAlerts` action that handles sending the SMS to the staff. 
3.  **The Trigger Condition**: Currently, the code in `actions.ts` checks if `location === "On Display"` AND `daysUntilExpiry <= 7`.

### **The Refinement Plan**
1.  **Professionalize SMS Content**: I will update the hardcoded security PIN message and the test signal message to follow the "Professional Industrial" style you requested.
2.  **Verify Trigger Logic**: Ensure the "On Display" check in `addInventoryItemAction` is robust and matches the criteria (0-7 days before expiry).
3.  **Apps Script Coordination**: Since I cannot change `Code.gs`, I will make sure the Next.js side passes the data exactly as the script expects for professional formatting.

### **Code Changes**

<changes>
  <description>Updated SMS message templates to a professional industrial tone and ensured the On-Display 7-day alert trigger is correctly integrated.</description>
  
  <change>
    <file>src/components/settings/staff-manager.tsx</file>
    <content><![CDATA['use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  UserPlus,
  Users,
  Smartphone,
  Phone,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { StaffMember } from '@/lib/types';
import { sendSmsAction } from '@/app/actions';

export function StaffManager() {
  const { toast } = useToast();
  const { staffRegistry, updateStaffList, isSyncing } = useDataCache();

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<StaffMember>({
    name: '',
    phone: '',
  });
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [testingStaffName, setTestingStaffName] = useState<string | null>(null);

  const handleAddStaff = async () => {
    if (!newName.trim()) return;

    const upperName = newName.trim().toUpperCase();

    if (staffRegistry.some((s) => s.name === upperName)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'This staff member already exists.',
      });
      return;
    }

    const updated = [
      ...staffRegistry,
      { name: upperName, phone: newPhone.trim() },
    ].sort((a, b) => a.name.localeCompare(b.name));

    await updateStaffList(updated);

    toast({
      title: 'Success',
      description: `"${upperName}" registered successfully.`,
    });

    setNewName('');
    setNewPhone('');
  };

  const handleTestSms = async (member: StaffMember) => {
    if (!member.phone) {
      toast({
        variant: 'destructive',
        title: 'Missing Node',
        description: 'This personnel has no registered phone number.',
      });
      return;
    }

    setTestingStaffName(member.name);

    // PROFESSIONAL INDUSTRIAL TONE
    const msg = `SHEETSYNC SECURITY: Test signal successful for ${member.name}. Mobile terminal linked to industrial registry. System ready for secure handshake protocols.`;

    try {
      const res = await sendSmsAction(msg, member.phone);

      if (res.success) {
        toast({
          title: 'Signal Dispatched',
          description: `Test SMS successfully sent to ${member.name}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test Failed',
          description: res.message || 'Gateway handshake failed.',
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'System Error',
        description: 'Communication failure with SMS gateway.',
      });
    } finally {
      setTestingStaffName(null);
    }
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;

    const updated = staffRegistry.filter(
      (s) => s.name !== staffToDelete.name
    );

    await updateStaffList(updated);

    toast({
      title: 'Staff Removed',
      description: `"${staffToDelete.name}" has been removed from the registry.`,
    });

    setStaffToDelete(null);
  };

  const startEditing = (index: number, member: StaffMember) => {
    setEditingIndex(index);
    setEditValues({ ...member });
  };

  const saveEdit = async (index: number) => {
    if (!editValues.name.trim()) return;

    const updated = [...staffRegistry];
    updated[index] = {
      ...editValues,
      name: editValues.name.trim().toUpperCase(),
    };

    await updateStaffList(
      updated.sort((a, b) => a.name.localeCompare(b.name))
    );

    toast({
      title: 'Updated',
      description: 'Staff information updated successfully.',
    });

    setEditingIndex(null);
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Overview */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Staff directory
            </h3>

            <Badge
              variant="secondary"
              className="rounded-lg border-0 bg-muted px-2 py-0.5 text-[8px] font-semibold"
            >
              {staffRegistry.length} staff
            </Badge>
          </div>

          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
            Manage staff identities and SMS contacts used by inventory logging
            and security handshakes.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.45fr)]">
        {/* Add staff */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex min-w-0 items-center gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h4 className="text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                Add staff member
              </h4>
              <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                Name is required. Phone number is optional.
              </p>
            </div>
          </div>

          <div className="space-y-3 p-3.5 sm:p-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="staff-name"
                className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Full name
              </Label>

              <Input
                id="staff-name"
                placeholder="Enter staff name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-10 rounded-xl border-border/60 bg-background px-3 text-sm font-medium shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="staff-phone"
                className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                SMS contact
              </Label>

              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />

                <Input
                  id="staff-phone"
                  placeholder="+974..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-10 rounded-xl border-border/60 bg-background pl-10 font-mono text-xs shadow-none"
                />
              </div>
            </div>

            <Button
              onClick={handleAddStaff}
              disabled={!newName.trim() || isSyncing}
              className="h-10 w-full rounded-xl text-[10px] font-semibold shadow-none"
            >
              {isSyncing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Add staff
            </Button>

            <div className="flex min-w-0 items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-amber-700 dark:text-amber-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="text-[9px] font-medium leading-4">
                Add a phone number if this staff member should receive
                security handshakes and expiry alerts.
              </p>
            </div>
          </div>
        </section>

        {/* Staff list */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:px-4">
            <div className="min-w-0">
              <h4 className="text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                Registered staff
              </h4>
              <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                Edit contacts, test SMS delivery, or remove staff.
              </p>
            </div>

            <Badge
              variant="outline"
              className="shrink-0 rounded-lg border-border/60 px-2 py-0.5 text-[8px] font-semibold text-muted-foreground"
            >
              {staffRegistry.length}
            </Badge>
          </div>

          <ScrollArea className="h-[360px] sm:h-[390px]">
            {staffRegistry.length > 0 ? (
              <div className="divide-y divide-border/50">
                {staffRegistry.map((member, index) => (
                  <div
                    key={member.name}
                    className="group min-w-0 px-3.5 py-3 transition-colors hover:bg-muted/25 sm:px-4"
                  >
                    {editingIndex === index ? (
                      <div className="space-y-2.5">
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                          <Input
                            value={editValues.name}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                name: e.target.value,
                              })
                            }
                            className="h-9 min-w-0 rounded-xl border-border/60 text-xs font-semibold uppercase shadow-none"
                            placeholder="Name"
                          />

                          <Input
                            value={editValues.phone || ''}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                phone: e.target.value,
                              })
                            }
                            className="h-9 min-w-0 rounded-xl border-border/60 font-mono text-xs shadow-none"
                            placeholder="+974..."
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-lg px-2.5 text-[9px] font-semibold text-muted-foreground"
                            onClick={() => setEditingIndex(null)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>

                          <Button
                            size="sm"
                            className="h-8 rounded-lg px-3 text-[9px] font-semibold"
                            onClick={() => saveEdit(index)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-[11px] font-bold text-muted-foreground">
                          {member.name.slice(0, 1)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                            {member.name}
                          </p>

                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span
                              className={cn(
                                'min-w-0 truncate font-mono text-[9px]',
                                member.phone
                                  ? 'text-muted-foreground'
                                  : 'text-muted-foreground/50'
                              )}
                            >
                              {member.phone || 'No SMS contact'}
                            </span>
                          </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleTestSms(member)}
                            disabled={
                              !member.phone ||
                              testingStaffName === member.name
                            }
                            title="Send Test SMS"
                            aria-label={`Send test SMS to ${member.name}`}
                          >
                            {testingStaffName === member.name ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => startEditing(index, member)}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setStaffToDelete(member)}
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>

                <p className="mt-3 text-sm font-semibold text-foreground">
                  No staff registered
                </p>

                <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-muted-foreground">
                  Add your first staff member using the form.
                </p>
              </div>
            )}
          </ScrollArea>
        </section>
      </div>

      <AlertDialog
        open={!!staffToDelete}
        onOpenChange={(open) => !open && setStaffToDelete(null)}
      >
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-2xl border border-border/60 p-4 shadow-2xl sm:p-5">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold tracking-tight">
                  Remove staff member?
                </AlertDialogTitle>

                <AlertDialogDescription className="mt-1 text-[10px] leading-4 sm:text-[11px]">
                  Remove{' '}
                  <span className="font-semibold text-foreground">
                    {staffToDelete?.name}
                  </span>{' '}
                  from the registry. They will no longer be available for
                  logging identification or future SMS alerts.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-[10px] font-semibold">
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmDelete}
              className="h-9 rounded-xl bg-destructive text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              Remove staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
