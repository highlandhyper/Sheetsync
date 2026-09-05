
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
import { 
    ListChecks, 
    MessageSquare, 
    Loader2, 
    User, 
    ChevronsUpDown, 
    Check, 
    Edit, 
    History, 
    RefreshCw, 
    PackageSearch,
    X,
    FileText
} from 'lucide-react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const { role } = useAuth();
  const { toast } = useToast();
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = React.useState(false);

  const isAdmin = role === 'admin';

  // INDUSTRIAL SHORTCUT ENGINE: Migrated to ALT to avoid OS conflicts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isAlt = e.altKey;
      
      // Toggle Terminal: ALT+K
      if ((e.key === 'k' || e.key === 'K') && isAlt) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      // Handle Terminal Actions: E, S, M
      if (isAlt) {
        const key = e.key.toLowerCase();
        
        if (['s', 'e', 'm'].includes(key)) {
            e.preventDefault();
            
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
                  title: newState ? 'Multi-Select Enabled' : 'Multi-Select Disabled',
                  description: newState ? 'Log checkboxes active.' : 'Checkboxes retracted.',
                });
            }
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange, isAdmin, isMultiSelectEnabled, setIsMultiSelectEnabled, toast]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const handleRequestSpecial = async () => {
    if (!staffName) return;
    setIsSubmitting(true);
    await requestSpecialEntry(staffName, 'single', reason.trim() || undefined);
    setIsSubmitting(false);
    setIsRequestDialogOpen(false);
    onOpenChange(false);
    setStaffName('');
    setReason('');
    toast({
        title: 'Request Sent',
        description: 'Administrators have been notified of your special entry request.',
    });
  };

  const handleDialogClose = (open: boolean) => {
    setIsRequestDialogOpen(open);
    if (!open) {
        setStaffName('');
        setReason('');
    }
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
                <CommandShortcut>ALT E</CommandShortcut>
            </CommandItem>
            <CommandItem
                onSelect={() => runCommand(() => setIsRequestDialogOpen(true))}
                className="cursor-pointer"
            >
                <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                <span>Request Special Entry (Silent Log)</span>
                <CommandShortcut>ALT S</CommandShortcut>
            </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Security & Audit">
            {isAdmin && (
                <CommandItem
                    onSelect={() => runCommand(() => router.push('/audit-log'))}
                    className="cursor-pointer"
                >
                    <History className="mr-2 h-4 w-4" />
                    <span>View Global Audit History</span>
                </CommandItem>
            )}
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
            <CommandShortcut>ALT M</CommandShortcut>
          </CommandItem>
          {isAdmin && (
            <CommandItem
                    onSelect={() => runCommand(() => router.push('/products/manage'))}
                    className="cursor-pointer"
                >
                    <PackageSearch className="mr-2 h-4 w-4" />
                    <span>Advanced Product Management</span>
                </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>

    <Dialog open={isRequestDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[420px] p-6 rounded-[2rem] border-none shadow-3xl bg-background">
            <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                            Special Entry
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none">
                            Silent Authorization Protocol
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Identify Personnel</Label>
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                aria-expanded={staffPopoverOpen}
                                className="w-full h-14 justify-between font-black uppercase tracking-tight bg-muted/20 border-primary/10 px-4 rounded-2xl shadow-inner"
                            >
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-primary" />
                                    {staffName || "Select staff member..."}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-white/10" align="start">
                            <Command>
                                <CommandInput placeholder="Search personnel registry..." className="h-12" />
                                <CommandList>
                                    <CommandEmpty className="py-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center">Zero registry matches</CommandEmpty>
                                    <CommandGroup className="p-2">
                                        {uniqueStaffNames.map(name => (
                                            <CommandItem 
                                                key={name} 
                                                value={name} 
                                                onSelect={() => {
                                                    setStaffName(name);
                                                    setStaffPopoverOpen(false);
                                                }}
                                                className="font-black uppercase text-xs h-11 cursor-pointer rounded-lg px-4"
                                            >
                                                <Check className={cn("mr-3 h-4 w-4", staffName === name ? "opacity-100" : "opacity-0")} />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Justification</Label>
                        <Badge variant="outline" className="text-[8px] font-black uppercase opacity-30 border-none">Optional</Badge>
                    </div>
                    <div className="relative group">
                        <FileText className="absolute left-4 top-4 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                        <Textarea 
                            placeholder="Identify purpose for silent log entry..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[100px] pl-11 py-4 rounded-2xl bg-muted/20 border-primary/5 font-bold text-sm shadow-inner focus:border-primary/20 placeholder:text-muted-foreground/20 placeholder:font-black placeholder:uppercase placeholder:text-[9px] placeholder:tracking-widest"
                        />
                    </div>
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-4 pt-2">
                <Button variant="ghost" onClick={() => handleDialogClose(false)} className="font-black uppercase tracking-widest text-[10px] h-14 rounded-2xl opacity-40 hover:opacity-100">
                    Abort
                </Button>
                <Button 
                    onClick={handleRequestSpecial} 
                    disabled={isSubmitting || !staffName} 
                    className="font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white h-14 border-none"
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Dispatch Request"}
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
