'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { clientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { Client, ClientFormData } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export async function createClientAction(formData: ClientFormData) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const result = await store.addClient(validationResult.data);
  if (result.error) {
    return { success: false, generalError: result.error };
  }

  revalidatePath('/dashboard');
  return { success: true, client: result.client };
}

export async function updateClientAction(id: string, formData: ClientFormData) {
  const validationResult = clientSchema.safeParse(formData);
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }

  const result = await store.updateClient(id, validationResult.data);
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
    console.error('Missing email configuration in .env. Please ensure EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, and EMAIL_FROM are set.');
    return { success: false, error: 'Email server not configured. Administrator has been notified.' };
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_SERVER_HOST,
    port: parseInt(EMAIL_SERVER_PORT, 10),
    secure: parseInt(EMAIL_SERVER_PORT, 10) === 465, // true for 465 (SSL), false for other ports (TLS/STARTTLS)
    auth: {
      user: EMAIL_SERVER_USER,
      pass: EMAIL_SERVER_PASSWORD,
    },
    tls: {
      // For Hostinger, sometimes explicit rejectUnauthorized: false is needed if there are SSL cert issues,
      // but it's better to ensure the server has valid certs. Start without it.
      // rejectUnauthorized: false 
    }
  });

  const mailOptions = {
    from: `"RecurPay" <${EMAIL_FROM}>`,
    to: client.email,
    subject: `Payment Reminder: Your Upcoming Payment for RecurPay`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #64B5F6;">Payment Reminder</h2>
        <p>Dear ${client.firstName} ${client.lastName},</p>
        <p>This is a friendly reminder that your recurring payment of <strong>${formatCurrency(client.paymentAmount)}</strong> is scheduled for <strong>${formatDate(client.nextPaymentDate)}</strong>.</p>
        <p><strong>Client Details:</strong></p>
        <ul>
          <li>Name: ${client.firstName} ${client.lastName}</li>
          <li>Email: ${client.email}</li>
          <li>Payment Amount: ${formatCurrency(client.paymentAmount)}</li>
          <li>Payment Due Date: ${formatDate(client.nextPaymentDate)}</li>
        </ul>
        <p>If you have already made this payment, please disregard this email. If you have any questions or need to update your payment information, please contact us.</p>
        <p>Thank you for your continued business!</p>
        <p>Sincerely,</p>
        <p><strong>The RecurPay Team</strong></p>
        <hr style="border: none; border-top: 1px solid #E3F2FD; margin-top: 20px; margin-bottom: 10px;" />
        <p style="font-size: 0.8em; color: #777;">
          This is an automated message from RecurPay. Please do not reply directly to this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.verify(); // Verify connection configuration
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { success: true, message: `Reminder email sent to ${client.email}` };
  } catch (error) {
    console.error('Error sending email:', error);
    // Provide a more generic error to the client for security
    let errorMessage = 'Failed to send email. Please try again later.';
    if (error instanceof Error && 'code' in error) {
        // nodemailer error codes https://nodemailer.com/usage/showcase/
        const nodemailerError = error as (Error & { code?: string });
        if (nodemailerError.code === 'EAUTH') {
            errorMessage = 'Failed to send email due to authentication error. Please check server credentials.';
        } else if (nodemailerError.code === 'ECONNREFUSED') {
            errorMessage = 'Failed to send email. Connection to email server refused.';
        }
    }
    return { success: false, error: errorMessage };
  }
}
