
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import React, { useEffect, useState, useCallback } from 'react';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { publicClientSchema, registrationSchema } from '@/lib/schema';
import type { PublicClientFormData, AppGeneralSettings } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { IVA_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, FileText, CheckCircle, UploadCloud, XCircle, LinkIcon } from 'lucide-react';
import { Separator } from '../ui/separator';

type RegistrationStep = 'initial' | 'details' | 'completed' | 'error';
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
  file: null, progress: 0, url: null, name: null, error: null, isUploading: false
};

const FileInputField = ({
  id,
  label,
  fileState,
  onFileChange,
  disabled,
}: {
  id: string;
  label: string;
  fileState: FileUploadState;
  onFileChange: (file: File) => void;
  disabled?: boolean;
}) => (
  <FormItem>
    <FormLabel>{label}</FormLabel>
    {fileState.url && !fileState.isUploading && (
      <div className="text-sm text-muted-foreground mb-1">
        Archivo actual: <a href={fileState.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon size={14}/> {fileState.name || 'Ver archivo'}</a>
      </div>
    )}
    <FormControl>
      <Input
        id={id}
        type="file"
        onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
        className="flex-grow"
        disabled={fileState.isUploading || disabled}
      />
    </FormControl>
    {fileState.isUploading && (
      <div className="mt-1">
        <Progress value={fileState.progress} className="w-full h-2" />
        <p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.file?.name} ({fileState.progress.toFixed(0)}%)</p>
      </div>
    )}
    {fileState.url && !fileState.isUploading && (
      <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
        <CheckCircle size={14} /> ¡{fileState.name} subido!
      </div>
    )}
    {fileState.error && !fileState.isUploading && (
      <div className="mt-1 text-xs text-destructive flex items-center gap-1">
        <XCircle size={14} /> Error: {fileState.error}
      </div>
    )}
    <FormMessage />
  </FormItem>
);


