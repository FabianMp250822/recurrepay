
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { clientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, ClientFormData } from '@/types';
import { formatCurrency, formatDate, calculateNextPaymentDate } from '@/lib/utils';
import { IVA_RATE, FINANCING_OPTIONS } from '@/lib/constants';

// Helper function to calculate financing details
function calculateFinancingDetails(formData: ClientFormData & { paymentAmount?: number }): Partial<Client> {
  const contractValue = formData.contractValue || 0;
  const downPayment = formData.downPayment || 0;
  const financingPlanKey = formData.financingPlan || 0;

  let calculatedPaymentAmount = formData.paymentAmount || 0; // Default to manually entered if no financing

  const details: Partial<Client> = {
    contractValue,
    downPayment,
    paymentMethod: formData.paymentMethod,
    financingPlan: financingPlanKey,
    ivaRate: 0,
    ivaAmount: 0,
    totalWithIva: contractValue, // Default if no IVA applicable or contract value is 0
    amountToFinance: 0,
    financingInterestRateApplied: 0,
    financingInterestAmount: 0,
    totalAmountWithInterest: 0,
  };

  if (contractValue > 0) {
    details.ivaRate = IVA_RATE;
    details.ivaAmount = contractValue * IVA_RATE;
    details.totalWithIva = contractValue + details.ivaAmount;
    details.amountToFinance = Math.max(0, details.totalWithIva - downPayment);

    if (financingPlanKey !== 0 && details.amountToFinance > 0) {
      const planInfo = FINANCING_OPTIONS[financingPlanKey];
      if (planInfo) {
        details.financingInterestRateApplied = planInfo.rate;
        details.financingInterestAmount = details.amountToFinance * planInfo.rate;
        details.totalAmountWithInterest = details.amountToFinance + details.financingInterestAmount;
        const numberOfMonths = financingPlanKey;
        calculatedPaymentAmount = numberOfMonths > 0 ? details.totalAmountWithInterest / numberOfMonths : 0;
      }
    } else if (details.amountToFinance === 0 && financingPlanKey !== 0) {
      // Contract fully paid with down payment, but a plan was selected (e.g. for record)
      // No monthly payment needed if amountToFinance is 0
      calculatedPaymentAmount = 0;
    }
  }
  
  // Si no hay plan de financiación y no se ingresó un monto de pago, podría ser un error
  // pero la validación del schema/form debería haberlo cubierto.
  // Aquí solo nos aseguramos de que paymentAmount (cuota) tenga un valor.
  if (financingPlanKey === 0 && contractValue === 0 && (!formData.paymentAmount || formData.paymentAmount <= 0)) {
    // This case implies a recurring service with no contract value, paymentAmount is mandatory.
    // The schema should enforce `paymentAmount` to be positive if `financingPlan` is 0 and `contractValue` is 0.
    // For now, we assume `formData.paymentAmount` is valid if this path is reached.
     calculatedPaymentAmount = formData.paymentAmount || 0; // Default if not calculated by financing
  }


  details.paymentAmount = calculatedPaymentAmount;
  return details;
}


export async function createClientAction(formData: ClientFormData & { paymentAmount?: number }) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  const financingDetails = calculateFinancingDetails(validatedData);

  const clientToCreate = {
    ...validatedData,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!, // Ensure paymentAmount is set
    nextPaymentDate: calculateNextPaymentDate(validatedData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
  };

  const result = await store.addClient(clientToCreate as Omit<Client, 'id'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }

  revalidatePath('/dashboard');
  return { success: true, client: result.client };
}

export async function updateClientAction(id: string, formData: ClientFormData & { paymentAmount?: number }) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }
  
  const validatedData = validationResult.data;
  const financingDetails = calculateFinancingDetails(validatedData);

  const clientToUpdate = {
    ...validatedData,
    ...financingDetails,
    paymentAmount: financingDetails.paymentAmount!, // Ensure paymentAmount is set
    nextPaymentDate: calculateNextPaymentDate(validatedData.paymentDayOfMonth).toISOString(),
    // createdAt should not be updated
  };


  const result = await store.updateClient(id, clientToUpdate as Omit<Client, 'id' | 'createdAt'>);
  if (result.error) {
    return { success: false, generalError: result.error };
  }
  
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${id}/edit`);
  return { success: true, client: result.client };
}

export async function deleteClientAction(id: string) {
  const result = await store.deleteClient(id);
  if (result.error) {
    return { success: false, error: result.error };
  }
  revalidatePath('/dashboard');
  return { success: true };
}

export async function sendPaymentReminderEmailAction(client: Client) {
  const {
    EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD,
    EMAIL_FROM,
  } = process.env;

  if (!EMAIL_SERVER_HOST || !EMAIL_SERVER_PORT || !EMAIL_SERVER_USER || !EMAIL_SERVER_PASSWORD || !EMAIL_FROM) {
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
  const subject = client.paymentAmount > 0 ? `Recordatorio de Pago - ${formatCurrency(client.paymentAmount)}` : `Recordatorio Importante`;


  const mailOptions = {
    from: `"RecurPay" <${EMAIL_FROM}>`,
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
          <li>Plan: ${client.financingPlan} meses</li>
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
        <p><strong>El Equipo de RecurPay</strong></p>
        <hr style="border: none; border-top: 1px solid #E3F2FD; margin-top: 20px; margin-bottom: 10px;" />
        <p style="font-size: 0.8em; color: #777;">
          Este es un mensaje automático de RecurPay. Por favor, no responda directamente a este correo electrónico.
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
