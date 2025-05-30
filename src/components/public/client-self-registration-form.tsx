// src/components/public/client-self-registration-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod'; // <--- ADDED THIS IMPORT
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/storage'; // Corrected import for User
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase'; // Ensure auth is exported from firebase.ts

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { registrationSchema, basePublicClientObjectSchema } from '@/lib/schema';
import type { PublicClientFormData, AppGeneralSettings } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';


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


// Specific schema for the client details part of the form
// This picks only the fields that are direct user inputs in this step.
const clientDetailsFormSpecificSchema = basePublicClientObjectSchema.pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  contractValue: true,
  financingPlan: true,
  paymentDayOfMonth: true,
  // email, applyIva, and file URLs are handled programmatically or come from context/URL,
  // so they are not direct Zod-validated inputs for *this specific form part*.
  // The full validation (including email and applyIva) happens in the server action
  // with the more comprehensive `publicClientSchema` from `@/lib/schema`.
});


export function ClientSelfRegistrationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { login } = useAuth(); // Use login from AuthContext

  const [appName, setAppName] = useState('RecurPay');
  const [isLoadingAppName, setIsLoadingAppName] = useState(true);

  const [registrationStep, setRegistrationStep] = useState<'initial' | 'login' | 'details' | 'completed'>('initial');
  const [loggedInUser, setLoggedInUser] = useState<FirebaseUser | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);

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

  const applyIvaFromUrl = searchParams.get('applyIva') !== 'false'; // Default to true if param is missing or not 'false'

  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingAppName(true);
      setIsLoadingFinancingOptions(true);
      try {
        const settings: AppGeneralSettings = await getGeneralSettings();
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
      } catch (error) {
        console.error("Error fetching app name for self-registration form:", error);
      } finally {
        setIsLoadingAppName(false);
      }
      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching financing options for self-registration form:", error);
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

  const clientDetailsForm = useForm<z.infer<typeof clientDetailsFormSpecificSchema>>({
    resolver: zodResolver(clientDetailsFormSpecificSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      contractValue: 0,
      financingPlan: 0,
      paymentDayOfMonth: 1,
    },
  });

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const cv = watchedContractValue ?? 0;
    const financingPlanKey = watchedFinancingPlan ?? 0;
    const applyIva = applyIvaFromUrl;

    const currentIvaRate = applyIva && cv > 0 ? IVA_RATE : 0;
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const amountToFinance = totalWithIva; // No down payment in self-registration for now

    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = 0;
    let monthlyInstallment = 0;

    if (cv > 0 && financingPlanKey !== 0 && Object.keys(financingOptions).length > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      financingInterestRateApplied = planDetails.rate;
      financingInterestAmount = amountToFinance * financingInterestRateApplied;
      totalAmountWithInterest = amountToFinance + financingInterestAmount;
      monthlyInstallment = financingPlanKey > 0 ? parseFloat((totalAmountWithInterest / financingPlanKey).toFixed(2)) : 0;
    } else if (cv > 0 && financingPlanKey === 0) { // Pago único
      monthlyInstallment = totalWithIva;
    } else if (cv === 0) {
        // No contract value, potentially a service with a recurring fee (not fully handled in this specific form's display logic yet)
        // For now, monthly installment will be 0 unless a paymentAmount field is added.
        // This form primarily focuses on contract-based registration.
    }

    setCalculatedValues({
      ivaAmount,
      totalWithIva,
      amountToFinance,
      financingInterestRateApplied,
      financingInterestAmount,
      totalAmountWithInterest,
      monthlyInstallment,
    });

  }, [watchedContractValue, watchedFinancingPlan, financingOptions, applyIvaFromUrl]);


  const handleInitialSubmit = async (values: z.infer<typeof registrationSchema>) => {
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      // Attempt to sign in first to check if user exists
      await login(values.email, values.password);
      // If login is successful, user exists. Check if they have completed registration (e.g., by checking Firestore)
      // This part requires knowing how to determine if a user has "completed" their profile.
      // For now, we'll assume if login works, we check for existing client data.
      const existingClient = await getClientByEmail(values.email);
      if (existingClient) {
          // If they have a full client record, redirect them to their portal (not yet built)
          // For now, show a message or redirect to a placeholder.
          toast({ title: "Bienvenido de Nuevo", description: "Hemos encontrado tu cuenta. Serás redirigido." });
          // router.push('/portal-cliente'); // Example redirect
          setRegistrationStep('completed'); // Or a specific "already registered" step
          setLoggedInUser(auth.currentUser); // Firebase auth.currentUser should be set by login
      } else {
          // User exists but no client record, or an incomplete one. Proceed to details form.
          toast({ title: "Cuenta Verificada", description: "Continúa completando tus datos." });
          setLoggedInUser(auth.currentUser);
          clientDetailsForm.setValue('email', values.email); // Pre-fill email
          setRegistrationStep('details');
      }
    } catch (signInError: any) {
      // If login fails, assume new user and try to register
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            setLoggedInUser(userCredential.user as FirebaseUser); // Cast to FirebaseUser from storage
            clientDetailsForm.setValue('email', values.email); // Pre-fill email
            setRegistrationStep('details');
            toast({ title: "Cuenta Creada", description: "¡Tu cuenta ha sido creada! Por favor, completa tus datos." });
        } catch (registrationError: any) {
            let message = "Error al crear la cuenta.";
            if (registrationError.code === 'auth/email-already-in-use') {
                message = "Este correo electrónico ya está en uso. Intenta iniciar sesión.";
                setRegistrationStep('login'); // Offer a way to switch to login explicitly
            } else if (registrationError.code === 'auth/weak-password') {
                message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
            }
            console.error("Error de registro:", registrationError);
            setRegistrationError(message);
            toast({ title: "Error de Registro", description: message, variant: "destructive" });
        }
      } else {
        // Other login error
        console.error("Error de inicio de sesión (no es 'no encontrado'):", signInError);
        setRegistrationError(signInError.message || "Error al verificar tu cuenta.");
        toast({ title: "Error", description: signInError.message || "Error al verificar tu cuenta.", variant: "destructive" });
      }
    } finally {
      setIsSubmittingRegistration(false);
    }
  };
  
  const handleLoginInstead = async (values: {email: string, password: string}) => {
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
        await login(values.email, values.password);
        const user = auth.currentUser;
        if (user) {
            const clientData = await getClientByEmail(user.email!);
            if (clientData) {
                toast({ title: "Inicio de Sesión Exitoso", description: "Bienvenido de nuevo. Serás redirigido." });
                // router.push('/portal-cliente'); // Redirect to client portal
                setRegistrationStep('completed'); // Or a specific "already registered" step
            } else {
                // User authenticated but no client data found, proceed to details form
                toast({ title: "Cuenta Verificada", description: "Por favor, completa los detalles de tu contrato." });
                setLoggedInUser(user);
                clientDetailsForm.setValue('email', user.email!);
                setRegistrationStep('details');
            }
        }
    } catch (error: any) {
        console.error("Error de inicio de sesión:", error);
        let message = "Error al iniciar sesión. Por favor, verifique sus credenciales.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Correo electrónico o contraseña inválidos.";
        }
        setRegistrationError(message);
        toast({ title: "Error de Inicio de Sesión", description: message, variant: "destructive" });
    } finally {
        setIsSubmittingRegistration(false);
    }
  };


  const handleClientDetailsSubmit = async (values: z.infer<typeof clientDetailsFormSpecificSchema>) => {
    if (!loggedInUser || !loggedInUser.email) {
      toast({ title: "Error", description: "Usuario no autenticado. Por favor, complete el paso de registro primero.", variant: "destructive" });
      return;
    }
    setIsSubmittingDetails(true);

    const formDataToSubmit: PublicClientFormData = {
      ...values,
      email: loggedInUser.email, // Email from authenticated user
      applyIva: applyIvaFromUrl,
      contractValue: values.contractValue ?? 0, // Ensure contractValue is a number
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };

    const result = await selfRegisterClientAction(formDataToSubmit);

    if (result.success) {
      toast({ title: "¡Registro Exitoso!", description: "Tu información ha sido registrada. Gracias." });
      setRegistrationStep('completed');
    } else {
      toast({
        title: "Error en el Registro",
        description: result.generalError || result.errors ? JSON.stringify(result.errors) : "No se pudo completar el registro.",
        variant: "destructive",
      });
    }
    setIsSubmittingDetails(false);
  };
  

  const handleFileUpload = useCallback(async (
    file: File,
    fileType: 'acceptanceLetter' | 'contractFile',
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    if (!file) return;
    if (!loggedInUser || !loggedInUser.uid) {
      toast({ title: "Error", description: "Debes crear tu cuenta primero para subir archivos.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    // Use UID for client-specific folder path
    const storagePath = `client_initial_documents/${loggedInUser.uid}/${uniqueFileName}`;
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
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta' : 'contrato'}`, description: error.message, variant: 'destructive' });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, progress: 100 }));
        if (fileType === 'acceptanceLetter') {
          clientDetailsForm.setValue('acceptanceLetterUrl', downloadURL, { shouldValidate: false }); // No need to validate URL here
          clientDetailsForm.setValue('acceptanceLetterFileName', file.name, { shouldValidate: false });
        } else if (fileType === 'contractFile') {
          clientDetailsForm.setValue('contractFileUrl', downloadURL, { shouldValidate: false });
          clientDetailsForm.setValue('contractFileName', file.name, { shouldValidate: false });
        }
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta subida' : 'Contrato subido'}`, description: `${file.name} subido con éxito.` });
      }
    );
  }, [clientDetailsForm, toast, loggedInUser]);

  const FileInputField = ({ id, fileState, onFileChange, label }: { id: string; fileState: FileUploadState; onFileChange: (file: File) => void; label: string; }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {fileState.url && !fileState.isUploading && (
        <div className="text-sm text-muted-foreground mb-2 p-2 border rounded-md">
          Archivo actual: <a href={fileState.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon size={14}/> {fileState.name || 'Ver archivo'}</a>
        </div>
      )}
      <FormControl>
        <Input id={id} type="file" onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])} className="flex-grow" disabled={fileState.isUploading || isSubmittingDetails} />
      </FormControl>
      {fileState.isUploading && <div className="mt-2"><Progress value={fileState.progress} className="w-full h-2" /><p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.file?.name} ({fileState.progress.toFixed(0)}%)</p></div>}
      {fileState.url && !fileState.isUploading && fileState.file && <div className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={16} /> ¡{fileState.name} subido!</div>}
      {fileState.error && !fileState.isUploading && <div className="mt-2 text-sm text-destructive flex items-center gap-1"><XCircle size={16} /> Error: {fileState.error}</div>}
      <FormMessage />
    </FormItem>
  );


  if (isLoadingAppName || isLoadingFinancingOptions) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  if (registrationStep === 'completed') {
    return (
      <Card className="w-full max-w-md text-center p-8">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <CardTitle className="text-2xl font-bold">¡Registro Completado!</CardTitle>
        <CardDescription className="mt-2">
          Gracias por registrarte en {appName}. Hemos recibido tu información.
          {/* Podrías añadir un enlace a un "panel de cliente" si existe */}
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {registrationStep === 'initial' || registrationStep === 'login' ? `Registro en ${appName}` : `Completa tus Datos - ${appName}`}
        </CardTitle>
        <CardDescription className="text-center">
          {registrationStep === 'initial' && "Crea tu cuenta para continuar. Esto te permitirá administrar tu perfil y servicios."}
          {registrationStep === 'login' && "Ingresa con tu cuenta existente."}
          {registrationStep === 'details' && "Casi listo. Completa los detalles de tu contrato o servicio."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(registrationStep === 'initial' || registrationStep === 'login') && (
          <Form {...registrationForm}>
            <form 
                onSubmit={registrationForm.handleSubmit(registrationStep === 'initial' ? handleInitialSubmit : (data) => handleLoginInstead({email: data.email, password: data.password}))} 
                className="space-y-6"
            >
              {registrationError && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md">
                  {registrationError}
                </div>
              )}
              <FormField control={registrationForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              {registrationStep === 'initial' && (
                <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              )}
              <Button type="submit" className="w-full" disabled={isSubmittingRegistration}>
                {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {registrationStep === 'initial' ? 'Crear Cuenta y Continuar' : 'Iniciar Sesión y Continuar'}
              </Button>
              {registrationStep === 'initial' && (
                <p className="text-sm text-center">
                  ¿Ya tienes una cuenta?{' '}
                  <Button variant="link" type="button" onClick={() => { setRegistrationStep('login'); setRegistrationError(null); }} className="p-0 h-auto">
                    Inicia Sesión Aquí
                  </Button>
                </p>
              )}
               {registrationStep === 'login' && (
                <p className="text-sm text-center">
                  ¿No tienes una cuenta?{' '}
                  <Button variant="link" type="button" onClick={() => { setRegistrationStep('initial'); setRegistrationError(null); }} className="p-0 h-auto">
                    Regístrate Aquí
                  </Button>
                </p>
              )}
            </form>
          </Form>
        )}

        {registrationStep === 'details' && loggedInUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(handleClientDetailsSubmit)} className="space-y-8 mt-6">
              <div className="p-4 border rounded-md bg-muted/50">
                <p className="text-sm font-medium">Cuenta creada con: <span className="text-primary">{loggedInUser.email}</span></p>
                <p className="text-xs text-muted-foreground">Ahora completa los siguientes detalles.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />

              <Card>
                <CardHeader><CardTitle className="text-lg">Detalles del Contrato/Servicio</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                      <FormItem><FormLabel>Valor del Contrato</FormLabel><FormControl><Input type="number" min="0" placeholder="0" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl>
                      <FormDescription>{applyIvaFromUrl ? "El IVA (19%) se calculará sobre este valor." : "Este contrato está exento de IVA."}</FormDescription><FormMessage /></FormItem>
                  )} />
                  
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                      <FormItem><FormLabel>Plan de Financiación</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value ?? '0')} disabled={isLoadingFinancingOptions || (watchedContractValue ?? 0) === 0}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                          <SelectContent>
                              {isLoadingFinancingOptions ? <SelectItem value="loading" disabled>Cargando planes...</SelectItem> :
                               Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {key !== "0" && option.rate > 0 && (watchedContractValue ?? 0) > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>))
                              }
                          </SelectContent></Select>
                          <FormDescription>{(watchedContractValue ?? 0) === 0 ? "La financiación no aplica si el valor del contrato es cero." : "Seleccione un plan si desea financiar el contrato."}</FormDescription><FormMessage /></FormItem>
                  )} />

                  <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                      <FormItem><FormLabel>Día de Pago Preferido del Mes</FormLabel><FormControl><Input type="number" min="1" max="31" placeholder="15" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} /></FormControl>
                      <FormDescription>Día (1-31) en que se generará el cobro de la cuota mensual.</FormDescription><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              {(watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader><CardTitle className="text-lg">Resumen (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    {applyIvaFromUrl && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>}
                    <div className="flex justify-between"><span>Total {applyIvaFromUrl ? 'con IVA' : 'Contrato'}:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    <hr/>
                    <div className="flex justify-between"><span>Saldo a { (watchedFinancingPlan ?? 0) === 0 ? 'Pagar (Total)' : 'Financiar'}:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                    {(watchedFinancingPlan ?? 0) !== 0 && (
                      <>
                        <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                        <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                        <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                      </>
                    )}
                    <hr/>
                    <div className="flex justify-between text-lg">
                      <span>{ (watchedFinancingPlan ?? 0) !== 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : 'Monto Total a Pagar:'}</span> 
                      <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-lg">Documentos Iniciales</CardTitle><CardDescription>Por favor, adjunta los siguientes documentos si los tienes disponibles.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <FileInputField id="self-reg-contractFile" fileState={contractFileState} onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)} label="Contrato Firmado (Opcional)" />
                  <FileInputField id="self-reg-acceptanceLetter" fileState={acceptanceLetterState} onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)} label="Carta de Aceptación (Opcional)" />
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={isSubmittingDetails || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {(isSubmittingDetails || acceptanceLetterState.isUploading || contractFileState.isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Información del Cliente
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

    