export function ClientSelfRegistrationForm() {
  const { toast } = useToast();
  const [appName, setAppName] = useState('RecurPay');
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('initial');
  const [registeredUser, setRegisteredUser] = useState<FirebaseUser | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0, totalWithIva: 0, amountToFinance: 0, financingInterestRateApplied: 0,
    financingInterestAmount: 0, totalAmountWithInterest: 0, monthlyInstallment: 0,
  });

  // File upload states
  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings: AppGeneralSettings = await getGeneralSettings();
        if (settings && settings.appName) setAppName(settings.appName);
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching settings for self-registration:", error);
        toast({ title: "Error", description: "No se pudieron cargar las configuraciones necesarias.", variant: "destructive" });
      }
    }
    loadSettings();
  }, [toast]);

  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<z.infer<typeof publicClientSchema>>({
    resolver: zodResolver(publicClientSchema),
    defaultValues: {
      firstName: '', lastName: '', phoneNumber: '', contractValue: undefined,
      financingPlan: 0, paymentDayOfMonth: 1,
      acceptanceLetterUrl: undefined, acceptanceLetterFileName: undefined,
      contractFileUrl: undefined, contractFileName: undefined,
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
      const amountToFinance = totalWithIva; // No down payment in self-registration for now
      const planDetails = financingOptions[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const monthlyInstallment = financingPlanKey > 0 ? totalAmountWithInterest / financingPlanKey : 0;

      setCalculatedValues({
        ivaAmount, totalWithIva, amountToFinance,
        financingInterestRateApplied: interestRate, financingInterestAmount,
        totalAmountWithInterest, monthlyInstallment,
      });
    } else {
      setCalculatedValues({
        ivaAmount: cv > 0 ? ivaAmount : 0,
        totalWithIva: cv > 0 ? totalWithIva : cv,
        amountToFinance: cv > 0 ? totalWithIva : 0,
        financingInterestRateApplied: 0, financingInterestAmount: 0,
        totalAmountWithInterest: 0, monthlyInstallment: 0,
      });
    }
  }, [watchedContractValue, watchedFinancingPlan, financingOptions]);

  const handleUserRegistration = async (values: z.infer<typeof registrationSchema>) => {
    setIsSubmittingRegistration(true);
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      setRegisteredUser(userCredential.user);
      clientDetailsForm.setValue('email', userCredential.user.email || ''); // Pre-fill email for next step
      setRegistrationStep('details');
      toast({ title: "Cuenta Creada", description: "Por favor, completa tus datos para finalizar." });
    } catch (error: any) {
      console.error("Error en registro de Firebase Auth:", error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("Este correo electrónico ya está registrado. Intenta iniciar sesión o usa otro correo.");
      } else if (error.code === 'auth/weak-password') {
        setAuthError("La contraseña es demasiado débil. Debe tener al menos 6 caracteres.");
      } else {
        setAuthError("Error al crear la cuenta: " + error.message);
      }
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
      toast({ title: "Error", description: "Usuario no registrado o archivo no válido.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    const storagePath = `client_initial_documents/${registeredUser.uid}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => setState(prev => ({ ...prev, progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
      (error) => {
        console.error(`Error al subir ${fileType}:`, error);
        setState(prev => ({ ...prev, isUploading: false, error: error.message, progress: 0 }));
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta' : 'contrato'}`, description: error.message, variant: 'destructive' });
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
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta subida' : 'Contrato subido'}`, description: `${file.name} subido.` });
      }
    );
  }, [registeredUser, toast, clientDetailsForm]);


  const handleClientDetailsSubmit = async (values: z.infer<typeof publicClientSchema>) => {
    if (!registeredUser || !registeredUser.email) {
      setFormError("Error: No se pudo obtener la información del usuario registrado.");
      return;
    }
    setIsSubmittingDetails(true);
    setFormError(null);

    const formDataForAction = {
      ...values,
      email: registeredUser.email, // Asegurar que el email del usuario registrado se envía
      // Las URLs de los archivos ya están en 'values' a través de clientDetailsForm.setValue
    };

    try {
      const result = await selfRegisterClientAction(formDataForAction);
      if (result.success) {
        toast({ title: "¡Registro Completado!", description: "Gracias por registrarte. Nos pondremos en contacto pronto." });
        setRegistrationStep('completed');
      } else {
        setFormError(result.generalError || "Error al guardar tus datos. " + (result.errors ? JSON.stringify(result.errors) : ''));
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && messages.length > 0) {
              clientDetailsForm.setError(field as keyof PublicClientFormData, { type: 'manual', message: messages[0] });
            }
          });
        }
      }
    } catch (error: any) {
      console.error("Error en submit de detalles:", error);
      setFormError("Ocurrió un error inesperado: " + error.message);
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  if (registrationStep === 'completed') {
    return (
      <Card className="w-full max-w-md text-center p-8">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <CardTitle className="text-2xl font-bold">¡Gracias por Registrarte en {appName}!</CardTitle>
        <CardDescription className="mt-2">
          Hemos recibido tu información. Si es necesario, nuestro equipo se pondrá en contacto contigo pronto.
        </CardDescription>
      </Card>
    );
  }
  
  if (registrationStep === 'error') {
    return (
       <Card className="w-full max-w-md text-center p-8">
        <XCircle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <CardTitle className="text-2xl font-bold">Error en el Registro</CardTitle>
        <CardDescription className="mt-2">
          {formError || "Ocurrió un error inesperado. Por favor, intenta más tarde o contacta a soporte."}
        </CardDescription>
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
        {registrationStep === 'initial' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleUserRegistration)} className="space-y-6">
              {authError && <Alert variant="destructive"><AlertTitle>Error de Registro</AlertTitle><AlertDescription>{authError}</AlertDescription></Alert>}
              <FormField control={registrationForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={isSubmittingRegistration}>
                {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cuenta y Continuar
              </Button>
            </form>
          </Form>
        )}

        {registrationStep === 'details' && registeredUser && (
          <Form {...clientDetailsForm}>
            <form onSubmit={clientDetailsForm.handleSubmit(handleClientDetailsSubmit)} className="space-y-8">
              {formError && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert>}
              
              <p className="text-sm text-muted-foreground">Cuenta creada para: <strong>{registeredUser.email}</strong>. Por favor, completa los siguientes detalles.</p>
              <Separator />

              <Card>
                <CardHeader><CardTitle className="text-lg">Información Personal</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle className="text-lg">Detalles del Contrato/Servicio</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                      <FormItem><FormLabel>Valor del Contrato/Servicio (antes de IVA)</FormLabel><FormControl>
                        <Input type="number" step="0.01" placeholder="1000000" {...field} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                      </FormControl><FormMessage /></FormItem>)} 
                  />
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                      <FormItem><FormLabel>Plan de Financiación</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                          <SelectContent>{Object.keys(financingOptions).length > 0 ? 
                              Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>))
                              : <SelectItem value="0" disabled>Cargando planes...</SelectItem>}
                          </SelectContent></Select><FormMessage />
                      </FormItem>)}
                  />
                   {showFinancingDetails && (watchedContractValue ?? 0) > 0 && (
                    <Card className="bg-muted/30 p-4 my-4">
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-md">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                      <CardContent className="p-0 space-y-1 text-xs">
                        <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                        <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                        <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                        <div className="flex justify-between"><span>Saldo a Financiar:</span> <strong className="text-sm">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                        {Number(watchedFinancingPlan) !== 0 && (
                          <>
                            <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                            <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                            <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                            <hr className="my-1"/>
                            <div className="flex justify-between text-sm"><span>Valor Cuota Mensual ({watchedFinancingPlan} meses):</span> <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong></div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                      <FormItem><FormLabel>Día de Pago Preferido de la Cuota</FormLabel><FormControl>
                          <Input type="number" min="1" max="31" placeholder="15" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                        </FormControl><FormDescription>Día (1-31) en que se generará el cobro mensual.</FormDescription><FormMessage />
                      </FormItem>)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Documentos (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FileInputField
                        id="contractFile-public-input"
                        label="Contrato Firmado (PDF, JPG, PNG)"
                        fileState={contractFileState}
                        onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)}
                        disabled={isSubmittingDetails || contractFileState.isUploading}
                    />
                    <FileInputField
                        id="acceptanceLetter-public-input"
                        label="Carta de Aceptación (PDF, JPG, PNG)"
                        fileState={acceptanceLetterState}
                        onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)}
                        disabled={isSubmittingDetails || acceptanceLetterState.isUploading}
                    />
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={isSubmittingDetails || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {isSubmittingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Información del Cliente
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
