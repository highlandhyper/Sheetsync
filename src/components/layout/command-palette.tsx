'use client';

import * as React from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useMultiSelect } from '@/context/multi-select-context';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, MessageSquare, Loader2, User, ChevronsUpDown, Check } from 'lucide-react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { isMultiSelectEnabled, setIsMultiSelectEnabled } = useMultiSelect();
  const { requestSpecialEntry } = useSpecialEntry();
  const { uniqueStaffNames } = useDataCache();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === 'K' && (e.metaKey || e.ctrlKey)) {
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
    setStaffName(''); // Reset for next time
    toast({
        title: 'Request Sent',
        description: 'Administrators have been notified of your special entry request.',
    });
  };

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
            <CommandItem
                onSelect={() => runCommand(() => setIsRequestDialogOpen(true))}
            >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>Request Special Entry (Silent Log)</span>
            </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Inventory Bulk Actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                setIsMultiSelectEnabled(true);
                toast({
                  title: 'Multi-Select Enabled',
                  description: 'Checkboxes are now visible on inventory lists for bulk actions.',
                });
              })
            }
            disabled={isMultiSelectEnabled}
          >
            <ListChecks className="mr-2 h-4 w-4" />
            <span>Enable Multi-Select Mode</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                setIsMultiSelectEnabled(false);
                toast({
                  title: 'Multi-Select Disabled',
                  description: 'Checkboxes are now hidden.',
                });
              })
            }
            disabled={!isMultiSelectEnabled}
          >
            <ListChecks className="mr-2 h-4 w-4" />
            <span>Disable Multi-Select Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>

    <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-[380px] p-6">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Special Entry
                </DialogTitle>
                <DialogDescription className="text-xs font-medium">
                    Request permission to log an item without triggering an email alert.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Identify Personnel</Label>
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                aria-expanded={staffPopoverOpen}
                                className="w-full h-12 justify-between font-bold bg-muted/20 border-primary/10 px-4"
                            >
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary" />
                                    {staffName || "Select staff member..."}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search personnel..." />
                                <CommandList>
                                    <CommandEmpty>No personnel found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueStaffNames.map(name => (
                                            <CommandItem 
                                                key={name} 
                                                value={name} 
                                                onSelect={() => {
                                                    setStaffName(name);
                                                    setStaffPopoverOpen(false);
                                                }}
                                                className="font-bold"
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
                <Button variant="outline" size="lg" onClick={() => setIsRequestDialogOpen(false)} className="font-bold rounded-xl">
                    Cancel
                </Button>
                <Button size="lg" onClick={handleRequestSpecial} disabled={isSubmitting || !staffName} className="font-black uppercase tracking-tighter rounded-xl shadow-lg shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Request"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
