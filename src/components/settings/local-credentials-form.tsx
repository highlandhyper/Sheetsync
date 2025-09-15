
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { localCredentialsSchema, type LocalCredentialsFormValues } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';

export function LocalCredentialsForm() {
  const { credentials, updateCredentials, isInitialized } = useLocalSettingsAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<LocalCredentialsFormValues>({
    resolver: zodResolver(localCredentialsSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isInitialized) {
      reset(credentials);
    }
  }, [isInitialized, credentials, reset]);

  const onSubmit = (data: LocalCredentialsFormValues) => {
    setIsSubmitting(true);
    updateCredentials(data.username, data.password);
    toast({
      title: 'Credentials Updated',
      description: 'Your local admin credentials have been saved.',
    });
    reset(data); // Sync form state with the new credentials
    setIsSubmitting(false);
  };
  
  if (!isInitialized) {
      return (
          <div className="space-y-4">
              <div className="space-y-2">
                  <Label>Username</Label>
                  <Input disabled placeholder="Loading..." />
              </div>
               <div className="space-y-2">
                  <Label>Password</Label>
                  <Input disabled placeholder="Loading..." />
              </div>
              <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Save Changes</Button>
          </div>
      )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          {...register('username')}
          className={errors.username ? 'border-destructive' : ''}
        />
        {errors.username && <p className="text-sm text-destructive mt-1">{errors.username.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          className={errors.password ? 'border-destructive' : ''}
        />
        {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
      </div>
      <DialogFooter className="pt-4">
        <DialogClose asChild>
            <Button type="button" variant="outline">
                Cancel
            </Button>
        </DialogClose>
        <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}
