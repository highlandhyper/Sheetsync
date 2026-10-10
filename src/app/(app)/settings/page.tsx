'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Palette,
  Bell,
  Smartphone,
  Shield,
  UserPlus,
  MapPin,
  LayoutDashboard,
  History,
  ShieldCheck,
  CloudUpload,
  Database,
  KeyRound,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Cpu,
  MessageSquare,
  SmartphoneNfc,
  Info,
  Volume2,
  Music,
  ExternalLink,
  Key,
  CheckCircle2,
  BellDot,
} from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocalCredentialsForm } from '@/components/settings/local-credentials-form';
import { AccessControlManager } from '@/components/settings/access-control-manager';
import { useAuth } from '@/context/auth-context';
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
import { MultiSelectToggle } from '@/components/settings/multi-select-toggle';
import { AdminWelcomeToggle } from '@/components/settings/admin-welcome-toggle';
import { InactivityTimeoutInput } from '@/components/settings/inactivity-timeout-input';
import { StaffManager } from '@/components/settings/staff-manager';
import { LocationManager } from '@/components/settings/location-manager';
import {
  getMasterSpreadsheetUrlAction,
  checkSmsConfigAction,
  sendSmsAction,
} from '@/app/actions';
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

/* ─── Settings row (list style) ─── */
interface SettingsRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  dialogClassName?: string;
  onOpen?: () => void;
  isManual?: boolean;
  disabled?: boolean;
}

