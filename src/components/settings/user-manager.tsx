'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, UserPlus, ShieldAlert, Eye, EyeOff, Mail, KeyRound, 
    ShieldCheck, User as UserIcon, Trash2, ArrowLeftRight, 
    AlertTriangle, RefreshCw, Search, Users as UsersIcon, Clock
} from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import type { Role, AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

const createUserSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(['admin', 'viewer']),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function UserManager() {
  const { toast } = useToast();
  const { users, updateUserRegistry, isSyncing } = useDataCache();
  const { user: currentUser } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [users, searchTerm]);

  const stats = useMemo(() => {
    return {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        viewers: users.filter(u => u.role === 'viewer').length
    };
  }, [users]);

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsSubmitting(true);
    
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
        toast({ variant: "destructive", title: "Already Registered", description: "This user is already in your app registry." });
        setIsSubmitting(false);
        return;
    }

    const tempAppName = `temp-app-${Date.now()}`;
    let tempApp;

    try {
      tempApp = initializeApp(firebaseConfig as any, tempAppName);
      const tempAuth = getAuth(tempApp);
      await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
      await addToRegistry(data.email, data.role);
      toast({ title: "User Created", description: `Successfully registered ${data.email}.` });
      reset();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
          toast({ title: "Account Found", description: "Email exists in Firebase. Adding to registry..." });
          await addToRegistry(data.email, data.role);
          reset();
      } else {
          toast({ variant: "destructive", title: "Registration Failed", description: error.message });
      }
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSubmitting(false);
    }
  };

  const addToRegistry = async (email: string, role: Role) => {
    const newRegistryUser: AppUser = {
        email: email.toLowerCase().trim(),
        role: role,
        createdAt: new Date().toISOString()
    };
    await updateUserRegistry([...users, newRegistryUser]);
  };

  const handleToggleRole = async (user: AppUser) => {
    if (user.email === currentUser?.email) {
        toast({ title: "Restricted", description: "You cannot change your own role.", variant: "destructive" });
        return;
    }
    const newRole: Role = user.role === 'admin' ? 'viewer' : 'admin';
    const updatedRegistry = users.map(u => u.email === user.email ? { ...u, role: newRole } : u);
    await updateUserRegistry(updatedRegistry);
    toast({ title: "Role Updated", description: `${user.email} is now a ${newRole.toUpperCase()}.` });
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    const updated = users.filter(u => u.email !== userToDelete.email);
    await updateUserRegistry(updated);
    toast({ title: "Access Revoked", description: `${userToDelete.email} removed.` });
    setUserToDelete(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10 shadow-none">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-primary/10 p-2 rounded-lg"><UsersIcon className="h-5 w-5 text-primary" /></div>
                <div><p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Registry</p><p className="text-2xl font-black">{stats.total}</p></div>
            </CardContent>
        </Card>
        <Card className="bg-muted/30 border-muted-foreground/10 shadow-none">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-primary/5 p-2 rounded-lg"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Admins</p><p className="text-2xl font-black">{stats.admins}</p></div>
            </CardContent>
        </Card>
        <Card className="bg-muted/30 border-muted-foreground/10 shadow-none">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-muted p-2 rounded-lg"><UserIcon className="h-5 w-5 text-muted-foreground" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Viewers</p><p className="text-2xl font-black">{stats.viewers}</p></div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ADD USER FORM */}
        <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Register Personnel
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6 border-2 border-primary/10 rounded-3xl bg-muted/10 shadow-inner">
                <div className="space-y-2">
                    <Label htmlFor="new-email" className="text-xs font-bold uppercase text-muted-foreground">Email Address</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="new-email" type="email" placeholder="user@example.com" {...register('email')} className="pl-9 h-11" />
                    </div>
                    {errors.email && <p className="text-[10px] text-destructive font-bold">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs font-bold uppercase text-muted-foreground">Initial Password</Label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="new-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...register('password')} className="pl-9 pr-10 h-11" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-[10px] text-destructive font-bold">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">System Role</Label>
                    <Select value={selectedRole} onValueChange={(v: any) => setValue('role', v)}>
                        <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="viewer">Viewer (Restricted)</SelectItem>
                            <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-black uppercase tracking-tighter shadow-xl shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Add to System
                </Button>
            </form>
        </div>

        {/* USER TABLE */}
        <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Personnel Registry
                </h3>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs"
                    />
                </div>
            </div>

            <div className="rounded-2xl border-2 border-muted overflow-hidden bg-background">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] uppercase font-black">Identity</TableHead>
                            <TableHead className="text-[10px] uppercase font-black">Permission</TableHead>
                            <TableHead className="text-[10px] uppercase font-black">Registered</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                            <TableRow key={user.email} className="group hover:bg-muted/30 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", user.role === 'admin' ? "bg-primary/10" : "bg-muted")}>
                                            {user.role === 'admin' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                        <span className="font-bold text-sm truncate max-w-[150px] sm:max-w-none">{user.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="text-[9px] uppercase font-black px-2 tracking-tighter">
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-[10px] font-medium italic">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {user.createdAt ? formatDistanceToNow(parseISO(user.createdAt), { addSuffix: true }) : 'N/A'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-primary hover:bg-primary/5"
                                            title="Toggle Role"
                                            onClick={() => handleToggleRole(user)}
                                            disabled={user.email === currentUser?.email || isSyncing}
                                        >
                                            <ArrowLeftRight className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-destructive hover:bg-destructive/5"
                                            title="Revoke Access"
                                            onClick={() => setUserToDelete(user)}
                                            disabled={user.email === currentUser?.email || isSyncing}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                    No users found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {isSyncing && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-primary animate-pulse uppercase font-black tracking-widest pt-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Updating Cloud Registry...
                </div>
            )}
        </div>
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-6 w-6" />
                Revoke App Access
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to remove <span className="font-bold text-foreground">"{userToDelete?.email}"</span>? 
              <br /><br />
              The user will be immediately blocked from all authenticated areas of the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">
              Block User Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
