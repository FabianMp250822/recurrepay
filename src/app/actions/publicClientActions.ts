
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { basePublicClientObjectSchema, publicClientSchema } from '@/lib/schema'; // Usar publicClientSchema para validación completa
import * as store from '@/lib/store';
import type { Client, PublicClientFormData } from '@/types';
import { calculateNextPaymentDate as calculateNextRegPaymentDateUtil } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { getFinancingOptionsMap } from '@/lib/store';


async function calculatePublicFinancingDetails(formData: PublicClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  // applyIva viene de formData, que lo obtiene del searchParam en el form
  const applyIvaFlag = formData.applyIva === undefined ? true : formData.applyIva; 
  const downPaymentPercentage = 0; // No hay abono en el flujo público por ahora
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
    status: 'active', // Podría ser 'pending_approval' si se implementa
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
    details.downPayment = details.totalWithIva * (downPaymentPercentage / 100); // Será 0
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
  } else { // contractValue es 0 (servicio recurrente sin contrato inicial)
    // Para servicios puros, applyIva podría o no aplicar según la naturaleza del servicio.
    // Asumimos que si CV=0, es un servicio y el monto es directo.
    // El schema debe asegurar que paymentAmount > 0 si CV=0.
    calculatedPaymentAmount = formData.paymentAmount || 0; // paymentAmount debe venir del form si CV=0
    details.applyIva = applyIvaFlag; // Mantener el flag
    details.ivaRate = applyIvaFlag ? IVA_RATE : 0;
    // Si es un servicio y se aplica IVA, el paymentAmount ingresado debería ser el subtotal.
    // Esto requiere que el formulario de inscripción maneje el `paymentAmount` para servicios.
    // Por ahora, si CV=0, paymentAmount es el valor final.
    if (calculatedPaymentAmount === 0 && contractValue === 0) {
        details.status = 'completed'; // O 'inactive' si es un servicio que no se configuró
    }
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function selfRegisterClientAction(formData: PublicClientFormData) {
  if (!formData.email) { // El email ahora se pasa explícitamente al action
    return { success: false, generalError: "Error: El correo electrónico del usuario no está disponible." };
  }

  // Validar todos los datos, incluyendo applyIva y URLs de archivos
  const validationResult = publicClientSchema.safeParse(formData);

  if (!validationResult.success) {
    console.error("Self-registration validation errors in action:", validationResult.error.flatten().fieldErrors);
    return { success: false, errors: validationResult.error.flatten().fieldErrors, generalError: "Por favor, corrija los errores en el formulario." };
  }

  const validatedData = validationResult.data;
  
  // Verificar si ya existe un cliente con este email (se hace antes de llegar aquí en el nuevo flujo, pero es buena doble verificación)
  const existingClientByEmail = await store.getClientByEmail(validatedData.email);
  if (existingClientByEmail) {
    return { success: false, generalError: "Ya existe un cliente registrado con este correo electrónico y perfil completo." };
  }

  const financingDetails = await calculatePublicFinancingDetails(validatedData); 

  if (validatedData.contractValue && validatedData.contractValue > 0 && financingDetails.paymentAmount === 0 && financingDetails.status !== 'completed') {
     console.warn(`Cliente ${validatedData.email} se registró con valor de contrato pero monto de pago 0 (excl. completado). Requiere revisión o es pago único.`);
  }
   // Si contractValue es 0, paymentAmount debe ser > 0 (validado por Zod)
  if ((validatedData.contractValue === undefined || validatedData.contractValue === 0) && (!financingDetails.paymentAmount || financingDetails.paymentAmount <= 0) && financingDetails.status !== 'completed') {
    return { success: false, errors: { paymentAmount: ["Se requiere un monto de pago para servicios recurrentes."] }, generalError: "Se requiere un monto de pago." };
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
    status: financingDetails.status || 'active',
    // Los campos de archivo (acceptanceLetterUrl, etc.) ya están en financingDetails
  };
  
  // Eliminar propiedades undefined antes de guardar
  Object.keys(clientToCreate).forEach(key => (clientToCreate as any)[key as keyof Client] === undefined && delete (clientToCreate as any)[key as keyof Client]);

  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }
  
  return { success: true, client: result.client };
}


export async function checkClientProfileStatus(email: string): Promise<{ hasProfile: boolean; clientData?: Client | null }> {
  try {
    const client = await store.getClientByEmail(email);
    if (client) {
      // Aquí podrías añadir más lógica para determinar si el perfil está "completo"
      // Por ahora, si existe un registro, consideramos que tiene un perfil.
      return { hasProfile: true, clientData: client };
    }
    return { hasProfile: false, clientData: null };
  } catch (error) {
    console.error("Error checking client profile status:", error);
    // En caso de error, asumimos que no tiene perfil para no bloquear el flujo,
    // pero se podría manejar de forma diferente.
    return { hasProfile: false, clientData: null };
  }
}

