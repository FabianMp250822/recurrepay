'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import Image from 'next/image';

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
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { publicClientSchema, registrationSchema } from '@/lib/schema';
import type { PublicClientFormData, AppGeneralSettings, FinancingPlanSetting } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { auth, storage } from '@/lib/firebase';

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

type FileUploadState = {
  file: File | null;
  progress: number;
  url: string | null;
  name: string | null;
  error: string | null;
  isUploading: boolean;
};

const initialFileUploadState: FileUploadState = {
  file: null,
  progress: 0,
  url: null,
  name: null,
  error: null,
  isUploading: false,
};


export function ClientSelfRegistrationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isSubmittingClientDetails, setIsSubmittingClientDetails] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [clientDetailsError, setClientDetailsError] = useState<string | null>(null);

  const [appName, setAppName] = useState('RecurPay');
  const [currentStep, setCurrentStep] = useState<'initial' | 'details' | 'completed'>('initial');
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

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);


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
          description: "No se pudieron cargar las opciones de financiación o configuración. Por favor, intente más tarde.",
          variant: "destructive",
        });
      }
    }
    loadInitialData();
  }, [toast]);

  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const clientDetailsForm = useForm<z.infer<typeof publicClientSchema>>({
    resolver: zodResolver(publicClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      contractValue: undefined,
      financingPlan: 0,
      paymentDayOfMonth: 1,
      acceptanceLetterUrl: undefined,
      acceptanceLetterFileName: undefined,
      contractFileUrl: undefined,
      contractFileName: undefined,
    },
  });

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const contractVal = parseFloat(String(watchedContractValue));
    const financingPlanKey = Number(watchedFinancingPlan);

    let cv = isNaN(contractVal) ? 0 : contractVal;

    const ivaAmount = cv * IVA_RATE;
    const totalWithIva = cv + ivaAmount;
    
    setShowFinancingDetails(financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0);

    if (financingPlanKey !== 0 && cv > 0 && financingOptions[financingPlanKey]) {
      const amountToFinance = totalWithIva; // Para auto-registro, el abono es 0, se financia el total con IVA
      const planDetails = financingOptions[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
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
      clientDetailsForm.setValue('paymentAmount', parseFloat(monthlyInstallment.toFixed(2)), { shouldValidate: true });
    } else {
      setCalculatedValues({
        ivaAmount: cv > 0 ? ivaAmount : 0,
        totalWithIva: cv > 0 ? totalWithIva : cv,
        amountToFinance: cv > 0 ? totalWithIva : cv,
        financingInterestRateApplied: 0,
        financingInterestAmount: 0,
        totalAmountWithInterest: 0,
        monthlyInstallment: 0,
      });
       clientDetailsForm.setValue('paymentAmount', cv > 0 ? totalWithIva : undefined , { shouldValidate: true });
    }
  }, [watchedContractValue, watchedFinancingPlan, clientDetailsForm, financingOptions]);


  const handleUserRegistration = async (values: z.infer<typeof registrationSchema>) => {
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      setRegisteredUser(userCredential.user);
      setCurrentStep('details');
      clientDetailsForm.setValue('email', values.email); // Pre-fill email for the next step
      toast({ title: "Cuenta Creada", description: "Tu cuenta ha sido creada. Por favor, completa tus datos." });
    } catch (error: any) {
      console.error("Error de registro de Firebase:", error);
      let message = "Error al crear la cuenta. Inténtelo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está registrado. Intente con otro.";
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
      }
      setRegistrationError(message);
      toast({ title: "Error de Registro", description: message, variant: "destructive" });
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleFileUpload = useCallback(async (
    file: File,
    fileType: 'acceptanceLetter' | 'contractFile',
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    if (!file || !registeredUser?.uid) {
      toast({ title: "Error", description: "Debe estar registrado para subir archivos.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    const storagePath = `client_initial_documents/${registeredUser.uid}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setState(prev => ({ ...prev, progress }));
      },
      (error) => {
        console.error(`Error al subir archivo (${fileType}):`, error);
        setState(prev => ({ ...prev, isUploading: false, error: error.message, progress: 0 }));
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta de aceptación' : 'contrato'}`, description: error.message, variant: 'destructive' });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, name: file.name, progress: 100 }));
        if (fileType === 'acceptanceLetter') {
          clientDetailsForm.setValue('acceptanceLetterUrl', downloadURL, { shouldValidate: true });
          clientDetailsForm.setValue('acceptanceLetterFileName', file.name, { shouldValidate: true });
        } else if (fileType === 'contractFile') {
          clientDetailsForm.setValue('contractFileUrl', downloadURL, { shouldValidate: true });
          clientDetailsForm.setValue('contractFileName', file.name, { shouldValidate: true });
        }
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta de aceptación subida' : 'Contrato subido'}`, description: `${file.name} subido con éxito.` });
      }
    );
  }, [clientDetailsForm, toast, registeredUser?.uid]);

  const FileInputField = ({ id, label, fileState, onFileChange }: { id: string; label: string; fileState: FileUploadState; onFileChange: (file: File) => void; }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          id={id} type="file"
          onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
          className="flex-grow"
          disabled={fileState.isUploading || isSubmittingClientDetails}
        />
      </FormControl>
      {fileState.isUploading && <Progress value={fileState.progress} className="w-full h-2 mt-2" />}
      {fileState.url && !fileState.isUploading && <div className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={16} /> ¡{fileState.name} subido!</div>}
      {fileState.error && !fileState.isUploading && <div className="mt-2 text-sm text-destructive flex items-center gap-1"><XCircle size={16} /> Error: {fileState.error}</div>}
      <FormMessage />
    </FormItem>
  );


  async function onSubmitClientDetails(values: z.infer<typeof publicClientSchema>) {
    if (!registeredUser || !registeredUser.email) {
      setClientDetailsError("Error: No se pudo obtener la información del usuario registrado.");
      toast({ title: "Error de Usuario", description: "No se pudo verificar el usuario. Por favor, intente registrarse de nuevo.", variant: "destructive" });
      return;
    }
    setIsSubmittingClientDetails(true);
    setClientDetailsError(null);

    const formDataToSubmit: PublicClientFormData & { email: string; acceptanceLetterUrl?: string; acceptanceLetterFileName?: string; contractFileUrl?: string; contractFileName?: string; } = {
      ...values,
      email: registeredUser.email,
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };

    if (formDataToSubmit.financingPlan && formDataToSubmit.financingPlan !== 0 && formDataToSubmit.contractValue && formDataToSubmit.contractValue > 0) {
      formDataToSubmit.paymentAmount = parseFloat(calculatedValues.monthlyInstallment.toFixed(2));
    } else {
      formDataToSubmit.paymentAmount = values.contractValue; // Si no hay financiación, se paga el total del contrato (con IVA)
    }


    try {
      const result = await selfRegisterClientAction(formDataToSubmit);
      if (result.success) {
        toast({ title: 'Registro Exitoso', description: `¡Bienvenido/a, ${values.firstName}! Tu información ha sido guardada.` });
        setCurrentStep('completed');
      } else {
        setClientDetailsError(result.generalError || "Error al guardar la información del cliente.");
        toast({ title: 'Error al Guardar', description: result.generalError || "No se pudo guardar tu información. Revisa los campos o inténtalo más tarde.", variant: 'destructive' });
      }
    } catch (error) {
      console.error("Error submitting client details:", error);
      setClientDetailsError("Ocurrió un error inesperado al guardar tus datos.");
      toast({ title: 'Error Inesperado', description: "Ocurrió un error. Por favor, inténtelo de nuevo.", variant: 'destructive' });
    } finally {
      setIsSubmittingClientDetails(false);
    }
  }

  if (currentStep === 'completed') {
    return (
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-primary">¡Registro Completado!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <p className="text-lg">Gracias por registrarte en {appName}.</p>
          <p>Hemos recibido tu información y pronto nos pondremos en contacto si es necesario.</p>
          <Button onClick={() => router.push('/')} variant="outline">Volver al Inicio</Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {currentStep === 'initial' ? `Registro de Cuenta - ${appName}` : `Completa tus Datos - ${appName}`}
        </CardTitle>
        {currentStep === 'initial' && (
          <CardDescription className="text-center pt-2">
            Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil,
            consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {currentStep === 'initial' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleUserRegistration)} className="space-y-6">
              <FormField control={registrationForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              {registrationError && <p className="text-sm font-medium text-destructive">{registrationError}</p>}
              <Button type="submit" className="w-full" disabled={isSubmittingRegistration}>
                {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cuenta y Continuar
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 'details' && registeredUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(onSubmitClientDetails)} className="space-y-8">
              <Card>
                <CardHeader><CardTitle className="text-lg">Información Personal</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={clientDetailsForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} value={registeredUser.email || ""} disabled /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Detalles del Contrato/Servicio</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={clientDetailsForm.control}
                    name="contractValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor del Contrato (Opcional, antes de IVA)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1000000"
                            value={String(field.value ?? "")}
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
                            disabled={field.disabled || isSubmittingClientDetails}
                          />
                        </FormControl>
                        <FormDescription>Si aplica, ingrese el valor total del contrato antes de impuestos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                      <FormItem><FormLabel>Plan de Financiación (si aplica)</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                          <SelectContent>{Object.keys(financingOptions).length > 0 ? Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% int.)` : ''}</SelectItem>)) : <SelectItem value="0" disabled>Cargando...</SelectItem>}</SelectContent></Select><FormMessage />
                      </FormItem>)}
                  />
                  <FormField
                    control={clientDetailsForm.control}
                    name="paymentDayOfMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Día de Pago Preferido del Mes</FormLabel>
                        <FormControl>
                           <Input
                            type="number"
                            min="1" max="31" placeholder="15"
                            value={String(field.value ?? "")}
                             onChange={e => {
                              const val = e.target.value;
                              if (val === "") {
                                field.onChange(undefined);
                              } else {
                                const num = parseInt(val, 10);
                                field.onChange(isNaN(num) ? undefined : num);
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>Día (1-31) para sus pagos recurrentes.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
              {showFinancingDetails && (watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader><CardTitle className="text-md">Resumen de Financiación (Estimado)</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                    <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
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
                <CardHeader><CardTitle className="text-lg">Documentos Contractuales (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FileInputField id="selfRegContractFile" label="Contrato Firmado" fileState={contractFileState} onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)} />
                    <FileInputField id="selfRegAcceptanceLetter" label="Carta de Aceptación" fileState={acceptanceLetterState} onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)} />
                </CardContent>
              </Card>

              {clientDetailsError && <p className="text-sm font-medium text-destructive">{clientDetailsError}</p>}
              <Button type="submit" className="w-full" disabled={isSubmittingClientDetails || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {(isSubmittingClientDetails || acceptanceLetterState.isUploading || contractFileState.isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Información del Cliente
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
