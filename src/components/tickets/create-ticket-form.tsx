'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createTicketSchema } from '@/lib/schema/ticket';
import { createTicket } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Send } from 'lucide-react';
import type { z } from 'zod';

const TICKET_CATEGORIES = [
  { value: 'pago', label: 'Problemas de Pago' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'contrato', label: 'Contrato/Servicios' },
  { value: 'tecnico', label: 'Soporte Técnico' },
  { value: 'informacion', label: 'Solicitud de Información' },
  { value: 'otro', label: 'Otro' },
];

const PRIORITY_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'text-green-600' },
  { value: 'media', label: 'Media', color: 'text-yellow-600' },
  { value: 'alta', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-600' },
];

interface CreateTicketFormProps {
  onTicketCreated?: () => void;
}

export function CreateTicketForm({ onTicketCreated }: CreateTicketFormProps) {
  const { client } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'media',
      category: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof createTicketSchema>) => {
    if (!client) {
      toast({
        title: 'Error',
        description: 'No se pudo identificar tu información de cliente',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await createTicket(
        client.id,
        `${client.firstName} ${client.lastName}`,
        client.email,
        values
      );

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Ticket Creado',
          description: 'Tu solicitud ha sido enviada correctamente',
        });
        form.reset();
        onTicketCreated?.();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al crear el ticket',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Nueva Solicitud
        </CardTitle>
        <CardDescription>
          Describe tu consulta o problema y te ayudaremos a resolverlo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la prioridad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <span className={priority.color}>
                              {priority.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asunto</FormLabel>
                  <FormControl>
                    <Input placeholder="Describe brevemente tu consulta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Proporciona todos los detalles relevantes sobre tu consulta o problema..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar Solicitud
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}