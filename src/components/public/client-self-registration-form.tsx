
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
import React, { useEffect, useState, useCallback } from 'react';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

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
import { registrationSchema, publicClientSchema } from '@/lib/schema';
import type { PublicClientFormData } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon, Info } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const searchParams = useSearchParams(); // For reading URL query parameters
  const { toast } = useToast();

  const [registrationStep, setRegistrationStep] = useState<'initial' | 'details' | 'completed'>('initial');
  const [registeredUser, setRegisteredUser] = useState<FirebaseUser | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);
  const [appName, setAppName] = useState('RecurPay');
  const [applyIvaForThisRegistration, setApplyIvaForThisRegistration] = useState(true);

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
        const [options, settings] = await Promise.all([
          getFinancingOptionsMap(),
          getGeneralSettings()
        ]);
        setFinancingOptions(options);
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
      } catch (error) {
        console.error("Error fetching initial data for self-registration:", error);
        toast({ title: "Error", description: "No se pudieron cargar las opciones de financiación.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadInitialData();

    const applyIvaParam = searchParams.get('applyIva');
    if (applyIvaParam === 'false') {
      setApplyIvaForThisRegistration(false);
    } else {
      setApplyIvaForThisRegistration(true); // Default to true if param is missing, 'true', or invalid
    }
  }, [toast, searchParams]);

  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<Omit<PublicClientFormData, 'email' | 'applyIva'>>({
    resolver: zodResolver(publicClientSchema.omit({ email: true, applyIva: true })), // Email will come from registeredUser, applyIva from state
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      contractValue: 0,
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
    const contractValRaw = clientDetailsForm.getValues('contractValue');
    const financingPlanKeyRaw = clientDetailsForm.getValues('financingPlan');

    let cv = typeof contractValRaw === 'number' ? contractValRaw : 0;
    let financingPlanKey = typeof financingPlanKeyRaw === 'number' ? financingPlanKeyRaw : 0;

    const currentIvaRate = applyIvaForThisRegistration && cv > 0 ? IVA_RATE : 0;
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const amountToFinance = totalWithIva; // No down payment in self-registration

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
    } else if (cv > 0 && financingPlanKey === 0) { // Contract value but no financing plan
      monthlyInstallment = totalWithIva; // Single payment of the total
    } else if (cv === 0) {
      monthlyInstallment = 0; // No contract, so no payment calculated here.
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
  }, [watchedContractValue, watchedFinancingPlan, financingOptions, clientDetailsForm, applyIvaForThisRegistration]);

  const handleUserRegistration = async (values: z.infer<typeof registrationSchema>) => {
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      setRegisteredUser(userCredential.user);
      setRegistrationStep('details');
      clientDetailsForm.reset(); // Reset details form for the new user
      setAcceptanceLetterState(initialFileUploadState); // Reset file states
      setContractFileState(initialFileUploadState);
      toast({ title: "Cuenta Creada", description: "Por favor, completa los detalles de tu contrato." });
    } catch (error: any) {
      console.error("Error de registro de Firebase:", error);
      let message = "Ocurrió un error al crear tu cuenta.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Esta dirección de correo electrónico ya está en uso. Por favor, intenta con otra.";
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
    if (!file) return;
    if (!registeredUser || !registeredUser.uid) {
      toast({ title: "Error", description: "No se pudo obtener el identificador del usuario para la subida.", variant: "destructive" });
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    // Use clientUID for the path, ensuring files are client-specific
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
  }, [clientDetailsForm, toast, registeredUser]);

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
            disabled={fileState.isUploading || isSubmittingDetails || disabled}
          />
        </div>
      </FormControl>
      {fileState.isUploading && (
        <div className="mt-2">
          <Progress value={fileState.progress} className="w-full h-2" />
          <p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.name} ({fileState.progress.toFixed(0)}%)</p>
        </div>
      )}
      {fileState.url && !fileState.isUploading && fileState.name && (
        <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 size={16} /> ¡{fileState.name} subido con éxito!
        </div>
      )}
      {fileState.error && !fileState.isUploading && (
        <div className="mt-2 text-sm text-destructive flex items-center gap-1">
          <XCircle size={16} /> {fileState.error}
        </div>
      )}
      <FormMessage />
    </FormItem>
  );

  const handleClientDetailsSubmit = async (values: Omit<PublicClientFormData, 'email' | 'applyIva'>) => {
    if (!registeredUser || !registeredUser.email) {
      setDetailsError("Error: No se pudo obtener la información del usuario registrado.");
      toast({ title: "Error de Usuario", description: "No se pudo obtener la información del usuario registrado. Por favor, intente registrarse de nuevo.", variant: "destructive" });
      return;
    }
    setIsSubmittingDetails(true);
    setDetailsError(null);

    const dataToSubmit: PublicClientFormData = {
      ...values,
      email: registeredUser.email,
      applyIva: applyIvaForThisRegistration, // Pass the determined IVA status
      // URLs and names are already set in 'values' by RHF via clientDetailsForm.setValue
      acceptanceLetterUrl: clientDetailsForm.getValues('acceptanceLetterUrl'),
      acceptanceLetterFileName: clientDetailsForm.getValues('acceptanceLetterFileName'),
      contractFileUrl: clientDetailsForm.getValues('contractFileUrl'),
      contractFileName: clientDetailsForm.getValues('contractFileName'),
    };

    try {
      const result = await selfRegisterClientAction(dataToSubmit);
      if (result.success) {
        toast({ title: "¡Registro Exitoso!", description: "Tu información ha sido enviada. Gracias por registrarte." });
        setRegistrationStep('completed');
      } else {
        setDetailsError(result.generalError || "Ocurrió un error al guardar tu información.");
        toast({ title: "Error al Guardar", description: result.generalError || "No se pudo guardar tu información. Por favor, revisa los campos.", variant: "destructive" });
      }
    } catch (error) {
      setDetailsError("Ocurrió un error inesperado.");
      toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado al procesar tu solicitud.", variant: "destructive" });
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  if (registrationStep === 'completed') {
    return (
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">¡Gracias por Registrarte!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <p>Tu información ha sido enviada con éxito.</p>
          <p>Recibirás más detalles pronto o serás contactado por un asesor de {appName}.</p>
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
        <CardDescription className="text-center">
          {registrationStep === 'initial'
            ? "Crea tu cuenta para gestionar tus servicios y pagos de forma segura."
            : "Ingresa los detalles de tu contrato y selecciona tu plan de financiación."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {registrationStep === 'initial' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleUserRegistration)} className="space-y-8">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>¡Bienvenido/a!</AlertTitle>
                <AlertDescription>
                  Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil,
                  consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
                </AlertDescription>
              </Alert>
              <FormField control={registrationForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl><Input type="email" placeholder="tu@correo.com" {...field} disabled={isSubmittingRegistration} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl><Input type="password" placeholder="********" {...field} disabled={isSubmittingRegistration} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl><Input type="password" placeholder="********" {...field} disabled={isSubmittingRegistration} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {registrationError && <p className="text-sm font-medium text-destructive">{registrationError}</p>}
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
              <Card>
                <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} disabled={isSubmittingDetails} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} disabled={isSubmittingDetails} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Correo Electrónico (registrado)</FormLabel>
                    <FormControl><Input type="email" value={registeredUser.email || ''} readOnly disabled /></FormControl>
                  </FormItem>
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} disabled={isSubmittingDetails} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Detalles del Contrato y Financiación</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                   <Alert variant={applyIvaForThisRegistration ? "default" : "destructive"}>
                      <Info className="h-4 w-4" />
                      <AlertTitle>{applyIvaForThisRegistration ? "IVA Incluido" : "Contrato Exento de IVA"}</AlertTitle>
                      <AlertDescription>
                        {applyIvaForThisRegistration
                          ? `Los cálculos de este contrato incluirán un ${IVA_RATE * 100}% de IVA.`
                          : "Este contrato ha sido configurado como exento de IVA. Los cálculos no incluirán IVA."}
                      </AlertDescription>
                    </Alert>
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor del Contrato/Servicio</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="1000000"
                          {...field}
                          value={String(field.value ?? "")}
                          onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === "" ? undefined : parseFloat(val));
                          }}
                          disabled={isSubmittingDetails}
                        />
                      </FormControl>
                      <FormDescription>Ingrese el valor base antes de IVA y financiación.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan de Financiación</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value ?? '0')} disabled={isLoadingFinancingOptions || isSubmittingDetails || (watchedContractValue ?? 0) === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {isLoadingFinancingOptions ? (
                            <SelectItem value="loading" disabled>Cargando planes...</SelectItem>
                          ) : Object.keys(financingOptions).length > 0 ? (
                            Object.entries(financingOptions).map(([key, option]) => (
                              <SelectItem key={key} value={key} disabled={key === "0" && (watchedContractValue ?? 0) === 0}>
                                {option.label} {key !== "0" && option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="0" disabled>No hay planes configurados.</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>{(watchedContractValue ?? 0) === 0 ? "Ingrese un valor de contrato para activar los planes." : "Seleccione un plan si desea financiar."}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {(watchedContractValue ?? 0) > 0 && (
                    <Card className="bg-muted/30">
                      <CardHeader><CardTitle className="text-base">Resumen (Calculado)</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                        {applyIvaForThisRegistration && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>}
                        <div className="flex justify-between"><span>Total {applyIvaForThisRegistration ? "con IVA" : "Contrato"}:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                        <hr />
                        <div className="flex justify-between"><span>Saldo a Pagar/Financiar:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                        {(watchedFinancingPlan ?? 0) !== 0 && (
                          <>
                            <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                            <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                            <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                          </>
                        )}
                        <hr />
                        <div className="flex justify-between text-md">
                          <span>{ (watchedContractValue ?? 0) > 0 && (watchedFinancingPlan ?? 0) === 0 ? "Monto Total Pago Único:" : ((watchedFinancingPlan ?? 0) !== 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : "Monto de Pago:")}</span>
                          <strong className="text-primary">
                            { (watchedContractValue ?? 0) > 0 && (watchedFinancingPlan ?? 0) === 0
                                ? formatCurrency(calculatedValues.totalWithIva)
                                : formatCurrency(calculatedValues.monthlyInstallment)
                            }
                          </strong>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de Pago Preferido del Mes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1" max="31"
                          placeholder="15"
                           {...field}
                           value={String(field.value ?? "")}
                           onChange={e => {
                             const val = e.target.value;
                             field.onChange(val === "" ? undefined : parseInt(val, 10));
                           }}
                          disabled={isSubmittingDetails}
                        />
                      </FormControl>
                      <FormDescription>Día (1-31) en que se generará el cobro de su cuota mensual.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

               <Card>
                <CardHeader><CardTitle className="text-xl">Documentos Requeridos</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <FileInputField
                        id="acceptanceLetter-file-input-public"
                        label="Carta de Aceptación del Contrato"
                        fileState={acceptanceLetterState}
                        onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)}
                        disabled={isSubmittingDetails}
                    />
                    <FileInputField
                        id="contractFile-file-input-public"
                        label="Contrato Firmado"
                        fileState={contractFileState}
                        onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)}
                        disabled={isSubmittingDetails}
                    />
                </CardContent>
               </Card>

              {detailsError && <p className="text-sm font-medium text-destructive">{detailsError}</p>}
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
