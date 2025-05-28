
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { clientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, ClientFormData, PaymentRecord } from '@/types';
import { formatCurrency, formatDate, calculateNextPaymentDate as calculateNextRegPaymentDateUtil, getDaysUntilDue } from '@/lib/utils';
import { IVA_RATE } from '@/lib/constants'; // Removed FINANCING_OPTIONS, will get from store
import { addMonths, setDate, getDate, getDaysInMonth } from 'date-fns';
import { getGeneralSettings } from '@/lib/store'; // To get appName

// Helper function to calculate financing details
async function calculateFinancingDetails(formData: ClientFormData): Promise<Partial<Client>> {
  const contractValue = formData.contractValue || 0;
  const downPaymentPercentage = formData.downPaymentPercentage || 0;
  const financingPlanKey = formData.financingPlan || 0;

  const financingOptionsFromDb = await store.getFinancingOptionsMap();


  const details: Partial<Client> = {
    contractValue,
    downPaymentPercentage,
    paymentMethod: formData.paymentMethod,
    financingPlan: financingPlanKey,
    ivaRate: 0,
    ivaAmount: 0,
    totalWithIva: contractValue,
    downPayment: 0, // Will be calculated
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
    acceptanceLetterUrl: formData.acceptanceLetterUrl,
    acceptanceLetterFileName: formData.acceptanceLetterFileName,
    contractFileUrl: formData.contractFileUrl,
    contractFileName: formData.contractFileName,
    paymentsMadeCount: 0, // Initialize for new clients
    status: 'active',
  };

  let calculatedPaymentAmount = formData.paymentAmount || 0;

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
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) { // Paid in full by down payment
      calculatedPaymentAmount = 0; 
      details.status = 'completed';
    } else if (financingPlanKey === 0) { // No financing plan
        calculatedPaymentAmount = formData.paymentAmount || 0;
        if (calculatedPaymentAmount === 0 && details.amountToFinance === 0) { // Contract paid by downpayment, no recurring
             details.status = 'completed';
        }
    }
  } else { // No contract value (e.g. simple recurring service)
    details.downPayment = 0; 
    calculatedPaymentAmount = formData.paymentAmount || 0;
    if (calculatedPaymentAmount === 0) {
        details.status = 'completed'; // Or maybe 'inactive' if no payment amount for simple service
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
  
  Object.keys(clientToCreate).forEach(key => clientToCreate[key as keyof typeof clientToCreate] === undefined && delete clientToCreate[key as keyof typeof clientToCreate]);


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
    nextPaymentDate: calculateNextRegPaymentDateUtil(validatedData.paymentDayOfMonth).toISOString(),
    paymentsMadeCount: existingClient.paymentsMadeCount, 
    status: financingDetails.status || existingClient.status || 'active',
  };
  Object.keys(clientToUpdate).forEach(key => clientToUpdate[key as keyof typeof clientToUpdate] === undefined && delete clientToUpdate[key as keyof typeof clientToUpdate]);


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
  if (client.paymentAmount === 0) {
     return { success: false, error: "Este cliente no tiene un monto de pago configurado." };
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
  newNextPaymentDate = addMonths(newNextPaymentDate, 1);
  
  const targetDay = client.paymentDayOfMonth;
  const daysInNewMonth = getDaysInMonth(newNextPaymentDate);
  newNextPaymentDate = setDate(newNextPaymentDate, Math.min(targetDay, daysInNewMonth));

  const updates: Partial<Client> = {
    nextPaymentDate: newNextPaymentDate.toISOString(),
    paymentsMadeCount: newPaymentsMadeCount,
  };
  
  const financingOptionsFromDb = await store.getFinancingOptionsMap();


  if (client.financingPlan && client.financingPlan > 0 && financingOptionsFromDb[client.financingPlan] && newPaymentsMadeCount >= client.financingPlan) {
    updates.paymentAmount = 0;
    updates.status = 'completed';
  }

  const updateResult = await store.updateClient(clientId, updates);
  if (updateResult.error) {
    return { success: false, error: `Error al actualizar cliente: ${updateResult.error}` };
  }

  revalidatePath('/clients');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}/edit`); 
  return { success: true, message: "Pago registrado y cliente actualizado." };
}


export async function sendPaymentReminderEmailAction(client: Client) {
  const {
    EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD,
    // EMAIL_FROM, // We'll get the appName and use it for the from part
  } = process.env;

  const generalSettings = await getGeneralSettings();
  const appName = generalSettings.appName || 'RecurPay'; // Default to RecurPay if not set
  const emailFromConfigured = process.env.EMAIL_FROM || `${appName} <noreply@example.com>`; // Fallback noreply

  if (!EMAIL_SERVER_HOST || !EMAIL_SERVER_PORT || !EMAIL_SERVER_USER || !EMAIL_SERVER_PASSWORD || !emailFromConfigured) {
    console.error('Falta configuración de correo en .env. Asegúrate de que EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, y EMAIL_FROM estén configurados.');
    return { success: false, error: 'Servidor de correo no configurado. El administrador ha sido notificado.' };
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_SERVER_HOST,
    port: parseInt(EMAIL_SERVER_PORT, 10),
    secure: parseInt(EMAIL_SERVER_PORT, 10) === 465, 
    auth: {
      user: EMAIL_SERVER_USER,
      pass: EMAIL_SERVER_PASSWORD,
    },
    tls: {
      // rejectUnauthorized: false 
    }
  });
  
  const paymentAmountText = client.paymentAmount > 0 ? `su pago de <strong>${formatCurrency(client.paymentAmount)}</strong>` : "su próximo compromiso de pago";
  
  let subject = `Recordatorio Importante - ${appName}`;
  const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
  const financingOptionsFromDb = await store.getFinancingOptionsMap();


  if (client.paymentAmount > 0) {
    if (daysUntilDue < -5) {
      subject = `URGENTE (${appName}): Pago VENCIDO para ${client.firstName} - ${formatCurrency(client.paymentAmount)}`;
    } else if (daysUntilDue < 0) {
      subject = `AVISO (${appName}): Tu pago para ${client.firstName} de ${formatCurrency(client.paymentAmount)} está VENCIDO`;
    } else if (daysUntilDue === 0) {
      subject = `¡Importante (${appName})! Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence HOY`;
    } else if (daysUntilDue === 1) {
      subject = `¡Atención (${appName})! Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence MAÑANA`;
    } else if (daysUntilDue <= 7) {
      subject = `Recordatorio (${appName}): Tu pago de ${formatCurrency(client.paymentAmount)} para ${client.firstName} vence pronto`;
    } else {
      subject = `Recordatorio Amistoso (${appName}): Próximo Pago`;
    }
  }


  const mailOptions = {
    from: emailFromConfigured.includes('<') ? emailFromConfigured : `"${appName}" <${emailFromConfigured}>`,
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
