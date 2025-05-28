
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { financingSettingsSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { AppFinancingSettings } from '@/types';

export async function fetchFinancingSettingsAction(): Promise<AppFinancingSettings> {
  // This action is simple, just calling the store function.
  // Error handling (like permission denied) is done in the store function and will propagate.
  return store.getFinancingPlanSettings();
}

export async function updateFinancingSettingsAction(formData: AppFinancingSettings) {
  const validationResult = financingSettingsSchema.safeParse(formData);

  if (!validationResult.success) {
    return { 
      success: false, 
      errors: validationResult.error.flatten().fieldErrors,
      generalError: "Error de validación. Por favor revise los campos."
    };
  }

  const result = await store.saveFinancingPlanSettings(validationResult.data);

  if (result.success) {
    revalidatePath('/settings'); // Revalidate settings page
    revalidatePath('/clients/new'); // Revalidate client form if it uses these settings
    revalidatePath('/clients', 'layout'); // Revalidate client list and edit pages potentially
    revalidatePath('/dashboard'); // Revalidate dashboard if it uses these settings
    return { success: true, message: "Configuración de financiación actualizada." };
  } else {
    return { success: false, generalError: result.error || "No se pudo actualizar la configuración." };
  }
}
