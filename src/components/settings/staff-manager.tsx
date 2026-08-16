'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Loader2, AlertTriangle, UserPlus } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* FORM SECTION */}
      <div className="space-y-6">
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <Label htmlFor="new-staff" className="text-sm font-black uppercase tracking-widest">Identify Personnel</Label>
            </div>
            <div className="flex flex-col gap-3">
                <Input
                    id="new-staff"
                    placeholder="ENTER FULL NAME..."
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
                    disabled={isSyncing}
                    className="h-12 font-black tracking-widest bg-muted/10 border-primary/5"
                />
                <Button onClick={handleAddStaff} disabled={!newStaffName.trim() || isSyncing} className="h-12 font-black uppercase tracking-tighter shadow-xl shadow-primary/20">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Register Personnel
                </Button>
            </div>
        </div>
        
        <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
            <p className="text-[10px] font-medium text-yellow-700/70 leading-relaxed">
                Registered personnel appear as options in the logging terminal. Modifications are synchronized across all system terminals.
            </p>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Registry</span>
            <Badge variant="outline" className="text-[8px] font-black">{uniqueStaffNames.length} Records</Badge>
        </div>
        <div className="rounded-2xl border-2 border-muted overflow-hidden bg-background">
            <ScrollArea className="h-[300px]">
                <div className="divide-y divide-muted">
                {uniqueStaffNames.length > 0 ? (
                    uniqueStaffNames.map((name, index) => (
                    <div key={name} className="flex items-center justify-between p-3.5 group hover:bg-muted/30 transition-colors">
                        {editingIndex === index ? (
                        <div className="flex-1 flex gap-2 mr-2">
                            <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value.toUpperCase())}
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
                            <span className="font-bold text-sm tracking-tight text-slate-700 dark:text-slate-300">{name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/5" onClick={() => startEditing(index, name)}>
                                <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={() => setStaffToDelete(name)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            </div>
                        </>
                        )}
                    </div>
                    ))
                ) : (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                        <Users className="h-10 w-10 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Zero Records Found</p>
                    </div>
                )}
                </div>
            </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
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
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
              Remove Staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
