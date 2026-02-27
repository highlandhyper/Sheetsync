'use client';

import * as React from 'react';
import {
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
import { ListChecks, MessageSquare, Loader2 } from 'lucide-react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { isMultiSelectEnabled, setIsMultiSelectEnabled } = useMultiSelect();
  const { requestSpecialEntry } = useSpecialEntry();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    setIsSubmitting(true);
    await requestSpecialEntry(staffName, 'single');
    setIsSubmitting(false);
    setIsRequestDialogOpen(false);
    onOpenChange(false);
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
        <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
                <DialogTitle className="text-lg">Request Special Entry</DialogTitle>
                <DialogDescription className="text-xs">
                    Request permission to log an item without triggering an email notification.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                    <Label htmlFor="staffNameReq" className="text-xs font-bold uppercase text-muted-foreground">Your Name</Label>
                    <Input 
                        id="staffNameReq" 
                        placeholder="Enter your name" 
                        value={staffName} 
                        onChange={(e) => setStaffName(e.target.value)}
                        className="h-9 text-sm"
                    />
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleRequestSpecial} disabled={isSubmitting || !staffName.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : "Send Request"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
