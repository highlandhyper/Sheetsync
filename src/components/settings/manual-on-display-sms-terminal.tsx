'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
    User, 
    Send, 
    Loader2, 
    Check, 
    ChevronsUpDown, 
    ShieldAlert,
    Smartphone,
    Info,
    LayoutDashboard
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { triggerManualOnDisplaySmsAction } from '@/app/actions';
import { cn } from '@/lib/utils';

export function ManualOnDisplaySmsTerminal() {
    const { uniqueStaffNames } = useDataCache();
    const { toast } = useToast();
    
    const [selectedStaff, setSelectedStaff] = useState('');
    const [isTriggering, setIsTriggering] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleTrigger = async () => {
        if (!selectedStaff) return;
        
        setIsTriggering(true);
        try {
            const res = await triggerManualOnDisplaySmsAction(selectedStaff);
            if (res.success) {
                toast({ 
                    title: "Alerts Dispatched", 
                    description: res.message || `Successfully notified ${selectedStaff} of On-Display items.` 
                });
                setSelectedStaff('');
            } else {
                toast({ 
                    variant: "destructive", 
                    title: "Action Blocked", 
                    description: res.message || "The protocol could not be finalized." 
                });
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Sync Error", description: "Communication failure with registry core." });
        } finally {
            setIsTriggering(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                    <LayoutDashboard className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-tight">On-Display Manual Dispatch</h4>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                        Identify personnel to receive immediate temporary access for their On-Display stock. Only items within the 7-day expiry threshold will be alerted.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Assigned Personnel</label>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full h-12 justify-between rounded-xl font-bold bg-background border-primary/10"
                            >
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary/40" />
                                    <span className={cn(!selectedStaff && "text-muted-foreground")}>
                                        {selectedStaff || "Select personnel..."}
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl">
                            <Command>
                                <CommandInput placeholder="Search registry..." />
                                <CommandList>
                                    <CommandEmpty className="py-6 text-[10px] font-black text-center text-muted-foreground/40 uppercase">No personnel found</CommandEmpty>
                                    <CommandGroup className="p-1.5">
                                        {uniqueStaffNames.map((name) => (
                                            <CommandItem
                                                key={name}
                                                value={name}
                                                onSelect={() => {
                                                    setSelectedStaff(name);
                                                    setPopoverOpen(false);
                                                }}
                                                className="font-bold text-xs h-10"
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", selectedStaff === name ? "opacity-100" : "opacity-0")} />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="pt-2">
                    <Button 
                        onClick={handleTrigger} 
                        disabled={!selectedStaff || isTriggering}
                        className="w-full h-12 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                    >
                        {isTriggering ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing Protocol...
                            </>
                        ) : (
                            <>
                                <Smartphone className="mr-2 h-4 w-4" />
                                Dispatch Manual Alert
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="p-4 bg-muted/20 border-t border-white/5 flex items-center gap-3">
                <ShieldAlert className="h-4 w-4 text-primary/40" />
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Secure Handshake Protocol v5.1</p>
            </div>
        </div>
    );
}
