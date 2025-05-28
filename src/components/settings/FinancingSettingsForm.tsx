
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import type { z } from 'zod';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { financingSettingsSchema } from '@/lib/schema';
import type { AppFinancingSettings, FinancingPlanSetting } from '@/types';
import { updateFinancingSettingsAction } from '@/app/actions/settingsActions';
import { Loader2 } from 'lucide-react';

type FinancingSettingsFormProps = {
  currentSettings: AppFinancingSettings;
};

export function FinancingSettingsForm({ currentSettings }: FinancingSettingsFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof financingSettingsSchema>>({
    resolver: zodResolver(financingSettingsSchema),
    defaultValues: {
      plans: currentSettings?.plans || [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "plans",
  });

  async function onSubmit(values: z.infer<typeof financingSettingsSchema>) {
    setIsSubmitting(true);
    try {
      const result = await updateFinancingSettingsAction(values);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: result.message || 'Las tasas de financiación han sido actualizadas.',
        });
      } else {
        if (result.errors) {
          // Handle specific field errors if your action returns them
          // For now, showing a general error.
        }
        toast({
          title: 'Error al Guardar',
          description: result.generalError || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error Inesperado',
        description: (error instanceof Error ? error.message : String(error)),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasas de Interés para Planes de Financiación</CardTitle>
        <CardDescription>
          Edite las tasas de interés aplicadas a cada plan de financiación.
          Ingrese la tasa como un decimal (ej: 0.05 para 5%).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {fields.map((field, index) => (
              field.isConfigurable ? ( // Only show configurable plans
                <div key={field.id} className="p-4 border rounded-md space-y-4">
                  <h3 className="font-semibold">{field.label} ({field.months} meses)</h3>
                   <FormField
                    control={form.control}
                    name={`plans.${index}.rate`}
                    render={({ field: rateField }) => (
                      <FormItem>
                        <FormLabel>Tasa de Interés (ej: 0.05 para 5%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.001" // Allow fine-grained control
                            placeholder="0.08"
                            {...rateField}
                            value={rateField.value === undefined || isNaN(Number(rateField.value)) ? "" : String(rateField.value)}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === "") {
                                rateField.onChange(undefined); // Treat empty as undefined or 0 based on Zod preprocess
                                } else {
                                const num = parseFloat(val);
                                rateField.onChange(isNaN(num) ? undefined : num); 
                                }
                            }}
                            />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Hidden fields to ensure all data for the plan is submitted if needed */}
                  <input type="hidden" {...form.register(`plans.${index}.months`)} value={field.months} />
                  <input type="hidden" {...form.register(`plans.${index}.label`)} value={field.label} />
                  {field.isDefault !== undefined && <input type="hidden" {...form.register(`plans.${index}.isDefault`)} value={String(field.isDefault)} />}
                  {field.isConfigurable !== undefined && <input type="hidden" {...form.register(`plans.${index}.isConfigurable`)} value={String(field.isConfigurable)} />}
                </div>
              ) : null
            ))}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios en Tasas
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
