'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function StaffManager() {
  const { toast } = useToast();
  const { uniqueStaffNames, updateStaffList, isSyncing } = useDataCache();
  const [newStaffName, setNewStaffName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    const upperName = newStaffName.trim().toUpperCase();
    if (uniqueStaffNames.includes(upperName)) {
        toast({ variant: "destructive", title: "Error", description: "This staff member already exists." });
        return;
    }
    const updated = [...uniqueStaffNames, upperName].sort();
    await updateStaffList(updated);
    toast({ title: "Success", description: `"${upperName}" added to staff registry.` });
    setNewStaffName('');
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    const updated = uniqueStaffNames.filter(n => n !== staffToDelete);
    await updateStaffList(updated);
    toast({ 
        title: "Staff Removed", 
        description: `"${staffToDelete}" has been removed from the active registry.` 
    });
    setStaffToDelete(null);
  };

  const startEditing = (index: number, name: string) => {
    setEditingIndex(index);
    setEditingValue(name);
  };

  const saveEdit = async (index: number) => {
    if (!editingValue.trim()) return;
    const upperValue = editingValue.trim().toUpperCase();
    const updated = [...uniqueStaffNames];
    updated[index] = upperValue;
    await updateStaffList(updated.sort());
    toast({ title: "Updated", description: "Staff information updated successfully." });
    setEditingIndex(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="new-staff">Add New Staff Member</Label>
        <div className="flex gap-2">
          <Input
            id="new-staff"
            placeholder="ENTER NAME..."
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
            disabled={isSyncing}
          />
          <Button onClick={handleAddStaff} disabled={!newStaffName.trim() || isSyncing}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/50 p-2 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Staff Name</span>
            <span>Actions</span>
        </div>
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {uniqueStaffNames.length > 0 ? (
            uniqueStaffNames.map((name, index) => (
              <div key={name} className="flex items-center justify-between p-3 group hover:bg-muted/30 transition-colors">
                {editingIndex === index ? (
                  <div className="flex-1 flex gap-2 mr-2">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value.toUpperCase())}
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
                    <span className="font-medium text-sm">{name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditing(index, name)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setStaffToDelete(name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm italic">
              No staff members registered.
            </div>
          )}
        </div>
      </div>
      
      {isSyncing && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating registry...
          </div>
      )}

      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm Removal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-bold text-foreground">"{staffToDelete}"</span> from the active staff registry? 
              <br /><br />
              Existing logs will keep this staff name, but they will no longer appear as an option for new logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
