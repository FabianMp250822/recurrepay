
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import { auth } from '@/lib/firebase';
import { registrationSchema, publicClientSchema } from '@/lib/schema';
import type { PublicClientFormData, AppFinancingSettings, CalculatedFinancingValues } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import { getFinancingOptionsMap } from '@/lib/store';
import { IVA_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

type RegistrationStep = 'initial' | 'details' | 'completed';

export function ClientSelfRegistrationForm() {
  const [appName, setAppName] = useState('RecurPay');
  const [financingOptionsDb, setFinancingOptionsDb] = useState<{ [key: number]: { rate: number; label: string } }>({});
  const [isLoadingAppName, setIsLoadingAppName] = useState(true);
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('initial');
  const [registeredUser, setRegisteredUser] = useState<FirebaseUser | null>(null);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedFinancingValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
    downPaymentAmount: 0, // For self-registration, downPayment is 0
  });
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingAppName(true);
      setIsLoadingFinancingOptions(true);
      try {
        const settings = await fetchGeneralSettingsAction();
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
      } catch (error) {
        console.error("Error fetching app name for self-registration:", error);
      } finally {
        setIsLoadingAppName(false);
      }

      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptionsDb(options);
      } catch (error) {
        console.error("Error fetching financing options for self-registration:", error);
        toast({ title: "Error", description: "No se pudieron cargar las opciones de financiación.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadInitialData();
  }, [toast]);

  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<z.infer<typeof publicClientSchema>>({
    resolver: zodResolver(publicClientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      contractValue: 0,
      financingPlan: 0, // Default to "Sin financiación"
      paymentDayOfMonth: 1,
    },
  });

  const handleRegistrationSubmit = async (data: z.infer<typeof registrationSchema>) => {
    registrationForm.clearErrors();
    setFormError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      setRegisteredUser(userCredential.user);
      clientDetailsForm.setValue('email', userCredential.user.email || ''); // Pre-fill for next step
      setRegistrationStep('details');
      toast({ title: 'Cuenta Creada', description: 'Por favor, completa tus datos personales y del contrato.' });
    } catch (error: any) {
      console.error("Error en registro de Firebase Auth:", error);
      let message = "Error al crear la cuenta. Inténtelo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está en uso. Por favor, intente con otro.";
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
      }
      setFormError(message);
      registrationForm.setError("email", { type: "manual", message });
    }
  };

  const handleClientDetailsSubmit = async (data: z.infer<typeof publicClientSchema>) => {
    clientDetailsForm.clearErrors();
    setFormError(null);
    if (!registeredUser || !registeredUser.email) {
      setFormError("Error: No se encontró información del usuario registrado para continuar.");
      return;
    }

    const formDataWithEmail: PublicClientFormData & { email: string } = {
      ...data,
      email: registeredUser.email,
    };

    // Ensure paymentAmount is set based on calculations if financing is involved
    if (data.contractValue && data.contractValue > 0 && data.financingPlan && data.financingPlan !== 0) {
        formDataWithEmail.paymentAmount = parseFloat(calculatedValues.monthlyInstallment.toFixed(2));
    } else if (data.contractValue === 0) {
        formDataWithEmail.paymentAmount = 0; // If no contract value, recurring payment is 0 for this form
    } else {
        // This case (contract value > 0, no financing plan) should ideally be handled by schema or specific business logic
        // For now, if it passes schema, it implies a one-time payment and recurring might be 0 or user-set.
        // Here, we assume calculated (which would be 0 if no financing) or let schema handle it.
        // The publicClientSchema might need refinement if paymentAmount is expected here.
        formDataWithEmail.paymentAmount = data.paymentAmount || 0; // Fallback for safety, though schema should guide this
    }


    try {
      const result = await selfRegisterClientAction(formDataWithEmail);
      if (result.success) {
        setRegistrationStep('completed');
        toast({ title: '¡Registro Exitoso!', description: 'Gracias por registrarte. Nos pondremos en contacto contigo pronto.' });
        // Optionally redirect or clear forms
        registrationForm.reset();
        clientDetailsForm.reset();
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && messages.length > 0) {
              clientDetailsForm.setError(field as keyof z.infer<typeof publicClientSchema>, { type: 'manual', message: messages[0] });
            }
          });
        }
        setFormError(result.generalError || 'Error al guardar la información. Por favor, inténtelo de nuevo.');
      }
    } catch (error) {
      console.error("Error inesperado en selfRegisterClientAction:", error);
      setFormError('Ocurrió un error inesperado. Por favor, inténtelo más tarde.');
    }
  };

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const contractVal = parseFloat(String(watchedContractValue)) || 0;
    const financingPlanKey = Number(watchedFinancingPlan);

    let ivaAmount = 0;
    let totalWithIva = contractVal;
    let amountToFinance = contractVal; // Assuming 0% down payment for self-registration
    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = contractVal; // Starts as contractVal, potentially with IVA then interest
    let monthlyInstallment = 0;

    if (contractVal > 0) {
      ivaAmount = contractVal * IVA_RATE;
      totalWithIva = contractVal + ivaAmount;
      amountToFinance = totalWithIva; // Still assuming 0% down for self-registration

      if (financingPlanKey !== 0 && financingOptionsDb[financingPlanKey]) {
        const planDetails = financingOptionsDb[financingPlanKey];
        financingInterestRateApplied = planDetails.rate;
        financingInterestAmount = amountToFinance * financingInterestRateApplied;
        totalAmountWithInterest = amountToFinance + financingInterestAmount;
        const numberOfMonths = financingPlanKey;
        monthlyInstallment = numberOfMonths > 0 ? totalAmountWithInterest / numberOfMonths : 0;
        setShowFinancingDetails(true);
      } else {
        setShowFinancingDetails(false);
        // If no financing or contract value is 0, monthly installment for recurring payment is 0 (or handled by a separate field if it was a service)
        // For this form's logic, if contractValue > 0 and no financing, it's a one-time payment.
        // The paymentAmount for *recurring* would be 0.
        monthlyInstallment = 0;
        totalAmountWithInterest = totalWithIva; // Total to pay is just totalWithIva if no financing.
      }
    } else {
      setShowFinancingDetails(false);
      monthlyInstallment = 0; // If no contract, no recurring payment calculated here.
    }

    setCalculatedValues({
      ivaAmount,
      totalWithIva,
      amountToFinance,
      financingInterestRateApplied,
      financingInterestAmount,
      totalAmountWithInterest,
      monthlyInstallment,
      downPaymentAmount: 0, // Fixed for self-registration
    });

    if (contractVal > 0 && financingPlanKey !== 0 && financingOptionsDb[financingPlanKey]) {
      clientDetailsForm.setValue('paymentAmount', parseFloat(monthlyInstallment.toFixed(2)));
    } else {
      clientDetailsForm.setValue('paymentAmount', 0); // If no contract or no financing, recurring is 0
    }

  }, [watchedContractValue, watchedFinancingPlan, clientDetailsForm, financingOptionsDb]);


  if (isLoadingAppName || isLoadingFinancingOptions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Cargando configuración del formulario...</p>
      </div>
    );
  }

  if (registrationStep === 'completed') {
    return (
      <Card className="w-full max-w-lg text-center p-8">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">¡Gracias por Registrarte en {appName}!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">Tu información ha sido enviada.</p>
          <p className="mt-2 text-muted-foreground">Nos pondremos en contacto contigo pronto si es necesario o puedes proceder a usar nuestros servicios según corresponda.</p>
          {/* Podrías añadir un botón para ir a la página de login o al dashboard si el usuario ya puede acceder */}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {registrationStep === 'initial' ? `Registro de Cuenta - ${appName}` : `Completa tus Datos - ${appName}`}
        </CardTitle>
        {registrationStep === 'initial' && (
          <CardDescription className="text-center pt-2">
            Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil, consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {formError && (
          <Alert variant="destructive" className="mb-6">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {registrationStep === 'initial' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleRegistrationSubmit)} className="space-y-6">
              <FormField control={registrationForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={registrationForm.formState.isSubmitting}>
                {registrationForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crear Cuenta y Continuar'}
              </Button>
            </form>
          </Form>
        )}

        {registrationStep === 'details' && registeredUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(handleClientDetailsSubmit)} className="space-y-8">
              {/* Personal Info Fields */}
              <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormItem>
                <FormLabel>Correo Electrónico (Registrado)</FormLabel>
                <FormControl><Input type="email" value={registeredUser.email || ''} readOnly disabled className="bg-muted/50" /></FormControl>
              </FormItem>
              <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />

              {/* Contract and Financing Fields */}
              <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor del Contrato/Servicio (antes de IVA, si aplica)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="0.01" placeholder="0"
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? "" : String(field.value)}
                      onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Si no es un contrato con valor específico, puedes dejarlo en 0.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan de Financiación (si aplica)</FormLabel>
                  <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value || 0)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.keys(financingOptionsDb).length > 0 ?
                        Object.entries(financingOptionsDb).map(([key, option]) => (
                          <SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>
                        ))
                        : <SelectItem value="0" disabled>Cargando planes...</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormDescription>Si tu contrato/servicio no tiene financiación, selecciona "Sin financiación".</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Calculated Values Display */}
              {showFinancingDetails && (watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato/Servicio:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                    <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    <hr />
                    <div className="flex justify-between"><span>Saldo a Financiar:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                    <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                    <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                    <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                    <hr />
                    <div className="flex justify-between text-lg"><span>Valor Cuota Mensual ({watchedFinancingPlan} meses):</span> <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong></div>
                  </CardContent>
                </Card>
              )}
               {(watchedContractValue === 0 || watchedContractValue === undefined) && Number(watchedFinancingPlan) === 0 && (
                  <FormField control={clientDetailsForm.control} name="paymentAmount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto del Pago Recurrente Mensual</FormLabel>
                       <FormControl>
                        <Input
                          type="number" step="0.01" placeholder="50000"
                          value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? "" : String(field.value)}
                          onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Si es un servicio recurrente sin valor de contrato ni financiación, ingrese el monto aquí.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
               )}


              <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Día Preferido de Pago de la Cuota (1-31)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="31" placeholder="1"
                      value={field.value === undefined || isNaN(Number(field.value)) ? "" : String(field.value)}
                      onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                    />
                  </FormControl>
                  <FormDescription>Día del mes en que se generará el cobro de la cuota.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="submit" className="w-full" disabled={clientDetailsForm.formState.isSubmitting}>
                  {clientDetailsForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Información del Cliente'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

    