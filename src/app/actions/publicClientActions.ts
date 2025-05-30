
'use server';

import { revalidatePath } from 'next/cache';
import { publicClientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store'; // Import to fetch options
// import { auth } from '@/lib/firebase'; // No longer needed here, auth context is client-side for the action call

async function calculatePublicFinancingDetails(formData: PublicClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const downPaymentPercentage = 0; // For self-registration, assume 0% down payment.
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

    if (financingPlanKey !== 0 && details.amountToFinance > 0) {
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
      calculatedPaymentAmount = 0; // If contract value > 0, and no financing, implies one-time payment or admin needs to set recurring
       if (details.amountToFinance === 0) { // Fully paid by (zero) downpayment
          details.status = 'completed';
       } else {
         // If there's contract value but no financing, payment amount is not determined by this logic for recurring.
         // Admin might need to set it. For now, it's 0.
         // Client will be 'active' but might need payment terms defined.
       }
    }
  } else { // No contract value (e.g. future simple recurring service without contract)
    // This form currently focuses on contractValue. If contractValue is 0, paymentAmount is 0.
    calculatedPaymentAmount = 0;
    details.status = 'completed'; // Or 'pending_setup' if admin needs to define payment for a service
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData) {
  // The user should be authenticated by Firebase client-side SDK before this action is called.
  // Server Actions invoked from client components will have the auth context.
  // For Firestore rules, `request.auth` should be populated.

  if (!formData.email) { // Email must be passed from the authenticated user context
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible. El usuario debe estar autenticado." };
  }

  const validationResult = publicClientSchema.safeParse(formData);
  if (!validationResult.success) {
    console.error("Self-registration validation errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  
  // Check for email uniqueness (using the email from validated form data, which should match authenticated user)
  const existingClientByEmail = await store.getClientByEmail(formData.email);
  if (existingClientByEmail) {
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico. Por favor, contacte a soporte." };
  }

  const financingDetails = await calculatePublicFinancingDetails(validatedData);

  if (validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${formData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión.`);
  }

  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: formData.email, // Use the email from the authenticated user
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    // status will come from financingDetails, defaults to 'active' or 'completed'
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

