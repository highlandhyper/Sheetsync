'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StaffManager() {
  const { uniqueStaffNames, updateStaffList, isSyncing } = useDataCache();
  const [newStaffName, setNewStaffName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    if (uniqueStaffNames.includes(newStaffName.trim().toUpperCase())) {
        alert("This staff member already exists.");
        return;
    }
    const updated = [...uniqueStaffNames, newStaffName.trim().toUpperCase()].sort();
    await updateStaffList(updated);
    setNewStaffName('');
  };

  const handleRemoveStaff = async (name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from the active staff list?`)) {
        const updated = uniqueStaffNames.filter(n => n !== name);
        await updateStaffList(updated);
    }
  };

  const startEditing = (index: number, name: string) => {
    setEditingIndex(index);
    setEditingValue(name);
  };

  const saveEdit = async (index: number) => {
    if (!editingValue.trim()) return;
    const updated = [...uniqueStaffNames];
    updated[index] = editingValue.trim().toUpperCase();
    await updateStaffList(updated.sort());
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
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveStaff(name)}>
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
    </div>
  );
}
