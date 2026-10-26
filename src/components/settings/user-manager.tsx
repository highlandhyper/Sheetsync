'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, ShieldCheck, User as UserIcon, Trash2, ArrowLeftRight, RefreshCw, Search, Users as UsersIcon, Clock, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
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
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setWorkingUid(null);
    }
  };

  const openConsole = () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (projectId) window.open(`https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/authentication/users`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">Server-managed access</p>
          <p className="text-muted-foreground mt-1">Roles are verified on the server. The permanent initial Admin cannot be demoted or disabled. User changes are recorded in the management audit log.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <UsersIcon className="h-5 w-5 text-primary" />
            <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registered</p><p className="text-2xl font-black">{stats.total}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 shadow-none">
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
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Create User
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6 border rounded-2xl bg-muted/10">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email address</Label>
              <Input id="new-email" type="email" autoComplete="off" placeholder="user@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Initial password (minimum 8 characters)</Label>
              <Input id="new-password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(value: 'admin' | 'viewer') => setValue('role', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (restricted)</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isSubmitting || isLoading} className="w-full">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create account
            </Button>
            <p className="text-xs text-muted-foreground">The account is created in Firebase Authentication and its role is stored separately in Firestore.</p>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> User access
            </h3>
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
                  <TableHead>Status / Last login</TableHead>
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
                        {entry.permanent && <Badge variant="outline" className="mt-1">Permanent Admin</Badge>}
                      </TableCell>
                      <TableCell><Badge variant={entry.role === 'admin' ? 'default' : 'secondary'}>{entry.role}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{entry.active ? 'Active' : 'Disabled'}</div>
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
                            {entry.active ? <Trash2 className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4" />}
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
          <p className="text-xs text-muted-foreground">Disabling an account blocks Firebase sign-in. It does not delete the account or erase historical records.</p>
        </div>
      </div>
    </div>
  );
}
