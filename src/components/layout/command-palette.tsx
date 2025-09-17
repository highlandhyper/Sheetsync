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
import { ListChecks } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { isMultiSelectEnabled, setIsMultiSelectEnabled } = useMultiSelect();
  const { toast } = useToast();

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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
  );
}
