
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { createUserWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
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
import { useToast } from '@/hooks/use-toast';
import { registrationSchema, basePublicClientObjectSchema } from '@/lib/schema'; // Import base schema
import type { PublicClientFormData } from '@/types';
import { selfRegisterClientAction } from '@/app/actions/publicClientActions';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import { auth, storage } from '@/lib/firebase';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon, CreditCard } from 'lucide-react';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';
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
  file: null, progress: 0, url: null, name: null, error: null, isUploading: false
};

// Schema for the fields in the client details step of the form
const clientDetailsFormSpecificSchema = basePublicClientObjectSchema.pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  contractValue: true,
  financingPlan: true,
  paymentDayOfMonth: true,
  // Note: applyIva is not picked because its value comes from URL params.
  // File URLs/names are not picked because they are set programmatically after upload.
});
type ClientDetailsFormValues = z.infer<typeof clientDetailsFormSpecificSchema>;


export function ClientSelfRegistrationForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [registrationStep, setRegistrationStep] = useState<'initial' | 'details' | 'completed'>('initial');
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<FirebaseUser | null>(null);
  const [appName, setAppName] = useState('RecurPay');
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>(initialFileUploadState);
  const [contractFileState, setContractFileState] = useState<FileUploadState>(initialFileUploadState);

  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);

  const [applyIvaFromUrl, setApplyIvaFromUrl] = useState<boolean>(true);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0, totalWithIva: 0, amountToFinance: 0,
    financingInterestRateApplied: 0, financingInterestAmount: 0,
    totalAmountWithInterest: 0, monthlyInstallment: 0,
  });

  useEffect(() => {
    async function loadAppSettings() {
      setIsLoadingSettings(true);
      try {
        const settings = await fetchGeneralSettingsAction();
        setAppName(settings.appName || 'RecurPay');
        setAppLogoUrl(settings.appLogoUrl || null);
      } catch (error) {
        console.error("Error fetching app settings for self-registration:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadAppSettings();
  }, []);

  useEffect(() => {
    const applyIvaParam = searchParams.get('applyIva');
    setApplyIvaFromUrl(applyIvaParam !== 'false'); // Default to true if param is missing or not 'false'
  }, [searchParams]);

  useEffect(() => {
    async function loadFinancingOptions() {
      setIsLoadingFinancingOptions(true);
      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching financing options for self-reg form:", error);
        toast({ title: "Error", description: "No se pudieron cargar las opciones de financiación.", variant: "destructive" });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadFinancingOptions();
  }, [toast]);

  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const clientDetailsForm = useForm<ClientDetailsFormValues>({
    resolver: zodResolver(clientDetailsFormSpecificSchema),
    defaultValues: {
      firstName: '', lastName: '', phoneNumber: '',
      contractValue: 0, financingPlan: 0, paymentDayOfMonth: 1,
    },
  });

  const watchedContractValue = clientDetailsForm.watch('contractValue');
  const watchedFinancingPlan = clientDetailsForm.watch('financingPlan');

  useEffect(() => {
    const contractValRaw = clientDetailsForm.getValues('contractValue');
    const financingPlanKeyRaw = clientDetailsForm.getValues('financingPlan');

    let cv = typeof contractValRaw === 'number' ? contractValRaw : 0;
    let financingPlanKey = typeof financingPlanKeyRaw === 'number' ? financingPlanKeyRaw : 0;

    const currentIvaRate = applyIvaFromUrl && cv > 0 ? IVA_RATE : 0;
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
    } else if (cv > 0 && financingPlanKey === 0) { // Contract value, but no financing
      monthlyInstallment = totalWithIva; // Single payment
    }

    setCalculatedValues({
      ivaAmount, totalWithIva, amountToFinance,
      financingInterestRateApplied, financingInterestAmount,
      totalAmountWithInterest, monthlyInstallment,
    });
  }, [watchedContractValue, watchedFinancingPlan, applyIvaFromUrl, financingOptions, clientDetailsForm]);


  const handleUserRegistration = async (values: z.infer<typeof registrationSchema>) => {
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      setRegisteredUser(userCredential.user);
      clientDetailsForm.setValue('firstName', ''); // Reset just in case
      clientDetailsForm.setValue('lastName', '');
      setRegistrationStep('details');
      toast({ title: "Cuenta Creada", description: "Ahora, por favor completa tus datos contractuales." });
    } catch (error: any) {
      console.error("Error creating user:", error);
      setRegistrationError(error.message || "Error al crear la cuenta. Verifica tus datos.");
      toast({ title: "Error de Registro", description: error.message || "No se pudo crear la cuenta.", variant: "destructive" });
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
      toast({ title: "Error", description: "Debe crear su cuenta primero para subir archivos.", variant: "destructive" });
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
        console.error(`Error uploading ${fileType}:`, error);
        setState(prev => ({ ...prev, isUploading: false, error: error.message, progress: 0 }));
        toast({ title: `Error al subir ${fileType === 'acceptanceLetter' ? 'carta' : 'contrato'}`, description: error.message, variant: 'destructive' });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, progress: 100 }));
        if (fileType === 'acceptanceLetter') {
          clientDetailsForm.setValue('acceptanceLetterUrl' as any, downloadURL, { shouldValidate: true }); // For data submission
          clientDetailsForm.setValue('acceptanceLetterFileName' as any, file.name, { shouldValidate: true });
        } else if (fileType === 'contractFile') {
          clientDetailsForm.setValue('contractFileUrl' as any, downloadURL, { shouldValidate: true });
          clientDetailsForm.setValue('contractFileName' as any, file.name, { shouldValidate: true });
        }
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta subida' : 'Contrato subido'}`, description: `${file.name} subido con éxito.` });
      }
    );
  }, [registeredUser, toast, clientDetailsForm]);

  const handleClientDetailsSubmit = async (values: ClientDetailsFormValues) => {
    if (!registeredUser || !registeredUser.email) {
      setDetailsError("Error: Usuario no registrado. Por favor, complete el primer paso.");
      return;
    }
    setIsSubmittingDetails(true);
    setDetailsError(null);

    const fullFormData: PublicClientFormData = {
      ...values,
      email: registeredUser.email,
      applyIva: applyIvaFromUrl,
      acceptanceLetterUrl: acceptanceLetterState.url || undefined,
      acceptanceLetterFileName: acceptanceLetterState.name || undefined,
      contractFileUrl: contractFileState.url || undefined,
      contractFileName: contractFileState.name || undefined,
    };

    try {
      const result = await selfRegisterClientAction(fullFormData);
      if (result.success) {
        toast({ title: "Registro Completado", description: `¡Gracias ${values.firstName}! Tu información ha sido enviada.` });
        setRegistrationStep('completed');
      } else {
        setDetailsError(result.generalError || "Error al guardar los detalles. Revisa los campos.");
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && Array.isArray(messages) && messages.length > 0) {
              clientDetailsForm.setError(field as keyof ClientDetailsFormValues, { type: 'manual', message: messages[0] });
            }
          });
        }
        toast({ title: "Error", description: result.generalError || "No se pudo completar el registro.", variant: "destructive" });
      }
    } catch (error: any) {
      setDetailsError(error.message || "Ocurrió un error inesperado.");
      toast({ title: "Error Inesperado", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingDetails(false);
    }
  };


  const FileInputField = ({ id, fileState, onFileChange, label }: { id: string; fileState: FileUploadState; onFileChange: (file: File) => void; label: string; }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input id={id} type="file" onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])} disabled={fileState.isUploading || isSubmittingDetails || !registeredUser} />
      </FormControl>
      {fileState.isUploading && <Progress value={fileState.progress} className="w-full h-2 mt-1" />}
      {fileState.url && !fileState.isUploading && fileState.name && <p className="text-xs text-green-600 mt-1">¡{fileState.name} subido!</p>}
      {fileState.error && !fileState.isUploading && <p className="text-xs text-destructive mt-1">Error: {fileState.error}</p>}
      <FormMessage />
    </FormItem>
  );

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {registrationStep === 'initial' ? `Registro de Cuenta - ${appName}` : registrationStep === 'details' ? `Completa tus Datos - ${appName}` : `¡Gracias por Registrarte! - ${appName}`}
        </CardTitle>
        {appLogoUrl && (
          <div className="flex justify-center my-4">
            <Image src={appLogoUrl} alt={`${appName} Logo`} width={150} height={50} className="object-contain" unoptimized />
          </div>
        )}
        {!appLogoUrl && isLoadingSettings && <div className="flex justify-center my-4"><Loader2 className="h-10 w-10 animate-spin" /></div>}
        {!appLogoUrl && !isLoadingSettings && (
            <div className="flex justify-center my-4">
                <CreditCard className="h-10 w-10 text-primary" />
            </div>
        )}

        {registrationStep === 'initial' && (
          <CardDescription className="text-center">
            Con estos datos crearás tu cuenta personal, que te permitirá administrar tu perfil, consultar y validar el estado de tus pagos, y gestionar tus servicios de forma segura.
          </CardDescription>
        )}
        {registrationStep === 'details' && (
          <CardDescription className="text-center">
            Por favor, completa la información de tu contrato o servicio. El correo ya ha sido verificado.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {registrationStep === 'initial' && (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(handleUserRegistration)} className="space-y-6">
              <FormField control={registrationForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registrationForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>)} />
              {registrationError && <p className="text-sm text-destructive">{registrationError}</p>}
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
                <CardContent className="space-y-4">
                  <FormItem><FormLabel>Correo Electrónico (Verificado)</FormLabel><FormControl><Input type="email" value={registeredUser.email || ''} readOnly disabled className="bg-muted/50" /></FormControl></FormItem>
                  <FormField control={clientDetailsForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Detalles del Contrato/Servicio</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={clientDetailsForm.control} name="contractValue" render={({ field }) => (<FormItem><FormLabel>Valor del Contrato/Servicio</FormLabel><FormControl><Input type="number" min="0" step="any" placeholder="500000" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                  {applyIvaFromUrl ? <p className="text-sm text-muted-foreground">Se aplicará IVA (19%) al valor del contrato.</p> : <p className="text-sm text-muted-foreground">Este contrato estará exento de IVA.</p>}
                  <FormField control={clientDetailsForm.control} name="financingPlan" render={({ field }) => (
                      <FormItem><FormLabel>Plan de Financiación</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value ?? '0')} disabled={isLoadingFinancingOptions}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                          <SelectContent>
                              {isLoadingFinancingOptions ? <SelectItem value="loading" disabled>Cargando planes...</SelectItem> :
                                Object.entries(financingOptions).map(([key, option]) => <SelectItem key={key} value={key}>{option.label} {key !== "0" && option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>)}
                          </SelectContent></Select><FormMessage />
                      </FormItem>)} />
                  <FormField control={clientDetailsForm.control} name="paymentDayOfMonth" render={({ field }) => (<FormItem><FormLabel>Día de Pago Preferido del Mes</FormLabel><FormControl><Input type="number" min="1" max="31" placeholder="15" {...field} value={String(field.value ?? "")} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></FormControl><FormDescription>Día (1-31) para el cobro recurrente.</FormDescription><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              {(watchedContractValue ?? 0) > 0 && (
                <Card className="bg-muted/20">
                  <CardHeader><CardTitle className="text-lg">Resumen (Calculado)</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                    {applyIvaFromUrl && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>}
                    <div className="flex justify-between"><span>Total {applyIvaFromUrl ? 'con IVA' : 'Contrato'}:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                    <hr />
                    <div className="flex justify-between"><span>Saldo a {Number(watchedFinancingPlan) > 0 ? 'Financiar' : 'Pagar (Total)'}:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                    {Number(watchedFinancingPlan) > 0 && (
                      <>
                        <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                        <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                        <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                      </>
                    )}
                    <hr />
                    <div className="flex justify-between text-lg">
                      <span>{Number(watchedFinancingPlan) > 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : 'Monto Total a Pagar:'}</span>
                      <strong className="text-primary">{formatCurrency(calculatedValues.monthlyInstallment)}</strong>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                  <CardHeader><CardTitle className="text-xl">Documentos del Contrato</CardTitle><CardDescription>Por favor, sube los documentos requeridos.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                      <FileInputField id="selfRegAcceptanceLetter" fileState={acceptanceLetterState} onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)} label="Carta de Aceptación Firmada" />
                      <FileInputField id="selfRegContractFile" fileState={contractFileState} onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)} label="Contrato Firmado" />
                  </CardContent>
              </Card>

              {detailsError && <p className="text-sm text-destructive">{detailsError}</p>}
              <Button type="submit" className="w-full" disabled={isSubmittingDetails || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {isSubmittingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Información del Cliente
              </Button>
            </form>
          </Form>
        )}

        {registrationStep === 'completed' && (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h3 className="mt-4 text-xl font-semibold">¡Registro Exitoso!</h3>
            <p className="mt-2 text-muted-foreground">
              Gracias por registrarte en {appName}. Hemos recibido tu información. Pronto podrás acceder a tu perfil.
            </p>
            {/* Podrías añadir un botón para ir a una página de "Mis Contratos" o similar en el futuro */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
