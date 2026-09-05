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
    Clock, 
    Barcode, 
    Hash, 
    MapPin, 
    Save, 
    X,
    Database,
    ShieldAlert,
    Wifi,
    RefreshCw,
    CheckCircle2,
    Search,
    User,
    Tag,
    Calendar as CalendarIcon,
    AlertTriangle,
    Trash
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-xl">
                        <CloudOff className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-widest leading-none text-slate-900 dark:text-white">Transmission Terminal</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Industrial Buffer Registry</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={isOnline ? "default" : "destructive"} className="px-3 py-1 font-black text-[9px] uppercase tracking-[0.2em] rounded-full">
                        {isOnline ? <Wifi className="mr-1.5 h-3 w-3" /> : <CloudOff className="mr-1.5 h-3 w-3" />}
                        {isOnline ? "LINK ACTIVE" : "OFFLINE"}
                    </Badge>
                    {pendingActions.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg">
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
                                        This will permanently erase all <strong>{pendingActions.length} pending logs</strong> from the local buffer. This action is cryptographic and irreversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl font-bold">Abort</AlertDialogCancel>
                                    <AlertDialogAction onClick={handlePurgeAll} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
                                        Execute Purge
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* SEARCH UTILITY */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="IDENTIFY SKU OR PERSONNEL IN QUEUE..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 pl-10 rounded-xl bg-muted/20 border-white/5 font-black uppercase text-[10px] tracking-widest shadow-inner placeholder:text-muted-foreground/20"
                />
            </div>

            {pendingActions.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4 pb-4">
                        {filteredActions.map((action) => {
                            const isEditing = editingId === action.id;
                            const isLog = action.type === 'LOG_INVENTORY';
                            
                            return (
                                <Card key={action.id} className={cn(
                                    "border-white/10 bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-300",
                                    isEditing ? "ring-2 ring-primary border-primary/20 shadow-2xl scale-[1.01]" : "hover:bg-primary/[0.02]"
                                )}>
                                    <div className="p-5 sm:p-6 space-y-5">
                                        {/* CARD HEADER */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2.5 rounded-xl shadow-sm", isLog ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500")}>
                                                    {isLog ? <Barcode className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">NODE_{action.id.slice(-6).toUpperCase()}</span>
                                                        <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black uppercase border-muted-foreground/10 text-muted-foreground/60">{action.type.replace('_', ' ')}</Badge>
                                                    </div>
                                                    <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1 truncate max-w-[150px]">
                                                        {action.data.barcode || 'SYSTEM_CMD'}
                                                    </h5>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 text-muted-foreground/30" />
                                                    <span className="text-[9px] font-mono font-bold text-muted-foreground/40">{format(parseISO(action.timestamp), 'HH:mm:ss')}</span>
                                                </div>
                                                <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/20">{format(parseISO(action.timestamp), 'dd MMM yyyy')}</span>
                                            </div>
                                        </div>

                                        {/* EDIT MODE: ADVANCED TERMINAL */}
                                        {isEditing ? (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-muted/10 p-4 rounded-2xl border border-primary/10 shadow-inner">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Volume</Label>
                                                        <div className="relative">
                                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/40" />
                                                            <Input 
                                                                type="number" 
                                                                value={editValues.quantity || editValues.returnedQty || 0}
                                                                onChange={(e) => setEditValues({ ...editValues, [isLog ? 'quantity' : 'returnedQty']: parseInt(e.target.value) })}
                                                                className="h-10 pl-8 font-black bg-background/50 border-none shadow-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Zone</Label>
                                                        <Select 
                                                            value={editValues.location} 
                                                            onValueChange={(v) => setEditValues({ ...editValues, location: v })}
                                                        >
                                                            <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-sm">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-white/10">
                                                                {uniqueLocations.map(loc => <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                {isLog && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Classification</Label>
                                                            <Select 
                                                                value={editValues.itemType} 
                                                                onValueChange={(v) => setEditValues({ ...editValues, itemType: v })}
                                                            >
                                                                <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-sm">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl border-white/10">
                                                                    <SelectItem value="Expiry" className="text-xs font-bold">EXPIRY</SelectItem>
                                                                    <SelectItem value="Damage" className="text-xs font-bold text-destructive">DAMAGE</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expiry Date</Label>
                                                            <Input 
                                                                type="date"
                                                                value={editValues.expiryDate || ''}
                                                                onChange={(e) => setEditValues({ ...editValues, expiryDate: e.target.value })}
                                                                className="h-10 font-bold bg-background/50 border-none shadow-sm uppercase text-[10px]"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Personnel Identity</Label>
                                                    <Select 
                                                        value={editValues.staffName} 
                                                        onValueChange={(v) => setEditValues({ ...editValues, staffName: v })}
                                                    >
                                                        <SelectTrigger className="h-10 font-bold bg-background/50 border-none shadow-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-white/10">
                                                            {uniqueStaffNames.map(staff => <SelectItem key={staff} value={staff} className="text-xs font-bold">{staff}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ) : (
                                            /* VIEW MODE: HIGH-DENSITY GRID */
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-muted/20 border border-white/5 space-y-1 group-hover:bg-primary/[0.02] transition-colors">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1.5 tracking-widest">
                                                        <Hash className="h-2.5 w-2.5 text-primary/40" /> Volume
                                                    </span>
                                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tabular-nums">
                                                        {action.data.quantity || action.data.returnedQty} <span className="text-[9px] font-bold text-muted-foreground/30 uppercase">Units</span>
                                                    </p>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-muted/20 border border-white/5 space-y-1 group-hover:bg-primary/[0.02] transition-colors">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1.5 tracking-widest">
                                                        <MapPin className="h-2.5 w-2.5 text-primary/40" /> Zone
                                                    </span>
                                                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tighter">
                                                        {action.data.location || 'Registry Core'}
                                                    </p>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-muted/20 border border-white/5 space-y-1 group-hover:bg-primary/[0.02] transition-colors">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1.5 tracking-widest">
                                                        <User className="h-2.5 w-2.5 text-primary/40" /> Personnel
                                                    </span>
                                                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-widest opacity-80">
                                                        {action.data.staffName || 'Admin Terminal'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* LOG DETAILS / WARNINGS */}
                                        {!isEditing && isLog && action.data.itemType === 'Damage' && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                                                <AlertTriangle className="h-3 w-3 text-orange-600" />
                                                <span className="text-[8px] font-black uppercase text-orange-700 tracking-[0.2em]">HIGH PRIORITY: DAMAGE PROTOCOL IDENTIFIED</span>
                                            </div>
                                        )}

                                        {/* ACTION FOOTER */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                            {isEditing ? (
                                                <>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-9 px-6 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-muted">Abort</Button>
                                                    <Button size="sm" onClick={handleSaveEdit} className="h-9 flex-1 text-[9px] font-black uppercase tracking-widest rounded-xl bg-primary text-white shadow-xl shadow-primary/20">
                                                        <Save className="mr-1.5 h-3.5 w-3.5" /> Synchronize Node
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => handleStartEdit(action)} className="h-9 text-[9px] font-black uppercase tracking-widest px-5 rounded-xl border-primary/10 hover:bg-primary/5 text-primary transition-all">
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" /> Advanced Edit
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => removeOfflineAction(action.id)} className="h-9 w-9 rounded-xl hover:bg-destructive/10 text-destructive/40 hover:text-destructive ml-auto transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}

                        {filteredActions.length === 0 && searchTerm && (
                            <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                                <div className="p-6 bg-muted/20 rounded-2xl mb-4 border-2 border-dashed border-white/5">
                                    <X className="h-10 w-10 text-primary/20" />
                                </div>
                                <h5 className="text-sm font-black uppercase tracking-tighter">Zero Node Matches</h5>
                                <p className="text-[10px] font-medium mt-1">No buffer records identified for your identification term.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center opacity-40">
                    <div className="p-8 bg-muted/20 rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
                        <CheckCircle2 className="h-16 w-16 text-primary/30" />
                    </div>
                    <div className="space-y-1">
                        <h5 className="text-2xl font-black uppercase tracking-tighter">Buffer Nominal</h5>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">System Core Synchronized</p>
                    </div>
                </div>
            )}
            
            <div className="p-4 bg-muted/5 border-t border-white/5 text-center">
                <p className="text-[7px] font-black uppercase tracking-[0.6em] text-muted-foreground/20">Registry Transmission Protocol v5.0 • Secure Local Queue</p>
            </div>
        </div>
    );
}
