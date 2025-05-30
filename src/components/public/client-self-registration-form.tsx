
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Asegúrate que 'db' esté exportado si se usa aquí directamente, o mejor a través de store
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch'; // Necesario para el IVA si se controla en el form
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registrationSchema, basePublicClientObjectSchema } from '@/lib/schema';
import type { PublicClientFormData, Client } from '@/types';
import { selfRegisterClientAction, checkClientProfileStatus } from '@/app/actions/publicClientActions';
import { fetchGeneralSettingsAction, fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { getFinancingOptionsMap } from '@/lib/store';
import { Progress } from "@/components/ui/progress";
import { IVA_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type RegistrationFormData = z.infer<typeof registrationSchema>;

const clientDetailsFormSpecificSchema = basePublicClientObjectSchema.pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  contractValue: true,
  financingPlan: true,
  paymentDayOfMonth: true,
  // applyIva es manejado por applyIvaFromUrl, no es input directo del usuario en este form
  // Los campos de archivo se manejan por separado
});
type ClientDetailsFormData = z.infer<typeof clientDetailsFormSpecificSchema>;


type FileUploadState = {
  file: File | null;
  progress: number;
  url: string | null;
  name: string | null;
  error: string | null;
  isUploading: boolean;
};
const initialFileUploadState: FileUploadState = { file: null, progress: 0, url: null, name: null, error: null, isUploading: false };


type CalculatedValues = {
  ivaAmount: number;
  totalWithIva: number;
  amountToFinance: number;
  financingInterestRateApplied: number;
  financingInterestAmount: number;
  totalAmountWithInterest: number;
  monthlyInstallment: number;
};

