
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { clientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, ClientFormData, PaymentRecord, AppGeneralSettings } from '@/types';
import { formatCurrency, formatDate, calculateNextPaymentDate as calculateNextRegPaymentDateUtil, getDaysUntilDue } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants';
import { addMonths, setDate, getDate, getDaysInMonth } from 'date-fns';
import { getGeneralSettings } from '@/lib/store'; 

const CONTRACT_VALUE_THRESHOLD = 1000000;
const MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT = 20;

// Helper function to calculate financing details
async function calculateFinancingDetails(formData: ClientFormData): Promise<Partial<Client>> {
  let contractValue = formData.contractValue || 0;
  let downPaymentPercentage = formData.downPaymentPercentage || 0;
  let financingPlanKey = formData.financingPlan || 0;

  // Apply business rules
  if (contractValue < CONTRACT_VALUE_THRESHOLD && contractValue > 0) {
    financingPlanKey = 0; // No financing
    downPaymentPercentage = 0; // No down payment
  } else if (contractValue >= CONTRACT_VALUE_THRESHOLD) {
    if (downPaymentPercentage < MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT && downPaymentPercentage !== 0) {
      // This should ideally be caught by Zod schema, but as a safeguard in calculation:
      // console.warn(`Down payment percentage ${downPaymentPercentage}% is below the minimum 20% for contracts >= ${CONTRACT_VALUE_THRESHOLD}. Adjusting or re-validating might be needed.`);
      // For calculation, we proceed with the provided value, Zod handles validation error.
    }
  }


  const financingOptionsFromDb = await store.getFinancingOptionsMap();

  const details: Partial<Client> = {
    contractValue,
    downPaymentPercentage,
    paymentMethod: formData.paymentMethod,
    financingPlan: financingPlanKey,
    ivaRate: 0,
    ivaAmount: 0,
    totalWithIva: contractValue,
    downPayment: 0,
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    acceptanceLetterUrl: formData.acceptanceLetterUrl,
    acceptanceLetterFileName: formData.acceptanceLetterFileName,
    contractFileUrl: formData.contractFileUrl,
    contractFileName: formData.contractFileName,
    paymentsMadeCount: 0, 
    status: 'active',
  };

  let calculatedPaymentAmount = formData.paymentAmount || 0;

  if (contractValue > 0) {
    details.ivaRate = IVA_RATE;
    details.ivaAmount = contractValue * IVA_RATE;
    details.totalWithIva = contractValue + details.ivaAmount;
    details.downPayment = details.totalWithIva * (downPaymentPercentage / 100);
    details.amountToFinance = Math.max(0, details.totalWithIva - details.downPayment);

    if (contractValue < CONTRACT_VALUE_THRESHOLD) {
      // For contracts < 1M, payment is total contract value upfront
      calculatedPaymentAmount = details.totalWithIva;
      details.financingPlan = 0; // Ensure no financing
      details.downPaymentPercentage = 0; // Ensure no down payment
      details.downPayment = 0;
      details.amountToFinance = details.totalWithIva;
      // If calculatedPaymentAmount is 0 and it's not due to being fully paid by down payment, it could be an issue.
      // But here, it's the full amount.
      if (calculatedPaymentAmount === 0) details.status = 'completed'; // Or perhaps 'pending_payment_total'

    } else if (financingPlanKey !== 0 && details.amountToFinance > 0) { // Contract >= 1M WITH financing
      const planInfo = financingOptionsFromDb[financingPlanKey];
      if (planInfo) {
        details.financingInterestRateApplied = planInfo.rate;
        details.financingInterestAmount = details.amountToFinance * planInfo.rate;
        details.totalAmountWithInterest = details.amountToFinance + details.financingInterestAmount;
        const numberOfMonths = financingPlanKey;
        calculatedPaymentAmount = numberOfMonths > 0 ? parseFloat((details.totalAmountWithInterest / numberOfMonths).toFixed(2)) : 0;
      }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) { // Paid in full by down payment (for contracts >= 1M)
      calculatedPaymentAmount = 0; 
      details.status = 'completed';
    } else if (financingPlanKey === 0) { // No financing plan (for contracts >= 1M or no contract value)
        // If contract >= 1M and no financing, paymentAmount is user-defined or totalAfterDP.
        // If no contract value, paymentAmount is user-defined for recurring service.
        calculatedPaymentAmount = formData.paymentAmount || 0; 
        if (calculatedPaymentAmount === 0 && details.amountToFinance === 0 && contractValue > 0) { // Contract fully paid by down payment
             details.status = 'completed';
        } else if (calculatedPaymentAmount === 0 && contractValue === 0) { // No contract, no payment amount for simple service
            details.status = 'completed'; // Or maybe 'inactive' if no payment amount for simple service
        }
    }
  } else { // No contract value (e.g. simple recurring service)
    details.downPayment = 0; 
    calculatedPaymentAmount = formData.paymentAmount || 0; // Must be > 0 as per Zod if no contract
    if (calculatedPaymentAmount === 0) { // Should be caught by Zod if no contract
        details.status = 'completed'; 
    }
  }
  
  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function createClientAction(formData: ClientFormData) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  const financingDetails = await calculateFinancingDetails(validatedData);

  const clientToCreate = {
    ...validatedData, 
    ...financingDetails, 
    paymentAmount: financingDetails.paymentAmount!, 
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
    paymentsMadeCount: 0, 
    status: financingDetails.status || 'active',
  };
  
  Object.keys(clientToCreate).forEach(key => (clientToCreate as any)[key as keyof typeof clientToCreate] === undefined && delete (clientToCreate as any)[key as keyof typeof clientToCreate]);


  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }

  revalidatePath('/clients');
  revalidatePath('/dashboard');
  return { success: true, client: result.client };
}

