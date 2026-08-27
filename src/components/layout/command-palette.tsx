'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { useMultiSelect } from '@/context/multi-select-context';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, MessageSquare, Loader2, User, ChevronsUpDown, Check, Edit, History, RefreshCw, PackageSearch } from 'lucide-react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { cn } from '@/lib/utils';
import { QuickProductEditDialog } from '@/components/products/quick-product-edit-dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { isMultiSelectEnabled, setIsMultiSelectEnabled } = useMultiSelect();
  const { requestSpecialEntry } = useSpecialEntry();
  const { uniqueStaffNames, refreshData } = useDataCache();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = React.useState(false);

  // UNIVERSAL TERMINAL SHORTCUT: CTRL+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const handleRequestSpecial = async () => {
    if (!staffName) return;
    setIsSubmitting(true);
    await requestSpecialEntry(staffName, 'single');
    setIsSubmitting(false);
    setIsRequestDialogOpen(false);
    onOpenChange(false);
    setStaffName('');
    toast({
        title: 'Request Sent',
        description: 'Administrators have been notified of your special entry request.',
    });
  };

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a terminal command or search SKU..." />
      <CommandList>
        <CommandEmpty>Zero registry matches identified.</CommandEmpty>
        <CommandGroup heading="Industrial Terminal">
            <CommandItem
                onSelect={() => runCommand(() => setIsQuickEditOpen(true))}
                className="flex items-center gap-2 cursor-pointer"
            >
                <Edit className="mr-2 h-4 w-4 text-primary" />
                <span>Quick Catalog Update (Instant)</span>
                <CommandShortcut>CTRL E</CommandShortcut>
            </CommandItem>
            <CommandItem
                onSelect={() => runCommand(() => setIsRequestDialogOpen(true))}
                className="cursor-pointer"
            >
                <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                <span>Request Special Entry (Silent Log)</span>
                <CommandShortcut>CTRL S</CommandShortcut>
            </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Security & Audit">
            <CommandItem
                onSelect={() => runCommand(() => router.push('/audit-log'))}
                className="cursor-pointer"
            >
                <History className="mr-2 h-4 w-4" />
                <span>View Global Audit History</span>
            </CommandItem>
            <CommandItem
                onSelect={() => runCommand(() => refreshData())}
                className="cursor-pointer"
            >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Force Registry Handshake</span>
            </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Inventory Configuration">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                const newState = !isMultiSelectEnabled;
                setIsMultiSelectEnabled(newState);
                toast({
                  title: newState ? 'Multi-Select Enabled' : 'Multi-Select Disabled',
                  description: newState 
                    ? 'Log checkboxes active for bulk operations.'
                    : 'Checkboxes retracted.',
                });
              })
            }
            className="cursor-pointer"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            <span>{isMultiSelectEnabled ? 'Disable' : 'Enable'} Bulk Selection Mode</span>
            <CommandShortcut>CTRL M</CommandShortcut>
          </CommandItem>
          <CommandItem
                onSelect={() => runCommand(() => router.push('/products/manage'))}
                className="cursor-pointer"
            >
                <PackageSearch className="mr-2 h-4 w-4" />
                <span>Advanced Product Management</span>
            </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>

    <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-[380px] p-6 rounded-3xl">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Special Entry
                </DialogTitle>
                <DialogDescription className="text-xs font-medium">
                    Authorize logging without triggering automated email alerts.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Identify Personnel</Label>
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                aria-expanded={staffPopoverOpen}
                                className="w-full h-12 justify-between font-bold bg-muted/20 border-primary/10 px-4 rounded-xl"
                            >
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary" />
                                    {staffName || "Select staff member..."}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl" align="start">
                            <Command>
                                <CommandInput placeholder="Search personnel registry..." />
                                <CommandList>
                                    <CommandEmpty>No matching personnel identified.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueStaffNames.map(name => (
                                            <CommandItem 
                                                key={name} 
                                                value={name} 
                                                onSelect={() => {
                                                    setStaffName(name);
                                                    setStaffPopoverOpen(false);
                                                }}
                                                className="font-bold h-11 cursor-pointer"
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", staffName === name ? "opacity-100" : "opacity-0")} />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" size="lg" onClick={() => setIsRequestDialogOpen(false)} className="font-bold rounded-xl h-12">
                    Cancel
                </Button>
                <Button size="lg" onClick={handleRequestSpecial} disabled={isSubmitting || !staffName} className="font-black uppercase tracking-tighter rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-white h-12">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Request"}
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