function SettingsRow({
  icon: Icon,
  label,
  description,
  trailing,
  onClick,
  children,
  dialogClassName,
  onOpen,
  isManual,
  disabled,
}: SettingsRowProps) {
  const rowContent = (
    <button
      type="button"
      disabled={disabled}
      onClick={isManual ? onClick : undefined}
      className={cn(
        'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors',
        'hover:bg-neutral-50 dark:hover:bg-white/[0.03]',
        'active:bg-neutral-100 dark:active:bg-white/[0.05]',
        'disabled:opacity-50 disabled:pointer-events-none'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
        <Icon
          className="h-4 w-4 text-neutral-600 dark:text-neutral-300"
          strokeWidth={1.75}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-black dark:text-white">
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {description}
          </p>
        )}
      </div>
      {trailing ?? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600"
          strokeWidth={1.75}
        />
      )}
    </button>
  );

  if (isManual || !children) {
    return rowContent;
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open && onOpen) onOpen();
      }}
    >
      <DialogTrigger asChild>{rowContent}</DialogTrigger>
      <DialogContent
        className={cn(
          'w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl',
          dialogClassName || 'sm:max-w-2xl'
        )}
      >
        <div className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col">
          <DialogHeader className="shrink-0 border-b border-neutral-100 dark:border-white/5 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
                <Icon
                  className="h-4 w-4 text-neutral-600 dark:text-neutral-300"
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight text-black dark:text-white">
                  {label}
                </DialogTitle>
                {description && (
                  <DialogDescription className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="min-w-0 overflow-y-auto p-5">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Section group ─── */
function SettingsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 divide-y divide-neutral-100 dark:divide-white/5',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ─── Notification terminal ─── */
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
        toast({
          title: 'Alerts Enabled',
          description: 'Browser notifications are now active.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Required',
          description:
            'Please enable notification permissions in your browser settings.',
        });
      }
    } else {
      setSetting('isBrowserNotificationsEnabled', false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
          <BellDot
            className="h-4 w-4 text-neutral-600 dark:text-neutral-300"
            strokeWidth={1.75}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-black dark:text-white">
            Browser notifications
          </p>
          <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
            Receive OTP and security alerts on this device.
          </p>
        </div>
        {isRequesting ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
        ) : (
          <Switch
            checked={settings.isBrowserNotificationsEnabled}
            onCheckedChange={handleToggle}
            disabled={isRequesting}
          />
        )}
      </div>
      {settings.isBrowserNotificationsEnabled && (
        <div className="flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-white/5 px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] font-medium">Notifications active</span>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function SettingsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { permissions, setSmsRecipientNumber, setSmsDeviceId } =
    useAccessControl();

  const [dbUrl, setDbUrl] = React.useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = React.useState(false);
  const [isDbAuthOpen, setIsDbAuthOpen] = React.useState(false);
  const [isMasterDbDialogOpen, setIsMasterDbDialogOpen] = React.useState(false);

  const [isBulkSmsDialogOpen, setIsBulkSmsDialogOpen] = React.useState(false);
  const [generatedBulkPin, setGeneratedBulkPin] = React.useState('');
  const [isSendingSms, setIsSendingSms] = React.useState(false);
  const [isImportTerminalOpen, setIsImportTerminalOpen] = React.useState(false);

  const [smsEnvStatus, setSmsEnvStatus] = React.useState<{
    hasApiKey: boolean;
    hasDeviceId: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (role === 'admin') {
      checkSmsConfigAction().then((res) => {
        if (res.success && res.data) setSmsEnvStatus(res.data);
      });
    }
  }, [role]);

  const handleInitiateBulkImport = async () => {
    if (!permissions.smsRecipientNumber) {
      toast({
        variant: 'destructive',
        title: 'Security Config Missing',
        description:
          'SMS recipient number must be configured in SMS Delivery settings.',
      });
      return;
    }

    setIsSendingSms(true);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const msg = `SHEETSYNC SECURITY: Authorized request for Bulk Data Import. Authentication Key: ${pin}. Session access is restricted to single-use verification.`;

    try {
      const res = await sendSmsAction(msg, permissions.smsRecipientNumber);
      if (res.success) {
        setGeneratedBulkPin(pin);
        setIsBulkSmsDialogOpen(true);
        toast({
          title: 'Verification Sent',
          description: 'Security key routed to authorized terminal.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Gateway Error',
          description: res.message || 'Failed to dispatch SMS.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'SMS Gateway unreachable.',
      });
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
          variant: 'destructive',
          title: 'Access Error',
          description: res.message || 'Spreadsheet ID is not configured.',
        });
        setIsMasterDbDialogOpen(false);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Auth Failure',
        description: 'Failed to verify database session.',
      });
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
    <div className="mx-auto w-full min-w-0 max-w-lg min-h-[100dvh] bg-neutral-50 dark:bg-[#0a0a0f] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 bg-neutral-50/90 dark:bg-[#0a0a0f]/90 backdrop-blur-md px-4 py-3 border-b border-neutral-200/60 dark:border-white/5">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-black dark:text-white pr-9">
          Settings
        </h1>
      </header>

      <div className="px-4 pt-6 space-y-6">
        {/* General */}
        <SettingsGroup>
          <SettingsRow
            icon={Palette}
            label="Appearance"
            description="Theme, multi-select, audio"
            dialogClassName="sm:max-w-2xl"
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                <h3 className="mb-1 text-[13px] font-medium text-black dark:text-white">
                  Visual theme
                </h3>
                <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Light, dark, or system
                </p>
                <ThemeToggle />
              </div>
              <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                <h3 className="mb-1 text-[13px] font-medium text-black dark:text-white">
                  Batch processing
                </h3>
                <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Multi-select for bulk actions
                </p>
                <MultiSelectToggle />
              </div>
              {role === 'admin' && (
                <>
                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                    <h3 className="mb-1 text-[13px] font-medium flex items-center gap-2 text-black dark:text-white">
                      <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Audio feedback
                    </h3>
                    <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                      Global thank-you sounds
                    </p>
                    <AudioFeedbackToggle />
                  </div>
                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                    <h3 className="mb-1 text-[13px] font-medium flex items-center gap-2 text-black dark:text-white">
                      <Music className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Identity prompt
                    </h3>
                    <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                      Voice variants for identity checks
                    </p>
                    <IdentityAudioSelector />
                  </div>
                </>
              )}
            </div>
          </SettingsRow>

          <SettingsRow
            icon={Bell}
            label="Notifications"
            description="Browser alerts for security events"
          >
            <NotificationTerminal />
          </SettingsRow>

          {role === 'admin' && (
            <SettingsRow
              icon={Smartphone}
              label="SMS delivery"
              description="Recipient and device for security messages"
              dialogClassName="sm:max-w-xl"
            >
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {smsEnvStatus?.hasApiKey ? (
                    <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-none px-2.5 py-1 text-[11px] font-medium">
                      <Wifi className="mr-1.5 h-3 w-3" strokeWidth={1.75} />
                      API ready
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-none px-2.5 py-1 text-[11px] font-medium">
                      <WifiOff className="mr-1.5 h-3 w-3" strokeWidth={1.75} />
                      No API key
                    </Badge>
                  )}
                  {smsEnvStatus?.hasDeviceId && (
                    <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-none px-2.5 py-1 text-[11px] font-medium">
                      <Cpu className="mr-1.5 h-3 w-3" strokeWidth={1.75} />
                      ENV loaded
                    </Badge>
                  )}
                </div>

                {!smsEnvStatus?.hasApiKey && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 p-3.5">
                    <AlertTriangle
                      className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5"
                      strokeWidth={1.75}
                    />
                    <p className="text-[13px] text-red-600 dark:text-red-400 leading-relaxed">
                      TEXTBEE_API_KEY not detected. SMS dispatch is disabled.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
                    Recipient phone number
                  </Label>
                  <div className="relative">
                    <MessageSquare
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      strokeWidth={1.75}
                    />
                    <Input
                      placeholder="+974..."
                      value={permissions.smsRecipientNumber || ''}
                      onChange={(e) => setSmsRecipientNumber(e.target.value)}
                      className="h-11 rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 pl-10 text-[14px] shadow-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
                    Textbee device ID
                  </Label>
                  <div className="relative">
                    <SmartphoneNfc
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      strokeWidth={1.75}
                    />
                    <Input
                      placeholder={
                        smsEnvStatus?.hasDeviceId
                          ? '******** (Loaded from ENV)'
                          : '6a95...'
                      }
                      value={permissions.smsDeviceId || ''}
                      onChange={(e) => setSmsDeviceId(e.target.value)}
                      className="h-11 rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 pl-10 font-mono text-[13px] shadow-none"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 p-3.5">
                  <Info
                    className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5"
                    strokeWidth={1.75}
                  />
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Environment variables take priority for maximum security.
                  </p>
                </div>
              </div>
            </SettingsRow>
          )}

          {role === 'admin' && (
            <SettingsRow
              icon={Shield}
              label="Session security"
              description="Welcome screen and auto-lock timer"
            >
              <div className="space-y-5">
                <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                  <h3 className="text-[14px] font-medium text-black dark:text-white mb-1">
                    Greeting protocol
                  </h3>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-4">
                    Show admin welcome on session start
                  </p>
                  <AdminWelcomeToggle />
                </div>
                <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4">
                  <h3 className="text-[14px] font-medium text-black dark:text-white mb-1">
                    Auto-lock timer
                  </h3>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-4">
                    Lock after idle period
                  </p>
                  <InactivityTimeoutInput />
                </div>
              </div>
            </SettingsRow>
          )}
        </SettingsGroup>

        {/* Warehouse (admin) */}
        {role === 'admin' && (
          <SettingsGroup>
            <SettingsRow
              icon={UserPlus}
              label="Staff"
              description="Manage staff members"
              dialogClassName="sm:max-w-4xl"
            >
              <StaffManager />
            </SettingsRow>
            <SettingsRow
              icon={MapPin}
              label="Locations"
              description="Warehouse storage zones"
              dialogClassName="sm:max-w-4xl"
            >
              <LocationManager />
            </SettingsRow>
            <SettingsRow
              icon={LayoutDashboard}
              label="On-Display protocol"
              description="Trigger expiry alerts for staff"
              dialogClassName="sm:max-w-md"
            >
              <ManualOnDisplaySmsTerminal />
            </SettingsRow>
            <SettingsRow
              icon={History}
              label="Transmission log"
              description="Recent On-Display alerts"
              dialogClassName="sm:max-w-4xl"
            >
              <OnDisplayAlertsTerminal />
            </SettingsRow>
            <SettingsRow
              icon={ShieldCheck}
              label="Permissions"
              description="Viewer access control"
              dialogClassName="sm:max-w-3xl"
            >
              <AccessControlManager />
            </SettingsRow>
          </SettingsGroup>
        )}

        {/* System (admin) */}
        {role === 'admin' && (
          <SettingsGroup>
            <SettingsRow
              icon={CloudUpload}
              label="Bulk import"
              description="Import large datasets via SMS"
              isManual
              disabled={isSendingSms}
              onClick={handleInitiateBulkImport}
              trailing={
                isSendingSms ? (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 text-neutral-300 dark:text-neutral-600"
                    strokeWidth={1.75}
                  />
                )
              }
            />
            <SettingsRow
              icon={Database}
              label="Data source"
              description="Open Google Sheets registry"
              isManual
              onClick={() => setIsDbAuthOpen(true)}
            />
            <SettingsRow
              icon={KeyRound}
              label="Admin credentials"
              description="Local credentials for protected actions"
              dialogClassName="sm:max-w-md"
            >
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                  strokeWidth={1.75}
                />
                <div>
                  <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                    Security notice
                  </p>
                  <p className="mt-0.5 text-[12px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                    These credentials authorize stock deletion and quantity
                    overrides.
                  </p>
                </div>
              </div>
              <LocalCredentialsForm />
            </SettingsRow>
          </SettingsGroup>
        )}

        {/* Footer links */}
        <div className="pt-2 space-y-1 px-1">
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500 py-2">
            SheetSync Industrial Inventory
          </p>
          <p className="text-[12px] text-neutral-300 dark:text-neutral-600 py-1">
            Version 5.0.0
          </p>
        </div>
      </div>

      {/* Master DB dialog */}
      <Dialog open={isMasterDbDialogOpen} onOpenChange={setIsMasterDbDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl">
          <div className="p-5">
            <DialogHeader>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
                  <Database
                    className="h-5 w-5 text-neutral-600 dark:text-neutral-300"
                    strokeWidth={1.75}
                  />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-black dark:text-white">
                    Cloud tunnel
                  </DialogTitle>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Authorized access
                  </p>
                </div>
              </div>
              <DialogDescription className="text-[14px] text-neutral-500 dark:text-neutral-400">
                Secure link to the Google Sheets registry.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 pb-5">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4">
              <AlertTriangle
                className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                  Integrity protocol
                </p>
                <p className="mt-0.5 text-[12px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                  Manual changes to headers or column order will disrupt
                  synchronization.
                </p>
              </div>
            </div>
            {dbUrl ? (
              <Button
                asChild
                className="h-11 w-full rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-none shadow-none"
              >
                <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.75} />
                  Open registry
                </a>
              </Button>
            ) : (
              <Button
                disabled
                className="h-11 w-full rounded-xl border border-dashed border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-[13px] font-medium opacity-60"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </Button>
            )}
          </div>
          <div className="flex justify-center border-t border-neutral-100 dark:border-white/5 p-3">
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              >
                Close
              </Button>
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

      {/* Bulk SMS pin dialog */}
      <Dialog open={isBulkSmsDialogOpen} onOpenChange={setIsBulkSmsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden p-0">
          <div className="p-5 border-b border-neutral-100 dark:border-white/5">
            <DialogHeader className="text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
                  <Key
                    className="h-4 w-4 text-neutral-600 dark:text-neutral-300"
                    strokeWidth={1.75}
                  />
                </div>
                <DialogTitle className="text-base font-semibold text-black dark:text-white">
                  Security handshake
                </DialogTitle>
              </div>
              <DialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
                Enter the 4-digit key sent to{' '}
                {permissions.smsRecipientNumber
                  ?.slice(-4)
                  .padStart(
                    permissions.smsRecipientNumber?.length || 4,
                    '*'
                  )}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
                Authentication key
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className="h-16 text-center text-3xl font-semibold tracking-[0.35em] bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 rounded-xl shadow-none focus-visible:ring-0"
                placeholder="••••"
                autoFocus
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length === 4) {
                    if (val === generatedBulkPin) {
                      setIsBulkSmsDialogOpen(false);
                      setIsImportTerminalOpen(true);
                      setGeneratedBulkPin('');
                      toast({
                        title: 'Access Granted',
                        description: 'Identity verified via SMS.',
                      });
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Access Denied',
                        description: 'Invalid security key.',
                      });
                      e.target.value = '';
                    }
                  }
                }}
              />
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-neutral-50 dark:bg-white/5 p-3.5">
              <ShieldCheck
                className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Key is valid for this session only.
              </p>
            </div>
          </div>
          <DialogFooter className="p-3 border-t border-neutral-100 dark:border-white/5">
            <Button
              variant="ghost"
              onClick={() => setIsBulkSmsDialogOpen(false)}
              className="w-full text-[13px] text-neutral-500 dark:text-neutral-400"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportTerminalOpen}
        onOpenChange={setIsImportTerminalOpen}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-white/10 p-0 shadow-2xl bg-white dark:bg-neutral-950">
          <div className="p-4 sm:p-5">
            <BulkImportTerminal />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
