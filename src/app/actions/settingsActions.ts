
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { financingSettingsSchema, generalSettingsSchema } from '@/lib/schema';
import * as store from '@/lib/store';
import type { AppFinancingSettings, AppGeneralSettings, AppGeneralSettingsFormData } from '@/types';

// --- Financing Settings Actions ---
export async function fetchFinancingSettingsAction(): Promise<AppFinancingSettings> {
  return store.getFinancingPlanSettings();
}

export async function updateFinancingSettingsAction(formData: AppFinancingSettings) {
  const validationResult = financingSettingsSchema.safeParse(formData);

  if (!validationResult.success) {
    return { 
      success: false, 
      errors: validationResult.error.flatten().fieldErrors,
      generalError: "Error de validación en configuración de financiación. Por favor revise los campos."
    };
  }

  const result = await store.saveFinancingPlanSettings(validationResult.data);

  if (result.success) {
    revalidatePath('/settings'); 
    revalidatePath('/clients/new'); 
    revalidatePath('/clients', 'layout'); 
    revalidatePath('/dashboard'); 
    return { success: true, message: "Configuración de financiación actualizada." };
  } else {
    return { success: false, generalError: result.error || "No se pudo actualizar la configuración de financiación." };
  }
}


// --- General App Settings Actions ---
export async function fetchGeneralSettingsAction(): Promise<AppGeneralSettings> {
  return store.getGeneralSettings();
}

export async function updateGeneralSettingsAction(formData: AppGeneralSettingsFormData) {
  // Map AppGeneralSettingsFormData to AppGeneralSettings for Zod validation
  const dataToValidate: Partial<AppGeneralSettings> = {
    appName: formData.appName,
    appLogoUrl: formData.appLogoUrl, 
    notificationsEnabled: formData.notificationsEnabled,
    themePrimary: formData.themePrimary,
    themeSecondary: formData.themeSecondary,
    themeAccent: formData.themeAccent,
    themeBackground: formData.themeBackground,
    themeForeground: formData.themeForeground,
  };

  const validationResult = generalSettingsSchema.safeParse(dataToValidate);

  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    console.error("Validation errors general settings:", fieldErrors);
    return {
      success: false,
      errors: fieldErrors,
      generalError: "Error de validación en configuración general. Por favor revise los campos."
    };
  }

  const result = await store.saveGeneralSettings(validationResult.data as AppGeneralSettings);

  if (result.success) {
    revalidatePath('/settings');
    revalidatePath('/', 'layout'); 
    return { success: true, message: "Configuración general actualizada." };
  } else {
    return { success: false, generalError: result.error || "No se pudo actualizar la configuración general." };
  }
}
