
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import React, { useEffect, useState, useCallback } from 'react';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth'; // Import FirebaseUser
import { auth } from '@/lib/firebase'; // Import auth for registration

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
import { publicClientSchema, registrationSchema } from '@/lib/schema';
import type { PublicClientFormData, FinancingPlanSetting } from '@/types'; // Adjusted type import
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

type FinancingOptionsMapType = { [key: number]: { rate: number; label: string } };

type CalculatedValues = {
  ivaAmount: number;
  totalWithIva: number;
  amountToFinance: number;
  financingInterestRateApplied: number;
  financingInterestAmount: number;
  totalAmountWithInterest: number;
  monthlyInstallment: number;
};

type RegistrationFormData = z.infer<typeof registrationSchema>;
type ClientDetailsFormData = z.infer<typeof publicClientSchema>;

export function ClientSelfRegistrationForm() {
  const { toast } = useToast();
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [isRegisteringUser, setIsRegisteringUser] = useState(false);
  const [currentStep, setCurrentStep] = useState<'registration' | 'details'>('registration');
  const [registeredUser, setRegisteredUser] = useState<FirebaseUser | null>(null);
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
  });
  const [appName, setAppName] = useState('RecurPay');
  const [formSubmittedSuccessfully, setFormSubmittedSuccessfully] = useState(false);

  const registrationForm = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const clientDetailsForm = useForm<ClientDetailsFormData>({
    resolver: zodResolver(publicClientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      contractValue: 0,
      financingPlan: 0,
      paymentDayOfMonth: 1,
    },
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [options, settings] = await Promise.all([
          getFinancingOptionsMap(),
          getGeneralSettings()
        ]);
        setFinancingOptions(options);
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
      } catch (error) {
        console.error("Error fetching initial data for self-registration form:", error);
        toast({
          title: "Error de Carga",
          description: "No se pudieron cargar las opciones de financiación. Intente más tarde.",
          variant: "destructive",
        });
      }
    }
    loadInitialData();
  }, [toast]);

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const contractVal = parseFloat(String(watchedContractValue));
    const financingPlanKey = Number(watchedFinancingPlan);

    let cv = isNaN(contractVal) ? 0 : contractVal;
    const ivaAmount = cv * IVA_RATE;
    const totalWithIva = cv + ivaAmount;
    // For self-registration, down payment is assumed 0%
    const calculatedDownPayment = 0;
    const amountToFinance = Math.max(0, totalWithIva - calculatedDownPayment);

    setShowFinancingDetails(financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0);

    if (financingPlanKey !== 0 && cv > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
      const monthlyInstallment = numberOfMonths > 0 ? parseFloat((totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;

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
        ivaAmount: cv > 0 ? ivaAmount : 0,
        totalWithIva: cv > 0 ? totalWithIva : cv,
        amountToFinance,
        financingInterestRateApplied: 0,
        financingInterestAmount: 0,
        totalAmountWithInterest: 0,
        monthlyInstallment: 0,
      });
    }
  }, [watchedContractValue, watchedFinancingPlan, clientDetailsForm, financingOptions]);

  const handleUserRegistration = async (values: RegistrationFormData) => {
    setIsRegisteringUser(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      setRegisteredUser(userCredential.user);
      toast({
        title: 'Registro Exitoso',
        description: 'Usuario creado. Por favor, complete los detalles de su contrato.',
      });
      setCurrentStep('details');
      clientDetailsForm.setValue('firstName', ''); // Clear potential previous values
      clientDetailsForm.setValue('lastName', '');
      // Pre-fill email if needed, or it can be accessed from registeredUser
    } catch (error: any) {
      console.error("Error en registro de Firebase:", error);
      let message = "Ocurrió un error durante el registro.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está en uso. Intente con otro.";
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es demasiado débil.";
      }
      toast({
        title: 'Error de Registro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsRegisteringUser(false);
    }
  };

  const handleClientDetailsSubmit = async (values: ClientDetailsFormData) => {
    if (!registeredUser || !registeredUser.email) {
      toast({ title: "Error", description: "No se encontró un usuario registrado para asociar.", variant: "destructive" });
      return;
    }
    setIsSubmittingDetails(true);

    const dataToSubmit: PublicClientFormData = {
      ...values,
      email: registeredUser.email, // Add registered user's email
      contractValue: values.contractValue ?? 0,
      financingPlan: values.financingPlan ?? 0,
    };
    
    // Payment amount for self-registration is derived from financing if contract exists
    if (dataToSubmit.financingPlan && dataToSubmit.financingPlan !== 0 && dataToSubmit.contractValue && dataToSubmit.contractValue > 0 && Object.keys(financingOptions).length > 0) {
      // This uses the calculated monthly installment from state.
      // Ensure this state reflects the form values correctly.
    } else if ((dataToSubmit.contractValue === undefined || dataToSubmit.contractValue === 0) && (dataToSubmit.financingPlan === undefined || dataToSubmit.financingPlan === 0)) {
        clientDetailsForm.setError('contractValue', {type: 'manual', message: 'Si no hay financiación, debe ingresar un valor de contrato o un monto de pago directo (funcionalidad futura).'});
        setIsSubmittingDetails(false);
        return;
    }


    try {
      const result = await selfRegisterClientAction(dataToSubmit);
      if (result.success) {
        toast({
          title: '¡Inscripción Exitosa!',
          description: `Gracias ${values.firstName}, sus datos han sido registrados. Pronto nos pondremos en contacto.`,
        });
        setFormSubmittedSuccessfully(true); // Set flag for success message
        // Optionally, redirect or clear form here
        // clientDetailsForm.reset();
        // setCurrentStep('registration'); // Or a thank you step
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
                clientDetailsForm.setError(field as keyof ClientDetailsFormData, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error en la Inscripción',
          description: result.generalError || 'No se pudieron guardar los detalles. Por favor, revise el formulario.',
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
      setIsSubmittingDetails(false);
    }
  };
  
  if (formSubmittedSuccessfully) {
    return (
      <Card className="w-full max-w-lg mx-auto shadow-xl">
        <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <CardTitle className="text-2xl">¡Gracias por Inscribirse!</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground">
                Sus datos han sido registrados exitosamente. El equipo de {appName} se pondrá en contacto con usted a la brevedad.
            </p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          {currentStep === 'registration' ? `Registro de Usuario - ${appName}` : `Detalles del Contrato - ${appName}`}
        </CardTitle>
        <CardDescription className="text-center">
          {currentStep === 'registration' ? 'Cree una cuenta para continuar con su inscripción.' : 'Complete la información de su contrato.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentStep === 'registration' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleUserRegistration)} className="space-y-6">
              <FormField
                control={registrationForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="su@correo.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={registrationForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={registrationForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isRegisteringUser}>
                {isRegisteringUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrarse y Continuar
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 'details' && registeredUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(handleClientDetailsSubmit)} className="space-y-6">
              <p className="text-sm text-muted-foreground">Usuario: {registeredUser.email}</p>
              <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
              
              <FormField
                control={clientDetailsForm.control}
                name="contractValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor del Contrato/Servicio (antes de IVA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1000000"
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? "" : String(field.value)}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : parseFloat(val));
                        }}
                        onBlur={field.onBlur} 
                        ref={field.ref}
                        name={field.name}
                        disabled={field.disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={clientDetailsForm.control}
                name="financingPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan de Financiación</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.keys(financingOptions).length > 0 ? 
                          Object.entries(financingOptions).map(([key, option]) => (
                            <SelectItem key={key} value={key}>
                              {option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés)` : ''}
                            </SelectItem>
                          ))
                          : <SelectItem value="0" disabled>Cargando planes...</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormDescription>Las tasas de interés son aproximadas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {showFinancingDetails && (watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30 my-4">
                  <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                    <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    <div className="flex justify-between"><span>Abono:</span> <strong>{formatCurrency(0)}</strong> <span className="text-xs">(0% para auto-registro)</span></div>
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

              <FormField
                control={clientDetailsForm.control}
                name="paymentDayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de Pago Preferido del Mes</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min="1" max="31" placeholder="15"
                        value={field.value === undefined || isNaN(Number(field.value)) ? "" : String(field.value)}
                        onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormDescription>Día (1-31) en que se generará su cobro mensual.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isSubmittingDetails}>
                {isSubmittingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Completar Inscripción
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
          {currentStep === 'registration' ?
            `Al registrarse, acepta nuestros términos y condiciones.` :
            `Revise cuidadosamente la información antes de enviar. ${appName} se pondrá en contacto para confirmar los detalles.`
          }
        </p>
      </CardFooter>
    </Card>
  );
}
