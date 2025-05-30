
'use server';

import { revalidatePath } from 'next/cache';
import { publicClientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store'; 

async function calculatePublicFinancingDetails(formData: PublicClientFormData & { email: string }): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const downPaymentPercentage = 0; // For self-registration, assume 0% down payment by default.
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
       // If contract value > 0, and no financing, this implies a one-time payment.
       // The payment amount would be totalWithIva, but recurring monthly payment is 0.
       // Status would be 'completed' after this one-time payment (not handled by this recurring logic).
       // For simplicity, we set recurring monthly payment to 0.
       calculatedPaymentAmount = 0; 
       if (details.amountToFinance === 0) { 
          details.status = 'completed';
       } else {
          // Client has a contract value but no financing, so their "recurring" payment is 0.
          // They would pay totalWithIva upfront.
          // The admin UI can show this correctly. For recurring logic, paymentAmount is 0.
       }
    }
  } else { // No contract value (e.g., simple recurring service without contract value)
    // This form currently requires a contractValue if financing is chosen.
    // If contractValue is 0, and no financing, then admin needs to set payment amount.
    // For self-registration, if contractValue is 0, we set paymentAmount to 0 by default.
    calculatedPaymentAmount = 0; 
    // If contract value is 0 and no specific payment amount is set for a service,
    // it's effectively 'completed' or needs admin setup.
    details.status = 'completed'; 
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData & { email: string }) {
  if (!formData.email) {
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible. El usuario debe estar autenticado." };
  }

  const validationResult = publicClientSchema.safeParse(formData);
  if (!validationResult.success) {
    console.error("Self-registration validation errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  
  const existingClientByEmail = await store.getClientByEmail(formData.email);
  if (existingClientByEmail) {
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico. Por favor, contacte a soporte." };
  }

  const financingDetails = await calculatePublicFinancingDetails(formData); // Pass full formData

  if (validatedData.contractValue && validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${formData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión o es pago único.`);
  }

  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: formData.email,
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    status: financingDetails.status || 'active',
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

