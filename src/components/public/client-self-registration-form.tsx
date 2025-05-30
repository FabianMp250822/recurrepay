
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';

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
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { registrationSchema, basePublicClientObjectSchema } from '@/lib/schema';
import type { PublicClientFormData } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { auth, storage } from '@/lib/firebase';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon, Eye, EyeOff } from 'lucide-react';
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
  // acceptanceLetterUrl, acceptanceLetterFileName, contractFileUrl, contractFileName
  // are handled programmatically and validated by the full schema in the server action.
  // applyIva is also handled programmatically based on URL param.
}).merge(z.object({ // Add file URLs as optional for client-side form state, not direct user input for Zod here
  acceptanceLetterUrl: z.string().url().optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().optional().or(z.literal('')),
  contractFileUrl: z.string().url().optional().or(z.literal('')),
  contractFileName: z.string().optional().or(z.literal('')),
}));

type ClientDetailsFormValues = z.infer<typeof clientDetailsFormSpecificSchema>;


function ClientSelfRegistrationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<'auth' | 'details' | 'completed'>('auth');
  const [authMode, setAuthMode] = useState<'loginOrRegister' | 'confirmPassword'>('loginOrRegister');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); 
  
  const [loggedInUser, setLoggedInUser] = useState<FirebaseUser | null>(null);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);
  const [applyIvaFromUrl, setApplyIvaFromUrl] = useState(true);
  const [appName, setAppName] = useState('RecurPay');
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
    const applyIvaParam = searchParams.get('applyIva');
    setApplyIvaFromUrl(applyIvaParam !== 'false'); 

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
        toast({ title: "Error", description: "No se pudieron cargar las opciones de financiación.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadInitialData();
  }, [searchParams, toast]);


  const authForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<ClientDetailsFormValues>({
    resolver: zodResolver(clientDetailsFormSpecificSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      contractValue: 0,
      financingPlan: 0,
      paymentDayOfMonth: 1,
      acceptanceLetterUrl: '',
      acceptanceLetterFileName: '',
      contractFileUrl: '',
      contractFileName: '',
    },
  });

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const cv = clientDetailsForm.getValues('contractValue') ?? 0;
    const financingPlanKey = clientDetailsForm.getValues('financingPlan') ?? 0;

    const currentIvaRate = applyIvaFromUrl && cv > 0 ? IVA_RATE : 0;
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const amountToFinance = totalWithIva; 

    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = amountToFinance;
    let monthlyInstallment = amountToFinance; 

    if (financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      financingInterestRateApplied = planDetails.rate;
      financingInterestAmount = amountToFinance * financingInterestRateApplied;
      totalAmountWithInterest = amountToFinance + financingInterestAmount;
      monthlyInstallment = financingPlanKey > 0 ? parseFloat((totalAmountWithInterest / financingPlanKey).toFixed(2)) : 0;
    } else if (cv > 0 && financingPlanKey === 0) { 
        monthlyInstallment = totalWithIva;
    } else if (cv === 0) {
        monthlyInstallment = 0; 
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


  const handleAuthSubmit = async (data: z.infer<typeof registrationSchema>) => {
    setIsLoading(true);
    setAuthError(null);
    const { email, password, confirmPassword } = data;

    if (authMode === 'loginOrRegister') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setLoggedInUser(userCredential.user);
        toast({ title: "Inicio de sesión exitoso", description: "Por favor, completa los detalles de tu contrato." });
        setCurrentStep('details');
      } catch (signInError: any) {
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          setAuthMode('confirmPassword');
          authForm.setValue('confirmPassword', ''); // Clear confirm password for new input
          toast({ title: "Usuario no encontrado", description: "Parece que eres nuevo. Por favor, confirma tu contraseña para crear una cuenta.", variant: "default" });
        } else {
          setAuthError(signInError.message || "Error al intentar iniciar sesión.");
        }
      }
    } else if (authMode === 'confirmPassword') {
      if (password !== confirmPassword) {
        authForm.setError("confirmPassword", { type: "manual", message: "Las contraseñas no coinciden." });
        setAuthError("Las contraseñas no coinciden.");
        setIsLoading(false);
        return;
      }
      try {
        const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
        setLoggedInUser(newUserCredential.user);
        toast({ title: "Cuenta Creada Exitosamente", description: "Ahora, por favor completa los detalles de tu contrato." });
        setCurrentStep('details');
      } catch (createError: any) {
        if (createError.code === 'auth/email-already-in-use') {
          setAuthError("Este correo electrónico ya está registrado. Intenta iniciar sesión.");
          setAuthMode('loginOrRegister'); 
          authForm.setValue('password', ''); // Clear password for login attempt
          authForm.setValue('confirmPassword', ''); 
        } else {
          setAuthError(createError.message || "Error al crear la cuenta.");
        }
      }
    }
    setIsLoading(false);
  };


  const handleClientDetailsSubmit = async (data: ClientDetailsFormValues) => {
    if (!loggedInUser || !loggedInUser.email) {
      setFormError("Error: Usuario no autenticado. Por favor, completa el paso de registro/inicio de sesión.");
      toast({ title: "Error de Autenticación", description: "No se pudo verificar tu sesión. Intenta recargar la página.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setFormError(null);

    const formDataToSubmit: PublicClientFormData = {
      ...data,
      email: loggedInUser.email, 
      applyIva: applyIvaFromUrl,
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };

    try {
      const result = await selfRegisterClientAction(formDataToSubmit);
      if (result.success) {
        toast({ title: "¡Registro Exitoso!", description: `Gracias ${data.firstName}, tu información ha sido registrada.` });
        setCurrentStep('completed');
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && Array.isArray(messages) && messages.length > 0) {
              clientDetailsForm.setError(field as keyof ClientDetailsFormValues, { type: 'manual', message: messages[0] });
            }
          });
        }
        setFormError(result.generalError || "Error al registrar los detalles. Por favor, revisa los campos.");
        toast({ title: "Error de Registro", description: result.generalError || "No se pudieron guardar tus datos.", variant: "destructive" });
      }
    } catch (error) {
      setFormError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      toast({ title: "Error Inesperado", description: "Algo salió mal al procesar tu solicitud.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (
    file: File,
    fileType: 'acceptanceLetter' | 'contractFile',
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    if (!file) return;
    if (!loggedInUser || !loggedInUser.uid) {
      toast({ title: "Error de Autenticación", description: "Debes iniciar sesión o crear una cuenta antes de subir archivos.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
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
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta de aceptación' : 'contrato'}`, description: error.message, variant: 'destructive' });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, progress: 100 }));
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
  }, [loggedInUser, toast, clientDetailsForm]);


  const FileInputField = ({
    id, 
    fileState,
    onFileChange,
    label,
    disabled,
  }: {
    id: string;
    fileState: FileUploadState;
    onFileChange: (file: File) => void;
    label: string;
    disabled?: boolean;
  }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {fileState.url && !fileState.isUploading && (
        <div className="text-sm text-muted-foreground mb-2 p-2 border rounded-md">
          Archivo actual: <a href={fileState.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon size={14}/> {fileState.name || 'Ver archivo'}</a>
        </div>
      )}
      <FormControl>
        <div className="flex items-center gap-2">
          <Input
            id={id} 
            type="file"
            onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
            className="flex-grow"
            disabled={fileState.isUploading || isLoading || disabled}
          />
        </div>
      </FormControl>
      {fileState.isUploading && (
        <div className="mt-2">
          <Progress value={fileState.progress} className="w-full h-2" />
          <p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.file?.name} ({fileState.progress.toFixed(0)}%)</p>
        </div>
      )}
      {fileState.url && !fileState.isUploading && fileState.file && (
        <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 size={16} /> ¡{fileState.name} subido con éxito!
        </div>
      )}
      {fileState.error && !fileState.isUploading &&(
        <div className="mt-2 text-sm text-destructive flex items-center gap-1">
          <XCircle size={16} /> {fileState.error}
        </div>
      )}
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
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <p>Gracias, {clientDetailsForm.getValues('firstName')}. Tu información ha sido registrada exitosamente.</p>
          <p>Próximamente podrás acceder a tu panel de cliente. Por favor, revisa tu correo para futuras comunicaciones.</p>
          {/* <Button onClick={() => router.push('/cliente/panel')}>Ir al Panel de Cliente</Button> */}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {currentStep === 'auth' ? `Bienvenido a ${appName}` : `Completa tus Datos - ${appName}`}
        </CardTitle>
        {currentStep === 'auth' && (
          <CardDescription className="text-center pt-2">
            {authMode === 'confirmPassword'
              ? "Para continuar, por favor confirma tu contraseña y crearemos tu cuenta."
              : "Ingresa tu correo y contraseña para acceder o registrarte."
            }
            <br /> Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil, consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
          </CardDescription>
        )}
         {currentStep === 'details' && (
          <CardDescription className="text-center pt-2">
            ¡Cuenta creada/verificada! Ahora, por favor completa los detalles de tu contrato o servicio. <br/> Correo: <strong>{loggedInUser?.email}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {authError && <p className="text-sm font-medium text-destructive mb-4 text-center">{authError}</p>}
        {formError && <p className="text-sm font-medium text-destructive mb-4 text-center">{formError}</p>}

        {currentStep === 'auth' && (
          <Form {...authForm}>
            <form onSubmit={authForm.handleSubmit(handleAuthSubmit)} className="space-y-6">
              <FormField control={authForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl><Input type="email" placeholder="tu@correo.com" {...field} disabled={isLoading || authMode === 'confirmPassword'} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={authForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Tu contraseña" 
                            {...field} 
                            disabled={isLoading} 
                        />
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" 
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {authMode === 'confirmPassword' && (
                <FormField control={authForm.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Input 
                                type={showConfirmPassword ? "text" : "password"} 
                                placeholder="Confirma tu contraseña" 
                                {...field} 
                                disabled={isLoading} 
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" 
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {authMode === 'confirmPassword' ? 'Crear Cuenta y Continuar' : 'Acceder / Registrarse'}
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 'details' && loggedInUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(handleClientDetailsSubmit)} className="space-y-8">
              <Card>
                <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" value={loggedInUser.email || ''} readOnly disabled className="bg-muted/50" /></FormControl>
                  </FormItem>
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Detalles del Contrato/Servicio</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor del Contrato/Servicio (COP)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" placeholder="0" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormDescription>Si es un servicio sin valor de contrato inicial, ingrese 0.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  
                  <FormItem>
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                        <FormLabel className="text-base">Aplicar IVA ({(IVA_RATE * 100).toFixed(0)}%) al Contrato</FormLabel>
                        <FormDescription>
                            {applyIvaFromUrl ? "El IVA se incluirá en el valor total del contrato según la configuración del enlace." : "El contrato está configurado como exento de IVA según el enlace."}
                        </FormDescription>
                        </div>
                        <Switch checked={applyIvaFromUrl} disabled />
                    </div>
                  </FormItem>

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
                                {option.label} {key !== "0" && option.rate > 0 && (watchedContractValue ?? 0) > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}
                              </SelectItem>
                            ))
                            : <SelectItem value="0" disabled>No hay planes disponibles.</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormDescription>{(watchedContractValue ?? 0) === 0 ? "La financiación no aplica si el valor del contrato es $0." : "Seleccione un plan si desea financiar el valor del contrato."}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                 { (watchedContractValue ?? 0) > 0 && (
                    <Card className="bg-muted/30">
                        <CardHeader><CardTitle className="text-lg">Resumen de Costos (Calculado)</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between"><span>Valor Contrato/Servicio:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                        {applyIvaFromUrl && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>}
                        <div className="flex justify-between"><span>Total {applyIvaFromUrl ? 'con IVA' : 'Contrato'}:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                        <hr />
                        <div className="flex justify-between"><span>Saldo a { (watchedFinancingPlan ?? 0) === 0 ? 'Pagar (Total)' : 'Financiar'}:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                        {(watchedFinancingPlan ?? 0) !== 0 && (
                            <>
                            <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                            <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                            <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                            </>
                        )}
                        <hr />
                        <div className="flex justify-between text-lg">
                            <span>{(watchedFinancingPlan ?? 0) !== 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : 'Monto Total a Pagar (Pago Único):'}</span>
                            <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong>
                        </div>
                        </CardContent>
                    </Card>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Configuración de Pago Mensual</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                        <FormItem><FormLabel>Día de Pago Preferido del Mes</FormLabel>
                            <FormControl><Input type="number" min="1" max="31" placeholder="15" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></FormControl>
                            <FormDescription>Día (1-31) en que prefieres que se genere el cobro de tu cuota mensual.</FormDescription><FormMessage />
                        </FormItem>)}
                    />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Documentos del Contrato (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FileInputField
                    id="public-acceptanceLetter-file-input"
                    label="Carta de Aceptación del Contrato"
                    fileState={acceptanceLetterState}
                    onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)}
                    disabled={isLoading || acceptanceLetterState.isUploading || contractFileState.isUploading}
                  />
                  <FileInputField
                    id="public-contractFile-file-input"
                    label="Contrato Firmado"
                    fileState={contractFileState}
                    onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)}
                    disabled={isLoading || acceptanceLetterState.isUploading || contractFileState.isUploading}
                  />
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={isLoading || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {(isLoading || acceptanceLetterState.isUploading || contractFileState.isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finalizar Registro y Guardar Información
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientSelfRegistrationForm() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-2">Cargando...</p></div>}>
      <ClientSelfRegistrationFormContent />
    </Suspense>
  );
}
