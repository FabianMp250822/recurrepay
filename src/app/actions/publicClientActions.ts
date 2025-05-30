
'use server';

import { revalidatePath } from 'next/cache';
import { publicClientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store'; 

// Tipado extendido para incluir los campos de archivo
type SelfRegisterClientFormData = PublicClientFormData & {
  email: string;
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
};

async function calculatePublicFinancingDetails(formData: SelfRegisterClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const downPaymentPercentage = 0; // Para auto-registro, abono 0% por defecto.
  const financingPlanKey = formData.financingPlan;

  const financingOptionsFromDb = await getFinancingOptionsMap();

  const details: Partial<Client> = {
    contractValue,
    downPaymentPercentage,
    financingPlan: financingPlanKey,
    ivaRate: 0,
    ivaAmount: 0,
    totalWithIva: contractValue,
    downPayment: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    paymentsMadeCount: 0,
    status: 'active', 
    // Incluir URLs de documentos si se proporcionan
    acceptanceLetterUrl: formData.acceptanceLetterUrl,
    acceptanceLetterFileName: formData.acceptanceLetterFileName,
    contractFileUrl: formData.contractFileUrl,
    contractFileName: formData.contractFileName,
  };

  let calculatedPaymentAmount = 0;

  if (contractValue > 0) {
    details.ivaRate = IVA_RATE;
    details.ivaAmount = contractValue * IVA_RATE;
    details.totalWithIva = contractValue + details.ivaAmount;
    details.downPayment = details.totalWithIva * (downPaymentPercentage / 100); 
    details.amountToFinance = Math.max(0, details.totalWithIva - details.downPayment);

    if (financingPlanKey !== 0 && details.amountToFinance > 0 && financingOptionsFromDb[financingPlanKey]) {
      const planInfo = financingOptionsFromDb[financingPlanKey];
      if (planInfo) {
        details.financingInterestRateApplied = planInfo.rate;
        details.financingInterestAmount = details.amountToFinance * planInfo.rate;
        details.totalAmountWithInterest = details.amountToFinance + details.financingInterestAmount;
        const numberOfMonths = financingPlanKey; 
        calculatedPaymentAmount = numberOfMonths > 0 ? parseFloat((details.totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
      }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) { 
      calculatedPaymentAmount = 0;
      details.status = 'completed';
    } else if (financingPlanKey === 0) { 
       calculatedPaymentAmount = 0; 
       if (details.amountToFinance === 0) { 
          details.status = 'completed';
       }
    }
  } else { 
    calculatedPaymentAmount = 0; 
    details.status = 'completed'; 
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: SelfRegisterClientFormData) {
  if (!formData.email) {
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible. El usuario debe estar autenticado." };
  }

  // Validar solo los campos de PublicClientFormData, los de archivo son opcionales y ya vienen como URLs
  const clientDetailsToValidate: PublicClientFormData = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    phoneNumber: formData.phoneNumber,
    contractValue: formData.contractValue,
    financingPlan: formData.financingPlan,
    paymentDayOfMonth: formData.paymentDayOfMonth,
    // No incluir los campos de archivo aquí para la validación de Zod, ya son URLs
  };

  const validationResult = publicClientSchema.safeParse(clientDetailsToValidate);
  if (!validationResult.success) {
    console.error("Self-registration validation errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  
  const existingClientByEmail = await store.getClientByEmail(formData.email);
  if (existingClientByEmail) {
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico. Por favor, contacte a soporte." };
  }

  // Pasar el formData completo a calculatePublicFinancingDetails para que tenga acceso a las URLs
  const financingDetails = await calculatePublicFinancingDetails(formData); 

  if (validatedData.contractValue && validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${formData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión o es pago único.`);
  }

  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: formData.email, // Usar el email del usuario autenticado
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    status: financingDetails.status || 'active',
    // Las URLs de los documentos ya están incluidas a través de ...financingDetails
  };
  
  Object.keys(clientToCreate).forEach(key => (clientToCreate as any)[key] === undefined && delete (clientToCreate as any)[key]);

  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }

  revalidatePath('/clients'); 
  revalidatePath('/dashboard'); 
  return { success: true, client: result.client };
}

