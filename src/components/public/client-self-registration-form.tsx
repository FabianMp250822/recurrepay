
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';

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
import { Switch } from "@/components/ui/switch"; // Assuming you might use it, good to have.
import { useToast } from '@/hooks/use-toast';
import { registrationSchema, basePublicClientObjectSchema, publicClientSchema } from '@/lib/schema';
import type { Client, PublicClientFormData } from '@/types';
import { selfRegisterClientAction, checkClientProfileStatus } from '@/app/actions/publicClientActions';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon, Eye, EyeOff } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { storage, auth, db } from '@/lib/firebase';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import type { User as FirebaseUser } from 'firebase/auth';

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

const clientDetailsFormSpecificSchema = basePublicClientObjectSchema.pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  contractValue: true,
  financingPlan: true,
  paymentDayOfMonth: true,
  // paymentAmount is calculated or set based on other fields for public registration
});


export function ClientSelfRegistrationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState<'credentials' | 'details' | 'documents' | 'completed' | 'profileExists'>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<FirebaseUser | null>(null);
  const [appName, setAppName] = useState('RecurPay');

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);
  const [applyIvaFromUrl, setApplyIvaFromUrl] = useState(true);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
  });

  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingFinancingOptions(true);
      try {
        const [options, generalSettings] = await Promise.all([
          getFinancingOptionsMap(),
          getGeneralSettings()
        ]);
        setFinancingOptions(options);
        if (generalSettings && generalSettings.appName) {
          setAppName(generalSettings.appName);
        }
      } catch (error) {
        console.error("Error fetching initial data for self-registration form:", error);
        toast({ title: "Error", description: "No se pudieron cargar las opciones de financiación o configuración.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadInitialData();

    const ivaParam = searchParams.get('applyIva');
    if (ivaParam === 'false') {
      setApplyIvaFromUrl(false);
    } else {
      setApplyIvaFromUrl(true); // Default to true if param is missing or not 'false'
    }

  }, [searchParams, toast]);


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
    const cvRaw = clientDetailsForm.getValues('contractValue');
    const financingPlanKeyRaw = clientDetailsForm.getValues('financingPlan');
    
    let cv = typeof cvRaw === 'number' ? cvRaw : 0;
    let financingPlanKey = typeof financingPlanKeyRaw === 'number' ? financingPlanKeyRaw : 0;

    const currentIvaRate = applyIvaFromUrl && cv > 0 ? IVA_RATE : 0;
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const amountToFinance = totalWithIva; // No down payment in public flow by default

    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = 0;
    let monthlyInstallment = 0;

    if (cv > 0 && financingPlanKey !== 0 && Object.keys(financingOptions).length > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      financingInterestRateApplied = planDetails.rate;
      financingInterestAmount = amountToFinance * financingInterestRateApplied;
      totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
      monthlyInstallment = numberOfMonths > 0 ? parseFloat((totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
    } else if (cv > 0 && financingPlanKey === 0) { // No financing plan
      monthlyInstallment = totalWithIva; // Single payment
    } else if (cv === 0) { // Pure service, no contract value
      // For pure services, client must input paymentAmount. This is handled by schema.
      // Here we assume if CV=0, monthlyInstallment is also 0 unless specified elsewhere.
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

  }, [watchedContractValue, watchedFinancingPlan, applyIvaFromUrl, financingOptions, clientDetailsForm]);


  const handleCredentialSubmit = async (values: z.infer<typeof registrationSchema>) => {
    setIsLoading(true);
    setFormError(null);
    try {
      // 1. Try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      setLoggedInUser(userCredential.user);
      toast({ title: "Inicio de Sesión Exitoso", description: "Verificando tu perfil..." });

      // 2. Check if client profile exists
      const profileStatus = await checkClientProfileStatus(userCredential.user.email!);
      if (profileStatus.hasProfile) {
        setCurrentStep('profileExists');
      } else {
        clientDetailsForm.setValue('firstName', profileStatus.clientData?.firstName || '');
        clientDetailsForm.setValue('lastName', profileStatus.clientData?.lastName || '');
        // Pre-fill other fields if available and if profile is incomplete
        setCurrentStep('details');
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        // 3. If user not found or wrong password, try to create user
        if (values.password !== values.confirmPassword) {
          registrationForm.setError("confirmPassword", { type: "manual", message: "Las contraseñas no coinciden." });
          setIsLoading(false);
          return;
        }
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
          setLoggedInUser(newUserCredential.user);
          setCurrentStep('details');
          toast({ title: "Cuenta Creada Exitosamente", description: "Por favor, completa tus detalles." });
        } catch (creationError: any) {
          if (creationError.code === 'auth/email-already-in-use') {
            setFormError("Este correo electrónico ya está en uso con otra cuenta. Intenta iniciar sesión o usa un correo diferente.");
          } else {
            setFormError(creationError.message || "Error al crear la cuenta.");
          }
        }
      } else {
        setFormError(error.message || "Error al iniciar sesión.");
      }
    }
    setIsLoading(false);
  };
  
  const handleFileUpload = useCallback(async (
    file: File,
    fileType: 'acceptanceLetter' | 'contractFile',
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    if (!file || !loggedInUser?.uid) {
      toast({ title: "Error", description: "Debes estar autenticado para subir archivos.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    const storagePath = `client_initial_documents/${loggedInUser.uid}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => setState(prev => ({ ...prev, progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
      (error) => {
        console.error(`Error al subir archivo (${fileType}):`, error);
        setState(prev => ({ ...prev, isUploading: false, error: error.message, progress: 0 }));
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta' : 'contrato'}`, description: error.message, variant: 'destructive' });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, progress: 100 }));
        if (fileType === 'acceptanceLetter') {
          clientDetailsForm.setValue('acceptanceLetterUrl' as any, downloadURL, { shouldValidate: true });
          clientDetailsForm.setValue('acceptanceLetterFileName' as any, file.name, { shouldValidate: true });
        } else if (fileType === 'contractFile') {
          clientDetailsForm.setValue('contractFileUrl' as any, downloadURL, { shouldValidate: true });
          clientDetailsForm.setValue('contractFileName' as any, file.name, { shouldValidate: true });
        }
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta de aceptación subida' : 'Contrato subido'}`, description: `${file.name} subido con éxito.` });
      }
    );
  }, [loggedInUser, clientDetailsForm, toast]);


  const onSubmitClientDetails = async (values: z.infer<typeof clientDetailsFormSpecificSchema>) => {
    if (!loggedInUser?.email) {
      toast({ title: "Error", description: "No se pudo obtener el correo del usuario autenticado.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setFormError(null);

    const fullFormData: PublicClientFormData = {
      ...values,
      email: loggedInUser.email,
      applyIva: applyIvaFromUrl,
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };
    
    const result = await selfRegisterClientAction(fullFormData);
    if (result.success) {
      toast({ title: "¡Registro Exitoso!", description: "Tus datos han sido guardados." });
      setCurrentStep('completed');
    } else {
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          if (messages && Array.isArray(messages) && messages.length > 0) {
            clientDetailsForm.setError(field as keyof z.infer<typeof clientDetailsFormSpecificSchema>, { type: 'manual', message: messages[0] });
          }
        });
      }
      setFormError(result.generalError || "Error al guardar los datos del cliente.");
    }
    setIsLoading(false);
  };

  const FileInputField = ({ id, fileState, onFileChange, label }: { id: string; fileState: FileUploadState; onFileChange: (file: File) => void; label: string; }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {fileState.url && !fileState.isUploading && (
        <div className="text-sm text-muted-foreground mb-2 p-2 border rounded-md">
          Archivo actual: <a href={fileState.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon size={14}/> {fileState.name || 'Ver archivo'}</a>
        </div>
      )}
      <FormControl>
        <Input id={id} type="file" onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])} className="flex-grow" disabled={fileState.isUploading || isLoading} />
      </FormControl>
      {fileState.isUploading && (<div className="mt-2"><Progress value={fileState.progress} className="w-full h-2" /><p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.file?.name} ({fileState.progress.toFixed(0)}%)</p></div>)}
      {fileState.url && !fileState.isUploading && fileState.file && (<div className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={16} /> ¡{fileState.name} subido con éxito!</div>)}
      {fileState.error && !fileState.isUploading && (<div className="mt-2 text-sm text-destructive flex items-center gap-1"><XCircle size={16} /> Error: {fileState.error}</div>)}
      <FormMessage />
    </FormItem>
  );


  if (currentStep === 'profileExists') {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">{appName}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-semibold">Ya tienes un perfil completo.</p>
          <p className="text-muted-foreground">Serás redirigido a tu panel de cliente en breve.</p>
          {/* Aquí iría la lógica de redirección al panel del cliente cuando exista */}
          <Button onClick={() => router.push('/')} className="mt-6">Volver al Inicio</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (currentStep === 'completed') {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">¡Gracias por Registrarte en {appName}!</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-lg">Tu información ha sido guardada exitosamente.</p>
          <p className="text-muted-foreground">Pronto nos pondremos en contacto contigo o podrás acceder a tu panel.</p>
          {/* Podrías redirigir o mostrar un link al (futuro) panel del cliente */}
           <Button onClick={() => router.push('/')} className="mt-6">Volver al Inicio</Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {currentStep === 'credentials' ? `Bienvenido a ${appName} - Crea tu Cuenta` : 
           currentStep === 'details' ? `Completa tus Datos - ${appName}` : 
           `Sube tus Documentos - ${appName}`}
        </CardTitle>
        {currentStep === 'credentials' && (
            <CardDescription className="text-center pt-2">
            Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil, consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
            </CardDescription>
        )}
        {currentStep === 'details' && (
             <CardDescription className="text-center pt-2">
            Ahora, por favor ingresa los detalles del servicio o contrato que deseas configurar.
            </CardDescription>
        )}
         {currentStep === 'documents' && (
             <CardDescription className="text-center pt-2">
            Para finalizar, por favor adjunta los documentos requeridos.
            </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {formError && <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">{formError}</div>}

        {currentStep === 'credentials' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleCredentialSubmit)} className="space-y-6">
              <FormField control={registrationForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Contraseña</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} placeholder="********" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</Button></div></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><div className="relative"><Input type={showConfirmPassword ? "text" : "password"} placeholder="********" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</Button></div></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crear Cuenta y Continuar'}</Button>
            </form>
          </Form>
        )}

        {currentStep === 'details' && loggedInUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(() => setCurrentStep('documents'))} className="space-y-8">
              <CardDescription className="text-sm text-muted-foreground">Correo de la cuenta: {loggedInUser.email}</CardDescription>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
              
              <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor del Contrato/Servicio (Opcional)</FormLabel>
                  <FormControl><Input type="number" placeholder="0" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl>
                  <FormDescription>Si es un servicio recurrente sin valor de contrato inicial, déjelo en 0.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <p className="text-sm p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700">
                {applyIvaFromUrl ? `Se aplicará IVA del ${(IVA_RATE * 100).toFixed(0)}% al valor del contrato.` : 'Este contrato está configurado como Exento de IVA.'}
              </p>

              {(watchedContractValue ?? 0) > 0 && (
                <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan de Financiación</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value ?? '0')} disabled={isLoadingFinancingOptions}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {isLoadingFinancingOptions ? <SelectItem value="loading" disabled>Cargando planes...</SelectItem> :
                          Object.keys(financingOptions).length > 0 ? Object.entries(financingOptions).map(([key, option]) => (
                            <SelectItem key={key} value={key}>{option.label} {key !== "0" && option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : (key === "0" ? "" : "(N/A)")}</SelectItem>
                          )) : <SelectItem value="0" disabled>No hay planes.</SelectItem>
                        }
                      </SelectContent>
                    </Select>
                    <FormDescription>Si el pago es único o no requiere financiación, seleccione "Sin financiación".</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                  <FormItem><FormLabel>Día de Pago Preferido del Mes</FormLabel>
                      <FormControl><Input type="number" min="1" max="31" placeholder="15" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} /></FormControl>
                      <FormDescription>Día (1-31) en que prefiere que se genere el cobro de su cuota.</FormDescription><FormMessage />
                  </FormItem>)}
              />

              {(watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader><CardTitle className="text-lg">Resumen (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    {applyIvaFromUrl && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>}
                    <div className="flex justify-between"><span>Total {applyIvaFromUrl ? 'con IVA' : 'Contrato'}:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    {(watchedFinancingPlan ?? 0) !== 0 && (
                      <>
                        <hr/>
                        <div className="flex justify-between"><span>Saldo a Financiar:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                        <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                        <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                        <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                      </>
                    )}
                     <hr/>
                    <div className="flex justify-between text-lg">
                        <span>{(watchedFinancingPlan ?? 0) !== 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : 'Monto Total a Pagar (Pago Único):'}</span>
                        <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong>
                    </div>
                  </CardContent>
                </Card>
              )}
               <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar a Carga de Documentos'}</Button>
            </form>
          </Form>
        )}

         {currentStep === 'documents' && loggedInUser && (
          <div className="space-y-8 pt-6">
            <FileInputField id="contractFile" label="Contrato Firmado (Opcional)" fileState={contractFileState} onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)} />
            <FileInputField id="acceptanceLetter" label="Carta de Aceptación (Opcional)" fileState={acceptanceLetterState} onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)} />
            <Button 
              onClick={clientDetailsForm.handleSubmit(onSubmitClientDetails)} 
              className="w-full" 
              disabled={isLoading || contractFileState.isUploading || acceptanceLetterState.isUploading}
            >
              {(isLoading || contractFileState.isUploading || acceptanceLetterState.isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Finalizar Registro y Guardar Datos'}
            </Button>
            <Button 
                type="button" 
                variant="outline" 
                className="w-full mt-2" 
                onClick={() => setCurrentStep('details')}
                disabled={isLoading || contractFileState.isUploading || acceptanceLetterState.isUploading}
            >
                Volver a Detalles del Cliente
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

