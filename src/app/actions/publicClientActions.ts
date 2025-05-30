
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { basePublicClientObjectSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';


async function calculatePublicFinancingDetails(formData: PublicClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const applyIvaFlag = formData.applyIva === undefined ? true : formData.applyIva;
  const downPaymentPercentage = 0; 
  const financingPlanKey = formData.financingPlan;

  const financingOptionsFromDb = await getFinancingOptionsMap();

  const details: Partial<Client> = {
    contractValue,
    applyIva: applyIvaFlag,
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
    details.amountToFinance = Math.max(0, details.totalWithIva - (details.downPayment || 0));

    if (financingPlanKey !== 0 && details.amountToFinance > 0 && financingOptionsFromDb[financingPlanKey]) {
      const planInfo = financingOptionsFromDb[financingPlanKey];
      if (planInfo) {
        details.financingInterestRateApplied = planInfo.rate;
        details.financingInterestAmount = details.amountToFinance * planInfo.rate;
        details.totalAmountWithInterest = details.amountToFinance + details.financingInterestAmount;
        const numberOfMonths = financingPlanKey;
        calculatedPaymentAmount = numberOfMonths > 0 ? parseFloat((details.totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
      }
    } else if (financingPlanKey === 0) { 
        calculatedPaymentAmount = details.totalWithIva; 
        if (details.amountToFinance === 0 && contractValue > 0) { 
            details.status = 'completed'; 
        }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) {
      calculatedPaymentAmount = 0;
      details.status = 'completed';
    }
  } else { 
    calculatedPaymentAmount = 0;
    details.status = 'completed'; 
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData) {
  if (!formData.email) {
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible. El usuario debe estar autenticado." };
  }

  // Validate all incoming data, including applyIva and file URLs, using a comprehensive schema
  // The basePublicClientObjectSchema needs to be merged with email for full validation here
  const fullPublicClientSchemaForAction = basePublicClientObjectSchema.merge(z.object({
    email: z.string().email({ message: "Correo electrónico inválido." }),
    applyIva: z.boolean().optional(), // applyIva comes from the form state, derived from URL
    // File URLs are optional and validated by basePublicClientObjectSchema if present
  }));
  
  const validationResult = fullPublicClientSchemaForAction.safeParse(formData);

  if (!validationResult.success) {
    console.error("Self-registration validation errors in action:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors, generalError: "Por favor, corrija los errores en el formulario." };
  }

  const validatedData = validationResult.data;
  
  const existingClientByEmail = await store.getClientByEmail(validatedData.email);
  if (existingClientByEmail) {
    // For now, if any client record exists with this email, we prevent a new full registration.
    // A more advanced flow might update an existing 'pending' or 'incomplete' record.
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico. Si necesitas completar tu información o tienes problemas, por favor contacta a soporte." };
  }

  const financingDetails = await calculatePublicFinancingDetails(validatedData); 

  if (validatedData.contractValue && validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${validatedData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión o es pago único.`);
  }

  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: validatedData.email, 
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails, // This includes applyIva, file URLs etc. from validatedData if passed to calculatePublicFinancingDetails
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    status: financingDetails.status || 'active',
  };
  
  Object.keys(clientToCreate).forEach(key => (clientToCreate as any)[key as keyof Client] === undefined && delete (clientToCreate as any)[key as keyof Client]);

  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }
  
  // Revalidation of admin paths isn't strictly necessary here as this is a public action.
  // Admin pages will revalidate their data when visited.
  // revalidatePath('/clients'); 
  // revalidatePath('/dashboard'); 
  return { success: true, client: result.client };
}
