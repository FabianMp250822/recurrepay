'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientSchema } from '@/lib/schema';
import type { Client, ClientFormData } from '@/types';
import { createClientAction, updateClientAction } from '@/app/actions/clientActions';
import { Loader2 } from 'lucide-react';

type ClientFormProps = {
  client?: Client;
  isEditMode: boolean;
};

export function ClientForm({ client, isEditMode }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: client?.firstName || '',
      lastName: client?.lastName || '',
      email: client?.email || '',
      phoneNumber: client?.phoneNumber || '',
      paymentAmount: client?.paymentAmount || 0,
      paymentDayOfMonth: client?.paymentDayOfMonth || 1,
    },
  });

  async function onSubmit(values: z.infer<typeof clientSchema>) {
    setIsSubmitting(true);
    try {
      let result;
      if (isEditMode && client) {
        result = await updateClientAction(client.id, values as ClientFormData);
      } else {
        result = await createClientAction(values as ClientFormData);
      }

      if (result.success) {
        toast({
          title: isEditMode ? 'Client Updated' : 'Client Created',
          description: `Client ${values.firstName} ${values.lastName} has been successfully ${isEditMode ? 'updated' : 'created'}.`,
        });
        router.push('/dashboard');
        router.refresh(); // Ensure data is fresh on dashboard
      } else {
        if (result.errors) {
          // Handle Zod field errors (though client-side should catch most)
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
                form.setError(field as keyof z.infer<typeof clientSchema>, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error',
          description: result.generalError || `Failed to ${isEditMode ? 'update' : 'create'} client. Please try again.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `An unexpected error occurred. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Client' : 'Create New Client'}</CardTitle>
        <CardDescription>
          {isEditMode ? 'Update the details of the existing client.' : 'Enter the details for the new client.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurring Payment Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentDayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Day of Month</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="31" placeholder="15" {...field} />
                    </FormControl>
                    <FormDescription>Enter a day from 1 to 31.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Client'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
