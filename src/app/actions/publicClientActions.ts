
'use server';

import { revalidatePath } from 'next/cache';
import { publicClientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';

// Tipado extendido para incluir los campos de archivo y applyIva
type SelfRegisterClientFormDataInternal = Omit<PublicClientFormData, 'email'> & {
  email: string;
  applyIva: boolean; // Make applyIva mandatory internally for calculation
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
};

async function calculatePublicFinancingDetails(formData: SelfRegisterClientFormDataInternal): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const applyIvaFlag = formData.applyIva; // This will be true/false from the form
  const downPaymentPercentage = 0; // Para auto-registro, abono 0% por defecto.
  const financingPlanKey = formData.financingPlan;

  const financingOptionsFromDb = await getFinancingOptionsMap();

  const details: Partial<Client> = {
    contractValue,
    applyIva: applyIvaFlag, // Save the flag
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
    acceptanceLetterUrl: formData.acceptanceLetterUrl,
    acceptanceLetterFileName: formData.acceptanceLetterFileName,
    contractFileUrl: formData.contractFileUrl,
    contractFileName: formData.contractFileName,
  };

  let calculatedPaymentAmount = 0;

  if (contractValue > 0) {
    if (applyIvaFlag) {
      details.ivaRate = IVA_RATE;
      details.ivaAmount = contractValue * IVA_RATE;
    } else {
      details.ivaRate = 0;
      details.ivaAmount = 0;
    }
    details.totalWithIva = contractValue + (details.ivaAmount || 0);
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
    } else if (financingPlanKey === 0) { // No financing plan
        calculatedPaymentAmount = details.totalWithIva; // Single payment of the total
        if (details.amountToFinance === 0 && contractValue > 0) { // This case might mean it's paid by other means or is $0 contract value
            details.status = 'completed'; // Or 'active' if payment is expected. If $0 contract, then completed.
        }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) {
      calculatedPaymentAmount = 0;
      details.status = 'completed';
    }


  } else { // contractValue is 0
    calculatedPaymentAmount = 0;
    details.status = 'completed'; // If no contract value, assume completed or no payment needed.
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData) {
  if (!formData.email) {
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible. El usuario debe estar autenticado." };
  }

  const clientDetailsToValidate: Omit<PublicClientFormData, 'email'> = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    phoneNumber: formData.phoneNumber,
    contractValue: formData.contractValue,
    applyIva: formData.applyIva, // Validate applyIva
    financingPlan: formData.financingPlan,
    paymentDayOfMonth: formData.paymentDayOfMonth,
    acceptanceLetterUrl: formData.acceptanceLetterUrl,
    acceptanceLetterFileName: formData.acceptanceLetterFileName,
    contractFileUrl: formData.contractFileUrl,
    contractFileName: formData.contractFileName,
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

  const internalFormData: SelfRegisterClientFormDataInternal = {
    ...validatedData,
    email: formData.email, // Add back the email
    applyIva: validatedData.applyIva ?? true, // Ensure applyIva is boolean for calculation
  };

  const financingDetails = await calculatePublicFinancingDetails(internalFormData); 

  if (validatedData.contractValue && validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${formData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión o es pago único.`);
  }

  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: formData.email, 
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails, // This now includes applyIva, ivaRate, ivaAmount, etc.
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    status: financingDetails.status || 'active',
    // File URLs already in financingDetails
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

