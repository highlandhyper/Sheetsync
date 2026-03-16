'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Loader2, MapPin, AlertTriangle } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="new-location">Add New Storage Zone</Label>
        <div className="flex gap-2">
          <Input
            id="new-location"
            placeholder="e.g., Cold Storage B..."
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={isSyncing}
          />
          <Button onClick={handleAdd} disabled={!newLocation.trim() || isSyncing}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/50 p-2 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Location Name</span>
            <span>Actions</span>
        </div>
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {uniqueLocations.length > 0 ? (
            uniqueLocations.map((name, index) => (
              <div key={name} className="flex items-center justify-between p-3 group hover:bg-muted/30 transition-colors">
                {editingIndex === index ? (
                  <div className="flex-1 flex gap-2 mr-2">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveEdit(index)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingIndex(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditing(index, name)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setLocationToDelete(name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm italic">
              No custom locations set.
            </div>
          )}
        </div>
      </div>
      
      {isSyncing && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating cloud registry...
          </div>
      )}

      <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
        <AlertDialogContent>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
