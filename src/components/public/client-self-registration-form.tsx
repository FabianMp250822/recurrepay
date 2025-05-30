
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
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
import { publicClientSchema } from '@/lib/schema';
import type { PublicClientFormData, FinancingPlanSetting } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { Loader2 } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

type FinancingOptionsMapType = { [key: number]: { rate: number; label: string } };

type CalculatedValues = {
  ivaAmount: number;
  totalWithIva: number;
  amountToFinance: number; // totalWithIva (since downPayment is 0 for self-registration)
  financingInterestRateApplied: number;
  financingInterestAmount: number;
  totalAmountWithInterest: number;
  monthlyInstallment: number;
};

export function ClientSelfRegistrationForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isFinancingOptionsLoading, setIsFinancingOptionsLoading] = useState(true);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
  });

  const form = useForm<z.infer<typeof publicClientSchema>>({
    resolver: zodResolver(publicClientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      contractValue: 0,
      financingPlan: undefined, // Important to be undefined initially for placeholder
      paymentDayOfMonth: 1,
    },
  });

  useEffect(() => {
    async function loadFinancingOptions() {
      setIsFinancingOptionsLoading(true);
      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching financing options for self-registration form:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las opciones de financiación. Intente más tarde.",
          variant: "destructive",
        });
      } finally {
        setIsFinancingOptionsLoading(false);
      }
    }
    loadFinancingOptions();
  }, [toast]);

  const watchedContractValue = form.watch('contractValue');
  const watchedFinancingPlan = form.watch('financingPlan');

  useEffect(() => {
    const contractVal = parseFloat(String(watchedContractValue)) || 0;
    const financingPlanKey = Number(watchedFinancingPlan);

    const ivaAmount = contractVal * IVA_RATE;
    const totalWithIva = contractVal + ivaAmount;
    // For self-registration, down payment is assumed to be 0
    const calculatedDownPayment = 0; 
    
    setShowFinancingDetails(contractVal > 0 && financingPlanKey !== undefined && Object.keys(financingOptions).length > 0);

    if (contractVal > 0 && financingPlanKey !== undefined && financingOptions[financingPlanKey]) {
      const amountToFinance = Math.max(0, totalWithIva - calculatedDownPayment);
      const planDetails = financingOptions[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey; // Key is the number of months
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
    } else {
      setCalculatedValues({
        ivaAmount: contractVal > 0 ? ivaAmount : 0,
        totalWithIva: contractVal > 0 ? totalWithIva : contractVal,
        amountToFinance: Math.max(0, (contractVal > 0 ? totalWithIva : contractVal) - calculatedDownPayment),
        financingInterestRateApplied: 0,
        financingInterestAmount: 0,
        totalAmountWithInterest: 0,
        monthlyInstallment: 0,
      });
    }
  }, [watchedContractValue, watchedFinancingPlan, financingOptions]);


  async function onSubmit(values: z.infer<typeof publicClientSchema>) {
    setIsSubmitting(true);
    
    if (values.contractValue > 0 && values.financingPlan === undefined) {
        form.setError('financingPlan', { type: 'manual', message: 'Debe seleccionar un plan de financiación si ingresa un valor de contrato.' });
        setIsSubmitting(false);
        return;
    }

    try {
      const result = await selfRegisterClientAction(values);

      if (result.success) {
        toast({
          title: '¡Registro Exitoso!',
          description: `Gracias ${values.firstName}, tu información ha sido enviada. Nos pondremos en contacto pronto.`,
          duration: 7000,
        });
        form.reset();
        setCalculatedValues({
            ivaAmount: 0, totalWithIva: 0, amountToFinance: 0,
            financingInterestRateApplied: 0, financingInterestAmount: 0,
            totalAmountWithInterest: 0, monthlyInstallment: 0,
        });
        setShowFinancingDetails(false);
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
                form.setError(field as keyof PublicClientFormData, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error en el Registro',
          description: result.generalError || `No se pudo completar el registro. Por favor, revisa los campos e inténtalo de nuevo.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error Inesperado',
        description: `Ocurrió un error. ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const renderNumberInput = (name: "contractValue", label: string, placeholder: string, description?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.01"
              placeholder={placeholder}
              value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? "" : String(field.value)}
              onChange={e => {
                const val = e.target.value;
                if (val === "") {
                  field.onChange(undefined);
                } else {
                  const num = parseFloat(val);
                  field.onChange(isNaN(num) ? undefined : num); 
                }
              }}
              onBlur={field.onBlur} 
              ref={field.ref}
              name={field.name}
              disabled={field.disabled || isSubmitting}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Formulario de Inscripción de Cliente</CardTitle>
        <CardDescription>
          Completa tus datos para configurar tu servicio o plan de financiación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="juan.perez@example.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Detalles del Servicio o Contrato</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {renderNumberInput("contractValue", "Valor del Contrato/Servicio (antes de IVA)", "1000000", "Si es un servicio recurrente sin valor de contrato inicial, puedes dejarlo en 0 y el administrador configurará la cuota.")}
                
                {watchedContractValue > 0 && (
                    <FormField control={form.control} name="financingPlan" render={({ field }) => (
                        <FormItem><FormLabel>Plan de Financiación</FormLabel>
                            <Select 
                                onValueChange={(value) => field.onChange(Number(value))} 
                                defaultValue={field.value !== undefined ? String(field.value) : undefined}
                                disabled={isSubmitting || isFinancingOptionsLoading}
                            >
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan de financiación" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {isFinancingOptionsLoading ? (
                                    <SelectItem value="loading" disabled>Cargando planes...</SelectItem>
                                ) : Object.keys(financingOptions).length > 0 ? 
                                    Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>))
                                    : <SelectItem value="no-options" disabled>No hay planes disponibles.</SelectItem>}
                            </SelectContent>
                            </Select>
                            <FormDescription>Selecciona cómo deseas financiar el valor del contrato.</FormDescription><FormMessage />
                        </FormItem>)}
                    />
                )}
                 <FormField control={form.control} name="paymentDayOfMonth" render={({ field }) => (
                    <FormItem><FormLabel>Día de Pago Preferido del Mes</FormLabel>
                        <FormControl><Input type="number" min="1" max="31" placeholder="15" 
                            value={field.value === undefined || isNaN(Number(field.value)) ? "" : String(field.value)}
                            onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                            disabled={isSubmitting}
                         /></FormControl>
                        <FormDescription>El día del mes (1-31) en que se realizará el cobro de tu cuota.</FormDescription><FormMessage />
                    </FormItem>)}
                />
              </CardContent>
            </Card>
            
            {showFinancingDetails && watchedContractValue > 0 && (
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Valor Contrato/Servicio:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                  <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                  <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                  {/* <div className="flex justify-between"><span>Abono (0%):</span> <strong>{formatCurrency(0)}</strong></div> */}
                  <hr/>
                  <div className="flex justify-between"><span>Saldo a Financiar:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                  <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                  <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                   <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                  <hr/>
                  <div className="flex justify-between text-lg"><span>Valor Cuota Mensual ({financingOptions[Number(watchedFinancingPlan)]?.label || '-'}):</span> <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong></div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting || isFinancingOptionsLoading} className="w-full md:w-auto">
                {(isSubmitting || isFinancingOptionsLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFinancingOptionsLoading ? 'Cargando configuración...' : 'Enviar Inscripción'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground">
          Al enviar este formulario, aceptas nuestros términos y condiciones. Tu información será tratada con confidencialidad.
        </p>
      </CardFooter>
    </Card>
  );
}
