'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Loader2, MapPin, AlertTriangle, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function LocationManager() {
  const { toast } = useToast();
  const { uniqueLocations, updateLocationList, isSyncing } = useDataCache();
  const [newLocation, setNewLocation] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLocation.trim()) return;
    if (uniqueLocations.some(l => l.toLowerCase() === newLocation.trim().toLowerCase())) {
        toast({ variant: "destructive", title: "Error", description: "This storage zone already exists." });
        return;
    }
    const updated = [...uniqueLocations, newLocation.trim()].sort();
    await updateLocationList(updated);
    toast({ title: "Zone Added", description: `"${newLocation.trim()}" is now an active storage zone.` });
    setNewLocation('');
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;
    const updated = uniqueLocations.filter(n => n !== locationToDelete);
    await updateLocationList(updated);
    toast({ title: "Zone Removed", description: `"${locationToDelete}" has been removed.` });
    setLocationToDelete(null);
  };

  const startEditing = (index: number, name: string) => {
    setEditingIndex(index);
    setEditingValue(name);
  };

  const saveEdit = async (index: number) => {
    if (!editingValue.trim()) return;
    const updated = [...uniqueLocations];
    updated[index] = editingValue.trim();
    await updateLocationList(updated.sort());
    toast({ title: "Updated", description: "Location name updated." });
    setEditingIndex(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* FORM SECTION */}
      <div className="space-y-6">
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                </div>
                <Label htmlFor="new-location" className="text-sm font-black uppercase tracking-widest">New Storage Zone</Label>
            </div>
            <div className="flex flex-col gap-3">
                <Input
                    id="new-location"
                    placeholder="e.g., Cold Storage B..."
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    disabled={isSyncing}
                    className="h-12 font-bold bg-muted/10 border-primary/5"
                />
                <Button onClick={handleAdd} disabled={!newLocation.trim() || isSyncing} className="h-12 font-black uppercase tracking-tighter shadow-xl shadow-primary/20">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Zone
                </Button>
            </div>
        </div>
        
        <div className="p-4 bg-muted/10 border border-primary/5 rounded-2xl">
            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                Defining zones allows for precise inventory tracking. All terminals in the warehouse will be updated with these new mapping options.
            </p>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Defined Regions</span>
            <Badge variant="outline" className="text-[8px] font-black">{uniqueLocations.length} Zones</Badge>
        </div>
        <div className="rounded-2xl border-2 border-muted overflow-hidden bg-background">
            <ScrollArea className="h-[300px]">
                <div className="divide-y divide-muted">
                {uniqueLocations.length > 0 ? (
                    uniqueLocations.map((name, index) => (
                    <div key={name} className="flex items-center justify-between p-3.5 group hover:bg-muted/30 transition-colors">
                        {editingIndex === index ? (
                        <div className="flex-1 flex gap-2 mr-2">
                            <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-9 text-sm font-bold bg-background"
                            autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 hover:bg-green-50" onClick={() => saveEdit(index)}>
                            <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:bg-destructive/5" onClick={() => setEditingIndex(null)}>
                            <X className="h-4 w-4" />
                            </Button>
                        </div>
                        ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <Building className="h-3.5 w-3.5 text-primary/40" />
                                <span className="font-bold text-sm tracking-tight text-slate-700 dark:text-slate-300">{name}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/5" onClick={() => startEditing(index, name)}>
                                <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={() => setLocationToDelete(name)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            </div>
                        </>
                        )}
                    </div>
                    ))
                ) : (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                        <MapPin className="h-10 w-10 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Zero Zones Defined</p>
                    </div>
                )}
                </div>
            </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Remove Storage Zone
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirm removal of <span className="font-bold text-foreground">"{locationToDelete}"</span>. 
              <br /><br />
              This will remove it from future logging options. Existing records associated with this zone will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
