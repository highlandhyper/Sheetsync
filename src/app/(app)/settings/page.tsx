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
  Volume2,
  Music,
  ExternalLink,
  Key,
  CheckCircle2,
  BellDot,
  Settings2,
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

type SectionId =
  | 'appearance'
  | 'notifications'
  | 'sms'
  | 'session'
  | 'staff'
  | 'locations'
  | 'on-display'
  | 'transmission'
  | 'permissions'
  | 'bulk-import'
  | 'data-source'
  | 'credentials';

type NavItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const GENERAL_ITEMS: NavItem[] = [
  { id: 'appearance', label: 'Appearance', description: 'Theme and interface', icon: Palette },
  { id: 'notifications', label: 'Notifications', description: 'Browser alerts', icon: Bell },
  { id: 'sms', label: 'SMS delivery', description: 'Security message routing', icon: Smartphone, adminOnly: true },
  { id: 'session', label: 'Session security', description: 'Welcome and auto-lock', icon: Shield, adminOnly: true },
];

const WAREHOUSE_ITEMS: NavItem[] = [
  { id: 'staff', label: 'Staff', description: 'Team members', icon: UserPlus },
  { id: 'locations', label: 'Locations', description: 'Storage zones', icon: MapPin },
  { id: 'on-display', label: 'On-Display protocol', description: 'Expiry alerts', icon: LayoutDashboard },
  { id: 'transmission', label: 'Transmission log', description: 'Alert history', icon: History },
  { id: 'permissions', label: 'Permissions', description: 'Viewer access', icon: ShieldCheck },
];

const SYSTEM_ITEMS: NavItem[] = [
  { id: 'bulk-import', label: 'Bulk import', description: 'Import via SMS', icon: CloudUpload },
  { id: 'data-source', label: 'Data source', description: 'Google Sheets registry', icon: Database },
  { id: 'credentials', label: 'Admin credentials', description: 'Local access keys', icon: KeyRound },
];

const ALL_ITEMS = [...GENERAL_ITEMS, ...WAREHOUSE_ITEMS, ...SYSTEM_ITEMS];

function AppearancePanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold text-black dark:text-white">Appearance</h2>
        <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">Theme, multi-select, and audio preferences.</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5 space-y-5">
        <div>
          <p className="text-[13px] font-medium text-black dark:text-white mb-1">Theme</p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Light, dark, or system</p>
          <ThemeToggle />
        </div>
        <div className="border-t border-neutral-100 dark:border-white/5 pt-5">
          <p className="text-[13px] font-medium text-black dark:text-white mb-1">Batch processing</p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Multi-select for bulk actions</p>
          <MultiSelectToggle />
        </div>
        {isAdmin && (
          <>
            <div className="border-t border-neutral-100 dark:border-white/5 pt-5">
              <p className="text-[13px] font-medium text-black dark:text-white mb-1 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Audio feedback
              </p>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Thank-you sounds</p>
              <AudioFeedbackToggle />
            </div>
            <div className="border-t border-neutral-100 dark:border-white/5 pt-5">
              <p className="text-[13px] font-medium text-black dark:text-white mb-1 flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5" strokeWidth={1.75} /> Identity prompt
              </p>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Voice variants</p>
              <IdentityAudioSelector />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationPanel() {
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
        toast({ title: 'Alerts Enabled', description: 'Browser notifications are now active.' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Required',
          description: 'Enable notification permissions in your browser settings.',
        });
      }
    } else {
      setSetting('isBrowserNotificationsEnabled', false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold text-black dark:text-white">Notifications</h2>
        <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">Control browser alerts for security events.</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
            <BellDot className="h-4 w-4 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-black dark:text-white">Browser notifications</p>
            <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">OTP and security alerts on this device</p>
          </div>
          {isRequesting ? (
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          ) : (
            <Switch checked={settings.isBrowserNotificationsEnabled} onCheckedChange={handleToggle} disabled={isRequesting} />
          )}
        </div>
        {settings.isBrowserNotificationsEnabled && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 dark:bg-white/5 px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-[13px] font-medium">Notifications active</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SmsPanel({
  smsEnvStatus,
  permissions,
  setSmsRecipientNumber,
  setSmsDeviceId,
}: {
  smsEnvStatus: { hasApiKey: boolean; hasDeviceId: boolean } | null;
  permissions: { smsRecipientNumber?: string; smsDeviceId?: string };
  setSmsRecipientNumber: (v: string) => void;
  setSmsDeviceId: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold text-black dark:text-white">SMS delivery</h2>
        <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">Configure recipient and device for security messages.</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5 space-y-5">
        <div className="flex flex-wrap gap-2">
          {smsEnvStatus?.hasApiKey ? (
            <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-none text-[11px] font-medium">
              <Wifi className="mr-1.5 h-3 w-3" strokeWidth={1.75} /> API ready
            </Badge>
          ) : (
            <Badge className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-none text-[11px] font-medium">
              <WifiOff className="mr-1.5 h-3 w-3" strokeWidth={1.75} /> No API key
            </Badge>
          )}
          {smsEnvStatus?.hasDeviceId && (
            <Badge className="bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-none text-[11px] font-medium">
              <Cpu className="mr-1.5 h-3 w-3" strokeWidth={1.75} /> ENV loaded
            </Badge>
          )}
        </div>
        {!smsEnvStatus?.hasApiKey && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 p-3.5">
            <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[13px] text-red-600 dark:text-red-400">TEXTBEE_API_KEY not detected. SMS is disabled.</p>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Recipient phone</Label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} />
            <Input
              placeholder="+974..."
              value={permissions.smsRecipientNumber || ''}
              onChange={(e) => setSmsRecipientNumber(e.target.value)}
              className="h-11 rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 pl-10 text-[14px] shadow-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Device ID</Label>
          <div className="relative">
            <SmartphoneNfc className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} />
            <Input
              placeholder={smsEnvStatus?.hasDeviceId ? '******** (from ENV)' : '6a95...'}
              value={permissions.smsDeviceId || ''}
              onChange={(e) => setSmsDeviceId(e.target.value)}
              className="h-11 rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 pl-10 font-mono text-[13px] shadow-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionPanel() {
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold text-black dark:text-white">Session security</h2>
        <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">Welcome screen and automatic lock timer.</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5 space-y-5">
        <div>
          <p className="text-[14px] font-medium text-black dark:text-white mb-1">Greeting</p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Admin welcome on session start</p>
          <AdminWelcomeToggle />
        </div>
        <div className="border-t border-neutral-100 dark:border-white/5 pt-5">
          <p className="text-[14px] font-medium text-black dark:text-white mb-1">Auto-lock</p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3">Lock after idle period</p>
          <InactivityTimeoutInput />
        </div>
      </div>
    </div>
  );
}

function SectionPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold text-black dark:text-white">{title}</h2>
        <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { permissions, setSmsRecipientNumber, setSmsDeviceId } = useAccessControl();
  const isAdmin = role === 'admin';

  const [activeSection, setActiveSection] = React.useState<SectionId>('appearance');
  const [mobileView, setMobileView] = React.useState<'list' | 'detail'>('list');
  const [animKey, setAnimKey] = React.useState(0);

  const [dbUrl, setDbUrl] = React.useState<string | null>(null);
  const [isDbAuthOpen, setIsDbAuthOpen] = React.useState(false);
  const [isMasterDbDialogOpen, setIsMasterDbDialogOpen] = React.useState(false);
  const [isBulkSmsDialogOpen, setIsBulkSmsDialogOpen] = React.useState(false);
  const [generatedBulkPin, setGeneratedBulkPin] = React.useState('');
  const [isSendingSms, setIsSendingSms] = React.useState(false);
  const [isImportTerminalOpen, setIsImportTerminalOpen] = React.useState(false);
  const [smsEnvStatus, setSmsEnvStatus] = React.useState<{ hasApiKey: boolean; hasDeviceId: boolean } | null>(null);

  React.useEffect(() => {
    if (isAdmin) {
      checkSmsConfigAction().then((res) => {
        if (res.success && res.data) setSmsEnvStatus(res.data);
      });
    }
  }, [isAdmin]);

  const handleInitiateBulkImport = async () => {
    if (!permissions.smsRecipientNumber) {
      toast({ variant: 'destructive', title: 'Config Missing', description: 'Set SMS recipient number first.' });
      return;
    }
    setIsSendingSms(true);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      const res = await sendSmsAction(`SHEETSYNC SECURITY: Bulk Import key: ${pin}. Single-use only.`, permissions.smsRecipientNumber);
      if (res.success) {
        setGeneratedBulkPin(pin);
        setIsBulkSmsDialogOpen(true);
        toast({ title: 'Key Sent', description: 'Check your SMS.' });
      } else {
        toast({ variant: 'destructive', title: 'SMS Failed', description: res.message });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'SMS gateway unreachable.' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleOpenMasterDb = async () => {
    if (dbUrl) return;
    try {
      const res = await getMasterSpreadsheetUrlAction();
      if (res.success && res.data) setDbUrl(res.data);
      else {
        toast({ variant: 'destructive', title: 'Error', description: res.message || 'Not configured.' });
        setIsMasterDbDialogOpen(false);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to open registry.' });
      setIsMasterDbDialogOpen(false);
    }
  };

  const openSection = (id: SectionId) => {
    if (id === 'bulk-import') {
      handleInitiateBulkImport();
      return;
    }
    if (id === 'data-source') {
      setIsDbAuthOpen(true);
      return;
    }
    setActiveSection(id);
    setMobileView('detail');
    setAnimKey((k) => k + 1);
  };

  const goBackToList = () => {
    setMobileView('list');
    setAnimKey((k) => k + 1);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'appearance':
        return <AppearancePanel isAdmin={isAdmin} />;
      case 'notifications':
        return <NotificationPanel />;
      case 'sms':
        return (
          <SmsPanel
            smsEnvStatus={smsEnvStatus}
            permissions={permissions}
            setSmsRecipientNumber={setSmsRecipientNumber}
            setSmsDeviceId={setSmsDeviceId}
          />
        );
      case 'session':
        return <SessionPanel />;
      case 'staff':
        return (
          <SectionPanel title="Staff" description="Manage team members.">
            <StaffManager />
          </SectionPanel>
        );
      case 'locations':
        return (
          <SectionPanel title="Locations" description="Warehouse storage zones.">
            <LocationManager />
          </SectionPanel>
        );
      case 'on-display':
        return (
          <SectionPanel title="On-Display protocol" description="Trigger expiry alerts.">
            <ManualOnDisplaySmsTerminal />
          </SectionPanel>
        );
      case 'transmission':
        return (
          <SectionPanel title="Transmission log" description="Recent alerts.">
            <OnDisplayAlertsTerminal />
          </SectionPanel>
        );
      case 'permissions':
        return (
          <SectionPanel title="Permissions" description="Viewer access control.">
            <AccessControlManager />
          </SectionPanel>
        );
      case 'credentials':
        return (
          <SectionPanel title="Admin credentials" description="Local keys for protected actions.">
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
              <p className="text-[13px] text-amber-700 dark:text-amber-400 leading-relaxed">
                These credentials authorize deletions and quantity overrides.
              </p>
            </div>
            <LocalCredentialsForm />
          </SectionPanel>
        );
      default:
        return <AppearancePanel isAdmin={isAdmin} />;
    }
  };

  const NavButton = ({ id, label, description, icon: Icon }: NavItem) => (
    <button
      type="button"
      onClick={() => openSection(id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        activeSection === id ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.04]'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-black dark:text-white">{label}</p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 line-clamp-1">{description}</p>
      </div>
    </button>
  );

  /* Mobile row WITH icon (same as desktop) */
  const MobileRow = ({ id, label, icon: Icon }: NavItem) => (
    <button
      type="button"
      onClick={() => openSection(id)}
      disabled={id === 'bulk-import' && isSendingSms}
      className="flex w-full items-center gap-3.5 px-1 py-3.5 text-left transition-colors active:opacity-60 disabled:opacity-50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
        <Icon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
      </div>
      <span className="flex-1 text-[16px] text-black dark:text-white">{label}</span>
      {id === 'bulk-import' && isSendingSms ? (
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
      ) : (
        <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600" strokeWidth={1.75} />
      )}
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-[#0a0a0f] overflow-x-hidden">
      {/* MOBILE */}
      <div className="lg:hidden relative min-h-[100dvh]">
        <div
          key={`list-${animKey}`}
          className={cn(
            mobileView === 'list' ? 'block' : 'hidden',
            'animate-in fade-in slide-in-from-left-4 duration-300 ease-out fill-mode-both'
          )}
        >
          <header className="sticky top-0 z-40 border-b border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-950 px-5 py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <h1 className="text-[22px] font-semibold text-black dark:text-white">Settings</h1>
            </div>
          </header>

          <div className="bg-white dark:bg-neutral-950 px-5 divide-y divide-neutral-100 dark:divide-white/5">
            {GENERAL_ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => (
              <MobileRow key={item.id} {...item} />
            ))}
          </div>

          {isAdmin && (
            <>
              <div className="h-2 bg-neutral-50 dark:bg-[#0a0a0f]" />
              <div className="bg-white dark:bg-neutral-950 px-5 divide-y divide-neutral-100 dark:divide-white/5">
                {WAREHOUSE_ITEMS.map((item) => (
                  <MobileRow key={item.id} {...item} />
                ))}
              </div>
              <div className="h-2 bg-neutral-50 dark:bg-[#0a0a0f]" />
              <div className="bg-white dark:bg-neutral-950 px-5 divide-y divide-neutral-100 dark:divide-white/5">
                {SYSTEM_ITEMS.map((item) => (
                  <MobileRow key={item.id} {...item} />
                ))}
              </div>
            </>
          )}

          <div className="px-5 py-8 text-center space-y-1">
            <p className="text-[13px] text-neutral-400 dark:text-neutral-500">SheetSync</p>
            <p className="text-[12px] text-neutral-300 dark:text-neutral-600">Version 5.0.0</p>
          </div>
        </div>

        <div
          key={`detail-${animKey}`}
          className={cn(
            mobileView === 'detail' ? 'block' : 'hidden',
            'animate-in fade-in slide-in-from-right-8 duration-300 ease-out fill-mode-both'
          )}
        >
          <header className="sticky top-0 z-40 border-b border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-950 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goBackToList}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors active:scale-90"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <h1 className="text-[17px] font-semibold text-black dark:text-white">
                {ALL_ITEMS.find((i) => i.id === activeSection)?.label}
              </h1>
            </div>
          </header>
          <div className="p-4 pb-10">{renderContent()}</div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="mb-8 flex items-center gap-2 text-[13px] text-neutral-400">
            <Link href="/dashboard" className="hover:text-black dark:hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-black dark:text-white font-medium">Settings</span>
          </div>

          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/5">
              <Settings2 className="h-6 w-6 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-black dark:text-white">Settings</h1>
              <p className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">
                Manage appearance, alerts, warehouse access, and system connections.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[240px_1fr] gap-10">
            <nav className="space-y-6">
              <div>
                <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">General</p>
                <div className="space-y-0.5">
                  {GENERAL_ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => (
                    <NavButton key={item.id} {...item} />
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div>
                  <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Warehouse</p>
                  <div className="space-y-0.5">
                    {WAREHOUSE_ITEMS.map((item) => (
                      <NavButton key={item.id} {...item} />
                    ))}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div>
                  <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">System</p>
                  <div className="space-y-0.5">
                    {SYSTEM_ITEMS.map((item) => (
                      <NavButton key={item.id} {...item} />
                    ))}
                  </div>
                </div>
              )}
            </nav>
            <main className="min-w-0 animate-in fade-in duration-200" key={activeSection}>
              {renderContent()}
            </main>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isMasterDbDialogOpen} onOpenChange={setIsMasterDbDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl">
          <div className="p-5">
            <DialogHeader>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
                  <Database className="h-5 w-5 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
                </div>
                <DialogTitle className="text-lg font-semibold text-black dark:text-white">Data source</DialogTitle>
              </div>
              <DialogDescription className="text-[14px] text-neutral-500 dark:text-neutral-400">
                Open the connected Google Sheets registry.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 pb-5">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-[13px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Do not change headers or column order — this will break sync.
              </p>
            </div>
            {dbUrl ? (
              <Button asChild className="h-11 w-full rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-none shadow-none">
                <a href={dbUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.75} /> Open registry
                </a>
              </Button>
            ) : (
              <Button disabled className="h-11 w-full rounded-xl border border-dashed border-neutral-200 dark:border-white/10 text-[13px] opacity-60">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
              </Button>
            )}
          </div>
          <div className="border-t border-neutral-100 dark:border-white/5 p-3 text-center">
            <DialogClose asChild>
              <Button variant="ghost" className="text-[13px] text-neutral-500">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <AuthorizeActionDialog
        isOpen={isDbAuthOpen}
        onOpenChange={setIsDbAuthOpen}
        onAuthorizationSuccess={() => {
          setIsDbAuthOpen(false);
          setIsMasterDbDialogOpen(true);
          handleOpenMasterDb();
        }}
        fixedIdentifier={user?.email || undefined}
        actionDescription={`Verify identity for ${user?.email} to open the data source.`}
      />

      <Dialog open={isBulkSmsDialogOpen} onOpenChange={setIsBulkSmsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-neutral-100 dark:border-white/5">
            <DialogHeader className="text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5">
                  <Key className="h-4 w-4 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
                </div>
                <DialogTitle className="text-base font-semibold text-black dark:text-white">Enter key</DialogTitle>
              </div>
              <DialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">4-digit code sent via SMS</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              className="h-14 text-center text-2xl font-semibold tracking-[0.35em] bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 rounded-xl shadow-none focus-visible:ring-0"
              placeholder="••••"
              autoFocus
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length === 4) {
                  if (val === generatedBulkPin) {
                    setIsBulkSmsDialogOpen(false);
                    setIsImportTerminalOpen(true);
                    setGeneratedBulkPin('');
                    toast({ title: 'Verified', description: 'Opening importer.' });
                  } else {
                    toast({ variant: 'destructive', title: 'Invalid key' });
                    e.target.value = '';
                  }
                }
              }}
            />
          </div>
          <DialogFooter className="p-3 border-t border-neutral-100 dark:border-white/5">
            <Button variant="ghost" onClick={() => setIsBulkSmsDialogOpen(false)} className="w-full text-[13px] text-neutral-500">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportTerminalOpen} onOpenChange={setIsImportTerminalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-white/10 p-0 shadow-2xl bg-white dark:bg-neutral-950">
          <div className="p-4 sm:p-5">
            <BulkImportTerminal />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
