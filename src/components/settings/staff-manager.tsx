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
  ShieldCheck,
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
} from '@/components/ui/alert-dialog';
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
  const [editValues, setEditValues] = useState<StaffMember>({
    name: '',
    phone: '',
  });
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [testingStaffName, setTestingStaffName] = useState<string | null>(null);

  const handleAddStaff = async () => {
    if (!newName.trim()) return;

    const upperName = newName.trim().toUpperCase();

    if (staffRegistry.some((s) => s.name === upperName)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'This staff member already exists.',
      });
      return;
    }

    const updated = [
      ...staffRegistry,
      { name: upperName, phone: newPhone.trim() },
    ].sort((a, b) => a.name.localeCompare(b.name));

    await updateStaffList(updated);

    toast({
      title: 'Success',
      description: `"${upperName}" registered successfully.`,
    });

    setNewName('');
    setNewPhone('');
  };

  const handleTestSms = async (member: StaffMember) => {
    if (!member.phone) {
      toast({
        variant: 'destructive',
        title: 'Missing Node',
        description: 'This personnel has no registered phone number.',
      });
      return;
    }

    setTestingStaffName(member.name);

    const msg = `SheetSync: Test alert for ${member.name}. Your terminal is now ready for Expiry Watch notifications.`;

    try {
      const res = await sendSmsAction(msg, member.phone);

      if (res.success) {
        toast({
          title: 'Signal Dispatched',
          description: `Test SMS successfully sent to ${member.name}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test Failed',
          description: res.message || 'Gateway handshake failed.',
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'System Error',
        description: 'Communication failure with SMS gateway.',
      });
    } finally {
      setTestingStaffName(null);
    }
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;

    const updated = staffRegistry.filter(
      (s) => s.name !== staffToDelete.name
    );

    await updateStaffList(updated);

    toast({
      title: 'Staff Removed',
      description: `"${staffToDelete.name}" has been removed from the registry.`,
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
    updated[index] = {
      ...editValues,
      name: editValues.name.trim().toUpperCase(),
    };

    await updateStaffList(
      updated.sort((a, b) => a.name.localeCompare(b.name))
    );

    toast({
      title: 'Updated',
      description: 'Staff information updated successfully.',
    });

    setEditingIndex(null);
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Overview */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Staff directory
            </h3>

            <Badge
              variant="secondary"
              className="rounded-lg border-0 bg-muted px-2 py-0.5 text-[8px] font-semibold"
            >
              {staffRegistry.length} staff
            </Badge>
          </div>

          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
            Manage staff identities and SMS contacts used by inventory logging
            and Expiry Watch.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.45fr)]">
        {/* Add staff */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex min-w-0 items-center gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h4 className="text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                Add staff member
              </h4>
              <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                Name is required. Phone number is optional.
              </p>
            </div>
          </div>

          <div className="space-y-3 p-3.5 sm:p-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="staff-name"
                className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Full name
              </Label>

              <Input
                id="staff-name"
                placeholder="Enter staff name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-10 rounded-xl border-border/60 bg-background px-3 text-sm font-medium shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="staff-phone"
                className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                SMS contact
              </Label>

              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />

                <Input
                  id="staff-phone"
                  placeholder="+974..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-10 rounded-xl border-border/60 bg-background pl-10 font-mono text-xs shadow-none"
                />
              </div>
            </div>

            <Button
              onClick={handleAddStaff}
              disabled={!newName.trim() || isSyncing}
              className="h-10 w-full rounded-xl text-[10px] font-semibold shadow-none"
            >
              {isSyncing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Add staff
            </Button>

            <div className="flex min-w-0 items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-amber-700 dark:text-amber-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="text-[9px] font-medium leading-4">
                Add a phone number if this staff member should receive
                Expiry Watch SMS reminders.
              </p>
            </div>
          </div>
        </section>

        {/* Staff list */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:px-4">
            <div className="min-w-0">
              <h4 className="text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                Registered staff
              </h4>
              <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                Edit contacts, test SMS delivery, or remove staff.
              </p>
            </div>

            <Badge
              variant="outline"
              className="shrink-0 rounded-lg border-border/60 px-2 py-0.5 text-[8px] font-semibold text-muted-foreground"
            >
              {staffRegistry.length}
            </Badge>
          </div>

          <ScrollArea className="h-[360px] sm:h-[390px]">
            {staffRegistry.length > 0 ? (
              <div className="divide-y divide-border/50">
                {staffRegistry.map((member, index) => (
                  <div
                    key={member.name}
                    className="group min-w-0 px-3.5 py-3 transition-colors hover:bg-muted/25 sm:px-4"
                  >
                    {editingIndex === index ? (
                      <div className="space-y-2.5">
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                          <Input
                            value={editValues.name}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                name: e.target.value,
                              })
                            }
                            className="h-9 min-w-0 rounded-xl border-border/60 text-xs font-semibold uppercase shadow-none"
                            placeholder="Name"
                          />

                          <Input
                            value={editValues.phone || ''}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                phone: e.target.value,
                              })
                            }
                            className="h-9 min-w-0 rounded-xl border-border/60 font-mono text-xs shadow-none"
                            placeholder="+974..."
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-lg px-2.5 text-[9px] font-semibold text-muted-foreground"
                            onClick={() => setEditingIndex(null)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>

                          <Button
                            size="sm"
                            className="h-8 rounded-lg px-3 text-[9px] font-semibold"
                            onClick={() => saveEdit(index)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-[11px] font-bold text-muted-foreground">
                          {member.name.slice(0, 1)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                            {member.name}
                          </p>

                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span
                              className={cn(
                                'min-w-0 truncate font-mono text-[9px]',
                                member.phone
                                  ? 'text-muted-foreground'
                                  : 'text-muted-foreground/50'
                              )}
                            >
                              {member.phone || 'No SMS contact'}
                            </span>
                          </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleTestSms(member)}
                            disabled={
                              !member.phone ||
                              testingStaffName === member.name
                            }
                            title="Send Test SMS"
                            aria-label={`Send test SMS to ${member.name}`}
                          >
                            {testingStaffName === member.name ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => startEditing(index, member)}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setStaffToDelete(member)}
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>

                <p className="mt-3 text-sm font-semibold text-foreground">
                  No staff registered
                </p>

                <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-muted-foreground">
                  Add your first staff member using the form.
                </p>
              </div>
            )}
          </ScrollArea>
        </section>
      </div>

      <AlertDialog
        open={!!staffToDelete}
        onOpenChange={(open) => !open && setStaffToDelete(null)}
      >
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-2xl border border-border/60 p-4 shadow-2xl sm:p-5">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold tracking-tight">
                  Remove staff member?
                </AlertDialogTitle>

                <AlertDialogDescription className="mt-1 text-[10px] leading-4 sm:text-[11px]">
                  Remove{' '}
                  <span className="font-semibold text-foreground">
                    {staffToDelete?.name}
                  </span>{' '}
                  from the registry. They will no longer be available for
                  logging identification or future SMS alerts.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-[10px] font-semibold">
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmDelete}
              className="h-9 rounded-xl bg-destructive text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              Remove staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
