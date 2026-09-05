'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    CloudOff, 
    Trash2, 
    Edit, 
    Barcode, 
    Hash, 
    MapPin, 
    Save, 
    X,
    ShieldAlert,
    Wifi,
    RefreshCw,
    CheckCircle2,
    Search,
    ChevronRight,
    Trash
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function OfflineQueueTerminal() {
    const { 
        pendingActions, 
        removeOfflineAction, 
        updateOfflineAction, 
        isOnline, 
        uniqueLocations, 
        uniqueStaffNames 
    } = useDataCache();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>(null);

    const filteredActions = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        if (!lower) return pendingActions;
        return pendingActions.filter(a => 
            (a.data.barcode || '').toLowerCase().includes(lower) ||
            (a.data.staffName || '').toLowerCase().includes(lower) ||
            (a.type || '').toLowerCase().includes(lower)
        );
    }, [pendingActions, searchTerm]);

    const handleStartEdit = (action: any) => {
        setEditingId(action.id);
        setEditValues({ ...action.data });
    };

    const handleSaveEdit = () => {
        if (editingId && editValues) {
            updateOfflineAction(editingId, editValues);
            setEditingId(null);
            setEditValues(null);
        }
    };

    const handlePurgeAll = () => {
        pendingActions.forEach(a => removeOfflineAction(a.id));
    };

    return (
        <div className="space-y-6">
            {/* TERMINAL HEADER */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <CloudOff className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-tight leading-none">Transmission Outbox</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-40">Industrial Buffer Queue</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={isOnline ? "default" : "secondary"} className="h-7 px-3 font-black text-[9px] uppercase tracking-widest rounded-full border-none">
                        {isOnline ? <Wifi className="mr-1.5 h-3 w-3" /> : <CloudOff className="mr-1.5 h-3 w-3" />}
                        {isOnline ? "Link Ready" : "Local Only"}
                    </Badge>
                    {pendingActions.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5">
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-none shadow-3xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2 text-destructive uppercase font-black tracking-tight">
                                        <ShieldAlert className="h-5 w-5" />
                                        Confirm Purge
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently erase all <strong>{pendingActions.length} pending logs</strong> from the local buffer. This action is irreversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl font-bold">Abort</AlertDialogCancel>
                                    <AlertDialogAction onClick={handlePurgeAll} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
                                        Purge All Logs
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* SEARCH UTILITY */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
                <Input 
                    placeholder="IDENTIFY SKU OR PERSONNEL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-9 rounded-xl bg-muted/20 border-white/5 font-bold uppercase text-[9px] tracking-[0.2em] shadow-inner placeholder:text-muted-foreground/20"
                />
            </div>

            {pendingActions.length > 0 ? (
                <ScrollArea className="h-[450px] pr-2">
                    <div className="space-y-3 pb-4">
                        {filteredActions.map((action) => {
                            const isEditing = editingId === action.id;
                            const isLog = action.type === 'LOG_INVENTORY';
                            
                            return (
                                <Card key={action.id} className={cn(
                                    "border border-white/10 bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-300",
                                    isEditing ? "ring-2 ring-primary border-primary/20 shadow-xl" : "hover:border-primary/20"
                                )}>
                                    <div className="p-4 sm:p-5">
                                        {/* COMPACT VIEW MODE */}
                                        {!isEditing ? (
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", isLog ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500")}>
                                                        {isLog ? <Barcode className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                                                                {action.data.barcode || 'SYSTEM_CMD'}
                                                            </h5>
                                                            <Badge variant="outline" className="h-4 px-1 text-[7px] font-black uppercase border-muted-foreground/10 text-muted-foreground/40">{action.id.slice(-4).toUpperCase()}</Badge>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest truncate">
                                                            {action.data.location || 'Registry'} • {action.data.staffName || 'Admin'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right mr-2">
                                                        <p className="text-xl font-black text-primary leading-none tabular-nums">
                                                            {action.data.quantity || action.data.returnedQty}
                                                        </p>
                                                        <p className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-tighter mt-1">UNITS</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleStartEdit(action)} 
                                                            className="h-9 w-9 rounded-xl bg-primary/5 text-primary hover:bg-primary/10"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => removeOfflineAction(action.id)} 
                                                            className="h-9 w-9 rounded-xl bg-destructive/5 text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* EXPANDED EDIT MODE: CLEAN FORM */
                                            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <Edit className="h-3.5 w-3.5 text-primary" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Advanced Edit Mode</span>
                                                    </div>
                                                    <button onClick={() => setEditingId(null)} className="text-muted-foreground/40 hover:text-foreground p-1">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Volume</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={editValues.quantity || editValues.returnedQty || 0}
                                                            onChange={(e) => setEditValues({ ...editValues, [isLog ? 'quantity' : 'returnedQty']: parseInt(e.target.value) })}
                                                            className="h-10 font-black bg-background/50 border-none shadow-inner"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Storage Zone</Label>
                                                        <Select 
                                                            value={editValues.location} 
                                                            onValueChange={(v) => setEditValues({ ...editValues, location: v })}
                                                        >
                                                            <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-inner">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-white/10">
                                                                {uniqueLocations.map(loc => <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Operating Personnel</Label>
                                                    <Select 
                                                        value={editValues.staffName} 
                                                        onValueChange={(v) => setEditValues({ ...editValues, staffName: v })}
                                                    >
                                                        <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-inner">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-white/10">
                                                            {uniqueStaffNames.map(staff => <SelectItem key={staff} value={staff} className="text-xs font-bold">{staff}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {isLog && (
                                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Classification</Label>
                                                            <Select 
                                                                value={editValues.itemType} 
                                                                onValueChange={(v) => setEditValues({ ...editValues, itemType: v })}
                                                            >
                                                                <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-inner">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl border-white/10">
                                                                    <SelectItem value="Expiry" className="text-xs font-bold">EXPIRY</SelectItem>
                                                                    <SelectItem value="Damage" className="text-xs font-bold text-destructive">DAMAGE</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Expiry Date</Label>
                                                            <Input 
                                                                type="date"
                                                                value={editValues.expiryDate || ''}
                                                                onChange={(e) => setEditValues({ ...editValues, expiryDate: e.target.value })}
                                                                className="h-10 font-bold bg-background/50 border-none shadow-inner uppercase text-[10px]"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-2 pt-2">
                                                    <Button variant="outline" onClick={() => setEditingId(null)} className="flex-1 font-bold h-11 rounded-xl">Discard</Button>
                                                    <Button onClick={handleSaveEdit} className="flex-[2] font-black uppercase tracking-widest text-[10px] h-11 rounded-xl shadow-lg shadow-primary/20 bg-primary text-white">
                                                        <Save className="mr-2 h-4 w-4" /> Save Advanced
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}

                        {filteredActions.length === 0 && searchTerm && (
                            <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                                <Search className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No Buffer Matches</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                    <div className="p-8 bg-muted/20 rounded-[3rem] mb-6 border-2 border-dashed border-white/5 opacity-20">
                        <CheckCircle2 className="h-12 w-12 text-primary" />
                    </div>
                    <div className="space-y-1 opacity-40">
                        <h5 className="text-lg font-black uppercase tracking-tight">Outbox Nominal</h5>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">All local records synced</p>
                    </div>
                </div>
            )}
            
            <div className="pt-2 text-center">
                <p className="text-[7px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">SheetSync Industrial Protocol • v5.0 Secure Outbox</p>
            </div>
        </div>
    );
}