'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronsUpDown,
  Edit,
  FileText,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  PackageSearch,
  RefreshCw,
  Tag,
  User,
} from 'lucide-react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { useMultiSelect } from '@/context/multi-select-context';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { useToast } from '@/hooks/use-toast';

import { QuickProductEditDialog } from '@/components/products/quick-product-edit-dialog';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMON_REASONS = [
  { label: 'Registry log correction', value: 'REGISTRY LOG CORRECTION' },
  { label: 'Damaged label re-scan', value: 'DAMAGED LABEL RE-SCAN' },
  { label: 'Shift handover sync', value: 'SHIFT HANDOVER SYNC' },
  { label: 'Urgent stock arrival', value: 'URGENT STOCK ARRIVAL' },
  { label: 'Bulk re-zone protocol', value: 'BULK RE-ZONE PROTOCOL' },
  { label: 'Return to vendor (RTV)', value: 'RETURN TO VENDOR (RTV)' },
  { label: 'System handshake override', value: 'SYSTEM HANDSHAKE OVERRIDE' },
];

export function CommandPalette({
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();

  const {
    isMultiSelectEnabled,
    setIsMultiSelectEnabled,
  } = useMultiSelect();

  const { requestSpecialEntry } = useSpecialEntry();
  const { uniqueStaffNames, refreshData } = useDataCache();
  const { role } = useAuth();
  const { toast } = useToast();

  const [isRequestDialogOpen, setIsRequestDialogOpen] =
    React.useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] =
    React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [selectedReason, setSelectedReason] = React.useState('');
  const [customReason, setCustomReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] =
    React.useState(false);

  const isAdmin = role === 'admin';

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const isAlt = event.altKey;

      if (
        (event.key === 'k' || event.key === 'K') &&
        isAlt
      ) {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (isAlt) {
        const key = event.key.toLowerCase();

        if (['s', 'e', 'm'].includes(key)) {
          event.preventDefault();

          if (key === 'e') {
            onOpenChange(false);
            setIsQuickEditOpen(true);
          }

          if (key === 's') {
            onOpenChange(false);
            setIsRequestDialogOpen(true);
          }

          if (key === 'm') {
            onOpenChange(false);

            const newState = !isMultiSelectEnabled;
            setIsMultiSelectEnabled(newState);

            toast({
              title: newState
                ? 'Multi-Select Enabled'
                : 'Multi-Select Disabled',
              description: newState
                ? 'Log checkboxes active.'
                : 'Checkboxes retracted.',
            });
          }
        }
      }
    };

    document.addEventListener('keydown', down);

    return () => {
      document.removeEventListener('keydown', down);
    };
  }, [
    open,
    onOpenChange,
    isAdmin,
    isMultiSelectEnabled,
    setIsMultiSelectEnabled,
    toast,
  ]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const handleRequestSpecial = async () => {
    if (!staffName) return;

    setIsSubmitting(true);

    const finalReason = [selectedReason, customReason]
      .filter(Boolean)
      .join(' | ');

    await requestSpecialEntry(
      staffName,
      'single',
      finalReason || undefined,
    );

    setIsSubmitting(false);
    setIsRequestDialogOpen(false);
    onOpenChange(false);
    setStaffName('');
    setSelectedReason('');
    setCustomReason('');

    toast({
      title: 'Request Sent',
      description:
        'Administrators have been notified of your special entry request.',
    });
  };

  const handleDialogClose = (nextOpen: boolean) => {
    setIsRequestDialogOpen(nextOpen);

    if (!nextOpen) {
      setStaffName('');
      setSelectedReason('');
      setCustomReason('');
    }
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <CommandInput placeholder="Search commands..." />

        <CommandList className="max-h-[420px]">
          <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
            No matching commands found.
          </CommandEmpty>

          <CommandGroup heading="Quick actions">
            <CommandItem
              onSelect={() =>
                runCommand(() => setIsQuickEditOpen(true))
              }
              className="cursor-pointer rounded-xl px-3 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Edit className="h-4 w-4" />
              </div>

              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Quick product edit
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Update a product instantly
                </p>
              </div>

              <CommandShortcut>ALT E</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => setIsRequestDialogOpen(true))
              }
              className="cursor-pointer rounded-xl px-3 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>

              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Request special entry
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Request temporary staff access
                </p>
              </div>

              <CommandShortcut>ALT S</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Security & audit">
            {isAdmin && (
              <CommandItem
                onSelect={() =>
                  runCommand(() => router.push('/audit-log'))
                }
                className="cursor-pointer rounded-xl px-3 py-2.5"
              >
                <History className="mr-3 h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  View audit history
                </span>
              </CommandItem>
            )}

            <CommandItem
              onSelect={() =>
                runCommand(() => refreshData())
              }
              className="cursor-pointer rounded-xl px-3 py-2.5"
            >
              <RefreshCw className="mr-3 h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Sync data now
              </span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Inventory">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  const newState = !isMultiSelectEnabled;
                  setIsMultiSelectEnabled(newState);

                  toast({
                    title: newState
                      ? 'Multi-Select Enabled'
                      : 'Multi-Select Disabled',
                    description: newState
                      ? 'Log checkboxes active for bulk operations.'
                      : 'Checkboxes retracted.',
                  });
                })
              }
              className="cursor-pointer rounded-xl px-3 py-2.5"
            >
              <ListChecks className="mr-3 h-4 w-4 text-muted-foreground" />

              <span className="text-sm font-medium">
                {isMultiSelectEnabled ? 'Disable' : 'Enable'} bulk
                selection
              </span>

              <CommandShortcut>ALT M</CommandShortcut>
            </CommandItem>

            {isAdmin && (
              <CommandItem
                onSelect={() =>
                  runCommand(() =>
                    router.push('/products/manage'),
                  )
                }
                className="cursor-pointer rounded-xl px-3 py-2.5"
              >
                <PackageSearch className="mr-3 h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Product management
                </span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog
        open={isRequestDialogOpen}
        onOpenChange={handleDialogClose}
      >
        <DialogContent
          className="
            flex max-h-[92dvh] w-[calc(100vw-1rem)] flex-col
            overflow-hidden rounded-2xl border border-border/60
            bg-background p-0 shadow-2xl
            sm:max-w-[460px] sm:rounded-3xl
          "
        >
          <div className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl">
                    Special Entry
                  </DialogTitle>

                  <DialogDescription className="mt-1 text-xs leading-5 sm:text-sm">
                    Request temporary access for a staff member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5 p-4 sm:p-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Staff member
                </Label>

                <Popover
                  open={staffPopoverOpen}
                  onOpenChange={setStaffPopoverOpen}
                  modal
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={staffPopoverOpen}
                      className="
                        h-11 w-full justify-between rounded-xl
                        border-border/60 bg-background px-3
                        text-sm font-medium shadow-none
                      "
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <User className="h-4 w-4 shrink-0 text-primary" />
                        <span
                          className={cn(
                            'truncate',
                            !staffName && 'text-muted-foreground',
                          )}
                        >
                          {staffName || 'Select staff member'}
                        </span>
                      </div>

                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="start"
                    className="
                      w-[--radix-popover-trigger-width]
                      overflow-hidden rounded-2xl border-border/60
                      p-0 shadow-xl
                    "
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search staff..."
                        className="h-11"
                      />

                      <CommandList className="max-h-[260px]">
                        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                          No staff members found.
                        </CommandEmpty>

                        <CommandGroup className="p-1.5">
                          {uniqueStaffNames.map((name) => (
                            <CommandItem
                              key={name}
                              value={name}
                              onSelect={() => {
                                setStaffName(name);
                                setStaffPopoverOpen(false);
                              }}
                              className="h-10 cursor-pointer rounded-lg px-3 text-xs font-medium"
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  staffName === name
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />

                              <span className="truncate">
                                {name}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Reason
                </Label>

                <Select
                  value={selectedReason}
                  onValueChange={setSelectedReason}
                >
                  <SelectTrigger
                    className="
                      h-11 rounded-xl border-border/60
                      bg-background px-3 text-sm font-medium shadow-none
                    "
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Tag className="h-4 w-4 shrink-0 text-primary" />

                      <SelectValue placeholder="Select a reason" />
                    </div>
                  </SelectTrigger>

                  <SelectContent className="rounded-xl border-border/60 shadow-xl">
                    {COMMON_REASONS.map((reason) => (
                      <SelectItem
                        key={reason.value}
                        value={reason.value}
                        className="text-xs"
                      >
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold text-foreground">
                    Additional details
                  </Label>

                  <Badge
                    variant="outline"
                    className="rounded-md border-border/60 text-[9px] font-medium text-muted-foreground"
                  >
                    Optional
                  </Badge>
                </div>

                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />

                  <Textarea
                    placeholder="Add any useful context..."
                    value={customReason}
                    onChange={(event) =>
                      setCustomReason(event.target.value)
                    }
                    className="
                      min-h-[110px] resize-none rounded-xl
                      border-border/60 bg-background
                      pl-10 pt-3 text-sm shadow-none
                    "
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter
            className="
              flex-row gap-2 border-t border-border/60
              bg-muted/15 p-4 sm:px-6
            "
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogClose(false)}
              className="h-11 flex-1 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleRequestSpecial}
              disabled={isSubmitting || !staffName}
              className="h-11 flex-1 rounded-xl text-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickProductEditDialog
        isOpen={isQuickEditOpen}
        onOpenChange={setIsQuickEditOpen}
      />
    </>
  );
}
