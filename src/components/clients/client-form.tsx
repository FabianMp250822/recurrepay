'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from "@/components/ui/progress";
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

export function ClientForm({ client, isEditMode }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFinancingDetails, setShowFinancingDetails] = useState(false);

  const [acceptanceLetterState, setAcceptanceLetterState] = useState<FileUploadState>({...initialFileUploadState, url: client?.acceptanceLetterUrl || null, name: client?.acceptanceLetterFileName || null });
  const [contractFileState, setContractFileState] = useState<FileUploadState>({...initialFileUploadState, url: client?.contractFileUrl || null, name: client?.contractFileName || null});
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMapType>({});

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
      downPaymentPercentage: client?.downPaymentPercentage ?? undefined,
      paymentMethod: client?.paymentMethod || PAYMENT_METHODS[0],
      financingPlan: client?.financingPlan || 0,
      paymentDayOfMonth: client?.paymentDayOfMonth || 1,
      paymentAmount: client?.paymentAmount ?? undefined,
      acceptanceLetterUrl: client?.acceptanceLetterUrl || undefined,
      acceptanceLetterFileName: client?.acceptanceLetterFileName || undefined,
      contractFileUrl: client?.contractFileUrl || undefined,
      contractFileName: client?.contractFileName || undefined,
    },
  });

  useEffect(() => {
    async function loadFinancingOptions() {
      try {
        const options = await getFinancingOptionsMap();
        setFinancingOptions(options);
      } catch (error) {
        console.error("Error fetching financing options for form:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las opciones de financiación. Usando valores por defecto.",
          variant: "destructive",
        });
      }
    }
    loadFinancingOptions();
  }, [toast]);

  const watchedContractValue = form.watch('contractValue');
  const watchedDownPaymentPercentage = form.watch('downPaymentPercentage');
  const watchedFinancingPlan = form.watch('financingPlan');

  useEffect(() => {
    const contractVal = parseFloat(String(watchedContractValue));
    const downPaymentPerc = parseFloat(String(watchedDownPaymentPercentage));
    const financingPlanKey = Number(watchedFinancingPlan);

    let cv = isNaN(contractVal) ? 0 : contractVal;
    let dpPerc = isNaN(downPaymentPerc) ? 0 : dpPerc;

    const ivaAmount = cv * IVA_RATE;
    const totalWithIva = cv + ivaAmount;
    const calculatedDownPayment = totalWithIva * (dpPerc / 100);
    
    setShowFinancingDetails(financingPlanKey !== 0 && cv > 0 && Object.keys(financingOptions).length > 0);

    if (financingPlanKey !== 0 && cv > 0 && financingOptions[financingPlanKey]) {
      const amountToFinance = Math.max(0, totalWithIva - calculatedDownPayment);
      const planDetails = financingOptions[financingPlanKey];
      const interestRate = planDetails ? planDetails.rate : 0;
      const financingInterestAmount = amountToFinance * interestRate;
      const totalAmountWithInterest = amountToFinance + financingInterestAmount;
      const numberOfMonths = financingPlanKey;
      const monthlyInstallment = numberOfMonths > 0 ? totalAmountWithInterest / numberOfMonths : 0;

      setCalculatedValues({
        ivaAmount,
        totalWithIva,
        calculatedDownPayment,
        amountToFinance,
        financingInterestRateApplied: interestRate,
        financingInterestAmount,
        totalAmountWithInterest,
        monthlyInstallment,
      });
      form.setValue('paymentAmount', parseFloat(monthlyInstallment.toFixed(2)), { shouldValidate: true });
    } else {
      setCalculatedValues({
        ivaAmount: cv > 0 ? ivaAmount : 0,
        totalWithIva: cv > 0 ? totalWithIva : cv,
        calculatedDownPayment: cv > 0 ? calculatedDownPayment : 0,
        amountToFinance: Math.max(0, (cv > 0 ? totalWithIva : cv) - (cv > 0 ? calculatedDownPayment : 0)),
        financingInterestRateApplied: 0,
        financingInterestAmount: 0,
        totalAmountWithInterest: 0,
        monthlyInstallment: 0,
      });
    }
  }, [watchedContractValue, watchedDownPaymentPercentage, watchedFinancingPlan, form, financingOptions]);


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
        return;
    }

    if (!auth.currentUser) {
      toast({ title: "Error de Autenticación", description: "No hay un administrador autenticado para realizar la subida.", variant: "destructive" });
      return;
    }


    setState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null }));
    const uniqueFileName = `${fileType}_${Date.now()}_${file.name}`;
    const clientIdentifier = clientEmail.trim() ? clientEmail.trim().replace(/[^a-zA-Z0-9_.-]/g, '_') : 'unknown_client';
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
        setState(prev => ({ ...prev, isUploading: false, url: downloadURL, name: file.name, progress: 100 }));
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

    const dataToSubmit: ClientFormData = {
      ...values,
      contractValue: values.contractValue ?? 0,
      downPaymentPercentage: values.downPaymentPercentage ?? 0,
      financingPlan: values.financingPlan ?? 0,
      acceptanceLetterUrl: acceptanceLetterState.url || values.acceptanceLetterUrl,
      acceptanceLetterFileName: acceptanceLetterState.name || values.acceptanceLetterFileName,
      contractFileUrl: contractFileState.url || values.contractFileUrl,
      contractFileName: contractFileState.name || values.contractFileName,
    };
    
    if (dataToSubmit.financingPlan && dataToSubmit.financingPlan !== 0 && dataToSubmit.contractValue && dataToSubmit.contractValue > 0 && Object.keys(financingOptions).length > 0) {
      dataToSubmit.paymentAmount = parseFloat(calculatedValues.monthlyInstallment.toFixed(2));
    } else {
      if (typeof values.paymentAmount !== 'number' || values.paymentAmount <= 0) {
        if ((values.contractValue === undefined || values.contractValue === 0) && values.financingPlan === 0) {
            form.setError('paymentAmount', {type: 'manual', message: 'Debe ingresar un monto de pago recurrente válido si no hay contrato ni financiación.'});
            setIsSubmitting(false);
            return;
        }
        if (values.contractValue && values.contractValue > 0 && values.financingPlan === 0) {
             form.setError('paymentAmount', {type: 'manual', message: 'Debe ingresar un monto de pago si el contrato es de pago único (sin financiación).'});
             setIsSubmitting(false);
             return;
        }
      }
      dataToSubmit.paymentAmount = values.paymentAmount;
    }

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
             if (messages && messages.length > 0) {
                form.setError(field as keyof z.infer<typeof clientSchema>, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error',
          description: result.generalError || `Error al ${isEditMode ? 'actualizar' : 'crear'} el cliente. Por favor, inténtelo de nuevo.`,
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

  const renderNumberInput = (name: "contractValue" | "downPaymentPercentage" | "paymentAmount", label: string, placeholder: string, description?: string) => (
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
              placeholder={placeholder}
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
              disabled={field.disabled}
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
          <p className="text-xs text-muted-foreground mt-1">Subiendo: {fileState.file?.name} ({fileState.progress.toFixed(0)}%)</p>
        </div>
      )}
      {fileState.url && !fileState.isUploading && (
        <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 size={16} /> ¡{fileState.name || (fileState.file ? fileState.file.name : '')} subido con éxito!
        </div>
      )}
      {fileState.error && !fileState.isUploading &&(
        <div className="mt-2 text-sm text-destructive flex items-center gap-1">
          <XCircle size={16} /> Error: {fileState.error === "Se requiere correo para la ruta de subida." ? "Se requiere correo para la ruta de subida." : fileState.error}
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
                {renderNumberInput("contractValue", "Valor del Contrato (antes de IVA)", "1000000")}
                {renderNumberInput("downPaymentPercentage", "Porcentaje de Abono (%)", "10", "Ingrese un valor entre 0 y 100.")}
                
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormLabel>Medio de Pago (Abono/Contrato)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un medio de pago" /></SelectTrigger></FormControl>
                        <SelectContent>{PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select><FormMessage />
                    </FormItem>)}
                />
                <FormField control={form.control} name="financingPlan" render={({ field }) => (
                    <FormItem><FormLabel>Plan de Financiación</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                        <SelectContent>{Object.keys(financingOptions).length > 0 ? 
                            Object.entries(financingOptions).map(([key, option]) => (<SelectItem key={key} value={key}>{option.label} {option.rate > 0 ? `(${(option.rate * 100).toFixed(0)}% interés aprox.)` : ''}</SelectItem>))
                            : <SelectItem value="0" disabled>Cargando planes...</SelectItem>}
                        </SelectContent>
                        </Select><FormDescription>Las tasas de interés son ejemplos y deben ajustarse a la ley.</FormDescription><FormMessage />
                    </FormItem>)}
                />
              </CardContent>
            </Card>
            
            {showFinancingDetails && (watchedContractValue ?? 0) > 0 && (
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-lg">Resumen de Financiación (Calculado)</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Valor Contrato:</span> <strong>{formatCurrency(watchedContractValue || 0)}</strong></div>
                  <div className="flex justify-between"><span>IVA ({(IVA_RATE * 100).toFixed(0)}%):</span> <strong>{formatCurrency(calculatedValues.ivaAmount)}</strong></div>
                  <div className="flex justify-between"><span>Total con IVA:</span> <strong>{formatCurrency(calculatedValues.totalWithIva)}</strong></div>
                  <div className="flex justify-between"><span>Abono ({watchedDownPaymentPercentage || 0}% del Total con IVA):</span> <strong>{formatCurrency(calculatedValues.calculatedDownPayment)}</strong></div>
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
              <CardHeader><CardTitle className="text-xl">Configuración de Pago Mensual</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="paymentDayOfMonth" render={({ field }) => (
                    <FormItem><FormLabel>Día de Pago de la Cuota del Mes</FormLabel>
                        <FormControl><Input type="number" min="1" max="31" placeholder="15" 
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
                         /></FormControl>
                        <FormDescription>Día (1-31) en que se generará el cobro de la cuota mensual.</FormDescription><FormMessage />
                    </FormItem>)}
                />
                {(!showFinancingDetails || !((watchedContractValue ?? 0) > 0)) && (
                  renderNumberInput("paymentAmount", "Monto de Pago Recurrente (si no hay financiación)", "50000", "Si no hay plan de financiación activo, ingrese el monto del servicio recurrente.")
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
