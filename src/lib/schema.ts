
import { z } from 'zod';

export const registrationSchema = z.object({
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string().min(6, { message: "La confirmación de contraseña debe tener al menos 6 caracteres." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),

  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({ message: "El valor del contrato debe ser un número positivo." }).optional()
  ),
  applyIva: z.boolean().optional().default(true),
  downPaymentPercentage: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().min(20, "El abono no puede ser menor al 20% para contratos >= $1M, o 0% si no hay abono.").max(100, "El porcentaje no puede exceder 100.").optional()
  ),
  paymentMethod: z.string().optional().or(z.literal('')),
  financingPlan: z.coerce.number()
    .optional().or(z.literal(0)),

  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  paymentAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().min(0, "El monto de pago no puede ser negativo.").optional()
  ),

  acceptanceLetterUrl: z.string().url("URL de carta de aceptación inválida.").optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().max(255, "Nombre de archivo muy largo.").optional().or(z.literal('')),
  contractFileUrl: z.string().url("URL de contrato inválida.").optional().or(z.literal('')),
  contractFileName: z.string().max(255, "Nombre de archivo muy largo.").optional().or(z.literal('')),

}).superRefine((data, ctx) => {
  const contractValue = data.contractValue ?? 0;
  const CONTRACT_VALUE_THRESHOLD = 1000000;
  const MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT = 20;

  if (contractValue > 0 && contractValue < CONTRACT_VALUE_THRESHOLD) {
    if (data.financingPlan !== 0 && data.financingPlan !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para contratos menores a $1,000,000, no se ofrece financiación.",
        path: ["financingPlan"],
      });
    }
    if (data.downPaymentPercentage !== 0 && data.downPaymentPercentage !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para contratos menores a $1,000,000, no se acepta abono inicial (debe ser 0%).",
        path: ["downPaymentPercentage"],
      });
    }
    // For contracts < 1M, paymentAmount should be the totalWithIva, this logic is handled in form/action.
  } else if (contractValue >= CONTRACT_VALUE_THRESHOLD) {
    if (data.downPaymentPercentage !== undefined && data.downPaymentPercentage !== 0 && data.downPaymentPercentage < MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El porcentaje de abono inicial debe ser 0% o al menos ${MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT}% para contratos de este valor.`,
        path: ["downPaymentPercentage"],
      });
    }
  }

  // Validate paymentAmount based on contract and financing
  if (contractValue === 0 && (data.financingPlan === 0 || data.financingPlan === undefined)) { // Pure service
    if (data.paymentAmount === undefined || data.paymentAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Se requiere un monto de pago recurrente positivo si no hay contrato ni financiación.",
        path: ["paymentAmount"],
      });
    }
  } else if (contractValue > 0 && (data.financingPlan === 0 || data.financingPlan === undefined) ) { // Contract, no financing
    if ((data.downPaymentPercentage ?? 0) < 100 && (data.paymentAmount === undefined || data.paymentAmount <= 0) && contractValue >= CONTRACT_VALUE_THRESHOLD) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Se requiere un monto de pago válido si el contrato no está totalmente cubierto por el abono y no hay financiación.",
            path: ["paymentAmount"],
         });
    }
    // If contractValue < CONTRACT_VALUE_THRESHOLD, paymentAmount is auto-calculated to totalWithIva.
    // Form/action logic should handle this, Zod here just ensures it's a number >= 0 if provided.
  }
  // If financingPlan is active, paymentAmount is auto-calculated. Zod just ensures it's a number >= 0 if provided (though form disables it).
});


export const basePublicClientObjectSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : parseFloat(String(val))),
    z.number().min(0, "El valor del contrato debe ser un número positivo o cero.")
  ),
  financingPlan: z.coerce.number({ required_error: "Debe seleccionar un plan de financiación.", invalid_type_error: "Plan de financiación inválido."}),
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),
  
  // Fields related to 'applyIva' and file uploads are handled programmatically by the form
  // and fully validated by the server action. These are optional at the base Zod object level
  // for flexibility in form schemas (e.g. using .pick()).
  applyIva: z.boolean().optional(),
  acceptanceLetterUrl: z.string().url("URL inválida para carta de aceptación.").optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().max(255, "Nombre de archivo muy largo.").optional().or(z.literal('')),
  contractFileUrl: z.string().url("URL inválida para contrato.").optional().or(z.literal('')),
  contractFileName: z.string().max(255, "Nombre de archivo muy largo.").optional().or(z.literal('')),
});

// Schema for server-side validation of the full public client data, including email.
export const publicClientSchema = basePublicClientObjectSchema.extend({
  email: z.string().email({ message: "Correo electrónico inválido." }),
  applyIva: z.boolean().optional().default(true), // Ensure applyIva is part of the validated data for the action.
}).refine(data => {
  // For public self-registration, financing is only applicable if contractValue > 0.
  // If contractValue is 0, financingPlan should ideally be 0 (no financing).
  if ((data.contractValue ?? 0) === 0 && data.financingPlan !== 0) {
    // This condition might be too strict or could be handled by defaulting financingPlan to 0 in the form
    // if contractValue is 0. For now, let's assume financingPlan 0 is valid for contractValue 0.
  }
  return true;
});


export const financingPlanSettingSchema = z.object({
  months: z.number().int(),
  label: z.string().min(1, "La etiqueta es requerida."),
  rate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : parseFloat(String(val))),
    z.number().min(0, "La tasa no puede ser negativa.").max(1, "La tasa debe ser un decimal entre 0 y 1 (ej. 0.05 para 5%).")
  ),
  isDefault: z.boolean().optional(),
  isConfigurable: z.boolean().optional(),
});

export const financingSettingsSchema = z.object({
  plans: z.array(financingPlanSettingSchema),
});

const hslColorString = z.string()
  .regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "El formato debe ser 'H S% L%' (ej: 207 88% 68%)")
  .optional()
  .or(z.literal(''));

export const generalSettingsSchema = z.object({
  appName: z.string().min(1, "El nombre de la aplicación es obligatorio.").max(50, "El nombre no puede exceder 50 caracteres.").optional().or(z.literal('')),
  appLogoUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
  notificationsEnabled: z.boolean().optional(),
  themePrimary: hslColorString,
  themeSecondary: hslColorString,
  themeAccent: hslColorString,
  themeBackground: hslColorString,
  themeForeground: hslColorString,
});
