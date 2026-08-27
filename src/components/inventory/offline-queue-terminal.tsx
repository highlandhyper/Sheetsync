'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    CloudOff, 
    Trash2, 
    Edit, 
    Zap, 
    Clock, 
    Barcode, 
    Hash, 
    MapPin, 
    Save, 
    X,
    Database,
    ShieldAlert,
    Wifi,
    RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function OfflineQueueTerminal() {
    const { pendingActions, removeOfflineAction, updateOfflineAction, isOnline, refreshData } = useDataCache();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>(null);

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-xl">
                        <CloudOff className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-widest leading-none">Offline Transmission Queue</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Pending Conflict Resolution</p>
                    </div>
                </div>
                <Badge variant={isOnline ? "default" : "destructive"} className="px-3 py-1 font-black text-[9px] uppercase tracking-[0.2em] rounded-full">
                    {isOnline ? <Wifi className="mr-1.5 h-3 w-3" /> : <CloudOff className="mr-1.5 h-3 w-3" />}
                    {isOnline ? "Registry Link Active" : "Disconnected"}
                </Badge>
            </div>

            {pendingActions.length > 0 ? (
                <ScrollArea className="h-[450px] pr-4">
                    <div className="space-y-4">
                        {pendingActions.map((action) => {
                            const isEditing = editingId === action.id;
                            const isLog = action.type === 'LOG_INVENTORY';
                            
                            return (
                                <Card key={action.id} className={cn(
                                    "border-white/10 bg-card/40 backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-300",
                                    isEditing ? "ring-2 ring-primary border-primary/20 shadow-2xl scale-[1.01]" : "hover:bg-primary/[0.02]"
                                )}>
                                    <div className="p-4 sm:p-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2 rounded-lg", isLog ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500")}>
                                                    {isLog ? <Barcode className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">OP_NODE_{action.id.slice(-4)}</span>
                                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{action.type.replace('_', ' ')}</h5>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3 text-muted-foreground/30" />
                                                <span className="text-[9px] font-mono font-bold text-muted-foreground/40">{format(parseISO(action.timestamp), 'HH:mm:ss')}</span>
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity Adjustment</Label>
                                                    <Input 
                                                        type="number" 
                                                        value={editValues.quantity || editValues.returnedQty || 0}
                                                        onChange={(e) => setEditValues({ ...editValues, [isLog ? 'quantity' : 'returnedQty']: parseInt(e.target.value) })}
                                                        className="h-10 font-bold bg-background/50"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Storage Zone</Label>
                                                    <Input 
                                                        value={editValues.location || 'Warehouse'}
                                                        onChange={(e) => setEditValues({ ...editValues, location: e.target.value })}
                                                        className="h-10 font-bold bg-background/50"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-muted/20 border border-white/5 grid grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1"><Barcode className="h-2 w-2" /> SKU Identity</span>
                                                    <p className="text-[11px] font-mono font-black text-slate-800 dark:text-slate-200 truncate">{action.data.barcode || 'N/A'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1"><Hash className="h-2 w-2" /> Payload Volume</span>
                                                    <p className="text-[11px] font-black text-primary">{action.data.quantity || action.data.returnedQty} Units</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/40 flex items-center gap-1"><MapPin className="h-2 w-2" /> Map Target</span>
                                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{action.data.location || 'Registry'}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                            {isEditing ? (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="h-8 text-[9px] font-black uppercase tracking-widest px-4 rounded-lg">Abort</Button>
                                                    <Button size="sm" onClick={handleSaveEdit} className="h-8 text-[9px] font-black uppercase tracking-widest px-4 rounded-lg bg-primary shadow-lg shadow-primary/20">
                                                        <Save className="mr-1.5 h-3 w-3" /> Commit Override
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" size="sm" onClick={() => handleStartEdit(action)} className="h-8 text-[9px] font-black uppercase tracking-widest px-4 rounded-lg hover:bg-primary/5 text-primary">
                                                        <Edit className="mr-1.5 h-3 w-3" /> Modify Conflict
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => removeOfflineAction(action.id)} className="h-8 text-[9px] font-black uppercase tracking-widest px-4 rounded-lg hover:bg-destructive/5 text-destructive ml-auto">
                                                        <Trash2 className="mr-1.5 h-3 w-3" /> Purge Log
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </ScrollArea>
            ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center opacity-40">
                    <div className="p-8 bg-muted/20 rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
                        <CheckCircle2 className="h-16 w-16 text-primary/30" />
                    </div>
                    <h5 className="text-2xl font-black uppercase tracking-tighter">Queue Nominal</h5>
                    <p className="text-sm font-medium mt-2 max-w-[280px]">No pending industrial transmissions identified. System state: Synced.</p>
                </div>
            )}
        </div>
    );
}