export function ClientSelfRegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCredentialProcessing, setIsCredentialProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  type RegistrationStep = 'credentials' | 'details' | 'documents' | 'completed' | 'profileExists';
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('credentials');
  const [loggedInUser, setLoggedInUser] = useState<FirebaseUser | null>(null);
  
  const [appName, setAppName] = useState('RecurPay');
  const [financingOptions, setFinancingOptions] = useState<{ [key: number]: { rate: number; label: string } }>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);

  const [applyIvaFromUrl, setApplyIvaFromUrl] = useState<boolean>(true);

  useEffect(() => {
    const ivaParam = searchParams.get('applyIva');
    setApplyIvaFromUrl(ivaParam === null || ivaParam === 'true'); // Default to true
  }, [searchParams]);


  useEffect(() => {
    async function loadInitialData() {
      try {
        const settings = await fetchGeneralSettingsAction();
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
        const finOptions = await getFinancingOptionsMap();
        setFinancingOptions(finOptions);
      } catch (error) {
        console.error("Error cargando datos iniciales para el formulario:", error);
        toast({ title: "Error", description: "No se pudieron cargar las configuraciones necesarias.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadInitialData();
  }, [toast]);

  const registrationForm = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<ClientDetailsFormData>({
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

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0, totalWithIva: 0, amountToFinance: 0,
    financingInterestRateApplied: 0, financingInterestAmount: 0,
    totalAmountWithInterest: 0, monthlyInstallment: 0,
  });

  useEffect(() => {
    const contractValRaw = clientDetailsForm.getValues('contractValue');
    const financingPlanKeyRaw = clientDetailsForm.getValues('financingPlan');

    const cv = typeof contractValRaw === 'number' ? contractValRaw : 0;
    const financingPlanKey = typeof financingPlanKeyRaw === 'number' ? financingPlanKeyRaw : 0;
    
    const currentIvaRate = applyIvaFromUrl && cv > 0 ? IVA_RATE : 0;
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const amountToFinance = totalWithIva; // No down payment in public form

    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = totalWithIva; // Default if no financing
    let monthlyInstallment = totalWithIva; // Default for single payment

    if (financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      financingInterestRateApplied = planDetails.rate;
      financingInterestAmount = amountToFinance * financingInterestRateApplied;
      totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
      monthlyInstallment = numberOfMonths > 0 ? parseFloat((totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
    } else if (cv > 0 && financingPlanKey === 0) { // Contract, no financing
       monthlyInstallment = totalWithIva; // Single payment
    } else if (cv === 0) {
        monthlyInstallment = 0; // No contract, no payment (should be handled by schema)
    }

    setCalculatedValues({
      ivaAmount, totalWithIva, amountToFinance,
      financingInterestRateApplied, financingInterestAmount,
      totalAmountWithInterest, monthlyInstallment,
    });

  }, [watchedContractValue, watchedFinancingPlan, applyIvaFromUrl, clientDetailsForm, financingOptions]);


  const firebaseErrorToMessage = (error: any): string => {
    if (error.code === 'auth/email-already-in-use') return "Este correo electrónico ya está en uso por otra cuenta.";
    if (error.code === 'auth/wrong-password') return "Contraseña incorrecta. Por favor, inténtelo de nuevo.";
    if (error.code === 'auth/user-not-found') return "No se encontró una cuenta con este correo electrónico. Verifique el correo o cree una cuenta nueva.";
    if (error.code === 'auth/invalid-credential') return "Credenciales inválidas. Verifique el correo y la contraseña.";
    return error.message || "Ocurrió un error desconocido. Por favor, inténtelo de nuevo.";
  };

  const handleCredentialSubmit = async (data: RegistrationFormData) => {
    setIsCredentialProcessing(true);
    setFormError(null);

    try {
      // Intento de inicio de sesión primero
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      setLoggedInUser(userCredential.user);
      toast({ title: "Inicio de Sesión Exitoso", description: "Verificando tu perfil..." });

      const profileStatus = await checkClientProfileStatus(userCredential.user.email!);
      if (profileStatus.hasProfile) {
        setCurrentStep('profileExists');
        // Aquí se podría redirigir al panel del cliente si ya existiera
        // router.push('/portal-cliente');
      } else {
        clientDetailsForm.setValue("firstName", profileStatus.clientData?.firstName || "");
        clientDetailsForm.setValue("lastName", profileStatus.clientData?.lastName || "");
        // etc., si quisiéramos precargar datos de un perfil parcial
        setCurrentStep('details');
      }
    } catch (signInError: any) {
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') { // invalid-credential para email/pass incorrecto
        // Si no se encuentra el usuario, o credencial inválida (puede ser pass incorrecto)
        // Proceder a intentar crear una nueva cuenta (asumiendo que el usuario quería registrarse)
        if (data.password !== data.confirmPassword) {
          setFormError("Las contraseñas no coinciden.");
          registrationForm.setError("confirmPassword", { type: "manual", message: "Las contraseñas no coinciden." });
          setIsCredentialProcessing(false);
          return;
        }
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
          setLoggedInUser(newUserCredential.user);
          setCurrentStep('details');
          toast({ title: "Cuenta Creada Exitosamente", description: "Ahora completa los detalles de tu plan." });
        } catch (createError: any) {
          setFormError(firebaseErrorToMessage(createError));
        }
      } else {
        // Otro error de inicio de sesión
        setFormError(firebaseErrorToMessage(signInError));
      }
    }
    setIsCredentialProcessing(false);
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
    // Usar UID del usuario para la ruta, asegurando que sea client-specific
    const storagePath = `client_initial_documents/${loggedInUser.uid}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath); // 'storage' debe ser importado de '@/lib/firebase'
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
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, progress: 100, name: file.name }));
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
  }, [loggedInUser, toast, clientDetailsForm]);


  const onSubmitClientDetails = async (data: ClientDetailsFormData) => {
    if (!loggedInUser || !loggedInUser.email) {
      setFormError("Error: Usuario no autenticado. Por favor, intente el paso anterior de nuevo.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    const fullFormData: PublicClientFormData = {
      ...data,
      email: loggedInUser.email,
      applyIva: applyIvaFromUrl,
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };

    try {
      const result = await selfRegisterClientAction(fullFormData);
      if (result.success) {
        toast({ title: "¡Registro Exitoso!", description: "Tu información ha sido guardada. Gracias por registrarte." });
        setCurrentStep('completed');
        // Aquí podrías redirigir al portal del cliente cuando exista
        // router.push('/portal-cliente');
      } else {
        setFormError(result.generalError || "Ocurrió un error al guardar tus datos.");
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && Array.isArray(messages) && messages.length > 0) {
              clientDetailsForm.setError(field as keyof ClientDetailsFormData, { type: 'manual', message: messages[0] });
            }
          });
        }
      }
    } catch (error) {
      setFormError("Ocurrió un error inesperado al procesar tu solicitud.");
    }
    setIsSubmitting(false);
  };
  
  const FileInputField = ({ id, fileState, onFileChange, label }: { id: string; fileState: FileUploadState; onFileChange: (file: File) => void; label: string; }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="flex items-center gap-2">
          <Input id={id} type="file" onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])} className="flex-grow" disabled={fileState.isUploading || isSubmitting} />
        </div>
      </FormControl>
      {fileState.isUploading && (<div className="mt-2"><Progress value={fileState.progress} className="w-full h-2" /><p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.name} ({fileState.progress.toFixed(0)}%)</p></div>)}
      {fileState.url && !fileState.isUploading && fileState.name && (<div className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={16} /> ¡{fileState.name} subido con éxito!</div>)}
      {fileState.error && !fileState.isUploading && (<div className="mt-2 text-sm text-destructive flex items-center gap-1"><XCircle size={16} /> {fileState.error}</div>)}
      <FormMessage />
    </FormItem>
  );

  if (currentStep === 'completed') {
    return (
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">¡Registro Completado!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <p>Gracias, {loggedInUser?.email || 'cliente'}. Tu información ha sido registrada exitosamente.</p>
          <p>Pronto recibirás más información o podrás acceder a tu panel de cliente.</p>
          {/* <Button onClick={() => router.push('/portal-cliente')}>Ir al Panel del Cliente</Button> */}
        </CardContent>
      </Card>
    );
  }
  
  if (currentStep === 'profileExists') {
    return (
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Cuenta Existente</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <p>Hola {loggedInUser?.email}, parece que ya tienes una cuenta y tu perfil está completo.</p>
          <p>En el futuro, serás redirigido a tu panel de cliente desde aquí.</p>
           {/* <Button onClick={() => router.push('/portal-cliente')}>Ir al Panel del Cliente</Button> */}
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {currentStep === 'credentials' ? `Acceso o Creación de Cuenta - ${appName}` : 
           currentStep === 'details' ? `Completa tus Datos - ${appName}` :
           `Registro - ${appName}`}
        </CardTitle>
        {currentStep === 'credentials' && (
          <CardDescription className="text-center pt-2">
            Ingresa tu correo y contraseña para acceder o crear tu cuenta. Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil, consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
          </CardDescription>
        )}
         {currentStep === 'details' && (
          <CardDescription className="text-center pt-2">
            ¡Casi listo! Por favor, completa la información de tu plan.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {formError && <p className="text-sm font-medium text-destructive mb-4 text-center">{formError}</p>}

        {currentStep === 'credentials' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleCredentialSubmit)} className="space-y-6">
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
                  <FormDescription>Si es una cuenta nueva, las contraseñas deben coincidir.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isCredentialProcessing}>
                {isCredentialProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continuar'}
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 'details' && loggedInUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(onSubmitClientDetails)} className="space-y-8">
              <Card>
                <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                  <FormItem>
                    <FormLabel>Correo Electrónico (registrado)</FormLabel>
                    <FormControl><Input type="email" value={loggedInUser.email || ''} disabled /></FormControl>
                  </FormItem>
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Detalles del Contrato/Servicio</CardTitle>
                    <CardDescription>
                        {applyIvaFromUrl ? 
                          `El IVA (${(IVA_RATE * 100).toFixed(0)}%) se aplicará al valor del contrato.` : 
                          "Este contrato está configurado como exento de IVA."
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor del Contrato/Servicio</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="1000000" {...field} 
                               value={String(field.value ?? "")}
                               onChange={e => {
                                  const val = e.target.value;
                                  field.onChange(val === "" ? undefined : parseFloat(val));
                               }} />
                      </FormControl>
                      <FormDescription>Ingrese 0 si es un servicio recurrente sin valor de contrato inicial.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan de Financiación</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value ?? '0')} disabled={isLoadingFinancingOptions || (watchedContractValue ?? 0) === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {isLoadingFinancingOptions ? (
                            <SelectItem value="loading" disabled>Cargando planes...</SelectItem>
                          ) : Object.keys(financingOptions).length > 0 ? 
                            Object.entries(financingOptions).map(([key, option]) => (
                              <SelectItem key={key} value={key}>
                                {option.label} {key !== "0" && option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}
                              </SelectItem>
                            ))
                            : <SelectItem value="0" disabled>No hay planes configurados.</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormDescription>Seleccione "Sin financiación" para servicios recurrentes directos o pagos únicos sin financiación.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de Pago Preferido del Mes</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" placeholder="15" {...field} 
                               value={String(field.value ?? "")}
                               onChange={e => {
                                  const val = e.target.value;
                                  field.onChange(val === "" ? undefined : parseInt(val, 10));
                               }}/>
                      </FormControl>
                      <FormDescription>Día (1-31) en que prefiere que se genere su cobro.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

               {(watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    { applyIvaFromUrl && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div> }
                    <div className="flex justify-between"><span>Total { applyIvaFromUrl ? 'con IVA' : 'Contrato' }:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    <hr/>
                    <div className="flex justify-between"><span>Saldo a { (watchedFinancingPlan ?? 0) !== 0 ? 'Financiar' : 'Pagar (Total)'}:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
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
                <CardHeader><CardTitle className="text-xl">Documentos del Contrato (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FileInputField id="acceptanceLetter-public" fileState={acceptanceLetterState} onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)} label="Carta de Aceptación del Contrato" />
                  <FileInputField id="contractFile-public" fileState={contractFileState} onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)} label="Contrato Firmado" />
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={isSubmitting || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {(isSubmitting || acceptanceLetterState.isUploading || contractFileState.isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Información del Cliente'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="text-center text-xs text-muted-foreground">
        <p>Si tienes alguna duda durante el proceso, por favor contacta a soporte.</p>
      </CardFooter>
    </Card>
  );
}