export async function updateClientAction(id: string, formData: ClientFormData) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }
  
  const validatedData = validationResult.data;
  const existingClient = await store.getClientById(id);
  if (!existingClient) {
    return { success: false, generalError: "Cliente no encontrado." };
  }

  const financingDetails = await calculateFinancingDetails(validatedData);

  const clientToUpdate = {
    ...validatedData,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!,
    // Preserve existing nextPaymentDate and paymentsMadeCount unless specifically recalculated
    nextPaymentDate: existingClient.nextPaymentDate, 
    paymentsMadeCount: existingClient.paymentsMadeCount, 
    // If financing details lead to 'completed', use that. Otherwise, use existing status or default to 'active'.
    status: financingDetails.status === 'completed' ? 'completed' : (existingClient.status || 'active'),
  };

  // If paymentDayOfMonth changed, recalculate nextPaymentDate
  if (validatedData.paymentDayOfMonth !== existingClient.paymentDayOfMonth) {
    clientToUpdate.nextPaymentDate = calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString();
  }


  Object.keys(clientToUpdate).forEach(key => (clientToUpdate as any)[key as keyof typeof clientToUpdate] === undefined && delete (clientToUpdate as any)[key as keyof typeof clientToUpdate]);


  const result = await store.updateClient(id, clientToUpdate as Partial<Omit<Client, 'id' | 'createdAt'>>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }
  
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}/edit`);
  revalidatePath('/dashboard');
  return { success: true, client: result.client };
}

export async function deleteClientAction(id: string) {
  const result = await store.deleteClient(id);
  if (result.error) {
    return { success: false, error: result.error };
  }
  revalidatePath('/clients');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function registerPaymentAction(clientId: string) {
  const client = await store.getClientById(clientId);
  if (!client) {
    return { success: false, error: "Cliente no encontrado." };
  }

  if (client.paymentAmount === 0 && client.status === 'completed') {
    return { success: false, error: "Este cliente ya ha completado todos sus pagos." };
  }
  if (client.paymentAmount === 0 && client.contractValue && client.contractValue < CONTRACT_VALUE_THRESHOLD) {
    // Special case for contracts < 1M where paymentAmount might be the total.
    // If it's 0, it means it was considered paid.
     return { success: false, error: "Este contrato de pago único ya ha sido completado." };
  }
   if (client.paymentAmount === 0 ) { // General case if payment amount is 0 but not completed
     return { success: false, error: "Este cliente no tiene un monto de pago configurado o ya completó sus pagos." };
  }


  const paymentAmountRecorded = client.paymentAmount;
  const paymentDate = new Date().toISOString();

  const paymentRecord: Omit<PaymentRecord, 'id' | 'recordedAt'> = {
    paymentDate: paymentDate,
    amountPaid: paymentAmountRecorded,
  };

  const historyResult = await store.addPaymentToHistory(clientId, paymentRecord);
  if (historyResult.error) {
    return { success: false, error: `Error al guardar en historial: ${historyResult.error}` };
  }

  let newPaymentsMadeCount = (client.paymentsMadeCount || 0) + 1;
  let newNextPaymentDate = new Date(client.nextPaymentDate);
  
  const updates: Partial<Client> = {
    paymentsMadeCount: newPaymentsMadeCount,
  };

  if (client.contractValue && client.contractValue < CONTRACT_VALUE_THRESHOLD) {
    // For single payment contracts < 1M, registering payment means it's completed.
    updates.status = 'completed';
    updates.paymentAmount = 0; // No more payments due
    // nextPaymentDate doesn't advance
  } else {
    // For recurring payments or financing installments
    newNextPaymentDate = addMonths(newNextPaymentDate, 1);
    const targetDay = client.paymentDayOfMonth;
    const daysInNewMonth = getDaysInMonth(newNextPaymentDate);
    newNextPaymentDate = setDate(newNextPaymentDate, Math.min(targetDay, daysInNewMonth));
    updates.nextPaymentDate = newNextPaymentDate.toISOString();

    const financingOptionsFromDb = await store.getFinancingOptionsMap();
    if (client.financingPlan && client.financingPlan > 0 && financingOptionsFromDb[client.financingPlan] && newPaymentsMadeCount >= client.financingPlan) {
      updates.paymentAmount = 0; // All installments paid
      updates.status = 'completed';
    }
  }
  
  const updateResult = await store.updateClient(clientId, updates);
  if (updateResult.error) {
    // Attempt to rollback payment history entry? More complex. For now, log and error.
    console.error(`Failed to update client ${clientId} after registering payment. Payment history entry ${historyResult.record?.id} was created.`);
    return { success: false, error: `Error al actualizar cliente después de registrar pago: ${updateResult.error}` };
  }

  revalidatePath('/clients');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}/edit`); 
  return { success: true, message: "Pago registrado y cliente actualizado." };
}


