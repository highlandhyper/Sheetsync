'use client';

import { useState } from 'react';
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
import { Loader2, UserPlus, ShieldAlert, Eye, EyeOff, Mail, KeyRound, ShieldCheck, User as UserIcon, Trash2, ArrowLeftRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import type { Role, AppUser } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
import { cn } from '@/lib/utils';

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

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsSubmitting(true);
    
    // 1. Check if they are ALREADY in our Spreadsheet registry
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
      
      // Try to create the Firebase account
      await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
      
      // If success, add to Spreadsheet
      await addToRegistry(data.email, data.role);
      
      toast({
        title: "User Created",
        description: `Successfully registered ${data.email} as ${data.role.toUpperCase()}.`,
      });
      reset();
    } catch (error: any) {
      // HANDLE EXISTING FIREBASE ACCOUNTS
      if (error.code === 'auth/email-already-in-use') {
          toast({
              title: "Account Found",
              description: "This email exists in Firebase. Adding it to the registry now...",
          });
          await addToRegistry(data.email, data.role);
          reset();
      } else {
          console.error("Error creating user:", error);
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: error.message || "Could not create the user account.",
          });
      }
    } finally {
      if (tempApp) {
        await deleteApp(tempApp);
      }
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
    const updatedRegistry = users.map(u => 
        u.email === user.email ? { ...u, role: newRole } : u
    );

    await updateUserRegistry(updatedRegistry);
    toast({ title: "Role Updated", description: `${user.email} is now a ${newRole.toUpperCase()}.` });
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    const updated = users.filter(u => u.email !== userToDelete.email);
    await updateUserRegistry(updated);
    toast({ title: "Access Revoked", description: `${userToDelete.email} has been removed from the registry.` });
    setUserToDelete(null);
  };

  return (
    <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Register Personnel
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium italic">Enter existing or new email</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-2xl bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="new-email" className="text-xs font-bold uppercase text-muted-foreground">Email Address</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="new-email"
                            type="email"
                            placeholder="user@example.com"
                            {...register('email')}
                            className={errors.email ? 'border-destructive pl-9 h-9 text-sm' : 'pl-9 h-9 text-sm'}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs font-bold uppercase text-muted-foreground">Pass (if new)</Label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="new-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...register('password')}
                            className={errors.password ? 'border-destructive pl-9 pr-10 h-9 text-sm' : 'pl-9 pr-10 h-9 text-sm'}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-grow">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Assign Role</Label>
                    <Select value={selectedRole} onValueChange={(v: any) => setValue('role', v)}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="viewer">Viewer (Restricted)</SelectItem>
                            <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-9 font-bold shadow-lg shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync / Create
                </Button>
            </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> System Registry ({users.length})
        </h3>
        
        <div className="rounded-2xl border overflow-hidden bg-background shadow-inner">
            <div className="divide-y">
                {users.length > 0 ? users.map((user) => (
                    <div key={user.email} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl", user.role === 'admin' ? "bg-primary/10" : "bg-muted")}>
                                {user.role === 'admin' ? <ShieldCheck className="h-5 w-5 text-primary" /> : <UserIcon className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-sm truncate max-w-[180px] sm:max-w-[240px]">{user.email}</p>
                                <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="text-[9px] uppercase font-black tracking-tighter">
                                    {user.role}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[10px] font-black uppercase"
                                onClick={() => handleToggleRole(user)}
                                disabled={user.email === currentUser?.email || isSyncing}
                            >
                                <ArrowLeftRight className="mr-1.5 h-3 w-3 text-primary" />
                                {user.role === 'admin' ? 'Set Viewer' : 'Set Admin'}
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setUserToDelete(user)}
                                disabled={user.email === currentUser?.email || isSyncing}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                        No registries found. Users must be synced to appear here.
                    </div>
                )}
            </div>
        </div>
      </div>

      {isSyncing && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground animate-pulse uppercase font-black">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating Cloud Registry...
          </div>
      )}

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Revoke App Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-bold text-foreground">"{userToDelete?.email}"</span> from the app registry? 
              <br /><br />
              This will strip their role and block them from accessing any authenticated features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
