
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { localCredentialsSchema, type LocalCredentialsFormValues } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Key } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';

const extendedCredentialsSchema = localCredentialsSchema.extend({
    quickAuthPin: z.string().length(4, "PIN must be exactly 4 digits").regex(/^\d+$/, "PIN must be numeric")
});

type ExtendedFormValues = z.infer<typeof extendedCredentialsSchema>;

export function LocalCredentialsForm() {
  const { credentials, updateCredentials, isInitialized } = useLocalSettingsAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExtendedFormValues>({
    resolver: zodResolver(extendedCredentialsSchema),
    defaultValues: {
      username: '',
      password: '',
      quickAuthPin: '1234'
    },
  });

  useEffect(() => {
    if (isInitialized) {
      reset({
          username: credentials.username || '',
          password: credentials.password || '',
          quickAuthPin: credentials.quickAuthPin || '1234'
      });
    }
  }, [isInitialized, credentials, reset]);

  const onSubmit = (data: ExtendedFormValues) => {
    setIsSubmitting(true);
    updateCredentials(data.username, data.password, data.quickAuthPin);
    toast({
      title: 'Credentials Updated',
      description: 'Your local admin credentials and Quick Auth PIN have been saved.',
    });
    reset(data); 
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

      <div className="space-y-2 pt-2 border-t mt-4">
        <Label htmlFor="quickAuthPin" className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-primary" />
            Quick Auth PIN (4 Digits)
        </Label>
        <Input
          id="quickAuthPin"
          type="password"
          maxLength={4}
          placeholder="1234"
          {...register('quickAuthPin')}
          className={errors.quickAuthPin ? 'border-destructive' : ''}
        />
        {errors.quickAuthPin && <p className="text-sm text-destructive mt-1">{errors.quickAuthPin.message}</p>}
        <p className="text-[10px] text-muted-foreground">Used for proactive Special Entry authorizations on the dashboard.</p>
      </div>

      <Button type="submit" disabled={!isDirty || isSubmitting} className="w-full mt-4">
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Credentials
      </Button>
    </form>
  );
}