export async function sendPaymentReminderEmailAction(client: Client) {
  const settings = await getGeneralSettings();
  const appName = settings.appName || 'RecurPay';
  const configuredEmailFrom = process.env.EMAIL_FROM || `${appName} <noreply@${appName.toLowerCase().replace(/\s+/g, '')}.com>`;

  const {
    EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD,
  } = process.env;

  if (!EMAIL_SERVER_HOST || !EMAIL_SERVER_PORT || !EMAIL_SERVER_USER || !EMAIL_SERVER_PASSWORD || !configuredEmailFrom) {
    console.error('Falta configuración de correo en .env.');
    return { success: false, error: 'Servidor de correo no configurado. El administrador ha sido notificado.' };
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_SERVER_HOST,
    port: parseInt(EMAIL_SERVER_PORT, 10),
    secure: parseInt(EMAIL_SERVER_PORT, 10) === 465, 
    auth: { user: EMAIL_SERVER_USER, pass: EMAIL_SERVER_PASSWORD, },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
  });
  
  const paymentAmountText = client.paymentAmount > 0 ? `su pago de <strong>${formatCurrency(client.paymentAmount)}</strong>` : "su próximo compromiso de pago";
  
  let subject = `Recordatorio Importante - ${appName}`;
  const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
  const financingOptionsFromDb = await store.getFinancingOptionsMap();

  if (client.paymentAmount > 0) {
    if (daysUntilDue < -5) { // Más de 5 días vencido
      subject = `URGENTE (${appName}): Pago VENCIDO para ${client.firstName} - ${formatCurrency(client.paymentAmount)}`;
    } else if (daysUntilDue < 0) { // 1 a 5 días vencido
      subject = `AVISO (${appName}): Tu pago para ${client.firstName} de ${formatCurrency(client.paymentAmount)} está VENCIDO`;
    } else if (daysUntilDue === 0) { // Vence hoy
      subject = `¡Importante (${appName})! Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence HOY`;
    } else if (daysUntilDue === 1) { // Vence mañana
      subject = `¡Atención (${appName})! Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence MAÑANA`;
    } else if (daysUntilDue <= 7) { // Vence en 2-7 días (ajustado de 5 a 7 para ser más general con el texto)
      subject = `Recordatorio (${appName}): Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence pronto`;
    } else { // Más de 7 días antes
      subject = `Recordatorio Amistoso (${appName}): Próximo Pago para ${client.firstName}`;
    }
  }


  const mailOptions = {
    from: configuredEmailFrom.includes('<') ? configuredEmailFrom : `"${appName}" <${configuredEmailFrom}>`,
    to: client.email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #64B5F6;">Recordatorio de Pago</h2>
        <p>Estimado/a ${client.firstName} ${client.lastName},</p>
        <p>Este es un recordatorio amigable sobre ${paymentAmountText} programado para el <strong>${formatDate(client.nextPaymentDate)}</strong>.</p>
        
        ${client.contractValue && client.contractValue > 0 && client.financingPlan && client.financingPlan > 0 ? `
        <p><strong>Detalles de su financiación:</strong></p>
        <ul>
          <li>Valor del Contrato: ${formatCurrency(client.contractValue)}</li>
          ${client.downPaymentPercentage && client.downPayment ? `<li>Abono (${client.downPaymentPercentage}%): ${formatCurrency(client.downPayment)}</li>` : ''}
          <li>Plan: ${financingOptionsFromDb[client.financingPlan]?.label || `${client.financingPlan} meses`}</li>
          <li>Cuota Mensual: ${formatCurrency(client.paymentAmount)}</li>
        </ul>
        ` : client.paymentAmount > 0 ? `
        <p><strong>Detalles del Pago Recurrente:</strong></p>
        <ul>
          <li>Monto del Pago: ${formatCurrency(client.paymentAmount)}</li>
          <li>Fecha de Vencimiento: ${formatDate(client.nextPaymentDate)}</li>
        </ul>
        ` : ''
        }

        <p>Si ya ha realizado este pago, por favor ignore este correo. Si tiene alguna pregunta o necesita actualizar su información de pago, no dude en contactarnos.</p>
        <p>¡Gracias por su preferencia!</p>
        <p>Atentamente,</p>
        <p><strong>El Equipo de ${appName}</strong></p>
        <hr style="border: none; border-top: 1px solid #E3F2FD; margin-top: 20px; margin-bottom: 10px;" />
        <p style="font-size: 0.8em; color: #777;">
          Este es un mensaje automático de ${appName}. Por favor, no responda directamente a este correo electrónico.
        </p>
      </div>
    `,
  };

  try {
    await transporter.verify(); 
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado: ' + info.response);
    return { success: true, message: `Correo de recordatorio enviado a ${client.email}` };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    let errorMessage = 'Error al enviar el correo. Por favor, inténtelo de nuevo más tarde.';
    if (error instanceof Error && 'code' in error) {
        const nodemailerError = error as (Error & { code?: string });
        if (nodemailerError.code === 'EAUTH') {
            errorMessage = 'Error al enviar el correo debido a un error de autenticación. Por favor, verifique las credenciales del servidor.';
        } else if (nodemailerError.code === 'ECONNREFUSED') {
            errorMessage = 'Error al enviar el correo. Conexión al servidor de correo rechazada.';
        }
    }
    return { success: false, error: errorMessage };
  }
}

