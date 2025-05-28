'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { clientSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { ClientFormData } from '@/types';
import { generateEmailSubject } from '@/ai/flows/generate-email-subject';
import { getDaysUntilDue } from '@/lib/utils';

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

export async function generateReminderSubjectAction(clientName: string, paymentAmount: number, nextPaymentDate: string) {
  try {
    const daysUntilDue = getDaysUntilDue(nextPaymentDate);
    if (daysUntilDue < 0) {
        return { success: false, error: "Payment date is in the past." };
    }
    const subjectOutput = await generateEmailSubject({
      clientName,
      paymentAmount,
      daysUntilDue,
    });
    return { success: true, subject: subjectOutput.subject };
  } catch (error) {
    console.error("Error generating email subject:", error);
    return { success: false, error: "Failed to generate email subject." };
  }
}
