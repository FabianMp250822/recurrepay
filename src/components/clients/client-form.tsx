
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { clientSchema } from '@/lib/schema';
import type { Client, ClientFormData as ClientFormInputs } from '@/types'; // Renombrado para claridad
import { createClientAction, updateClientAction } from '@/app/actions/clientActions';
import { Loader2 } from 'lucide-react';
import { IVA_RATE, FINANCING_OPTIONS, PAYMENT_METHODS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type ClientFormProps = {
  client?: Client;
  isEditMode: boolean;
};

// Define un tipo para los valores calculados que se mostrarán
type CalculatedValues = {
  ivaAmount: number;
  totalWithIva: number;
  amountToFinance: number;
  financingInterestRateApplied: number;
  financingInterestAmount: number;
  totalAmountWithInterest: number;
  monthlyInstallment: number;
};

export function ClientForm({ client, isEditMode }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
  });

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: client?.firstName || '',
      lastName: client?.lastName || '',
      email: client?.email || '',
      phoneNumber: client?.phoneNumber || '',
      contractValue: client?.contractValue || 0,
      downPayment: client?.downPayment || 0,
      paymentMethod: client?.paymentMethod || PAYMENT_METHODS[0],
      financingPlan: client?.financingPlan || 0, // 0 para "Sin financiación"
      paymentDayOfMonth: client?.paymentDayOfMonth || 1,
      paymentAmount: client?.paymentAmount || undefined, // Este será el pago recurrente si no hay financiación
    },
  });

  const watchedContractValue = form.watch('contractValue');
  const watchedDownPayment = form.watch('downPayment');
  const watchedFinancingPlan = form.watch('financingPlan');

  useEffect(() => {
    const contractValue = parseFloat(String(watchedContractValue)) || 0;
    const downPayment = parseFloat(String(watchedDownPayment)) || 0;
    const financingPlanKey = Number(watchedFinancingPlan);

    if (financingPlanKey !== 0 && contractValue > 0) {
      setShowFinancingDetails(true);
      const ivaAmount = contractValue * IVA_RATE;
      const totalWithIva = contractValue + ivaAmount;
      const amountToFinance = Math.max(0, totalWithIva - downPayment);
      
      const planDetails = FINANCING_OPTIONS[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey; // Asumiendo que la clave es el número de meses
      const monthlyInstallment = numberOfMonths > 0 ? totalAmountWithInterest / numberOfMonths : 0;

      setCalculatedValues({
        ivaAmount,
        totalWithIva,
        amountToFinance,
        financingInterestRateApplied: interestRate,
        financingInterestAmount,
        totalAmountWithInterest,
        monthlyInstallment,
      });
      // Si hay financiación, paymentAmount (cuota mensual) se calcula, no se toma del input
      form.setValue('paymentAmount', undefined, { shouldValidate: true });


    } else {
      setShowFinancingDetails(false);
      setCalculatedValues({
        ivaAmount: 0,
        totalWithIva: contractValue, // Sin IVA si no hay valor de contrato o plan
        amountToFinance: Math.max(0, contractValue - downPayment),
        financingInterestRateApplied: 0,
        financingInterestAmount: 0,
        totalAmountWithInterest: 0,
        monthlyInstallment: 0,
      });
       // Si no hay financiación, se podría permitir ingresar un paymentAmount manual
       // form.setValue('paymentAmount', client?.paymentAmount || 0); // O resetearlo
    }
  }, [watchedContractValue, watchedDownPayment, watchedFinancingPlan, form, client?.paymentAmount]);


  async function onSubmit(values: z.infer<typeof clientSchema>) {
    setIsSubmitting(true);

    // Si no hay financiación, y el usuario no puso un paymentAmount, no permitir submit si es requerido
    if (values.financingPlan === 0 && !values.paymentAmount) {
        form.setError("paymentAmount", { type: "manual", message: "Se requiere un monto de pago recurrente si no hay financiación."})
        setIsSubmitting(false);
        return;
    }
    
    const dataToSubmit: ClientFormInputs & { paymentAmount?: number } = {
      ...values,
      contractValue: values.contractValue || 0,
      downPayment: values.downPayment || 0,
      financingPlan: values.financingPlan || 0,
      paymentMethod: values.paymentMethod || '',
    };

    // Si hay financiación, la cuota mensual se toma de los valores calculados
    // Si no hay financiación, el usuario debe ingresar un `paymentAmount` para el servicio recurrente
    if (dataToSubmit.financingPlan && dataToSubmit.financingPlan !== 0 && dataToSubmit.contractValue && dataToSubmit.contractValue > 0) {
      dataToSubmit.paymentAmount = calculatedValues.monthlyInstallment;
    } else {
      // Asegurarse de que paymentAmount tenga un valor si no hay financiación
      if (typeof values.paymentAmount !== 'number' || values.paymentAmount <= 0) {
         form.setError('paymentAmount', {type: 'manual', message: 'Debe ingresar un monto de pago recurrente válido si no hay plan de financiación.'});
         setIsSubmitting(false);
         return;
      }
      dataToSubmit.paymentAmount = values.paymentAmount;
    }


    try {
      let result;
      if (isEditMode && client) {
        result = await updateClientAction(client.id, dataToSubmit as any); // Cast as any for now
      } else {
        result = await createClientAction(dataToSubmit as any); // Cast as any for now
      }

      if (result.success) {
        toast({
          title: isEditMode ? 'Cliente Actualizado' : 'Cliente Creado',
          description: `El cliente ${values.firstName} ${values.lastName} ha sido ${isEditMode ? 'actualizado' : 'creado'} exitosamente.`,
        });
        router.push('/dashboard');
        router.refresh(); 
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
                form.setError(field as keyof z.infer<typeof clientSchema>, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error',
          description: result.generalError || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente. Por favor, inténtelo de nuevo.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Ocurrió un error inesperado. Por favor, inténtelo de nuevo.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</CardTitle>
        <CardDescription>
          {isEditMode ? 'Actualice los detalles del cliente.' : 'Ingrese los detalles para el nuevo cliente.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombres</FormLabel>
                        <FormControl><Input placeholder="Juan" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellidos</FormLabel>
                        <FormControl><Input placeholder="Pérez" {...field} /></FormControl>
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
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl><Input type="email" placeholder="juan.perez@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Teléfono</FormLabel>
                      <FormControl><Input placeholder="3001234567" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Información del Contrato y Financiación</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="contractValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor del Contrato (antes de IVA)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="1000000" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="downPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Abono</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="100000" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medio de Pago (Abono/Contrato)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un medio de pago" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={form.control}
                  name="financingPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan de Financiación</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(FINANCING_OPTIONS).map(([key, option]) => (
                            <SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Las tasas de interés son ejemplos y deben ajustarse a la ley.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            {showFinancingDetails && watchedContractValue && watchedContractValue > 0 && (
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                  <div className="flex justify-between"><span>IVA ({IVA_RATE * 100}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                  <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                  <div className="flex justify-between"><span>Abono:</span> <strong>{formatCurrency(watchedDownPayment || 0)}</strong></div>
                  <hr/>
                  <div className="flex justify-between"><span>Saldo a Financiar:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                  <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                  <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                   <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                  <hr/>
                  <div className="flex justify-between text-lg"><span>Valor Cuota Mensual ({watchedFinancingPlan} meses):</span> <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong></div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-xl">Configuración de Pago Mensual</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="paymentDayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de Pago de la Cuota del Mes</FormLabel>
                      <FormControl><Input type="number" min="1" max="31" placeholder="15" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                      <FormDescription>Día (1-31) en que se generará el cobro de la cuota mensual.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(!showFinancingDetails || !(watchedContractValue && watchedContractValue > 0)) && (
                    <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Monto de Pago Recurrente (si no hay financiación)</FormLabel>
                        <FormControl>
                            <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="50000" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value ?? ""}
                            />
                        </FormControl>
                        <FormDescription>Si no hay un plan de financiación activo, ingrese el monto del servicio recurrente.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Guardar Cambios' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
