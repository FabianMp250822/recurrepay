
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

// --- Manual Firebase Function Trigger ---
export async function triggerManualReminderDispatchAction(): Promise<{ success: boolean, message: string }> {
  const functionUrl = process.env.FIREBASE_FUNCTION_REMINDER_URL;
  const functionKey = process.env.FIREBASE_FUNCTION_REMINDER_KEY;

  if (!functionUrl) {
    console.error("FIREBASE_FUNCTION_REMINDER_URL no está configurada en las variables de entorno.");
    return { success: false, message: "La URL de la función de recordatorios no está configurada en el servidor." };
  }

  let urlToCall = functionUrl;
  if (functionKey) {
    urlToCall += `?key=${encodeURIComponent(functionKey)}`;
  }

  console.log(`Attempting to trigger Firebase Function at: ${urlToCall.split('?')[0]} (key omitted for security)`);

  try {
    const response = await fetch(urlToCall, { method: 'GET' }); // O 'POST' si tu función lo espera y le envías un cuerpo

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error al llamar a la función de Firebase: ${response.status} ${response.statusText}`, errorText);
      return { success: false, message: `Error al ejecutar la función: ${response.status} - ${errorText || response.statusText}` };
    }

    const resultText = await response.text();
    console.log("Respuesta de la función de Firebase:", resultText);
    return { success: true, message: `Función de recordatorios ejecutada. Respuesta: ${resultText}` };

  } catch (error: any) {
    console.error("Error de red o desconocido al llamar a la función de Firebase:", error);
    return { success: false, message: `Error de conexión al ejecutar la función: ${error.message}` };
  }
}
