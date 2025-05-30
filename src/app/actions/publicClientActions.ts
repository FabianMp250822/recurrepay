
'use server';

import { revalidatePath } from 'next/cache';
import { publicClientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';
import { addMonths, setDate, getDaysInMonth } from 'date-fns';

async function calculatePublicFinancingDetails(formData: PublicClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  // For self-registration, we assume 0% down payment for simplicity.
  // This could be made configurable in appSettings later if needed.
  const downPaymentPercentage = 0;
  const financingPlanKey = formData.financingPlan;

  const financingOptionsFromDb = await getFinancingOptionsMap();

  const details: Partial<Client> = {
    contractValue,
    downPaymentPercentage,
    // paymentMethod: formData.paymentMethod, // Not collected in public form for now
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
    status: 'active', // Or 'pending_approval' if an approval flow is desired
  };

  let calculatedPaymentAmount = 0;

  if (contractValue > 0) {
    details.ivaRate = IVA_RATE;
    details.ivaAmount = contractValue * IVA_RATE;
    details.totalWithIva = contractValue + details.ivaAmount;
    details.downPayment = details.totalWithIva * (downPaymentPercentage / 100); // Will be 0
    details.amountToFinance = Math.max(0, details.totalWithIva - details.downPayment);

    if (financingPlanKey !== 0 && details.amountToFinance > 0) {
      const planInfo = financingOptionsFromDb[financingPlanKey];
      if (planInfo) {
        details.financingInterestRateApplied = planInfo.rate;
        details.financingInterestAmount = details.amountToFinance * planInfo.rate;
        details.totalAmountWithInterest = details.amountToFinance + details.financingInterestAmount;
        const numberOfMonths = financingPlanKey; // This is the key, which is the number of months
        calculatedPaymentAmount = numberOfMonths > 0 ? parseFloat((details.totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
      }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) { // Paid in full (not possible with 0 down payment unless contract value is 0)
      calculatedPaymentAmount = 0;
      details.status = 'completed';
    } else if (financingPlanKey === 0) { // No financing plan (e.g. one-time payment for contract)
      // If it's a one-time payment for a contract, the monthly payment is effectively the total.
      // However, this flow is for recurring. For now, if no financing plan for a contract, paymentAmount might be 0.
      // This logic might need refinement based on how "no financing" for a contract is handled.
      // For self-registration, if contractValue > 0 and no financing, it's ambiguous.
      // Let's assume paymentAmount is 0 if contractValue > 0 and financingPlan is 0 for now.
      // Admin would need to adjust.
      calculatedPaymentAmount = 0;
       if (details.amountToFinance === 0) {
          details.status = 'completed';
       }
    }
  } else { // No contract value (e.g. simple recurring service without contract)
    // This case is not fully handled by the current public form which focuses on contractValue.
    // If we wanted to support pure recurring services without contract via this form,
    // client would need to input paymentAmount directly if contractValue is 0.
    // For now, this path will result in 0 paymentAmount if contractValue is 0.
    calculatedPaymentAmount = 0;
    details.status = 'completed'; // Or inactive
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData) {
  const validationResult = publicClientSchema.safeParse(formData);
  if (!validationResult.success) {
    console.error("Self-registration validation errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  
  // Check for email uniqueness before proceeding
  const existingClientByEmail = await store.getClientByEmail(validatedData.email);
  if (existingClientByEmail) {
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico." };
  }

  const financingDetails = await calculatePublicFinancingDetails(validatedData);

  // If contractValue > 0 but financing plan results in 0 payment amount, this might indicate an issue
  // or a need for manual review. For now, we proceed.
  if (validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     // This scenario might occur if financingPlan is 0 (Sin financiación) for a contract.
     // The client is created, but admin might need to define payment terms or set a recurring payment amount manually.
     // The status might also need adjustment.
     console.warn(`Client ${validatedData.email} registered with contract value but 0 payment amount (excluding completed). Review needed.`);
  }


  const clientToCreate: Omit<Client, 'id'> = {
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    email: validatedData.email,
    phoneNumber: validatedData.phoneNumber,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!,
    paymentDayOfMonth: validatedData.paymentDayOfMonth,
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0,
    // status will come from financingDetails, defaults to 'active' or 'completed'
  };
  
  // Remove undefined keys to prevent Firestore errors
  Object.keys(clientToCreate).forEach(key => (clientToCreate as any)[key] === undefined && delete (clientToCreate as any)[key]);

  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }

  revalidatePath('/clients'); // For admin view
  revalidatePath('/dashboard'); // For admin view
  return { success: true, client: result.client };
}

