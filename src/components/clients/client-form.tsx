
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase'; 

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
import { Switch } from "@/components/ui/switch"; // Import Switch
import { useToast } from '@/hooks/use-toast';
import { clientSchema } from '@/lib/schema';
import type { Client, ClientFormData } from '@/types';
import { createClientAction, updateClientAction } from '@/app/actions/clientActions';
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon } from 'lucide-react';
import { IVA_RATE, PAYMENT_METHODS } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store'; 
import { formatCurrency } from '@/lib/utils';

type ClientFormProps = {
  client?: Client;
  isEditMode: boolean;
};

type FinancingOptionsMapType = { [key: number]: { rate: number; label: string } };

type CalculatedValues = {
  ivaAmount: number;
  totalWithIva: number;
  calculatedDownPayment: number; 
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

const CONTRACT_VALUE_THRESHOLD = 1000000;
const MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT = 20;

export function ClientForm({ client, isEditMode }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>({...initialFileUploadState, url: client?.acceptanceLetterUrl || null, name: client?.acceptanceLetterFileName || null });
  const [contractFileState, setContractFileState] = useState<FileUploadState>({...initialFileUploadState, url: client?.contractFileUrl || null, name: client?.contractFileName || null});
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});
  const [isLoadingFinancingOptions, setIsLoadingFinancingOptions] = useState(true);

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    ivaAmount: 0,
    totalWithIva: 0,
    calculatedDownPayment: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    monthlyInstallment: 0,
  });

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: client?.firstName || '',
      lastName: client?.lastName || '',
      email: client?.email || '',
      phoneNumber: client?.phoneNumber || '',
      contractValue: client?.contractValue ?? undefined,
      applyIva: client?.applyIva === undefined ? true : client.applyIva, // Default to true
      downPaymentPercentage: client?.downPaymentPercentage ?? undefined,
      paymentMethod: client?.paymentMethod || PAYMENT_METHODS[0],
      financingPlan: client?.financingPlan ?? 0,
      paymentDayOfMonth: client?.paymentDayOfMonth || 1,
      paymentAmount: client?.paymentAmount ?? undefined,
      acceptanceLetterUrl: client?.acceptanceLetterUrl || undefined,
      acceptanceLetterFileName: client?.acceptanceLetterFileName || undefined,
      contractFileUrl: client?.contractFileUrl || undefined,
      contractFileName: client?.contractFileName || undefined,
    },
  });

  const watchedContractValue = form.watch('contractValue');
  const watchedDownPaymentPercentage = form.watch('downPaymentPercentage');
  const watchedFinancingPlan = form.watch('financingPlan');
  const watchedApplyIva = form.watch('applyIva'); // Watch the new applyIva field

  const isContractValueBelowThreshold = (watchedContractValue ?? 0) < CONTRACT_VALUE_THRESHOLD;

  useEffect(() => {
    async function loadFinancingOptions() {
      setIsLoadingFinancingOptions(true);
      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching financing options for form:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las opciones de financiación.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingFinancingOptions(false);
      }
    }
    loadFinancingOptions();
  }, [toast]);

  useEffect(() => {
    const cv = form.getValues('contractValue') ?? 0;
    if (cv < CONTRACT_VALUE_THRESHOLD) {
      if (form.getValues('financingPlan') !== 0) {
        form.setValue('financingPlan', 0, { shouldValidate: true });
      }
      if (form.getValues('downPaymentPercentage') !== 0 && form.getValues('downPaymentPercentage') !== undefined) {
        form.setValue('downPaymentPercentage', 0, { shouldValidate: true });
      }
    }
  }, [watchedContractValue, form]);


  useEffect(() => {
    const contractValRaw = form.getValues('contractValue');
    const downPaymentPercRaw = form.getValues('downPaymentPercentage');
    const financingPlanKeyRaw = form.getValues('financingPlan');
    const applyIvaFlag = form.getValues('applyIva') ?? true; // Default to true

    let cv = typeof contractValRaw === 'number' ? contractValRaw : 0;
    let dpPerc = typeof downPaymentPercRaw === 'number' ? downPaymentPercRaw : 0;
    let financingPlanKey = typeof financingPlanKeyRaw === 'number' ? financingPlanKeyRaw : 0;
    
    if (cv < CONTRACT_VALUE_THRESHOLD) {
      financingPlanKey = 0;
      dpPerc = 0;
    } else { 
      if (dpPerc !==0 && dpPerc < MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT) {
        // Zod will handle the validation error if dpPerc is between 1 and 19.
        // For calculation, we proceed with the user's value, Zod catches it.
      }
    }

    const currentIvaRate = applyIvaFlag && cv > 0 ? IVA_RATE : 0; // Apply IVA only if flag is true and contract value exists
    const ivaAmount = cv * currentIvaRate;
    const totalWithIva = cv + ivaAmount;
    const calculatedDownPayment = totalWithIva * (dpPerc / 100);
    const amountToFinance = Math.max(0, totalWithIva - calculatedDownPayment);

    let financingInterestRateApplied = 0;
    let financingInterestAmount = 0;
    let totalAmountWithInterest = 0;
    let monthlyInstallment = 0;
    let finalPaymentAmountForForm = form.getValues('paymentAmount');

    if (cv < CONTRACT_VALUE_THRESHOLD && cv > 0) {
      financingPlanKey = 0; 
      dpPerc = 0; 
      monthlyInstallment = totalWithIva; 
      finalPaymentAmountForForm = totalWithIva;
      form.setValue('paymentAmount', parseFloat(totalWithIva.toFixed(2)), { shouldValidate: true });
    } else if (financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0 && financingOptions[financingPlanKey]) {
      const planDetails = financingOptions[financingPlanKey];
      financingInterestRateApplied = planDetails.rate;
      financingInterestAmount = amountToFinance * financingInterestRateApplied;
      totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
      monthlyInstallment = numberOfMonths > 0 ? parseFloat((totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
      finalPaymentAmountForForm = monthlyInstallment;
      form.setValue('paymentAmount', monthlyInstallment, { shouldValidate: true });
    } else if (financingPlanKey === 0 && cv > 0) {
      if (dpPerc === 100) {
        finalPaymentAmountForForm = 0;
        form.setValue('paymentAmount', 0, { shouldValidate: true });
      } else if (amountToFinance > 0 && (form.getValues('paymentAmount') === undefined || form.getValues('paymentAmount') === 0) ) {
        // If there's an amount to finance and no payment amount is set, it implies a single payment of the remainder
        // This scenario might need more clarification. For now, if no financing plan, paymentAmount is user-driven unless 100% DP.
        // Or, if we want to enforce that if no financing, paymentAmount = amountToFinance:
        // finalPaymentAmountForForm = amountToFinance;
        // form.setValue('paymentAmount', parseFloat(amountToFinance.toFixed(2)), { shouldValidate: true });
      }
      monthlyInstallment = 0; 
    } else if (cv === 0) {
        monthlyInstallment = 0;
        // For services without contract value, paymentAmount is user-defined.
        // Zod schema ensures it's > 0 if no contract.
    }


    setCalculatedValues({
      ivaAmount,
      totalWithIva,
      calculatedDownPayment,
      amountToFinance,
      financingInterestRateApplied,
      financingInterestAmount,
      totalAmountWithInterest,
      monthlyInstallment, 
    });

  }, [watchedContractValue, watchedDownPaymentPercentage, watchedFinancingPlan, watchedApplyIva, form, financingOptions]);


  const handleFileUpload = useCallback(async (
    file: File,
    fileType: 'acceptanceLetter' | 'contractFile',
    setState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    if (!file) return;

    const isEmailValid = await form.trigger("email");
    if (!isEmailValid) {
      toast({
        title: "Correo Electrónico Requerido",
        description: "Por favor, ingrese un correo electrónico válido para el cliente antes de subir archivos.",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, file: null, isUploading: false, error: "Se requiere correo para la ruta de subida." }));
      const fileInput = document.getElementById(`${fileType}-file-input-admin`) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      return;
    }
    
    const clientEmail = form.getValues("email");
    if (!clientEmail) {
        toast({ title: "Error", description: "El correo electrónico del cliente no puede estar vacío para subir archivos.", variant: "destructive" });
        setState(prev => ({ ...prev, file: null, error: "Email vacío" }));
        return;
    }

    if (!auth.currentUser) {
      toast({ title: "Error de Autenticación", description: "No hay un administrador autenticado para realizar la subida.", variant: "destructive" });
      setState(prev => ({ ...prev, file: null, error: "No autenticado" }));
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null, name: file.name }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    const clientIdentifier = clientEmail.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storagePath = `client_documents/${clientIdentifier}/${uniqueFileName}`;
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
          form.setValue('acceptanceLetterUrl', downloadURL, { shouldValidate: true });
          form.setValue('acceptanceLetterFileName', file.name, { shouldValidate: true });
        } else if (fileType === 'contractFile') {
          form.setValue('contractFileUrl', downloadURL, { shouldValidate: true });
          form.setValue('contractFileName', file.name, { shouldValidate: true });
        }
        toast({ title: `${fileType === 'acceptanceLetter' ? 'Carta de aceptación subida' : 'Contrato subido'}`, description: `${file.name} subido con éxito.` });
      }
    );
  }, [form, toast]);


  async function onSubmit(values: z.infer<typeof clientSchema>) {
    setIsSubmitting(true);

    let finalContractValue = values.contractValue ?? 0;
    let finalPaymentAmount = values.paymentAmount; // Start with form value
    const finalApplyIva = values.applyIva ?? true;

    if (finalContractValue < CONTRACT_VALUE_THRESHOLD && finalContractValue > 0) {
        const ivaRateForCalc = finalApplyIva ? IVA_RATE : 0;
        const iva = finalContractValue * ivaRateForCalc;
        finalPaymentAmount = finalContractValue + iva;
    } else if (values.financingPlan && values.financingPlan !== 0 && finalContractValue > 0 && Object.keys(financingOptions).length > 0) {
        finalPaymentAmount = parseFloat(calculatedValues.monthlyInstallment.toFixed(2));
    } else if (finalContractValue > 0 && values.financingPlan === 0 && (values.downPaymentPercentage ?? 0) === 100) {
        finalPaymentAmount = 0; // Fully paid by down payment
    }
    // If no contract and no financing, paymentAmount comes from user input (validated by Zod to be >0).
    // If contract >= 1M and no financing, and not 100% DP, paymentAmount is user-defined or might be totalAfterDownPayment. Zod handles if it's missing or <=0.

    const dataToSubmit: ClientFormData = {
      ...values,
      contractValue: finalContractValue,
      applyIva: finalApplyIva,
      downPaymentPercentage: finalContractValue < CONTRACT_VALUE_THRESHOLD ? 0 : (values.downPaymentPercentage ?? 0),
      financingPlan: finalContractValue < CONTRACT_VALUE_THRESHOLD ? 0 : (values.financingPlan ?? 0),
      paymentAmount: finalPaymentAmount, 
      acceptanceLetterUrl: acceptanceLetterState.url || values.acceptanceLetterUrl,
      acceptanceLetterFileName: acceptanceLetterState.name || values.acceptanceLetterFileName,
      contractFileUrl: contractFileState.url || values.contractFileUrl,
      contractFileName: contractFileState.name || values.contractFileName,
    };
    
    try {
      let result;
      if (isEditMode && client) {
        result = await updateClientAction(client.id, dataToSubmit as any);
      } else {
        result = await createClientAction(dataToSubmit as any);
      }

      if (result.success) {
        toast({
          title: isEditMode ? 'Cliente Actualizado' : 'Cliente Creado',
          description: `El cliente ${values.firstName} ${values.lastName} ha sido ${isEditMode ? 'actualizado' : 'creado'} exitosamente.`,
        });
        router.push('/clients');
        router.refresh();
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && Array.isArray(messages) && messages.length > 0) {
                form.setError(field as keyof z.infer<typeof clientSchema>, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error',
          description: result.generalError || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente. Por favor, revise los campos.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error Inesperado',
        description: `Ocurrió un error. ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderNumberInput = (
    name: "contractValue" | "downPaymentPercentage" | "paymentAmount", 
    label: string, 
    placeholder: string, 
    description?: string,
    disabled: boolean = false,
    min?: number // Added min prop
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={name === "downPaymentPercentage" ? "1" : "0.01"}
              min={min !== undefined ? min : (name === "paymentAmount" ? "0" : "0.01")}
              placeholder={placeholder}
              value={String(field.value ?? "")} // Ensure value is always a string
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
              disabled={field.disabled || disabled || (name === "paymentAmount" && (isContractValueBelowThreshold || (watchedFinancingPlan !==0 && (watchedContractValue ?? 0) > 0)))}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
  
const FileInputField = ({
    id,
    fileState,
    onFileChange,
    existingFileUrl,
    existingFileName,
    label,
  }: {
    id: string;
    fileState: FileUploadState;
    onFileChange: (file: File) => void;
    existingFileUrl?: string;
    existingFileName?: string;
    label: string;
  }) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {existingFileUrl && !fileState.file && !fileState.isUploading &&(
        <div className="text-sm text-muted-foreground mb-2 p-2 border rounded-md">
          Archivo actual: <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon size={14}/> {existingFileName || 'Ver archivo'}</a>
        </div>
      )}
      <FormControl>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="file"
            onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
            className="flex-grow"
            disabled={fileState.isUploading || isSubmitting}
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
      {fileState.error && !fileState.isUploading &&(
        <div className="mt-2 text-sm text-destructive flex items-center gap-1">
          <XCircle size={16} /> {fileState.error === "Se requiere correo para la ruta de subida." ? "Se requiere correo para la ruta de subida." : fileState.error}
        </div>
      )}
      <FormMessage />
    </FormItem>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</CardTitle>
        <CardDescription>
          {isEditMode ? 'Actualice los detalles del cliente.' : 'Ingrese los detalles para el nuevo cliente.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle className="text-xl">Información Personal</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="juan.perez@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Información del Contrato y Financiación</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {renderNumberInput("contractValue", "Valor del Contrato", "1000000", undefined, false, 0.01)}
                
                <FormField
                  control={form.control}
                  name="applyIva"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Aplicar IVA ({(IVA_RATE * 100).toFixed(0)}%) al Contrato</FormLabel>
                        <FormDescription>
                          Active esta opción para incluir el IVA en el valor total del contrato.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {renderNumberInput(
                  "downPaymentPercentage", 
                  "Porcentaje de Abono (%)", 
                  isContractValueBelowThreshold ? "0" : String(MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT), 
                  isContractValueBelowThreshold 
                    ? "No se acepta abono para contratos menores a $1,000,000."
                    : `Ingrese 0 si no hay abono, o un valor entre ${MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT} y 100 para contratos >= $1,000,000.`,
                  isContractValueBelowThreshold,
                  0 // min value for the input field itself
                )}
                
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormLabel>Medio de Pago (Abono/Contrato)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un medio de pago" /></SelectTrigger></FormControl>
                        <SelectContent>{PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select><FormMessage />
                    </FormItem>)}
                />
                <FormField control={form.control} name="financingPlan" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plan de Financiación</FormLabel>
                        <Select 
                            onValueChange={(value) => field.onChange(Number(value))} 
                            value={String(field.value)}
                            disabled={isLoadingFinancingOptions || isContractValueBelowThreshold}
                        >
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {isLoadingFinancingOptions ? (
                                <SelectItem value="loading" disabled>Cargando planes...</SelectItem>
                            ) : Object.keys(financingOptions).length > 0 ? 
                                Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {key !== "0" && option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>))
                                : <SelectItem value="0" disabled>No hay planes configurados.</SelectItem>}
                             <SelectItem value="0">Sin financiación</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormDescription>
                            {isContractValueBelowThreshold 
                                ? "No se ofrece financiación para contratos menores a $1,000,000."
                                : "Las tasas de interés deben ajustarse a la ley."
                            }
                        </FormDescription>
                        <FormMessage />
                    </FormItem>)}
                />
              </CardContent>
            </Card>
            
            {(watchedContractValue ?? 0) > 0 && (
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                  { (form.getValues('applyIva') ?? true) && <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div> }
                  <div className="flex justify-between"><span>Total { (form.getValues('applyIva') ?? true) ? 'con IVA' : 'Contrato' }:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                  {!isContractValueBelowThreshold && <div className="flex justify-between"><span>Abono ({form.getValues('downPaymentPercentage') || 0}% del Total { (form.getValues('applyIva') ?? true) ? 'con IVA' : 'Contrato' }):</span> <strong>{formatCurrency(calculatedValues.calculatedDownPayment)}</strong></div>}
                  <hr/>
                  <div className="flex justify-between"><span>Saldo a {isContractValueBelowThreshold ? 'Pagar (Total)' : 'Financiar'}:</span> <strong className="text-base">{formatCurrency(calculatedValues.amountToFinance)}</strong></div>
                  {!isContractValueBelowThreshold && watchedFinancingPlan !== 0 && (
                    <>
                      <div className="flex justify-between"><span>Tasa Interés Aplicada:</span> <strong>{(calculatedValues.financingInterestRateApplied * 100).toFixed(2)}%</strong></div>
                      <div className="flex justify-between"><span>Monto Intereses Financiación:</span> <strong>{formatCurrency(calculatedValues.financingInterestAmount)}</strong></div>
                      <div className="flex justify-between"><span>Total a Pagar (Financiado):</span> <strong>{formatCurrency(calculatedValues.totalAmountWithInterest)}</strong></div>
                    </>
                  )}
                  <hr/>
                  <div className="flex justify-between text-lg">
                    <span>{isContractValueBelowThreshold ? 'Monto Total a Pagar (Pago Único):' : (watchedFinancingPlan !== 0 ? `Valor Cuota Mensual (${watchedFinancingPlan} meses):` : 'Monto de Pago (según configuración):')}</span> 
                    <strong className="text-primary">
                        {isContractValueBelowThreshold 
                            ? formatCurrency(calculatedValues.totalWithIva)
                            : (watchedFinancingPlan !== 0 ? formatCurrency(calculatedValues.monthlyInstallment) : formatCurrency(form.getValues('paymentAmount') ?? 0))
                        }
                    </strong>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-xl">Configuración de Pago Mensual</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="paymentDayOfMonth" render={({ field }) => (
                    <FormItem><FormLabel>Día de Pago de la Cuota del Mes</FormLabel>
                        <FormControl><Input type="number" min="1" max="31" placeholder="15" 
                            value={String(field.value ?? "")} // Ensure value is always a string
                            onChange={e => {
                              const val = e.target.value;
                              if (val === "") {
                                field.onChange(undefined);
                              } else {
                                const num = parseInt(val, 10);
                                field.onChange(isNaN(num) ? undefined : num);
                              }
                            }}
                         /></FormControl>
                        <FormDescription>Día (1-31) en que se generará el cobro de la cuota mensual.</FormDescription><FormMessage />
                    </FormItem>)}
                />
                {renderNumberInput(
                  "paymentAmount", 
                  isContractValueBelowThreshold ? "Monto Total del Contrato (calculado)" : (watchedFinancingPlan !== 0 && (watchedContractValue ?? 0) > 0 ? "Cuota Mensual (calculada)" : "Monto de Pago Recurrente"), 
                  "50000", 
                  (isContractValueBelowThreshold || (watchedFinancingPlan !== 0 && (watchedContractValue ?? 0) > 0)) 
                    ? "Este valor es calculado automáticamente." 
                    : "Si no hay financiación o contrato, ingrese el monto del servicio recurrente. Si hay contrato sin financiación y no es 100% abonado, ingrese el saldo a pagar o la cuota de servicio.",
                  (isContractValueBelowThreshold || (watchedFinancingPlan !== 0 && (watchedContractValue ?? 0) > 0)), // disabled if calculated
                  0 // min value
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">Documentos del Cliente</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FileInputField
                  id="acceptanceLetter-file-input-admin"
                  label="Carta de Aceptación del Contrato"
                  fileState={acceptanceLetterState}
                  onFileChange={(file) => handleFileUpload(file, 'acceptanceLetter', setAcceptanceLetterState)}
                  existingFileUrl={client?.acceptanceLetterUrl}
                  existingFileName={client?.acceptanceLetterFileName}
                />
                <FileInputField
                  id="contractFile-file-input-admin"
                  label="Contrato Firmado"
                  fileState={contractFileState}
                  onFileChange={(file) => handleFileUpload(file, 'contractFile', setContractFileState)}
                  existingFileUrl={client?.contractFileUrl}
                  existingFileName={client?.contractFileName}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || acceptanceLetterState.isUploading || contractFileState.isUploading}>
                {(isSubmitting || acceptanceLetterState.isUploading || contractFileState.isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Guardar Cambios' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

