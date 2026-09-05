
'use client';

import { useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Plus, 
    Trash2, 
    Edit2, 
    Check, 
    X, 
    Loader2, 
    AlertTriangle, 
    UserPlus, 
    Users, 
    Smartphone, 
    Phone,
    Send,
    ShieldCheck
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import type { StaffMember } from '@/lib/types';
import { sendSmsAction } from '@/app/actions';

export function StaffManager() {
  const { toast } = useToast();
  const { staffRegistry, updateStaffList, isSyncing } = useDataCache();
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<StaffMember>({ name: '', phone: '' });
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [testingStaffName, setTestingStaffName] = useState<string | null>(null);

  const handleAddStaff = async () => {
    if (!newName.trim()) return;
    const upperName = newName.trim().toUpperCase();
    
    if (staffRegistry.some(s => s.name === upperName)) {
        toast({ variant: "destructive", title: "Error", description: "This staff member already exists." });
        return;
    }

    const updated = [...staffRegistry, { name: upperName, phone: newPhone.trim() }].sort((a, b) => a.name.localeCompare(b.name));
    await updateStaffList(updated);
    toast({ title: "Success", description: `"${upperName}" registered successfully.` });
    setNewName('');
    setNewPhone('');
  };

  const handleTestSms = async (member: StaffMember) => {
    if (!member.phone) {
        toast({ variant: "destructive", title: "Missing Node", description: "This personnel has no registered phone number." });
        return;
    }
    
    setTestingStaffName(member.name);
    const msg = `SheetSync: Test alert for ${member.name}. Your terminal is now ready for Expiry Watch notifications.`;
    
    try {
        const res = await sendSmsAction(msg, member.phone);
        if (res.success) {
            toast({ title: "Signal Dispatched", description: `Test SMS successfully sent to ${member.name}.` });
        } else {
            toast({ variant: "destructive", title: "Test Failed", description: res.message || "Gateway handshake failed." });
        }
    } catch (e) {
        toast({ variant: "destructive", title: "System Error", description: "Communication failure with SMS gateway." });
    } finally {
        setTestingStaffName(null);
    }
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    const updated = staffRegistry.filter(s => s.name !== staffToDelete.name);
    await updateStaffList(updated);
    toast({ 
        title: "Staff Removed", 
        description: `"${staffToDelete.name}" has been removed from the registry.` 
    });
    setStaffToDelete(null);
  };

  const startEditing = (index: number, member: StaffMember) => {
    setEditingIndex(index);
    setEditValues({ ...member });
  };

  const saveEdit = async (index: number) => {
    if (!editValues.name.trim()) return;
    const updated = [...staffRegistry];
    updated[index] = { ...editValues, name: editValues.name.trim().toUpperCase() };
    await updateStaffList(updated.sort((a, b) => a.name.localeCompare(b.name)));
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
                <Label className="text-sm font-black uppercase tracking-widest">Register Personnel</Label>
            </div>
            <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="staff-name" className="text-[10px] uppercase font-black text-muted-foreground ml-1">Full Name</Label>
                    <Input
                        id="staff-name"
                        placeholder="ENTER NAME..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-11 font-bold bg-muted/10 border-primary/5"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="staff-phone" className="text-[10px] uppercase font-black text-muted-foreground ml-1">SMS Contact (e.g. +974...)</Label>
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                        <Input
                            id="staff-phone"
                            placeholder="+974..."
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            className="h-11 pl-9 font-bold bg-muted/10 border-primary/5"
                        />
                    </div>
                </div>
                <Button onClick={handleAddStaff} disabled={!newName.trim() || isSyncing} className="h-12 font-black uppercase tracking-tighter shadow-xl shadow-primary/20">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add to Registry
                </Button>
            </div>
        </div>
        
        <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
            <p className="text-[10px] font-medium text-yellow-700/70 leading-relaxed">
                Provide a phone number to enable systematic SMS alerts for this member when their watched products reach the 1-month threshold.
            </p>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Personnel Database</span>
            <Badge variant="outline" className="text-[8px] font-black">{staffRegistry.length} Records</Badge>
        </div>
        <div className="rounded-2xl border-2 border-muted overflow-hidden bg-background">
            <ScrollArea className="h-[350px]">
                <div className="divide-y divide-muted">
                {staffRegistry.length > 0 ? (
                    staffRegistry.map((member, index) => (
                    <div key={member.name} className="flex flex-col p-4 group hover:bg-muted/30 transition-colors">
                        {editingIndex === index ? (
                        <div className="space-y-3">
                            <Input
                                value={editValues.name}
                                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                className="h-9 text-xs font-bold uppercase"
                                placeholder="Name"
                            />
                            <Input
                                value={editValues.phone || ''}
                                onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                                className="h-9 text-xs font-mono"
                                placeholder="+974..."
                            />
                            <div className="flex gap-2 justify-end pt-1">
                                <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => setEditingIndex(null)}>Cancel</Button>
                                <Button size="sm" className="h-8 px-4" onClick={() => saveEdit(index)}>Save Changes</Button>
                            </div>
                        </div>
                        ) : (
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase truncate">{member.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Phone className="h-3 w-3 text-primary/40" />
                                    <span className="text-[10px] font-mono text-muted-foreground">{member.phone || 'NO SMS CONTACT'}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-primary hover:bg-primary/5" 
                                    onClick={() => handleTestSms(member)}
                                    disabled={!member.phone || testingStaffName === member.name}
                                    title="Send Test SMS"
                                >
                                    {testingStaffName === member.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/5" onClick={() => startEditing(index, member)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={() => setStaffToDelete(member)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
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
        <AlertDialogContent className="rounded-3xl border-none shadow-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Revoke Registry Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-bold text-foreground">"{staffToDelete?.name}"</span>? 
              <br /><br />
              This will disable their eligibility for future SMS alerts and logging identification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
              Purge Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
