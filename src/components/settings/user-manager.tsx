'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, ShieldCheck, User as UserIcon, Ban, ArrowLeftRight, RefreshCw, Search, Users as UsersIcon, Clock, ExternalLink, ShieldAlert, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters for a stronger password.'),
  role: z.enum(['admin', 'viewer']),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type ManagedUser = {
  uid: string;
  email: string;
  role: 'admin' | 'viewer';
  active: boolean;
  permanent: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

export function UserManager() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingUid, setWorkingUid] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ user: ManagedUser; update: { role?: 'admin' | 'viewer'; active?: boolean } } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', password: '', role: 'viewer' },
  });

  const selectedRole = watch('role');

  const authorizedFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    if (!currentUser) throw new Error('Sign in again to continue.');
    const token = await currentUser.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success !== true) {
      throw new Error(payload.error || 'The request failed.');
    }
    return payload;
  }, [currentUser]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await authorizedFetch('/api/admin/users');
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to load users',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [authorizedFetch, toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(
    () => users.filter((entry) => entry.email.toLowerCase().includes(searchTerm.toLowerCase())),
    [users, searchTerm],
  );

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((entry) => entry.role === 'admin' && entry.active).length,
    viewers: users.filter((entry) => entry.role === 'viewer' && entry.active).length,
  }), [users]);

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsSubmitting(true);
    try {
      await authorizedFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          role: data.role,
        }),
      });
      toast({ title: 'User created', description: `${data.email} was added to Firebase Authentication and assigned the ${data.role} role.` });
      reset({ email: '', password: '', role: 'viewer' });
      await loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'User creation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUser = async (entry: ManagedUser, update: { role?: 'admin' | 'viewer'; active?: boolean }) => {
    setPendingChange({ user: entry, update });
  };

  const confirmUserChange = async () => {
    if (!pendingChange) return;
    const { user: entry, update } = pendingChange;
    setPendingChange(null);
    setWorkingUid(entry.uid);
    try {
      await authorizedFetch(`/api/admin/users/${encodeURIComponent(entry.uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      toast({
        title: 'User updated',
        description: update.role ? `${entry.email} is now ${update.role}.` : update.active ? `${entry.email} has been enabled.` : `${entry.email} has been disabled.`,
      });
      await loadUsers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setWorkingUid(null);
    }
  };

  const openConsole = () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (projectId) window.open(`https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/authentication/users`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Security & access</p><h2 className="mt-1 text-2xl font-bold tracking-tight">User management</h2><p className="mt-1 text-sm text-muted-foreground">Create accounts, assign least-privilege roles, and control sign-in access.</p></div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Server-verified roles</Badge>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">Access changes require confirmation</p>
          <p className="text-muted-foreground mt-1">Use Viewer by default. Grant Admin only when necessary. Role and account changes are checked by the server and recorded in the audit log. The protected Admin account cannot be changed here.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <UsersIcon className="h-5 w-5 text-primary" />
            <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registered</p><p className="text-2xl font-black">{stats.total}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Admins</p><p className="text-2xl font-black">{stats.admins}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Viewers</p><p className="text-2xl font-black">{stats.viewers}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4 rounded-xl border bg-card p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Create account
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email address</Label>
              <Input id="new-email" type="email" autoComplete="off" placeholder="user@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <div className="relative">
                <Input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-11" placeholder="At least 12 characters" {...register('password')} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Use a unique password. Share it securely and ask the user to change it after first sign-in.</p>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Access role</Label>
              <Select value={selectedRole} onValueChange={(value: 'admin' | 'viewer') => setValue('role', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — limited access (recommended)</SelectItem>
                  <SelectItem value="admin">Admin — can manage users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isSubmitting || isLoading} className="w-full">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create account
            </Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />Admin access is powerful. Select it only for trusted staff who need account-management permissions.</div>
          </form>
        </div>

        <div className="lg:col-span-2 min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Accounts & permissions
            </h3><p className="mt-1 text-xs text-muted-foreground">Review status, last sign-in, and role before making changes.</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openConsole}><ExternalLink className="mr-2 h-3.5 w-3.5" /> Firebase Console</Button>
              <Button variant="outline" size="icon" onClick={() => void loadUsers()} disabled={isLoading} aria-label="Refresh users">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by email..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status & last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : filteredUsers.length ? filteredUsers.map((entry) => {
                  const isSelf = entry.uid === currentUser?.uid;
                  const busy = workingUid === entry.uid;
                  return (
                    <TableRow key={entry.uid}>
                      <TableCell>
                        <div className="font-semibold text-sm">{entry.email}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{entry.uid}</div>
                        {entry.permanent && <Badge variant="outline" className="mt-1 border-amber-500/40 text-amber-700">Protected Admin</Badge>}
                      </TableCell>
                      <TableCell><Badge variant={entry.role === 'admin' ? 'default' : 'secondary'}>{entry.role}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Badge variant={entry.active ? 'outline' : 'destructive'} className="mb-1">{entry.active ? 'Active' : 'Disabled'}</Badge>
                        <div className="mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{entry.lastLoginAt ? new Date(entry.lastLoginAt).toLocaleString() : 'No login recorded'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={entry.role === 'admin' ? 'Change to Viewer' : 'Promote to Admin'}
                            aria-label={entry.role === 'admin' ? 'Change to Viewer' : 'Promote to Admin'}
                            disabled={busy || isSelf || entry.permanent || !entry.active}
                            onClick={() => void updateUser(entry, { role: entry.role === 'admin' ? 'viewer' : 'admin' })}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={entry.active ? 'Disable account' : 'Enable account'}
                            aria-label={entry.active ? 'Disable account' : 'Enable account'}
                            disabled={busy || isSelf || entry.permanent}
                            onClick={() => void updateUser(entry, { active: !entry.active })}
                          >
                            {entry.active ? <Ban className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No users found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Disabling an account blocks Firebase sign-in but does not delete historical records. Your own account and the protected Admin cannot be changed here.</p>
        </div>
      </div>
      <Dialog open={Boolean(pendingChange)} onOpenChange={(open) => { if (!open && !workingUid) setPendingChange(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
          {pendingChange && (() => {
            const roleChange = Boolean(pendingChange.update.role);
            const disabling = pendingChange.update.active === false;
            const target = pendingChange.update.role;
            const title = roleChange ? (target === 'viewer' ? 'Change role to Viewer?' : 'Grant Admin access?') : disabling ? 'Disable this account?' : 'Re-enable this account?';
            const description = roleChange ? (target === 'viewer' ? 'This user will lose access to user management and Admin-only settings.' : 'This user will be able to manage accounts, roles, and protected settings.') : disabling ? 'This user will no longer be able to sign in. Existing records will remain.' : 'This user will be able to sign in to SheetSync again.';
            return <>
              <div className="p-5 sm:p-6">
                <DialogHeader className="text-left">
                  <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-xl", disabling ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                    {disabling ? <Ban className="h-5 w-5" /> : roleChange ? <ShieldCheck className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                  </div>
                  <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
                  <DialogDescription className="pt-1 text-sm leading-6">{description}</DialogDescription>
                </DialogHeader>
                <div className={cn("mt-5 rounded-xl border p-3.5", disabling ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/40")}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold uppercase">{pendingChange.user.email.slice(0,1)}</div>
                    <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{pendingChange.user.email}</p><p className="mt-1 text-xs text-muted-foreground">{roleChange ? `Role: ${pendingChange.user.role} → ${target}` : `Status: ${pendingChange.user.active ? 'Active' : 'Disabled'} → ${disabling ? 'Disabled' : 'Active'}`}</p></div>
                    <Badge variant={disabling ? "destructive" : "outline"}>{roleChange ? target : disabling ? "Disable" : "Enable"}</Badge>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">This change is checked by the server and recorded in the security audit log.</p>
              </div>
              <DialogFooter className="gap-2 border-t bg-muted/20 p-4 sm:flex-row">
                <Button type="button" variant="outline" className="sm:flex-1" onClick={() => setPendingChange(null)}>Cancel</Button>
                <Button type="button" variant={disabling ? "destructive" : "default"} className="sm:flex-1" onClick={() => void confirmUserChange()} disabled={Boolean(workingUid)}>{disabling ? "Disable account" : roleChange ? target === 'viewer' ? "Change to Viewer" : "Grant Admin" : "Enable account"}</Button>
              </DialogFooter>
            </>;
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
